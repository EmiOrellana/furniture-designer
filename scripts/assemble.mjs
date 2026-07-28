/**
 * Arma la carpeta que se publica (dist/) juntando las dos partes del sitio:
 *
 *   landing/              → dist/            (raíz del sitio)
 *   app/dist/index.html   → dist/app/index.html   (la app, en /app)
 *
 * Se ejecuta al final de `npm run build`, después de compilar la app.
 * No necesita dependencias: solo Node.
 */
import { access, cp, mkdir, rm, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dist');
const LANDING = join(root, 'landing');
const APP_FILE = join(root, 'app', 'dist', 'index.html');

const exists = async p => access(p).then(() => true, () => false);

if (!(await exists(APP_FILE))) {
  console.error(
    '\n✖ No se encontró app/dist/index.html.\n' +
    '  Compilá la app primero:  npm --prefix app run build\n',
  );
  process.exit(1);
}

// Empezar siempre desde cero para que no queden archivos viejos
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// 1 · La landing va tal cual a la raíz del sitio
await cp(LANDING, OUT, {
  recursive: true,
  // El CLAUDE.md son instrucciones de desarrollo, no contenido publicable
  filter: src => !src.endsWith('CLAUDE.md'),
});

// 2 · La app (un único HTML autocontenido) va a /app
await mkdir(join(OUT, 'app'), { recursive: true });
await cp(APP_FILE, join(OUT, 'app', 'index.html'));

const files = await readdir(OUT, { recursive: true });
console.log(`\n✔ dist/ armado — ${files.length} entradas`);
console.log('  landing → /');
console.log('  app     → /app\n');
