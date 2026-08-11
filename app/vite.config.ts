/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Endpoint SOLO de desarrollo: permite guardar capturas generadas por la app
 * en landing/assets/ (POST /__dev/save?name=archivo.png).
 * No existe en el build.
 */
function devShotSaver(): Plugin {
  return {
    name: 'dev-shot-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/save', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'shot.png';
        const safe = name.replace(/[^a-z0-9._-]/gi, '');
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c as Buffer));
        req.on('end', () => {
          const dir = path.resolve(__dirname, '..', 'landing', 'assets');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, safe), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

// El build produce un único index.html autocontenido: se puede abrir con
// doble click (file://) o subir a cualquier hosting estático.
export default defineConfig({
  plugins: [viteSingleFile(), devShotSaver()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  test: {
    // Sólo las pruebas unitarias. Las de `e2e/` las corre Playwright, y sin
    // esto Vitest las levantaría por el nombre y fallaría al no ser suyas.
    include: ['tests/**/*.test.ts'],
  },
});
