import type { PieceSnapshot, PieceType, ProjectState } from './types';
import { MAT } from './materials';

/** Valida a grandes rasgos un proyecto cargado desde archivo. */
export function isProject(data: unknown): data is ProjectState & { version?: number } {
  return !!data && typeof data === 'object' && Array.isArray((data as ProjectState).pieces);
}

/** Normaliza un proyecto v3 (rellena valores faltantes, filtra corruptos). */
export function normalizeV3(data: ProjectState): ProjectState {
  const groups = (data.groups ?? []).map(g => ({
    id: g.id, name: g.name || `Grupo ${g.id}`,
    pos: g.pos ?? { x: 0, y: 0, z: 0 },
    rot: g.rot ?? { x: 0, y: 0, z: 0 },
  }));
  const validGids = new Set(groups.map(g => g.id));
  const pieces = (data.pieces ?? [])
    .filter(p => p && p.type in MAT && p.params && p.params.L > 0)
    .map(p => ({
      ...p,
      opacity: p.opacity ?? 1,
      visible: p.visible !== false,
      color: p.color || MAT[p.type].color,
      name: p.name || `${MAT[p.type].label} #${p.id}`,
      groupId: p.groupId != null && validGids.has(p.groupId) ? p.groupId : null,
      pos: p.pos ?? { x: 0, y: 0, z: 0 },
      rot: p.rot ?? { x: 0, y: 0, z: 0 },
    }));
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
      name: s.name ?? `${MAT[type].label} #${s.id}`,
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

/** Carga un proyecto desde texto JSON (v2 o v3). Lanza si es inválido. */
export function parseProject(text: string): ProjectState {
  const data = JSON.parse(text);
  if (!isProject(data)) throw new Error('El archivo no es un proyecto FerroMadera');
  if (data.version === 3) return normalizeV3(data as ProjectState);
  return convertV2(data as unknown as V2Project);
}
