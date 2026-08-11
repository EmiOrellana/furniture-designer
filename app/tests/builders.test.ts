import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildPieceMesh, cloneForExport, disposeClonedMaterials, mirrorObject,
  setOpacity, stripLines, visibleMeshes,
} from '../src/scene/builders';
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

/**
 * Regresión: ocultar una pieza apaga sólo su objeto raíz. En el ángulo, que es
 * un grupo con dos alas, las mallas hijas seguían con `visible = true`, y como
 * Three.js no mira la visibilidad al lanzar rayos, la pieza oculta se seguía
 * pudiendo seleccionar y medir en el viewport.
 */
describe('mallas visibles', () => {
  const angle = (over: Partial<PieceData> = {}): PieceData =>
    piece({ type: 'angle', params: { L: 1000, a: 40, e: 4 }, ...over });

  /** Raíz de escena con las piezas dadas, como la usa el visor. */
  function sceneWith(...meshes: THREE.Object3D[]): THREE.Group {
    const root = new THREE.Group();
    for (const m of meshes) root.add(m);
    return root;
  }

  it('una pieza simple visible aporta su malla', () => {
    const root = sceneWith(buildPieceMesh(piece()));
    expect(visibleMeshes(root).length).toBe(1);
  });

  it('un ángulo visible aporta sus dos alas', () => {
    const root = sceneWith(buildPieceMesh(angle()));
    expect(visibleMeshes(root).length).toBe(2);
  });

  it('una pieza simple oculta no aporta nada', () => {
    const root = sceneWith(buildPieceMesh(piece({ visible: false })));
    expect(visibleMeshes(root)).toEqual([]);
  });

  it('un ángulo oculto no aporta ninguna de sus alas', () => {
    const root = sceneWith(buildPieceMesh(angle({ visible: false })));
    expect(visibleMeshes(root)).toEqual([]);
  });

  it('apagar la raíz después de construirla también lo oculta', () => {
    const mesh = buildPieceMesh(angle());
    const root = sceneWith(mesh);
    expect(visibleMeshes(root).length).toBe(2);

    mesh.visible = false; // lo que hace el botón del ojo

    expect(visibleMeshes(root)).toEqual([]);
  });

  it('ocultar un grupo oculta a sus miembros', () => {
    const grp = new THREE.Group();
    grp.add(buildPieceMesh(piece()));
    grp.add(buildPieceMesh(angle()));
    const root = sceneWith(grp);
    expect(visibleMeshes(root).length).toBe(3);

    grp.visible = false;

    expect(visibleMeshes(root)).toEqual([]);
  });

  it('una pieza oculta no tapa a las visibles', () => {
    const root = sceneWith(
      buildPieceMesh(piece({ id: 1, visible: false })),
      buildPieceMesh(piece({ id: 2 })),
    );
    const targets = visibleMeshes(root);
    expect(targets.length).toBe(1);
    expect(targets[0].userData.pieceId).toBe(2);
  });

  it('pedida sobre una pieza suelta se incluye a sí misma', () => {
    // Lo usa el encuadre de la selección, que parte de la pieza, no de la raíz.
    expect(visibleMeshes(buildPieceMesh(piece())).length).toBe(1);
    expect(visibleMeshes(buildPieceMesh(angle())).length).toBe(2);
    expect(visibleMeshes(buildPieceMesh(piece({ visible: false })))).toEqual([]);
  });
});

/**
 * Regresión: el espejado negaba dos ángulos de Euler, lo que equivale a
 * R' = S·R·S. Eso da la reflexión correcta sólo si la geometría es simétrica
 * respecto del eje espejado, cosa que cumplen todos los perfiles menos uno: el
 * **ángulo espejado en Z**, cuya sección en L no es simétrica en Z, salía con la
 * orientación equivocada. La rotación de partida no tenía nada que ver.
 *
 * El caso `ángulo` + `z` es el único que distinguía la fórmula vieja de la
 * correcta, y por eso está acá abajo con las dos combinaciones de eje.
 *
 * La prueba no mira ángulos: compara cajas envolventes en mundiales. Si el
 * espejado es correcto, la caja de la copia es la reflexión exacta de la
 * original, cualquiera sea la rotación de partida.
 */
