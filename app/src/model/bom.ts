import type { PieceData, PieceType } from './types';
import { MAT, pieceWeight, profileStr } from './materials';

export interface BomGroup {
  key: string;
  type: PieceType;
  prof: string;
  label: string;
  linear: boolean;
  count: number;
  /** mm lineales totales */
  totalLen: number;
  /** m² totales (solo placas) */
  totalArea: number;
  /** kg totales */
  weight: number;
  cuts: number[];
  list: PieceData[];
}

/** Agrupa las piezas por tipo + perfil comercial. */
export function calcBOM(pieces: PieceData[]): BomGroup[] {
  const map = new Map<string, BomGroup>();
  for (const p of pieces) {
    const prof = profileStr(p);
    const key = `${p.type}|${prof}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, type: p.type, prof, label: MAT[p.type].label,
        linear: MAT[p.type].linear,
        count: 0, totalLen: 0, totalArea: 0, weight: 0, cuts: [], list: [],
      };
      map.set(key, g);
    }
    g.count++;
    g.totalLen += p.params.L;
    g.totalArea += (p.params.L * (p.params.w ?? 0)) / 1e6;
    g.weight += pieceWeight(p);
    g.cuts.push(p.params.L);
    g.list.push(p);
  }
  return [...map.values()];
}

export interface Bar {
  cuts: number[];
  /** mm consumidos (cortes + kerf) */
  used: number;
  /** true si el corte no entra en una barra */
  over: boolean;
}

/**
 * Distribuye cortes en barras comerciales (first-fit decreasing).
 * `kerf` = material que se pierde en cada corte.
 */
export function packBars(cuts: number[], barLen: number, kerf: number): Bar[] {
  const sorted = [...cuts].sort((a, b) => b - a);
  const bars: Bar[] = [];
  for (const L of sorted) {
    if (L > barLen) {
      bars.push({ cuts: [L], used: L, over: true });
      continue;
    }
    let placed = false;
    for (const b of bars) {
      if (b.over) continue;
      const need = L + (b.cuts.length ? kerf : 0);
      if (b.used + need <= barLen) {
        b.cuts.push(L);
        b.used += need;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ cuts: [L], used: L, over: false });
  }
  return bars;
}

/** % de aprovechamiento de las barras completas (sin contar cortes imposibles). */
export function barUtilization(bars: Bar[], barLen: number): number {
  const usable = bars.filter(b => !b.over);
  if (usable.length === 0) return 0;
  return (usable.reduce((s, b) => s + b.used, 0) / (usable.length * barLen)) * 100;
}
