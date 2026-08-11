import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { cloneForExport, disposeClonedMaterials, stripLines } from '../scene/builders';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Fecha de hoy en ISO corto (2026-07-29), para nombres de archivo. */
export const stamp = (): string => new Date().toISOString().slice(0, 10);

/**
 * Exporta a glTF binario (.glb). La escena se escala de mm a metros,
 * que es la unidad estándar de glTF — así Blender la importa 1:1.
 */
export function exportGLB(root: THREE.Object3D): Promise<Blob> {
  const clone = cloneForExport(root);
  stripLines(clone); // solo mallas: las líneas de borde no aportan en Blender
  const wrapper = new THREE.Group();
  wrapper.name = 'FerroMadera';
  wrapper.add(clone);
  wrapper.scale.setScalar(0.001); // mm → m
  wrapper.updateMatrixWorld(true);

  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      wrapper,
      result => {
        disposeClonedMaterials(wrapper);
        resolve(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }));
      },
      err => {
        disposeClonedMaterials(wrapper);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
      { binary: true },
    );
  });
}

export async function downloadGLB(root: THREE.Object3D): Promise<void> {
  const blob = await exportGLB(root);
  downloadBlob(blob, `ferromadera_${stamp()}.glb`);
}

/** Exporta a Wavefront OBJ (unidades en mm, solo mallas). */
export function exportOBJ(root: THREE.Object3D): string {
  const clone = cloneForExport(root);
  stripLines(clone);
  clone.updateMatrixWorld(true);
  try {
    return new OBJExporter().parse(clone);
  } finally {
    disposeClonedMaterials(clone);
  }
}

export function downloadOBJ(root: THREE.Object3D): void {
  const text = exportOBJ(root);
  downloadBlob(new Blob([text], { type: 'text/plain' }), `ferromadera_${stamp()}.obj`);
}
