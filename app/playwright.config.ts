import { defineConfig } from '@playwright/test';

/**
 * Pruebas de punta a punta contra la app real corriendo en el servidor de
 * desarrollo.
 *
 * Cubren lo que los tests unitarios no pueden ni fingir: contextos WebGL,
 * lanzado de rayos con una cámara de verdad, el bucle de dibujo y el cableado
 * de `ui.ts`, que son 900 líneas sin otra red.
 *
 * Usa el Chrome instalado en el sistema (`channel: 'chrome'`), así que no hay
 * que descargar navegadores: `npm install` no baja 200 MB de binarios.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // comparten el mismo servidor de desarrollo
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    // El idioma inicial sale de `navigator.language`. Sin fijarlo, las pruebas
    // dependerían de cómo esté configurado el Chrome de cada máquina.
    locale: 'es-AR',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Si ya lo tenías abierto para trabajar, lo reutiliza en vez de pelear
    // por el puerto.
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