describe('espejado', () => {
  function worldBox(o: THREE.Object3D): THREE.Box3 {
    o.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(o);
  }

  function expectReflected(orig: THREE.Box3, copia: THREE.Box3, axis: 'x' | 'z'): void {
    const s = { x: axis === 'x' ? -1 : 1, y: 1, z: axis === 'z' ? -1 : 1 };
    for (const k of ['x', 'y', 'z'] as const) {
      const a = orig.min[k] * s[k], b = orig.max[k] * s[k];
      expect(copia.min[k], `min.${k}`).toBeCloseTo(Math.min(a, b), 6);
      expect(copia.max[k], `max.${k}`).toBeCloseTo(Math.max(a, b), 6);
    }
  }

  /** Dos copias idénticas de una pieza con la rotación y posición dadas. */
  function par(data: PieceData, pos: [number, number, number], rot: [number, number, number]) {
    return [0, 1].map(() => {
      const m = buildPieceMesh(data);
      m.position.set(...pos);
      m.rotation.set(...rot);
      return m;
    }) as [THREE.Object3D, THREE.Object3D];
  }

  /*
   * Un perfil simétrico como control. No sirve para atrapar el error que hubo:
   * la fórmula vieja y equivocada también lo aprobaba, porque un tubo cuadrado
   * es simétrico respecto de cualquiera de los dos ejes. Está para que se vea
   * que el caso fácil sigue andando.
   */
  it('refleja un perfil simétrico', () => {
    const [a, b] = par(piece(), [420, 310, -180], [0.43, 0.7, 0.26]);
    const antes = worldBox(a);
    mirrorObject(b, 'x');
    expectReflected(antes, worldBox(b), 'x');
  });

  /*
   * Éste sí discrimina. La sección en L no es simétrica en Z, así que espejarlo
   * en ese eje es el único caso donde la fórmula vieja daba una orientación
   * equivocada. Va en los dos ejes para dejar ver que el problema era el eje y
   * no el perfil.
   */
  for (const axis of ['x', 'z'] as const) {
    it(`refleja un ángulo, que no es simétrico en su sección, en ${axis}`, () => {
      const data = piece({ type: 'angle', params: { L: 900, a: 40, e: 4 } });
      const [a, b] = par(data, [150, 90, 240], [0.3, 1.1, -0.55]);
      const antes = worldBox(a);
      mirrorObject(b, axis);
      expectReflected(antes, worldBox(b), axis);
    });
  }

  it('refleja un grupo entero, miembro por miembro', () => {
    const build = () => {
      const g = new THREE.Group();
      g.position.set(500, 100, 200);
      g.rotation.set(0, 0.6, 0);
      const p1 = buildPieceMesh(piece({ id: 1 }));
      p1.position.set(-200, 50, 0);
      p1.rotation.set(0.2, 0.4, 0.1);
      const p2 = buildPieceMesh(piece({ id: 2, params: { L: 600, a: 25, e: 1.6 } }));
      p2.position.set(180, -40, 90);
      p2.rotation.set(0, 0, Math.PI / 2);
      g.add(p1, p2);
      return g;
    };
    const original = build();
    const copia = build();
    const antes = worldBox(original);

    mirrorObject(copia, 'x');

    expectReflected(antes, worldBox(copia), 'x');
    // y cada miembro por separado, no sólo el conjunto
    copia.updateMatrixWorld(true);
    original.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      expectReflected(
        new THREE.Box3().setFromObject(original.children[i]),
        new THREE.Box3().setFromObject(copia.children[i]),
        'x',
      );
    }
  });

  it('libera los materiales del clon sin tocar la geometría compartida', () => {
    const mesh = buildPieceMesh(piece({ type: 'angle', params: { L: 500, a: 40, e: 4 } }));
    const clon = cloneForExport(mesh);
    let materiales = 0, geometrias = 0;
    clon.traverse(c => {
      const m = (c as THREE.Mesh).material as THREE.Material | undefined;
      m?.addEventListener('dispose', () => { materiales++; });
    });
    // La geometría es la misma instancia en el clon y en el original.
    mesh.traverse(c => (c as THREE.Mesh).geometry?.addEventListener('dispose', () => { geometrias++; }));

    disposeClonedMaterials(clon);

    expect(materiales).toBeGreaterThan(0);
    expect(geometrias, 'liberar la geometría dejaría el visor en negro').toBe(0);
  });

  it('stripLines libera el material de las líneas que saca', () => {
    const clon = cloneForExport(buildPieceMesh(piece()));
    let liberados = 0;
    clon.traverse(c => {
      if ((c as THREE.Line).isLine || (c as THREE.LineSegments).isLineSegments) {
        ((c as THREE.Line).material as THREE.Material).addEventListener('dispose', () => { liberados++; });
      }
    });

    stripLines(clon);

    expect(liberados).toBeGreaterThan(0);
    expect(visibleMeshes(clon).length).toBeGreaterThan(0); // las mallas siguen
  });
});
