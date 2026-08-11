import type { PieceParams, PieceSnapshot, PieceType, ProjectState, Vec3 } from './types';
import { MAT, profileStr } from './materials';

/**
 * Un `.fmd` es JSON de origen desconocido: los tipos de `ProjectState` son una
 * promesa que el archivo no está obligado a cumplir. Todo lo que entra por acá
 * se valida campo por campo antes de tocar la escena.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Medida: número finito y positivo, o el valor del catálogo. */
function dim(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : def;
}

/** Coordenada: número finito, o cero. Un NaN suelto envenena toda la escena
 *  —caja envolvente, encuadre y exportados— sin dejar rastro visible. */
function coord(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function vec3(v: unknown): Vec3 {
  const o = (v ?? {}) as Partial<Vec3>;
  return { x: coord(o.x), y: coord(o.y), z: coord(o.z) };
}

/** Parámetros del tipo, con los del catálogo como red. Descarta claves ajenas
 *  y cualquier valor que no sea un número positivo. */
function sanitizeParams(type: PieceType, raw: unknown, L: number): PieceParams {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: PieceParams = { L };
  for (const f of MAT[type].fields) out[f.key] = dim(src[f.key], f.def);
  return out;
}

/** Valida a grandes rasgos un proyecto cargado desde archivo. */
export function isProject(data: unknown): data is ProjectState & { version?: number } {
  return !!data && typeof data === 'object' && Array.isArray((data as ProjectState).pieces);
}

/** Normaliza un proyecto v3 (rellena valores faltantes, filtra corruptos). */
export function normalizeV3(data: ProjectState): ProjectState {
  const groups = (data.groups ?? [])
    .filter(g => g && Number.isFinite(g.id))
    .map(g => ({
      id: g.id,
      // El modelo no traduce, así que el relleno no puede llevar idioma: es un
      // marcador para un grupo que llegó sin nombre, no un nombre de verdad.
      name: typeof g.name === 'string' && g.name ? g.name : `G${g.id}`,
      pos: vec3(g.pos),
      rot: vec3(g.rot),
    }));
  const validGids = new Set(groups.map(g => g.id));
  const pieces: PieceSnapshot[] = (data.pieces ?? [])
    .filter(p => p && p.type in MAT && Number.isFinite(p.id) && dim(p.params?.L, 0) > 0)
    .map(p => {
      const type = p.type;
      const params = sanitizeParams(type, p.params, p.params.L);
      return {
        id: p.id,
        type,
        params,
        color: typeof p.color === 'string' && HEX_COLOR.test(p.color) ? p.color : MAT[type].color,
        opacity: Math.min(1, Math.max(0, coord(p.opacity ?? 1))),
        visible: p.visible !== false,
        // Antes esto ponía `MAT[type].label`, que es una CLAVE de i18n: una
        // pieza sin nombre salía llamada "mat.tube_square #3". El perfil no
        // depende del idioma y además dice algo útil en el taller.
        name: typeof p.name === 'string' && p.name ? p.name : `${profileStr({ type, params })} #${p.id}`,
        groupId: p.groupId != null && validGids.has(p.groupId) ? p.groupId : null,
        pos: vec3(p.pos),
        rot: vec3(p.rot),
      };
    });
  const maxPieceId = pieces.reduce((m, p) => Math.max(m, p.id), 0);
  const maxGroupId = groups.reduce((m, g) => Math.max(m, g.id), 0);
  return {
    version: 3, app: 'ferromadera',
    idCounter: Math.max(data.idCounter ?? 0, maxPieceId),
    groupCounter: Math.max(data.groupCounter ?? 0, maxGroupId),
    groups, pieces,
  };
}

/* ── Formato v2 (FerroMadera 1) ─────────────────────────────── */

interface V2Piece {
  id: number; type: string;
  length: number; width: number; height: number;
  color: string; opacity?: number; name?: string;
  groupId?: number | null;
  pos: { x: number; y: number; z: number };
  rot: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}
interface V2Project {
  version?: number;
  idCounter?: number; groupCounter?: number;
  groups?: { id: number; name: string }[];
  pieces: V2Piece[];
}

const V2_TYPE_MAP: Record<string, PieceType> = {
  iron_structural_square: 'tube_square',
  iron_structural_round: 'tube_round',
  iron_angle: 'angle',
  wood: 'wood',
};

/**
 * Convierte un proyecto del FerroMadera original.
 * La escala del mesh se "hornea" en los parámetros reales.
 */
export function convertV2(data: V2Project): ProjectState {
  const pieces: PieceSnapshot[] = (data.pieces ?? []).map(s => {
    const sc = s.scale ?? { x: 1, y: 1, z: 1 };
    const type = V2_TYPE_MAP[s.type] ?? 'tube_square';
    const L = Math.round(s.length * sc.x);
    let params;
    if (type === 'tube_square')     params = { L, a: Math.round(s.width * sc.z), e: 1.6 };
    else if (type === 'tube_round') params = { L, d: Math.round(s.width * sc.z), e: 1.6 };
    else if (type === 'angle')      params = { L, a: Math.round(s.width * sc.z), e: 4 };
    else                            params = { L, w: Math.round(s.width * sc.z), e: Math.round(s.height * sc.y) };
    return {
      id: s.id, type, params,
      color: s.color, opacity: s.opacity ?? 1, visible: true,
      // Vacío a propósito: el relleno lo pone `normalizeV3`, que es el único
      // que sabe cómo se nombra una pieza sin nombre.
      name: s.name ?? '',
      groupId: s.groupId ?? null,
      pos: s.pos, rot: s.rot,
    };
  });
  // Los grupos v2 no tenían transformación propia: un grupo en el origen
  // conserva las posiciones mundiales de los miembros como locales.
  const groups = (data.groups ?? []).map(g => ({
    id: g.id, name: g.name,
    pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 },
  }));
  return normalizeV3({
    version: 3,
    idCounter: data.idCounter ?? 0,
    groupCounter: data.groupCounter ?? 0,
    groups, pieces,
  });
}

/**
 * Error de carga con la clave i18n del motivo. El modelo no traduce, así que
 * entrega la clave y la interfaz decide en qué idioma decirlo.
 */
export class ProjectError extends Error {
  constructor(readonly key: string, readonly vars?: Record<string, string | number>) {
    super(key);
    this.name = 'ProjectError';
  }
}

/** Carga un proyecto desde texto JSON (v2 o v3). Lanza si es inválido. */
export function parseProject(text: string): ProjectState {
  const data = JSON.parse(text);
  if (!isProject(data)) throw new ProjectError('err.notProject');
  const version = typeof data.version === 'number' ? data.version : 2;
  if (version === 3) return normalizeV3(data as ProjectState);
  // Sólo lo anterior a v3 se convierte. Un formato más nuevo se rechaza en vez
  // de pasarlo por el conversor de v2, que lo destrozaría en silencio.
  if (version > 3) throw new ProjectError('err.futureVersion', { v: version });
  return convertV2(data as unknown as V2Project);
}
