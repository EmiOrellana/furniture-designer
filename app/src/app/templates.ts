import * as THREE from 'three';
import type { Store, Piece } from './state';
import type { FieldDef } from '../model/materials';
import { t } from './i18n';

export interface TemplateDef {
  /** clave i18n del nombre de la plantilla */
  title: string;
  /** los labels de los campos son claves i18n */
  fields: FieldDef[];
  build(store: Store, v: Record<string, number>): Piece[];
}

const rad = THREE.MathUtils.degToRad;

function mk(
  store: Store, made: Piece[],
  type: Parameters<Store['createPiece']>[0], params: Parameters<Store['createPiece']>[1],
  pos: [number, number, number], rotZ = 0, rotY = 0, name?: string,
): Piece {
  const p = store.createPiece(type, params, { name });
  p.mesh.position.set(pos[0], pos[1], pos[2]);
  p.mesh.rotation.set(0, rad(rotY), rad(rotZ));
  made.push(p);
  return p;
}

export const TEMPLATES: Record<string, TemplateDef> = {
  mesa: {
    title: 'tpl.mesa',
    fields: [
      { key: 'w', label: 'tplf.width', def: 1200 },
      { key: 'd', label: 'tplf.depth', def: 600 },
      { key: 'h', label: 'tplf.height', def: 750 },
      { key: 'per', label: 'tplf.profile', def: 30 },
      { key: 'top', label: 'tplf.top', def: 25 },
    ],
    build(store, v) {
      const { w, d, h, per, top } = v;
      const made: Piece[] = [];
      const legL = h - top;
      const lx = w / 2 - per / 2;
      const lz = d / 2 - per / 2;
      const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
      corners.forEach(([x, z], i) =>
        mk(store, made, 'tube_square', { L: legL, a: per, e: 1.6 }, [x, legL / 2, z], 90, 0,
          `${t('name.leg')} #${i + 1}`));
      const ay = legL - per / 2;
      [-lz, lz].forEach((z, i) =>
        mk(store, made, 'tube_square', { L: w - 2 * per, a: per, e: 1.6 }, [0, ay, z], 0, 0,
          `${t('name.front')} #${i + 1}`));
      [-lx, lx].forEach((x, i) =>
        mk(store, made, 'tube_square', { L: d - 2 * per, a: per, e: 1.6 }, [x, ay, 0], 0, 90,
          `${t('name.side')} #${i + 1}`));
      mk(store, made, 'wood', { L: w, w: d, e: top }, [0, h - top / 2, 0], 0, 0, t('name.top'));
      return made;
    },
  },
  estante: {
    title: 'tpl.estante',
    fields: [
      { key: 'w', label: 'tplf.width', def: 900 },
      { key: 'd', label: 'tplf.depth', def: 350 },
      { key: 'h', label: 'tplf.heightS', def: 1800 },
      { key: 'n', label: 'tplf.shelves', def: 4 },
      { key: 'per', label: 'tplf.profile', def: 25 },
      { key: 'e', label: 'tplf.plate', def: 18 },
    ],
    build(store, v) {
      const { w, d, h, per, e } = v;
      const made: Piece[] = [];
      const lx = w / 2 - per / 2;
      const lz = d / 2 - per / 2;
      const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]];
      corners.forEach(([x, z], i) =>
        mk(store, made, 'tube_square', { L: h, a: per, e: 1.6 }, [x, h / 2, z], 90, 0,
          `${t('name.upright')} #${i + 1}`));
      const n = Math.max(2, Math.round(v.n));
      const y0 = 120;
      const y1 = h - 60;
      for (let i = 0; i < n; i++) {
        const y = y0 + ((y1 - y0) * i) / (n - 1);
        [-lz, lz].forEach((z, j) =>
          mk(store, made, 'tube_square', { L: w - 2 * per, a: per, e: 1.6 },
            [0, y - e / 2 - per / 2, z], 0, 0, `${t('name.rail')} N${i + 1}.${j + 1}`));
        mk(store, made, 'wood', { L: w, w: d, e }, [0, y, 0], 0, 0, `${t('name.shelf')} #${i + 1}`);
      }
      return made;
    },
  },
};
