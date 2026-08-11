import type { Page } from '@playwright/test';
import type * as THREE from 'three';
import type { Store } from '../src/app/state';
import type { Overlay } from '../src/app/overlay';
import type { Viewer } from '../src/scene/viewer';

/**
 * Lo que la app expone en `window.__fm` durante el desarrollo.
 *
 * Se tipa con los tipos reales del código, así que si cambia una firma esto
 * deja de compilar en vez de fallar en tiempo de ejecución.
 *
 * Instrumentar por acá es deliberado: sirve para *observar* —¿se dibujó?,
 * ¿el contexto sigue vivo?—, mientras que las acciones se hacen por la interfaz
 * real siempre que se pueda, para no probar un camino que el usuario no tiene.
 */
export interface DebugHook {
  frame(): void;
  THREE: typeof THREE;
  store: Store;
  viewer: Viewer;
  overlay: Overlay;
  buildPlansPDF(root: THREE.Object3D, pieces: Store['pieces']): { output(kind: string): Blob };
}

declare global {
  interface Window {
    __fm: DebugHook;
    /** Contador de dibujos que instalan las pruebas. */
    __dibujos: number;
    /** Contador de avisos del store, para comprobar el agrupado. */
    __avisos: number;
  }
}

/**
 * Abre la app con una escena vacía y el contador de dibujos instalado.
 *
 * Cada prueba corre en un contexto nuevo, así que el almacenamiento arranca
 * limpio y no hay autoguardado previo que restaurar.
 */
export async function abrirApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__fm?.frame === 'function');
  await page.evaluate(() => {
    const { store, viewer } = window.__fm;
    const unidades = [
      ...store.groups.map(g => ({ t: 'g' as const, id: g.id })),
      ...store.pieces.map(p => ({ t: 'p' as const, id: p.id })),
    ];
    if (unidades.length) store.deleteUnits(unidades);
    window.__dibujos = 0;
    const original = viewer.render.bind(viewer);
    viewer.render = () => { window.__dibujos++; original(); };
  });
  await paso(page, 2);
}

/**
 * Avanza `n` cuadros del bucle a mano.
 *
 * No se espera a `requestAnimationFrame`: si la ventana queda en segundo plano
 * el navegador lo detiene, y la prueba colgaría o —peor— pasaría por no dibujar
 * nada. Accionar el paso la hace determinista.
 */
export async function paso(page: Page, n = 1): Promise<void> {
  await page.evaluate(veces => {
    for (let i = 0; i < veces; i++) window.__fm.frame();
  }, n);
}

/** Cuántas veces se dibujó desde que se abrió la app. */
export function dibujos(page: Page): Promise<number> {
  return page.evaluate(() => window.__dibujos);
}
