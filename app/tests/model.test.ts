import { describe, expect, it } from 'vitest';
import { MAT, defaultParams, pieceDims, pieceWeight, profileStr, sectionArea } from '../src/model/materials';
import { barUtilization, calcBOM, packBars } from '../src/model/bom';
import { convertV2, normalizeV3, parseProject } from '../src/model/serialize';
import type { PieceData, ProjectState } from '../src/model/types';

const piece = (over: Partial<PieceData> = {}): PieceData => ({
  id: 1, type: 'tube_square', params: { L: 1000, a: 30, e: 1.6 },
  color: '#555', opacity: 1, visible: true, name: 'Test', groupId: null,
  ...over,
});

describe('materiales', () => {
  it('área de sección del tubo cuadrado 30×30×1.6', () => {
    // 30² − 26.8² = 900 − 718.24 = 181.76 mm²
    expect(sectionArea(piece())).toBeCloseTo(181.76, 2);
  });

  it('peso del tubo cuadrado ≈ 1.427 kg/m', () => {
    expect(pieceWeight(piece())).toBeCloseTo(1.4268, 3);
  });

  it('peso del tubo redondo Ø30×1.6', () => {
    const p = piece({ type: 'tube_round', params: { L: 1000, d: 30, e: 1.6 } });
    // área = π/4 (30² − 26.8²) = π/4 · 181.76 ≈ 142.76 mm² → 1.121 kg/m
    expect(pieceWeight(p)).toBeCloseTo(1.1206, 3);
  });

  it('peso del ángulo 40×40×4: e(2a−e) = 4·76 = 304 mm²', () => {
    const p = piece({ type: 'angle', params: { L: 1000, a: 40, e: 4 } });
    expect(sectionArea(p)).toBe(304);
    expect(pieceWeight(p)).toBeCloseTo(2.386, 2);
  });

  it('madera usa densidad 600', () => {
    const p = piece({ type: 'wood', params: { L: 1000, w: 300, e: 18 } });
    expect(pieceWeight(p)).toBeCloseTo(300 * 18 * 1000 * 600e-9, 4);
  });

  it('espesor mayor a la mitad del perfil no rompe (sección maciza)', () => {
    const p = piece({ params: { L: 1000, a: 30, e: 99 } });
    expect(sectionArea(p)).toBe(900);
  });

  it('dims y perfil', () => {
    expect(pieceDims(piece())).toEqual([1000, 30, 30]);
    expect(profileStr(piece())).toBe('30×30×1.6');
    const rect = piece({ type: 'tube_rect', params: { L: 500, w: 40, h: 20, e: 1.6 } });
    expect(pieceDims(rect)).toEqual([500, 40, 20]);
    expect(profileStr(rect)).toBe('40×20×1.6');
  });

  it('defaultParams cubre todos los tipos', () => {
    for (const t of Object.keys(MAT) as (keyof typeof MAT)[]) {
      const params = defaultParams(t, 800);
      expect(params.L).toBe(800);
      expect(sectionArea({ type: t, params })).toBeGreaterThan(0);
    }
  });
});

describe('BOM', () => {
  it('agrupa por tipo y perfil', () => {
    const pieces = [
      piece({ id: 1 }),
      piece({ id: 2, params: { L: 500, a: 30, e: 1.6 } }),
      piece({ id: 3, params: { L: 500, a: 20, e: 1.6 } }), // perfil distinto
      piece({ id: 4, type: 'wood', params: { L: 1200, w: 600, e: 25 } }),
    ];
    const bom = calcBOM(pieces);
    expect(bom).toHaveLength(3);
    const g30 = bom.find(g => g.prof === '30×30×1.6')!;
    expect(g30.count).toBe(2);
    expect(g30.totalLen).toBe(1500);
    const wood = bom.find(g => g.type === 'wood')!;
    expect(wood.linear).toBe(false);
    expect(wood.totalArea).toBeCloseTo(0.72, 5);
  });

  it('packBars: first-fit decreasing con kerf', () => {
    const bars = packBars([2000, 2000, 2000], 6000, 3);
    // 2000 + 3 + 2000 + 3 + 2000 = 6006 > 6000 → 2 barras
    expect(bars).toHaveLength(2);
    expect(bars[0].cuts).toEqual([2000, 2000]);
    expect(bars[1].cuts).toEqual([2000]);
  });

  it('packBars: corte imposible queda marcado', () => {
    const bars = packBars([7000, 1000], 6000, 3);
    expect(bars.find(b => b.over)?.cuts).toEqual([7000]);
    expect(bars.filter(b => !b.over)).toHaveLength(1);
  });

  it('packBars sin kerf llena la barra exacta', () => {
    const bars = packBars([3000, 3000], 6000, 0);
    expect(bars).toHaveLength(1);
    expect(barUtilization(bars, 6000)).toBe(100);
  });
});

