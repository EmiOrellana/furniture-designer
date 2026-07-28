import type { PieceData, PieceParams, PieceType } from './types';

/** `label` es una clave i18n (ver app/i18n.ts) — el modelo es neutro al idioma. */
export interface FieldDef { key: string; label: string; def: number; }

export interface MaterialDef {
  /** clave i18n del nombre del material */
  label: string;
  /** clave i18n de la descripción corta */
  hint: string;
  color: string;
  /** true = se compra por metro lineal; false = por superficie (m²). */
  linear: boolean;
  /** densidad en kg/m³ */
  density: number;
  fields: FieldDef[];
  /** id del símbolo SVG con la sección del perfil */
  icon: string;
}

export const DENSITY_STEEL = 7850;
export const DENSITY_WOOD = 600;

export const MAT: Record<PieceType, MaterialDef> = {
  tube_square: {
    label: 'mat.tube_square', hint: 'hint.tube_square',
    color: '#5a5f6b', linear: true, density: DENSITY_STEEL, icon: 'sec-square',
    fields: [
      { key: 'a', label: 'f.profile', def: 30 },
      { key: 'e', label: 'f.wall', def: 1.6 },
    ],
  },
  tube_rect: {
    label: 'mat.tube_rect', hint: 'hint.tube_rect',
    color: '#5a5f6b', linear: true, density: DENSITY_STEEL, icon: 'sec-rect',
    fields: [
      { key: 'w', label: 'f.base', def: 40 },
      { key: 'h', label: 'f.height', def: 20 },
      { key: 'e', label: 'f.wall', def: 1.6 },
    ],
  },
  tube_round: {
    label: 'mat.tube_round', hint: 'hint.tube_round',
    color: '#565e70', linear: true, density: DENSITY_STEEL, icon: 'sec-round',
    fields: [
      { key: 'd', label: 'f.diameter', def: 30 },
      { key: 'e', label: 'f.wall', def: 1.6 },
    ],
  },
  angle: {
    label: 'mat.angle', hint: 'hint.angle',
    color: '#525763', linear: true, density: DENSITY_STEEL, icon: 'sec-angle',
    fields: [
      { key: 'a', label: 'f.wing', def: 40 },
      { key: 'e', label: 'f.thickness', def: 4 },
    ],
  },
  flat: {
    label: 'mat.flat', hint: 'hint.flat',
    color: '#616671', linear: true, density: DENSITY_STEEL, icon: 'sec-flat',
    fields: [
      { key: 'w', label: 'f.width', def: 30 },
      { key: 'e', label: 'f.thickness', def: 4 },
    ],
  },
  wood: {
    label: 'mat.wood', hint: 'hint.wood',
    color: '#c9a06c', linear: false, density: DENSITY_WOOD, icon: 'sec-wood',
    fields: [
      { key: 'w', label: 'f.width', def: 300 },
      { key: 'e', label: 'f.thickness', def: 18 },
    ],
  },
};

export const PIECE_TYPES = Object.keys(MAT) as PieceType[];

type Dimensioned = Pick<PieceData, 'type' | 'params'>;

/** Caja envolvente [Largo(X), Ancho(Z), Alto(Y)] en mm. */
export function pieceDims(p: Dimensioned): [number, number, number] {
  const q = p.params;
  switch (p.type) {
    case 'tube_square': return [q.L, q.a!, q.a!];
    case 'tube_rect':   return [q.L, q.w!, q.h!];
    case 'tube_round':  return [q.L, q.d!, q.d!];
    case 'angle':       return [q.L, q.a!, q.a!];
    case 'flat':        return [q.L, q.w!, q.e!];
    case 'wood':        return [q.L, q.w!, q.e!];
  }
}

/** Área de la sección transversal en mm² (para peso). */
export function sectionArea(p: Dimensioned): number {
  const q = p.params;
  switch (p.type) {
    case 'tube_square': {
      const e = Math.min(q.e!, q.a! / 2);
      return q.a! * q.a! - (q.a! - 2 * e) * (q.a! - 2 * e);
    }
    case 'tube_rect': {
      const e = Math.min(q.e!, Math.min(q.w!, q.h!) / 2);
      return q.w! * q.h! - (q.w! - 2 * e) * (q.h! - 2 * e);
    }
    case 'tube_round': {
      const e = Math.min(q.e!, q.d! / 2);
      return (Math.PI / 4) * (q.d! * q.d! - (q.d! - 2 * e) * (q.d! - 2 * e));
    }
    case 'angle': return q.e! * (2 * q.a! - q.e!);
    case 'flat':  return q.w! * q.e!;
    case 'wood':  return q.w! * q.e!;
  }
}

/** Peso de la pieza en kg. */
export function pieceWeight(p: Dimensioned): number {
  return sectionArea(p) * p.params.L * MAT[p.type].density * 1e-9;
}

/** Descripción del perfil comercial, p.ej. "30×30×1.6". */
export function profileStr(p: Dimensioned): string {
  const q = p.params;
  switch (p.type) {
    case 'tube_square': return `${q.a}×${q.a}×${q.e}`;
    case 'tube_rect':   return `${q.w}×${q.h}×${q.e}`;
    case 'tube_round':  return `Ø${q.d}×${q.e}`;
    case 'angle':       return `${q.a}×${q.a}×${q.e}`;
    case 'flat':        return `${q.w}×${q.e}`;
    case 'wood':        return `${q.w}×${q.e}`;
  }
}

/** Valores por defecto de parámetros para un tipo. */
export function defaultParams(type: PieceType, L = 1000): PieceParams {
  const params: PieceParams = { L };
  for (const f of MAT[type].fields) params[f.key] = f.def;
  return params;
}
