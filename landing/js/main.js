/**
 * Punto de entrada de la landing. Módulos ES nativos: no hay build.
 */
import { initReveal } from './reveal.js';
import { initLang, setLang, getLang, onLangChange } from './i18n.js';

/** La barra superior gana fondo al despegarse del tope. */
function initStickyNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/** Selector de idioma con banderas. */
function initLangSwitch() {
  const buttons = document.querySelectorAll('.lang-btn');
  const paint = () => {
    buttons.forEach(b => {
      const active = b.dataset.lang === getLang();
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  };
  buttons.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  onLangChange(paint);
  paint();
}

/** Año del pie, para no tener que actualizarlo a mano. */
function initYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
}

initLang();        // traduce antes de mostrar nada más
initLangSwitch();
initStickyNav();
initYear();
initReveal();

// Avisa al script en línea de index.html que el módulo cargó bien
window.__landingReady = true;