describe('serialización', () => {
  it('normalizeV3 filtra piezas corruptas y arregla contadores', () => {
    const dirty = {
      version: 3, idCounter: 0, groupCounter: 0,
      groups: [{ id: 1, name: '', pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }],
      pieces: [
        { id: 7, type: 'tube_square', params: { L: 100, a: 30, e: 1.6 }, groupId: 99, pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
        { id: 8, type: 'no_existe', params: { L: 100 } },
        { id: 9, type: 'wood', params: { L: -5, w: 10, e: 2 } },
      ],
    } as unknown as ProjectState;
    const clean = normalizeV3(dirty);
    expect(clean.pieces).toHaveLength(1);
    expect(clean.pieces[0].groupId).toBeNull(); // grupo 99 no existe
    expect(clean.idCounter).toBe(7);
    expect(clean.groups[0].name).toBe('Grupo 1');
  });

  it('convertV2 hornea la escala en los parámetros', () => {
    const v2 = {
      version: 2, idCounter: 2, groupCounter: 1,
      groups: [{ id: 1, name: 'Grupo 1' }],
      pieces: [
        {
          id: 1, type: 'iron_structural_square', length: 1000, width: 30, height: 30,
          color: '#3e3e46', opacity: 1, name: 'X #1', groupId: 1,
          pos: { x: 0, y: 15, z: 0 }, rot: { x: 0, y: 0, z: 0 }, scale: { x: 1.5, y: 1, z: 1 },
        },
        {
          id: 2, type: 'wood', length: 800, width: 300, height: 18,
          color: '#d4b896', opacity: 0.5, name: 'W #2', groupId: 1,
          pos: { x: 0, y: 100, z: 0 }, rot: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
        },
      ],
    };
    const v3 = convertV2(v2);
    expect(v3.pieces[0].params).toEqual({ L: 1500, a: 30, e: 1.6 });
    expect(v3.pieces[1].params).toEqual({ L: 800, w: 300, e: 18 });
    expect(v3.pieces[1].opacity).toBe(0.5);
    expect(v3.pieces[0].groupId).toBe(1);
    expect(v3.groups).toHaveLength(1);
  });

  it('parseProject acepta v3 y v2, rechaza basura', () => {
    const v3: ProjectState = {
      version: 3, idCounter: 1, groupCounter: 0, groups: [],
      pieces: [{ ...piece(), pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }],
    };
    expect(parseProject(JSON.stringify(v3)).pieces).toHaveLength(1);
    expect(() => parseProject('{"cosa": true}')).toThrow();
  });

  it('round-trip v3: serializar → parsear conserva datos', () => {
    const v3: ProjectState = {
      version: 3, idCounter: 5, groupCounter: 2,
      groups: [{ id: 2, name: 'Mesa', pos: { x: 10, y: 20, z: 30 }, rot: { x: 0, y: 1.5, z: 0 } }],
      pieces: [{
        ...piece({ id: 5, groupId: 2 }),
        pos: { x: 1, y: 2, z: 3 }, rot: { x: 0.1, y: 0.2, z: 0.3 },
      }],
    };
    const back = parseProject(JSON.stringify(v3));
    expect(back).toEqual({ ...v3, app: 'ferromadera' });
  });
});
