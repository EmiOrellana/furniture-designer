import { expect, test } from '@playwright/test';
import { abrirApp, paso } from './app';

/**
 * `ui.ts` son unas novecientas líneas sin tests unitarios: necesita un
 * documento de verdad y un contexto WebGL. Estas pruebas manejan la app por
 * donde la maneja una persona —botones y campos— y comprueban lo que se ve.
 *
 * Sirven además de red para el refactor del refresco de interfaz: hoy la lista
 * se actualiza de rebote, porque toda acción termina cambiando la selección.
 * Cuando eso pase a ser explícito, estas pruebas tienen que seguir en verde.
 */
test.describe('interfaz', () => {
  test.beforeEach(async ({ page }) => abrirApp(page));

  const filas = (page: import('@playwright/test').Page) =>
    page.locator('#pieces-list [data-pid]');

  test('agregar una pieza la muestra en la lista y en la barra de estado', async ({ page }) => {
    await expect(filas(page)).toHaveCount(0);

    await page.click('#btn-add');
    await page.click('#btn-add');

    await expect(filas(page)).toHaveCount(2);
    await expect(page.locator('#piece-count')).toHaveText('2');
    await expect(page.locator('#status-stats')).toContainText('2 piezas');
  });

  test('borrar una pieza la saca de la lista', async ({ page }) => {
    await page.click('#btn-add');
    await page.click('#btn-add');
    await expect(filas(page)).toHaveCount(2);

    await filas(page).first().click();
    await page.click('#btn-del');

    await expect(filas(page)).toHaveCount(1);
    await expect(page.locator('#status-stats')).toContainText('1 pieza');
  });

  test('una plantilla puebla la lista y agrupa', async ({ page }) => {
    await page.click('.tpl-card[data-tpl="mesa"]');
    await page.click('#tpl-ok');

    await expect(filas(page)).toHaveCount(9); // 4 patas + 4 refuerzos + tapa
    await expect(page.locator('#groups-list [data-gid]')).toHaveCount(1);
    await expect(page.locator('#groups-list .group-count')).toHaveText('9');
  });

  test('elegir una pieza de la lista la marca sin rehacer las filas', async ({ page }) => {
    await page.click('#btn-add');
    await page.click('#btn-add');
    await page.click('#btn-add');

    // Marca en el DOM: si el HTML se rearmara, el nodo se pierde.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#pieces-list [data-pid]')!.dataset.marca = 'viva';
    });

    await filas(page).nth(1).click();

    await expect(filas(page).nth(1)).toHaveClass(/selected/);
    await expect(page.locator('#pieces-list .selected')).toHaveCount(1);
    const marcaSobrevive = await page.evaluate(() =>
      document.querySelector<HTMLElement>('#pieces-list [data-pid]')!.dataset.marca === 'viva');
    expect(marcaSobrevive, 'seleccionar no debe reconstruir la lista').toBe(true);
  });

  test('el ojo oculta la pieza y lo refleja en la lista', async ({ page }) => {
    await page.click('#btn-add');
    const fila = filas(page).first();

    await fila.locator('.eye-btn').click();

    await expect(fila).toHaveClass(/hidden-piece/);
    const oculta = await page.evaluate(() => window.__fm.store.pieces[0].visible === false);
    expect(oculta).toBe(true);
  });

  /**
   * Regresión: el estado previo se capturaba al enfocar el campo, no al
   * empezar a editar. Si entre una cosa y otra pasaba otra acción, deshacer
   * saltaba por encima y se la comía.
   */
  test('deshacer no se come una acción intermedia', async ({ page }) => {
    await page.click('#btn-add');
    await filas(page).first().click();

    const largo = page.locator('#dim-L');
    await largo.focus();

    // Entre enfocar y editar, aparece otra pieza.
    await page.click('#btn-add');
    await expect(filas(page)).toHaveCount(2);

    await filas(page).first().click();
    await largo.fill('654');
    await largo.blur();

    await page.click('#btn-undo');

    await expect(filas(page), 'la pieza intermedia debe seguir').toHaveCount(2);
  });

  /**
   * Varias teclas seguidas en un campo son un solo paso de historial.
   *
   * Se mira la medida en la fila de la lista y no el campo del inspector,
   * porque deshacer vacía la selección y el inspector se esconde con el último
   * texto escrito adentro.
   */
  test('editar una medida deja un único paso de deshacer', async ({ page }) => {
    await page.click('#btn-add');
    const medidas = filas(page).first().locator('.piece-dims');
    await expect(medidas).toHaveText('1000×30×30');

    await filas(page).first().click();
    // Tecla por tecla y no `fill`, que escribe de un saque: lo que se prueba
    // es que tres pulsaciones dejen un solo paso, no una.
    const largo = page.locator('#dim-L');
    await largo.click();
    await largo.press('Control+a');
    await largo.pressSequentially('800');
    await largo.blur();
    await expect(medidas).toHaveText('800×30×30');

    await page.click('#btn-undo');

    await expect(medidas, 'vuelve al valor previo a toda la edición').toHaveText('1000×30×30');
  });

  test('el selector de idioma traduce la interfaz', async ({ page }) => {
    await page.click('#btn-add');
    await expect(page.locator('#status-stats')).toContainText('pieza');

    await page.click('#lang-en');

    await expect(page.locator('#status-stats')).toContainText('piece');
    await expect(page.locator('[data-i18n="sec.add"]')).toHaveText('Add profile');
  });

  /**
   * El botón refleja si las etiquetas se están viendo, no si están pedidas:
   * por encima del tope se apagan solas y antes seguía encendido.
   */
  test('el botón de etiquetas se apaga cuando hay demasiadas piezas', async ({ page }) => {
    await page.click('#btn-add');
    await paso(page);
    await expect(page.locator('#btn-labels')).toHaveAttribute('aria-pressed', 'true');

    await page.evaluate(() => {
      const { store } = window.__fm;
      for (let i = 0; i < 70; i++) store.createPiece('tube_square', { L: 200, a: 25, e: 1.6 });
    });

    await expect(page.locator('#btn-labels')).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * Regresión del refresco de rebote: antes sólo avisaban `setSel` y `restore`,
   * y las demás operaciones se apoyaban en que la acción terminara
   * reseleccionando. Una operación que no tocara la selección dejaba la lista y
   * los totales mostrando el estado anterior. Lo vimos en vivo: la barra decía
   * «9 piezas» habiendo 2.
   */
  test('una operación que no toca la selección también refresca la lista', async ({ page }) => {
    await page.click('#btn-add');
    await expect(filas(page)).toHaveCount(1);

    // Sin `setSel` por ningún lado.
    await page.evaluate(() => {
      const { store } = window.__fm;
      store.createPiece('tube_square', { L: 700, a: 30, e: 1.6 });
      store.createPiece('angle', { L: 700, a: 40, e: 4 });
    });

    await expect(filas(page)).toHaveCount(3);
    await expect(page.locator('#piece-count')).toHaveText('3');
    await expect(page.locator('#status-stats')).toContainText('3 piezas');
  });

  /**
   * Duplicar en bloque tiene que emitir un solo aviso. Sin agrupar, treinta
   * copias rearmarían las listas treinta veces; y en el caso de borrar sería
   * peor que lento, porque `deleteUnits` disuelve grupos por dentro y la
   * interfaz llegaría a dibujar un estado a medio terminar.
   */
  test('una serie de copias emite un único aviso', async ({ page }) => {
    await page.click('#btn-add');
    await page.click('#btn-add');
    await page.click('#btn-add');
    await page.evaluate(() => {
      const { store } = window.__fm;
      store.setSel(store.pieces.map(p => ({ t: 'p' as const, id: p.id })));
      window.__avisos = 0;
      store.onChange(() => { window.__avisos++; });
    });

    await page.click('#btn-dup');

    await expect(filas(page)).toHaveCount(6);
    expect(await page.evaluate(() => window.__avisos)).toBe(1);
  });

  test('abrir un archivo de una versión más nueva avisa en vez de romperlo', async ({ page }) => {
    const futuro = JSON.stringify({
      version: 9, idCounter: 1, groupCounter: 0, groups: [],
      pieces: [{ id: 1, type: 'tube_square', params: { L: 500, a: 30, e: 1.6 } }],
    });
    // Se arma el File en la página para no depender de las globales de Node:
    // este proyecto compila sólo con tipos de navegador, a propósito.
    await page.evaluate(contenido => {
      const dt = new DataTransfer();
      dt.items.add(new File([contenido], 'futuro.fmd', { type: 'application/json' }));
      const input = document.getElementById('file-input') as HTMLInputElement;
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, futuro);

    await expect(page.locator('#toast')).toContainText('versión más nueva');
    await expect(filas(page), 'no debe cargar nada').toHaveCount(0);
  });
});
