import { expect, test } from '@playwright/test';
import { abrirApp, dibujos, paso } from './app';

test.describe('visor 3D', () => {
  test.beforeEach(async ({ page }) => abrirApp(page));

  /**
   * Regresión del error más grave del repaso: `renderOrthoView` creaba un
   * `WebGLRenderer` por vista y sólo llamaba a `dispose()`, que libera recursos
   * de Three.js pero **no el contexto**. Cada PDF de planos abría tres, y el
   * navegador tolera unos dieciséis: a las seis exportaciones mataba los más
   * viejos, incluido el del visor, que quedaba congelado hasta recargar.
   */
  test('exportar planos muchas veces no mata el contexto del visor', async ({ page }) => {
    const r = await page.evaluate(() => {
      const { store, viewer, buildPlansPDF } = window.__fm;
      for (let i = 0; i < 6; i++) store.createPiece('tube_square', { L: 500, a: 30, e: 1.6 });
      const tamanos: number[] = [];
      // Doce exportaciones: con el código viejo serían 36 contextos.
      for (let i = 0; i < 12; i++) {
        tamanos.push(buildPlansPDF(viewer.root, store.pieces).output('blob').size);
      }
      return {
        contextoPerdido: viewer.renderer.getContext().isContextLost(),
        todosIguales: new Set(tamanos).size === 1,
      };
    });

    expect(r.contextoPerdido, 'el visor quedaría congelado hasta recargar').toBe(false);
    // Si algo se acumulara en la escena compartida, los PDF irían cambiando.
    expect(r.todosIguales, 'las exportaciones deben ser idénticas').toBe(true);
  });

  /**
   * Una pieza oculta no debe poder seleccionarse. En los perfiles compuestos
   * —el ángulo son dos alas— apagarla sólo apaga el objeto raíz, y como
   * Three.js no mira la visibilidad al lanzar rayos, las alas seguían siendo
   * blanco válido.
   */
  test('una pieza de ángulo oculta no se puede seleccionar', async ({ page }) => {
    const r = await page.evaluate(() => {
      const { store, viewer } = window.__fm;
      const p = store.createPiece('angle', { L: 800, a: 40, e: 4 });
      viewer.frameView('front');
      viewer.render();
      const caja = viewer.renderer.domElement.getBoundingClientRect();
      const centro = { clientX: caja.left + caja.width / 2, clientY: caja.top + caja.height / 2 };

      const alClicarVisible = viewer.pickPieceId(centro);
      p.visible = false;
      p.mesh.visible = false;
      viewer.render();
      return { id: p.id, alClicarVisible, alClicarOculta: viewer.pickPieceId(centro) };
    });

    expect(r.alClicarVisible, 'visible sí debe seleccionarse').toBe(r.id);
    expect(r.alClicarOculta, 'oculta no').toBeNull();
  });

  /**
   * El canvas 2D de las etiquetas debe tener la misma densidad que el de WebGL,
   * o se ve borroso al lado de un modelo nítido.
   */
  test('los dos lienzos usan la densidad real de la pantalla', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.dispatchEvent(new Event('resize')); // ajusta con el dpr actual
      const cv = document.getElementById('overlay') as HTMLCanvasElement;
      const vp = document.getElementById('viewport')!;
      const gl = window.__fm.viewer.renderer.domElement;
      const dpr = window.devicePixelRatio;
      return {
        esperado: Math.round(vp.clientWidth * dpr),
        overlay: cv.width,
        webgl: gl.width,
        escalaDelContexto: cv.getContext('2d')!.getTransform().a,
        dpr,
      };
    });

    expect(r.overlay).toBe(r.esperado);
    expect(r.webgl).toBe(r.esperado);
    // Sin la escala el dibujo saldría en un rincón y a un tamaño equivocado.
    expect(r.escalaDelContexto).toBeCloseTo(r.dpr, 5);
  });
});

test.describe('bucle de dibujo', () => {
  test.beforeEach(async ({ page }) => abrirApp(page));

  /**
   * El bucle sólo dibuja si cambió algo. Estando quieto no debe gastar nada:
   * con 60 piezas el par render + etiquetas cuesta unos 2,7 ms por cuadro, y
   * antes se pagaban sesenta veces por segundo mirando una escena inmóvil.
   */
  test('estando quieto no dibuja', async ({ page }) => {
    await page.evaluate(() => {
      const { store } = window.__fm;
      for (let i = 0; i < 10; i++) store.createPiece('tube_square', { L: 400, a: 30, e: 1.6 });
    });
    await paso(page, 3);

    const antes = await dibujos(page);
    await paso(page, 120);

    expect((await dibujos(page)) - antes, '120 cuadros sin ningún cambio').toBe(0);
  });

  /**
   * La contracara, y la parte peligrosa: si la huella se olvida de algo, la
   * pantalla queda congelada mostrando algo que ya no es cierto. Se recorren
   * todas las vías de cambio que existen hoy.
   */
  test('cada tipo de cambio provoca un dibujo', async ({ page }) => {
    const sinDibujar = await page.evaluate(() => {
      const fm = window.__fm;
      const { store, viewer, overlay, THREE } = fm;
      const p = store.createPiece('tube_square', { L: 500, a: 30, e: 1.6 });
      store.createPiece('angle', { L: 500, a: 40, e: 4 });
      fm.frame(); fm.frame();

      const casos: [string, () => void][] = [
        ['mover la cámara', () => { viewer.camera.position.x += 50; }],
        ['crear una pieza', () => { store.createPiece('tube_square', { L: 300, a: 25, e: 1.6 }); }],
        ['mover una pieza', () => { p.mesh.position.x += 40; }],
        ['rotar una pieza', () => { p.mesh.rotation.y += 0.3; }],
        ['cambiar medidas', () => { p.params.L = 900; store.rebuildPiece(p); }],
        ['cambiar color', () => { p.color = '#ff0000'; }],
        ['cambiar opacidad', () => { p.opacity = 0.4; }],
        ['ocultar', () => { p.visible = false; p.mesh.visible = false; }],
        ['mostrar', () => { p.visible = true; p.mesh.visible = true; }],
        ['renombrar', () => { p.name = 'Otro nombre'; }],
        ['seleccionar', () => store.setSel([{ t: 'p', id: p.id }])],
        ['deseleccionar', () => store.setSel([])],
        ['apagar la grilla', () => { viewer.grid.visible = false; }],
        ['apagar etiquetas', () => { overlay.showLabels = false; }],
        ['prender etiquetas', () => { overlay.showLabels = true; }],
        ['entrar a medir', () => { overlay.measuring = true; }],
        ['punto de medición', () => overlay.addMeasurePoint(new THREE.Vector3(0, 100, 0))],
        ['salir de medir', () => { overlay.measuring = false; overlay.clearMeasure(); }],
        ['resaltar eje del gizmo', () => { viewer.gizmo.axis = 'X'; }],
        ['soltar el eje del gizmo', () => { viewer.gizmo.axis = null; }],
        ['agrupar', () => { store.groupPieces(store.pieces.slice(0, 2), 'G'); }],
        ['mover un grupo', () => { store.groups[0].obj.position.z += 100; }],
        ['borrar una pieza', () => store.deleteUnits([{ t: 'p', id: p.id }])],
      ];

      const fallaron: string[] = [];
      for (const [etiqueta, accion] of casos) {
        const antes = window.__dibujos;
        accion();
        fm.frame();
        if (window.__dibujos === antes) fallaron.push(etiqueta);
      }
      return fallaron;
    });

    expect(sinDibujar, 'estos cambios no se verían en pantalla').toEqual([]);
  });
});
