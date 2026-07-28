/**
 * Traducción ES / EN de la landing.
 * Mismo enfoque que la app: diccionario clave → [español, inglés] y
 * atributos data-i18n* en el HTML. Sin dependencias.
 *
 * Para agregar un idioma: sumar una tercera posición a cada entrada y
 * un botón más en el selector (index.html + LANGS de abajo).
 */

const LS_KEY = 'fm_landing_lang';

/** Orden de los idiomas dentro de cada entrada del diccionario. */
export const LANGS = ['es', 'en'];

const DICT = {
  /* ── Meta ─────────────────────────────────────────────────── */
  'meta.title': [
    'FerroMadera — Diseñador 3D de muebles de hierro y madera',
    'FerroMadera — 3D designer for steel and wood furniture',
  ],

  /* ── Barra superior ───────────────────────────────────────── */
  'nav.home': ['Inicio', 'Home'],
  'nav.sections': ['Secciones', 'Sections'],
  'nav.features': ['Funciones', 'Features'],
  'nav.how': ['Cómo funciona', 'How it works'],
  'nav.faq': ['Preguntas', 'FAQ'],
  'cta.start': ['Empezar', 'Start'],
  'lang.es': ['Español', 'Spanish'],
  'lang.en': ['Inglés', 'English'],
  'lang.group': ['Idioma', 'Language'],

  /* ── Hero ─────────────────────────────────────────────────── */
  'hero.title': [
    'Diseñador 3D de muebles de hierro y madera.',
    '3D designer for steel and wood furniture.',
  ],
  'hero.see': ['Ver qué genera', 'See what it produces'],
  'hero.alt': [
    'Vista 3D de una mesa y una estantería de caño estructural con tapa de madera, diseñadas en la app.',
    '3D view of a table and a shelving unit made of structural tube with wooden tops, designed in the app.',
  ],

  /* ── Qué hace ─────────────────────────────────────────────── */
  'what.eyebrow': ['Qué hace', 'What it does'],
  'what.title': [
    'Del modelo 3D a los datos de fabricación.',
    'From the 3D model to fabrication data.',
  ],
  'what.intro': [
    'Elegís perfiles comerciales reales —caño cuadrado, rectangular o redondo, ángulo, planchuela y placa de madera—, los armás en 3D con las medidas que quieras, y la app calcula sola todo lo que necesitás para construirlo.',
    'You pick real commercial profiles —square, rectangular or round tube, angle iron, flat bar and wood board—, assemble them in 3D at whatever size you need, and the app works out everything required to build it.',
  ],
  'what.1': [
    '<strong>Cada pieza guarda sus medidas de fabricación</strong> —perfil, espesor de pared y largo de corte—, no una figura aproximada.',
    '<strong>Every piece stores its fabrication data</strong> —profile, wall thickness and cut length—, not just an approximate shape.',
  ],
  'what.2': [
    '<strong>Movés, rotás y medís con precisión</strong>, con ajuste a grilla y a 15°. Nada está atado a una plantilla: el mueble es tuyo.',
    '<strong>Move, rotate and measure precisely</strong>, with grid and 15° snapping. Nothing is locked to a template: the design is yours.',
  ],
  'what.3': [
    '<strong>Todo se recalcula al instante</strong>: cambiás una medida y la lista de cortes, el peso, el costo y los planos se actualizan solos.',
    '<strong>Everything recalculates instantly</strong>: change one dimension and the cut list, the weight, the cost and the drawings update on their own.',
  ],

  /* ── Funciones ────────────────────────────────────────────── */
  'feat.eyebrow': ['Funciones', 'Features'],
  'feat.title': ['Lo que te llevás al taller.', 'What you take to the workshop.'],

  'f1.title': ['Optimización de cortes', 'Cut optimization'],
  'f1.body': [
    'La app distribuye todos los cortes en barras comerciales y te dice cuántas comprar y cómo cortar cada una. Configurás el largo de la barra y el espesor de corte, y ves el sobrante de cada tira y el aprovechamiento real.',
    'The app packs every cut into commercial stock bars and tells you how many to buy and how to cut each one. Set the bar length and the kerf, and see the offcut left on each bar and the real utilization.',
  ],
  'f1.t1': ['largo de barra', 'bar length'],
  'f1.t2': ['kerf', 'kerf'],
  'f1.t3': ['sobrantes', 'offcuts'],
  'f1.t4': ['% aprovechamiento', '% utilization'],
  'f1.alt': [
    'Lista de materiales con cortes por barra, pesos y costos.',
    'Bill of materials showing cuts per bar, weights and costs.',
  ],

  'f2.title': ['Peso y costo reales', 'Real weight and cost'],
  'f2.body': [
    'El peso se calcula con la sección real del perfil, descontando el hueco del caño: no es una estimación gruesa. Cargás el precio del metro o del m² y tenés el costo del material antes de comprarlo.',
    'Weight is computed from the true cross-section, subtracting the hollow core of the tube — not a rough guess. Enter the price per meter or per m² and you get the material cost before buying it.',
  ],
  'f2.t1': ['kg por pieza', 'kg per piece'],
  'f2.t2': ['kg por perfil', 'kg per profile'],
  'f2.t3': ['costo estimado', 'estimated cost'],
  'f2.d1': ['Caño cuadrado 30×30×1.6', 'Square tube 30×30×1.6'],
  'f2.d2': ['8 piezas', '8 pieces'],
  'f2.d3': ['Pata #1 – #4', 'Leg #1 – #4'],
  'f2.d4': ['Refuerzo frontal #1 – #2', 'Front rail #1 – #2'],
  'f2.d5': ['Refuerzo lateral #1 – #2', 'Side rail #1 – #2'],

  'f3.title': ['Planos técnicos en PDF', 'Technical drawings in PDF'],
  'f3.body': [
    'Tres vistas ortográficas —frontal, lateral y superior— con las cotas generales del conjunto, más el resumen de materiales. Listo para imprimir y colgar al lado de la mesa de trabajo.',
    'Three orthographic views —front, side and top— with the overall dimensions, plus the bill of materials. Ready to print and pin next to the workbench.',
  ],
  'f3.t1': ['vistas acotadas', 'dimensioned views'],
  'f3.t2': ['A4 apaisado', 'A4 landscape'],
  'f3.t3': ['imágenes PNG por vista', 'PNG per view'],
  'f3.alt': [
    'Plano técnico con vista frontal y lateral acotadas en milímetros.',
    'Technical drawing with front and side views dimensioned in millimeters.',
  ],

  'f4.title': ['Plantillas y exportación 3D', 'Templates and 3D export'],
  'f4.body': [
    'Arrancá con una mesa o una estantería completas a partir de unas pocas medidas, y después modificá lo que quieras. Cuando lo tengas listo, exportalo a Blender o a tu CAD para renderizarlo o seguir trabajándolo.',
    'Start from a complete table or shelving unit built out of a few measurements, then change whatever you want. When it is ready, export it to Blender or your CAD to render it or keep working on it.',
  ],
  'f4.t3': ['proyecto .fmd', '.fmd project'],
  'f4.alt': [
    'Mesa y estantería generadas desde plantillas y ajustadas pieza por pieza.',
    'Table and shelving unit generated from templates and adjusted piece by piece.',
  ],

  /* ── Pasos ────────────────────────────────────────────────── */
  'steps.eyebrow': ['Cómo funciona', 'How it works'],
  'steps.title': ['Tres pasos, sin instalar nada.', 'Three steps, nothing to install.'],
  's1.title': ['Diseñá', 'Design'],
  's1.body': [
    'Agregá perfiles del catálogo o generá una plantilla, y acomodá las piezas con las medidas exactas de tu mueble.',
    'Add profiles from the catalog or generate a template, and lay out the pieces at the exact dimensions of your build.',
  ],
  's2.title': ['Revisá materiales', 'Check materials'],
  's2.body': [
    'Mirá los cortes por barra, los kilos y el costo estimado. Ajustá lo que haga falta y volvé a comprobar.',
    'Review the cuts per bar, the weight and the estimated cost. Adjust whatever you need and check again.',
  ],
  's3.title': ['Llevate los planos', 'Take the drawings'],
  's3.body': [
    'Descargá los planos acotados y la lista de cortes en PDF, y ponete a soldar con las medidas en la mano.',
    'Download the dimensioned drawings and the cut list as PDF, and start welding with the numbers in hand.',
  ],

  /* ── Público ──────────────────────────────────────────────── */
  'aud.eyebrow': ['Para quién es', "Who it's for"],
  'aud.title': [
    'Pensado para el que corta y suelda.',
    'Built for the people who cut and weld.',
  ],
  'aud.body': [
    'No hace falta saber CAD ni haber usado un programa 3D antes. Si sabés qué caño vas a comprar y qué medidas querés, sabés usarlo.',
    'No CAD skills needed, and no previous 3D software experience. If you know which tube you are buying and what dimensions you want, you know how to use it.',
  ],
  'aud.1': ['Soldadores', 'Welders'],
  'aud.2': ['Herreros', 'Ironworkers'],
  'aud.3': ['Carpintería metálica', 'Metal fabrication'],
  'aud.4': ['Makers y aficionados', 'Makers and hobbyists'],

  /* ── Preguntas ────────────────────────────────────────────── */
  'faq.eyebrow': ['Preguntas', 'FAQ'],
  'faq.title': ['Lo que suelen preguntar.', 'What people usually ask.'],
  'q1': ['¿Necesito instalar algo?', 'Do I need to install anything?'],
  'a1': [
    'No. Se abre en el navegador y ya podés empezar a diseñar. Tampoco hay que crear una cuenta ni dejar un mail.',
    'No. It opens in your browser and you can start designing right away. No account and no email required either.',
  ],
  'q2': ['¿Mis diseños se suben a algún lado?', 'Are my designs uploaded anywhere?'],
  'a2': [
    'No. Todo se procesa dentro de tu navegador: los diseños, los cálculos y los PDF. Nada viaja a un servidor, y el trabajo en curso queda guardado en tu propia computadora.',
    'No. Everything runs inside your browser: the designs, the calculations and the PDFs. Nothing travels to a server, and work in progress stays on your own computer.',
  ],
  'q3': ['¿Sirve para cualquier mueble?', 'Does it work for any piece of furniture?'],
  'a3': [
    'Sí. Las plantillas son solo un atajo para arrancar: podés mover, rotar y redimensionar cada pieza por separado, o armar el mueble desde cero pieza por pieza.',
    'Yes. Templates are just a shortcut to get going: you can move, rotate and resize every piece individually, or build the whole thing from scratch.',
  ],
  'q4': ['¿Qué puedo exportar?', 'What can I export?'],
  'a4': [
    'Planos técnicos y lista de materiales en PDF, imágenes PNG de cada vista, el modelo 3D en <span class="mono">.glb</span> (para Blender) o <span class="mono">.obj</span> (para CAD), y el archivo del proyecto para seguir editándolo después.',
    'Technical drawings and the bill of materials as PDF, PNG images of each view, the 3D model as <span class="mono">.glb</span> (for Blender) or <span class="mono">.obj</span> (for CAD), and the project file to keep editing later.',
  ],
  'q5': ['¿Es gratis?', 'Is it free?'],
  'a5': [
    'Sí, y sin publicidad. Si te resulta útil, podés apoyarlo con una donación.',
    'Yes, and ad-free. If you find it useful, you can support it with a donation.',
  ],

  /* ── Apoyo ────────────────────────────────────────────────── */
  'sup.title': ['¿Te ahorró una barra de más?', 'Saved you an extra bar?'],
  'sup.body': [
    'Este proyecto es gratis, sin cuentas ni publicidad, y lo mantengo en mi tiempo libre. Si te sirvió en el taller, podés invitarme un café: es lo que me permite seguir agregando funciones.',
    'This project is free, with no accounts and no ads, and I maintain it in my spare time. If it helped you in the workshop, you can buy me a coffee — that is what keeps new features coming.',
  ],
  'sup.cta': ['Invitame un café', 'Buy me a coffee'],
  'sup.note': [
    'Pago único, sin suscripción. También ayuda mucho recomendarlo a otro colega.',
    'One-time payment, no subscription. Recommending it to a colleague helps just as much.',
  ],

  /* ── Pie ──────────────────────────────────────────────────── */
  'foot.links': ['Enlaces del pie', 'Footer links'],
  'foot.openApp': ['Abrir la app', 'Open the app'],
};

let current = 'es';
const listeners = [];

export const getLang = () => current;
export const onLangChange = fn => listeners.push(fn);

/** Traduce una clave; si no existe, devuelve la clave (no rompe la página). */
export function t(key) {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[LANGS.indexOf(current)] ?? entry[0];
}

/** Vuelca las traducciones sobre el DOM. */
export function applyStatic() {
  document.documentElement.lang = current;
  document.title = t('meta.title');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.setAttribute('alt', t(el.dataset.i18nAlt));
  });
  document.querySelectorAll('[data-i18n-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  });
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try { localStorage.setItem(LS_KEY, lang); } catch { /* sin almacenamiento */ }
  applyStatic();
  listeners.forEach(fn => fn(lang));
}

/** Idioma inicial: guardado > idioma del navegador > español. */
export function initLang() {
  let lang = null;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (LANGS.includes(saved)) lang = saved;
  } catch { /* sin almacenamiento */ }
  if (!lang) lang = navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  current = lang;
  applyStatic();
  return current;
}
