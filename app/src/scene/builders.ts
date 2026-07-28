import * as THREE from 'three';
import type { PieceData } from '../model/types';
import { pieceDims } from '../model/materials';

export const EDGE_COLOR = 0x565b63;
export const EDGE_SELECTED = 0xffa14f;
export const EMISSIVE_SELECTED = 0x6b3410;

function makeMaterial(p: PieceData): THREE.MeshStandardMaterial {
  const isWood = p.type === 'wood';
  const transparent = p.opacity < 1;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.color),
    metalness: isWood ? 0.0 : 0.4,
    roughness: isWood ? 0.85 : 0.55,
    transparent,
    opacity: p.opacity,
    // Las piezas translúcidas no escriben profundidad: si lo hicieran se
    // taparían entre sí al superponerse, en lugar de dejarse ver.
    depthWrite: !transparent,
  });
}

/**
 * Aplica una opacidad a todas las mallas de un subárbol.
 *
 * `opacity` es un uniforme que el shader lee en cada cuadro, así que cambiarlo
 * se ve al instante. `transparent`, en cambio, forma parte de cómo se compila
 * el material: al pasar una pieza de opaca a translúcida hay que marcarla con
 * `needsUpdate`, o el visor la sigue dibujando con el programa viejo —opaca—
 * aunque sus propiedades ya digan lo contrario.
 */
export function setOpacity(obj: THREE.Object3D, opacity: number): void {
  const transparent = opacity < 1;
  obj.traverse(c => {
    if (!(c as THREE.Mesh).isMesh) return;
    const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    if (mat.transparent !== transparent) mat.needsUpdate = true;
    mat.transparent = transparent;
    mat.opacity = opacity;
    mat.depthWrite = !transparent;
  });
}

function boxWithEdges(p: PieceData, L: number, H: number, W: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(L, H, W);
  const mesh = new THREE.Mesh(geo, makeMaterial(p));
  mesh.castShadow = true;
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: EDGE_COLOR }),
  ));
  return mesh;
}

/**
 * Construye la malla de una pieza a partir de sus parámetros.
 * Siempre centrada en el origen, con el largo a lo largo del eje X.
 */
export function buildPieceMesh(p: PieceData): THREE.Object3D {
  const q = p.params;
  let root: THREE.Object3D;

  if (p.type === 'tube_round') {
    const r = q.d! / 2;
    const segs = 24;
    const geo = new THREE.CylinderGeometry(r, r, q.L, segs);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); // eje X
    const mesh = new THREE.Mesh(geo, makeMaterial(p));
    mesh.castShadow = true;
    const lineMat = () => new THREE.LineBasicMaterial({ color: EDGE_COLOR });
    for (const x of [-q.L / 2, q.L / 2]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
      }
      mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat()));
    }
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const pts = [
        new THREE.Vector3(-q.L / 2, Math.cos(a) * r, Math.sin(a) * r),
        new THREE.Vector3(q.L / 2, Math.cos(a) * r, Math.sin(a) * r),
      ];
      mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat()));
    }
    root = mesh;
  } else if (p.type === 'angle') {
    const g = new THREE.Group();
    const mH = boxWithEdges(p, q.L, q.e!, q.a!); // ala horizontal (abajo)
    mH.position.set(0, -q.a! / 2 + q.e! / 2, 0);
    g.add(mH);
    const mV = boxWithEdges(p, q.L, q.a! - q.e!, q.e!); // ala vertical (atrás)
    mV.position.set(0, q.e! / 2, -q.a! / 2 + q.e! / 2);
    g.add(mV);
    root = g;
  } else {
    const [L, W, H] = pieceDims(p);
    root = boxWithEdges(p, L, H, W);
  }

  root.userData.pieceId = p.id;
  root.traverse(c => { c.userData.pieceId = p.id; });
  root.visible = p.visible;
  root.name = p.name;
  return root;
}

/** Libera geometrías y materiales de un subárbol. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse(c => {
    const anyC = c as THREE.Mesh;
    if (anyC.geometry) anyC.geometry.dispose();
    const m = anyC.material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose());
  });
}

/** Aplica o quita el resaltado de selección. */
export function setHighlight(obj: THREE.Object3D, on: boolean): void {
  obj.traverse(c => {
    if ((c as THREE.Mesh).isMesh) {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat?.emissive) mat.emissive.setHex(on ? EMISSIVE_SELECTED : 0x000000);
    } else if ((c as THREE.Line).isLine) {
      const mat = (c as THREE.Line).material as THREE.LineBasicMaterial;
      mat?.color.setHex(on ? EDGE_SELECTED : EDGE_COLOR);
    }
  });
}

/**
 * Clon limpio de un subárbol para exportar: materiales duplicados,
 * sin resaltado de selección, bordes en gris neutro.
 */
export function cloneForExport(root: THREE.Object3D): THREE.Object3D {
  const clone = root.clone(true);
  clone.traverse(c => {
    if ((c as THREE.Mesh).isMesh) {
      const mesh = c as THREE.Mesh;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (mat.emissive) mat.emissive.setHex(0x000000);
      mesh.material = mat;
    } else if ((c as THREE.Line).isLine) {
      const line = c as THREE.Line;
      const mat = (line.material as THREE.LineBasicMaterial).clone();
      mat.color.setHex(0x555555);
      line.material = mat;
    }
  });
  return clone;
}

/** Quita las líneas de borde de un subárbol (para exportar solo mallas). */
export function stripLines(root: THREE.Object3D): void {
  const toRemove: THREE.Object3D[] = [];
  root.traverse(c => {
    if ((c as THREE.Line).isLine || (c as THREE.LineSegments).isLineSegments) toRemove.push(c);
  });
  for (const c of toRemove) c.parent?.remove(c);
}
