import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Store } from '../src/app/state';
import type { Viewer } from '../src/scene/viewer';

/**
 * Doble del Viewer con lo poco que el Store le pide: una raíz de escena donde
 * colgar las mallas y un gizmo que se pueda soltar.
 */
function viewerFalso(): Viewer {
  return {
    root: new THREE.Group(),
    gizmo: { object: null, attach() { /* nada */ }, detach() { /* nada */ } },
  } as unknown as Viewer;
}

/**
 * El Store necesita un Viewer para casi todo, pero el autoguardado no lo toca:
 * sólo serializa y escribe en localStorage. Alcanza con un doble vacío.
 */
const storeSuelto = () => new Store({} as unknown as Viewer);

/** Reemplaza localStorage por uno que falla o funciona según se pida. */
function fingirAlmacenamiento(falla: () => boolean): { escrituras: number } {
  const stats = { escrituras: 0 };
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        if (falla()) throw new Error('QuotaExceededError');
        stats.escrituras++;
      },
    },
    configurable: true,
    writable: true,
  });
  return stats;
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, 'localStorage');
});

/**
 * `pieceById` era una búsqueda lineal y ahora usa un índice. El riesgo de un
 * índice es que se desincronice, así que esto lo compara contra una búsqueda
 * lineal después de cada operación que agrega o quita piezas.
 */
describe('índice de piezas por id', () => {
  const cuadrado = { L: 500, a: 30, e: 1.6 };

  function verificar(store: Store, etq: string): void {
    for (const p of store.pieces) {
      expect(store.pieceById(p.id), `${etq}: id ${p.id}`).toBe(store.pieces.find(x => x.id === p.id));
    }
    // Ni piezas fantasma en el índice ni faltantes.
    const indice = (store as unknown as { byId: Map<number, unknown> }).byId;
    expect(indice.size, `${etq}: tamaño del índice`).toBe(store.pieces.length);
    expect(store.pieceById(999_999), `${etq}: id inexistente`).toBeUndefined();
  }

  it('se mantiene al crear, duplicar, agrupar, borrar y restaurar', () => {
    const store = new Store(viewerFalso());
    verificar(store, 'vacío');

    const a = store.createPiece('tube_square', cuadrado);
    const b = store.createPiece('tube_square', cuadrado);
    const c = store.createPiece('angle', { L: 500, a: 40, e: 4 });
    verificar(store, 'tras crear 3');

    const dup = store.duplicateUnit({ t: 'p', id: a.id }, new THREE.Vector3(100, 0, 0));
    verificar(store, 'tras duplicar una pieza');

    const grp = store.groupPieces([b, c], 'G');
    verificar(store, 'tras agrupar');

    const dupG = store.duplicateUnit({ t: 'g', id: grp.id }, new THREE.Vector3(0, 0, 200));
    verificar(store, 'tras duplicar un grupo');

    store.deleteUnits([dup]);
    verificar(store, 'tras borrar una pieza');

    store.deleteUnits([dupG]);
    verificar(store, 'tras borrar un grupo entero');

    const snapshot = store.serialize();
    store.deleteUnits(store.pieces.map(p => ({ t: 'p' as const, id: p.id })));
    verificar(store, 'tras borrar todo');
    expect(store.pieces).toHaveLength(0);

    store.restore(snapshot);
    verificar(store, 'tras restaurar');
    expect(store.pieces.length).toBeGreaterThan(0);
  });

  it('el espejado también deja el índice consistente', () => {
    const store = new Store(viewerFalso());
    const p = store.createPiece('angle', { L: 600, a: 40, e: 4 });
    const copia = store.mirrorUnit({ t: 'p', id: p.id }, 'z');
    verificar(store, 'tras espejar');
    expect(store.pieceById(copia.id)).toBeDefined();
  });
});

/**
 * Regresión: el `catch` del autoguardado estaba vacío. Si el almacenamiento se
 * llenaba, el usuario seguía trabajando convencido de que su proyecto se
 * guardaba solo.
 */
describe('autoguardado', () => {
  it('avisa una sola vez, no en cada tecla', () => {
    vi.useFakeTimers();
    fingirAlmacenamiento(() => true);
    const store = storeSuelto();
    const errores: unknown[] = [];
    store.onAutosaveError = e => errores.push(e);

    for (let i = 0; i < 5; i++) { store.scheduleAutosave(); vi.runAllTimers(); }

    expect(errores).toHaveLength(1);
    expect((errores[0] as Error).message, 'llega el error real, no uno inventado').toContain('Quota');
  });

  it('vuelve a avisar si falla, se recupera y falla de nuevo', () => {
    vi.useFakeTimers();
    let roto = true;
    fingirAlmacenamiento(() => roto);
    const store = storeSuelto();
    let avisos = 0;
    store.onAutosaveError = () => { avisos++; };

    store.scheduleAutosave(); vi.runAllTimers();
    expect(avisos).toBe(1);

    roto = false;                                  // se libera espacio
    store.scheduleAutosave(); vi.runAllTimers();
    expect(avisos).toBe(1);

    roto = true;                                   // se vuelve a llenar
    store.scheduleAutosave(); vi.runAllTimers();
    expect(avisos).toBe(2);
  });

  it('no avisa cuando guarda bien', () => {
    vi.useFakeTimers();
    const stats = fingirAlmacenamiento(() => false);
    const store = storeSuelto();
    let avisos = 0;
    store.onAutosaveError = () => { avisos++; };

    store.scheduleAutosave();
    vi.runAllTimers();

    expect(avisos).toBe(0);
    expect(stats.escrituras).toBe(1);
  });
});
