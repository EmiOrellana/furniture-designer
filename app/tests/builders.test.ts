import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPieceMesh, setOpacity } from '../src/scene/builders';
import type { PieceData } from '../src/model/types';

const piece = (over: Partial<PieceData> = {}): PieceData => ({
  id: 1, type: 'tube_square', params: { L: 1000, a: 30, e: 1.6 },
  color: '#5a5f6b', opacity: 1, visible: true, name: 'Test', groupId: null,
  ...over,
});

/** Todos los materiales de malla del subárbol. */
function materials(obj: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  obj.traverse(c => {
    if ((c as THREE.Mesh).isMesh) out.push((c as THREE.Mesh).material as THREE.MeshStandardMaterial);
  });
  return out;
}

describe('materiales de las piezas', () => {
  it('una pieza opaca no es transparente y escribe profundidad', () => {
    const m = materials(buildPieceMesh(piece()))[0];
    expect(m.transparent).toBe(false);
    expect(m.opacity).toBe(1);
    expect(m.depthWrite).toBe(true);
  });

  it('una pieza creada translúcida ya nace configurada', () => {
    const m = materials(buildPieceMesh(piece({ opacity: 0.4 })))[0];
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBe(0.4);
    expect(m.depthWrite).toBe(false);
  });

  /**
   * Regresión: pasar de opaco a translúcido cambia cómo se compila el
   * material. Sin `needsUpdate` el visor lo seguía dibujando opaco, aunque
   * las propiedades fueran correctas (los exportados sí se veían bien porque
   * clonan los materiales).
   */
  it('volver translúcida una pieza opaca marca el material para recompilar', () => {
    const mesh = buildPieceMesh(piece());
    const m = materials(mesh)[0];
    const before = m.version;

    setOpacity(mesh, 0.3);

    expect(m.transparent).toBe(true);
    expect(m.opacity).toBe(0.3);
    expect(m.depthWrite).toBe(false);
    expect(m.version).toBeGreaterThan(before);
  });

  it('volver a opaca también recompila', () => {
    const mesh = buildPieceMesh(piece({ opacity: 0.3 }));
    const m = materials(mesh)[0];
    const before = m.version;

    setOpacity(mesh, 1);

    expect(m.transparent).toBe(false);
    expect(m.opacity).toBe(1);
    expect(m.depthWrite).toBe(true);
    expect(m.version).toBeGreaterThan(before);
  });

  it('ajustar la opacidad sin cruzar el umbral no recompila de más', () => {
    const mesh = buildPieceMesh(piece({ opacity: 0.5 }));
    const m = materials(mesh)[0];
    const before = m.version;

    setOpacity(mesh, 0.2); // sigue siendo translúcida

    expect(m.opacity).toBe(0.2);
    expect(m.version).toBe(before);
  });

  it('alcanza a todas las mallas de una pieza compuesta (ángulo)', () => {
    const mesh = buildPieceMesh(piece({ type: 'angle', params: { L: 1000, a: 40, e: 4 } }));
    const mats = materials(mesh);
    expect(mats.length).toBe(2); // el perfil L son dos alas

    setOpacity(mesh, 0.25);

    for (const m of mats) {
      expect(m.transparent).toBe(true);
      expect(m.opacity).toBe(0.25);
    }
  });
});
