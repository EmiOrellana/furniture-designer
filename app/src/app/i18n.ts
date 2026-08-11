/**
 * Internacionalización mínima: diccionario ES/EN, interpolación {var} y
 * barrido de atributos data-i18n* en el HTML estático.
 * Sin dependencias — seguro de importar desde Node (tests).
 */

export type Lang = 'es' | 'en';

const LS_LANG = 'fm3_lang';

/** clave → [español, inglés] */
export const DICT: Record<string, [string, string]> = {
  'locale': ['es-AR', 'en-US'],
  'brand.tag': ['Diseñador 3D de muebles', '3D furniture designer'],

  // Barra superior
  'tip.undo': ['Deshacer (Ctrl+Z)', 'Undo (Ctrl+Z)'],
  'tip.redo': ['Rehacer (Ctrl+Y)', 'Redo (Ctrl+Y)'],
  'btn.new': ['Nuevo', 'New'],
  'btn.open': ['Abrir', 'Open'],
  'btn.save': ['Guardar', 'Save'],
  'tip.save': ['Guardar proyecto (Ctrl+S)', 'Save project (Ctrl+S)'],
  'btn.bom': ['Materiales y cortes', 'Materials & cuts'],
  'btn.export': ['Exportar', 'Export'],

  // Panel izquierdo
  'sec.add': ['Agregar perfil', 'Add profile'],
  'sec.templates': ['Plantillas', 'Templates'],
  'sec.shortcuts': ['Atajos', 'Shortcuts'],
  'btn.addPiece': ['Agregar pieza', 'Add piece'],
  'field.length': ['Largo', 'Length'],
  'unit.mm': ['mm', 'mm'],
  'unit.deg': ['grados', 'degrees'],
  'tpl.mesa': ['Mesa', 'Table'],
  'tpl.estante': ['Estantería', 'Shelving unit'],
  'tpl.hint': [
    'Genera un mueble paramétrico completo, listo para ajustar pieza por pieza.',
    'Generates a complete parametric piece of furniture, ready to tweak piece by piece.',
  ],
  'sc.move': ['mover', 'move'],
  'sc.rotate': ['rotar', 'rotate'],
  'sc.frame': ['encuadrar', 'frame'],
  'sc.measure': ['medir', 'measure'],
  'sc.duplicate': ['duplicar', 'duplicate'],
  'sc.delete': ['eliminar', 'delete'],
  'sc.altclick': ['+click pieza de grupo', '+click piece in group'],
  'sc.shiftclick': ['+click multi', '+click multi'],

  // Toolbar del viewport
  'tip.select': ['Seleccionar (Esc)', 'Select (Esc)'],
  'tip.move': ['Mover (G)', 'Move (G)'],
  'tip.rotate': ['Rotar (R)', 'Rotate (R)'],
  'tip.snap': ['Ajuste a grilla y a 15° al rotar', 'Snap to grid and to 15° when rotating'],
  'tip.viewIso': ['Vista isométrica (Inicio)', 'Isometric view (Home)'],
  'tip.viewFront': ['Vista frontal', 'Front view'],
  'tip.viewSide': ['Vista lateral', 'Side view'],
  'tip.viewTop': ['Vista superior', 'Top view'],
  'view.btnFront': ['F', 'F'],
  'view.btnSide': ['L', 'S'],
  'view.btnTop': ['S', 'T'],
  'tip.grid': ['Grilla', 'Grid'],
  'tip.labels': ['Etiquetas', 'Labels'],
  'tip.measure': ['Medir distancia (M)', 'Measure distance (M)'],
  'tip.frameSel': ['Encuadrar selección (F)', 'Frame selection (F)'],
  'tip.help': ['Ayuda', 'Help'],

  // Tarjeta de ayuda
  'help.title': ['Controles', 'Controls'],
  'help.orbit': ['Orbitar', 'Orbit'],
  'help.orbitV': ['arrastrar', 'drag'],
  'help.zoom': ['Zoom', 'Zoom'],
  'help.zoomV': ['rueda', 'wheel'],
  'help.pan': ['Panear', 'Pan'],
  'help.panV': ['click derecho', 'right-click'],
  'help.sel': ['Seleccionar', 'Select'],
  'help.selV': ['click', 'click'],
  'help.multi': ['Multi-selección', 'Multi-select'],
  'help.multiV': ['<kbd>Shift</kbd> + click', '<kbd>Shift</kbd> + click'],
  'help.grp': ['Pieza dentro de grupo', 'Piece inside a group'],
  'help.grpV': ['<kbd>Alt</kbd> + click', '<kbd>Alt</kbd> + click'],
  'help.nudge': ['Empujar pieza', 'Nudge piece'],
  'help.nudgeV': [
    '<kbd>←→↑↓</kbd> · <kbd>RePág</kbd>/<kbd>AvPág</kbd>',
    '<kbd>←→↑↓</kbd> · <kbd>PgUp</kbd>/<kbd>PgDn</kbd>',
  ],
  'help.save': ['Guardar', 'Save'],
  'help.saveV': ['<kbd>Ctrl</kbd>+<kbd>S</kbd>', '<kbd>Ctrl</kbd>+<kbd>S</kbd>'],

  // Estado vacío y barra de estado
  'empty.title': ['Empezá tu mueble', 'Start your build'],
  'empty.body': [
    'Elegí un perfil del catálogo y agregalo,<br>o generá una <b>plantilla</b> para arrancar rápido.',
    'Pick a profile from the catalog and add it,<br>or generate a <b>template</b> to get going fast.',
  ],
  'status.default': [
    'Orbitar: arrastrar · Zoom: rueda · Panear: click derecho',
    'Orbit: drag · Zoom: wheel · Pan: right-click',
  ],
  'status.move': [
    'Arrastrá las flechas del gizmo para mover — el snap ajusta a la grilla',
    'Drag the gizmo arrows to move — snap locks to the grid',
  ],
  'status.rotate': [
    'Arrastrá los anillos para rotar — el snap ajusta a 15°',
    'Drag the rings to rotate — snap locks to 15°',
  ],
  'status.measure': [
    'Medir: hacé click en dos puntos (piezas o piso) · Esc para salir',
    'Measure: click two points (pieces or floor) · Esc to exit',
  ],

  // Inspector
  'sec.props': ['Propiedades', 'Properties'],
  'field.name': ['Nombre', 'Name'],
  // El sufijo del marco de referencia no es decorativo: la posición es
  // absoluta y la rotación es relativa al grupo que contiene la pieza.
  'field.pos': ['Posición global', 'Global position'],
  'field.rot': ['Rotación relativa', 'Relative rotation'],
  'field.color': ['Color', 'Color'],
  'field.opacity': ['Opacidad', 'Opacity'],
  'act.dup': ['Duplicar', 'Duplicate'],
  'act.del': ['Eliminar', 'Delete'],
  'act.mirrorX': ['Espejo X', 'Mirror X'],
  'act.mirrorZ': ['Espejo Z', 'Mirror Z'],
  'act.array': ['Serie…', 'Array…'],
  'act.group': ['Agrupar', 'Group'],
  'tip.mirrorX': [
    'Copia espejada respecto al plano YZ del origen',
    'Mirrored copy across the origin YZ plane',
  ],
  'tip.mirrorZ': [
    'Copia espejada respecto al plano XY del origen',
    'Mirrored copy across the origin XY plane',
  ],
  'multi.note': [
    '{u} elementos seleccionados ({n} piezas). Podés duplicar, agrupar o eliminar en bloque.',
    '{u} items selected ({n} pieces). You can duplicate, group or delete them in bulk.',
  ],
  'sel.elements': ['{n} elementos', '{n} items'],
  'w.piece': ['pieza', 'piece'],
  'w.bar': ['barra', 'bar'],

  // Lista de piezas
  'sec.pieces': ['Piezas', 'Pieces'],
  'list.empty': [
    'Sin piezas todavía.<br>Agregá un perfil desde el catálogo.',
    'No pieces yet.<br>Add a profile from the catalog.',
  ],
  'eye.toggle': ['Mostrar/ocultar', 'Show/hide'],
  'group.name': ['Grupo {n}', 'Group {n}'],
  'group.copy': ['{name} copia', '{name} copy'],
  'group.created': ['{name} creado ({n} piezas)', '{name} created ({n} pieces)'],

  // Materiales (catálogo)
  'mat.tube_square': ['Tubo cuadrado', 'Square tube'],
  'mat.tube_rect': ['Tubo rectangular', 'Rectangular tube'],
  'mat.tube_round': ['Tubo redondo', 'Round tube'],
  'mat.angle': ['Ángulo (L)', 'Angle (L)'],
  'mat.flat': ['Planchuela', 'Flat bar'],
  'mat.wood': ['Madera (placa)', 'Wood (board)'],
  'hint.tube_square': ['Tubo estructural cuadrado', 'Square structural tube'],
  'hint.tube_rect': ['Tubo estructural rectangular', 'Rectangular structural tube'],
  'hint.tube_round': ['Tubo estructural circular', 'Round structural tube'],
  'hint.angle': ['Perfil L de alas iguales', 'Equal-leg L profile'],
  'hint.flat': ['Barra plana maciza', 'Solid flat bar'],
  'hint.wood': ['Placa de madera — se computa por m²', 'Wood board — counted in m²'],
  'f.profile': ['Perfil', 'Profile'],
  'f.wall': ['Pared', 'Wall'],
  'f.base': ['Base', 'Base'],
  'f.height': ['Altura', 'Height'],
  'f.diameter': ['Diámetro', 'Diameter'],
  'f.wing': ['Ala', 'Leg'],
  'f.thickness': ['Espesor', 'Thickness'],
  'f.width': ['Ancho', 'Width'],

  // Modales
  'confirm.yes': ['Sí, confirmar', 'Yes, confirm'],
  'confirm.cancel': ['Cancelar', 'Cancel'],
  'confirm.new': ['¿Nuevo proyecto?', 'New project?'],
  'confirm.newMsg': [
    'Se borrarán todas las piezas y grupos del diseño actual.',
    'All pieces and groups in the current design will be deleted.',
  ],
  'bom.title': ['Materiales y cortes', 'Materials & cuts'],
  'bom.bar': ['Barra comercial', 'Stock bar length'],
  'bom.kerf': ['Kerf (corte)', 'Kerf (cut width)'],
  'btn.close': ['Cerrar', 'Close'],
  'bom.pdf': ['Exportar PDF', 'Export PDF'],
  'bom.thPiece': ['Pieza', 'Piece'],
  'bom.thCut': ['Corte', 'Cut'],
  'bom.thWeight': ['Peso', 'Weight'],
  'bom.hidden': ['(oculta)', '(hidden)'],
  'bom.util': ['aprovechamiento {p}%', '{p}% utilization'],
  'bom.barRow': ['Barra {i}', 'Bar {i}'],
  'bom.rest': ['(sobra {mm} mm)', '({mm} mm left over)'],
  'bom.over': ['¡Corte de {mm} mm supera la barra!', '{mm} mm cut exceeds the bar!'],
  'bom.price': ['Precio $/{u}', 'Price $/{u}'],
  'bom.subtotal': ['subtotal ${c}', 'subtotal ${c}'],
  'bom.totalWeight': ['Peso total', 'Total weight'],
  'bom.cost': ['Costo estimado', 'Estimated cost'],
  'bom.empty': ['No hay piezas todavía.', 'No pieces yet.'],

  'exp.title': ['Exportar', 'Export'],
  'exp.pdf': ['Planos PDF', 'PDF drawings'],
  'exp.pdfDesc': [
    '3 vistas ortográficas con cotas + resumen',
    '3 orthographic views with dimensions + summary',
  ],
  'exp.png': ['Imagen PNG', 'PNG image'],
  'exp.pngDesc': [
    'Vista frontal, lateral o superior con cotas',
    'Front, side or top view with dimensions',
  ],
  'exp.glb': ['Modelo 3D (.glb)', '3D model (.glb)'],
  'exp.glbDesc': ['Para Blender, con colores y nombres', 'For Blender, with colors and names'],
  'exp.obj': ['Modelo 3D (.obj)', '3D model (.obj)'],
  'exp.objDesc': ['Para CAD — unidades en mm', 'For CAD — units in mm'],
  'view.front': ['Frontal', 'Front'],
  'view.side': ['Lateral', 'Side'],
  'view.top': ['Superior', 'Top'],

  'arr.title': ['Repetir en serie', 'Linear array'],
  'arr.count': ['Cantidad total (incluida la original)', 'Total count (including the original)'],
  'arr.sep': ['Separación entre copias', 'Spacing between copies'],
  'arr.ok': ['Generar', 'Generate'],

  // Plantillas (campos y nombres de piezas)
  'tplf.width': ['Ancho (mm)', 'Width (mm)'],
  'tplf.depth': ['Profundidad (mm)', 'Depth (mm)'],
  'tplf.height': ['Altura total (mm)', 'Total height (mm)'],
  'tplf.heightS': ['Altura (mm)', 'Height (mm)'],
  'tplf.profile': ['Perfil del tubo (mm)', 'Tube profile (mm)'],
  'tplf.top': ['Espesor de tapa (mm)', 'Top thickness (mm)'],
  'tplf.shelves': ['Cantidad de estantes', 'Number of shelves'],
  'tplf.plate': ['Espesor de placa (mm)', 'Board thickness (mm)'],
  'name.leg': ['Pata', 'Leg'],
  'name.front': ['Refuerzo frontal', 'Front rail'],
  'name.side': ['Refuerzo lateral', 'Side rail'],
  'name.top': ['Tapa', 'Top'],
  'name.upright': ['Parante', 'Upright'],
  'name.rail': ['Travesaño', 'Crossbar'],
  'name.shelf': ['Estante', 'Shelf'],

  // Toasts
  'toast.select2': ['Seleccioná al menos 2 piezas (Shift+click)', 'Select at least 2 pieces (Shift+click)'],
  'toast.noGroup': ['No hay grupo seleccionado', 'No group selected'],
  'toast.selectFirst': ['Seleccioná algo primero', 'Select something first'],
  'toast.mirror': ['Copia en espejo respecto al origen', 'Mirrored copy across the origin'],
  'toast.sepZero': ['La separación no puede ser 0', 'Spacing cannot be 0'],
  'toast.series': ['Serie de {n} generada', 'Array of {n} generated'],
  'toast.tplDone': [
    'Plantilla generada — ajustala pieza por pieza a gusto',
    'Template generated — tweak it piece by piece',
  ],
  'toast.noUndo': ['Nada para deshacer', 'Nothing to undo'],
  'toast.noRedo': ['Nada para rehacer', 'Nothing to redo'],
  'toast.noPieces': ['No hay piezas', 'No pieces'],
  'toast.noSave': ['No hay piezas para guardar', 'No pieces to save'],
  'toast.labelsLimit': [
    'Las etiquetas se ocultan con más de {n} piezas: se superponen y no se leen',
    'Labels are hidden above {n} pieces: they overlap and become unreadable',
  ],
  // Motivos de fallo al abrir un archivo. Los lanza el modelo como clave.
  'err.notProject': ['El archivo no es un proyecto FerroMadera', 'Not a FerroMadera project file'],
  'err.futureVersion': [
    'El archivo es de una versión más nueva (v{v}). Actualizá la aplicación.',
    'This file uses a newer version (v{v}). Update the app.',
  ],
  'err.unreadable': ['No se pudo leer el archivo', 'The file could not be read'],
  'toast.autosaveErr': [
    'No se pudo autoguardar (almacenamiento lleno). Guardá el proyecto en un archivo.',
    'Autosave failed (storage full). Save your project to a file.',
  ],
  'toast.noExport': ['No hay piezas para exportar', 'No pieces to export'],
  'toast.saved': ['Proyecto guardado', 'Project saved'],
  'toast.loaded': ['Proyecto cargado: {c}', 'Project loaded: {c}'],
  'toast.loadErr': ['Error al cargar: {e}', 'Load error: {e}'],
  'toast.restored': ['Diseño restaurado ({c})', 'Design restored ({c})'],
  'toast.glb': [
    'Modelo .glb exportado (escala en metros, listo para Blender)',
    '.glb exported (meter scale, ready for Blender)',
  ],
  'toast.glbErr': ['Error al exportar GLB: {e}', 'GLB export error: {e}'],
  'toast.obj': ['Modelo .obj exportado (unidades en mm)', '.obj exported (units in mm)'],
  'toast.plans': ['Planos PDF generados', 'PDF drawings generated'],
  'toast.png': ['Imagen PNG generada', 'PNG image generated'],
  'toast.bomPdf': ['PDF de materiales generado', 'Materials PDF generated'],

  // PDFs / PNG export
  'pdf.plansTitle': ['FERROMADERA - PLANOS TECNICOS', 'FERROMADERA - TECHNICAL DRAWINGS'],
  'pdf.viewFront': ['VISTA FRONTAL', 'FRONT VIEW'],
  'pdf.viewSide': ['VISTA LATERAL', 'SIDE VIEW'],
  'pdf.viewTop': ['VISTA SUPERIOR', 'TOP VIEW'],
  'pdf.sheet': ['Hoja {a} de {b}', 'Sheet {a} of {b}'],
  'pdf.sheetN': ['Hoja {a}', 'Sheet {a}'],
  'pdf.unit': ['unidad: mm', 'units: mm'],
  'pdf.summary': ['RESUMEN DE MATERIALES', 'BILL OF MATERIALS'],
  'pdf.totalWeight': ['PESO TOTAL: {kg} kg', 'TOTAL WEIGHT: {kg} kg'],
  'pdf.bomTitle': ['FERROMADERA - LISTA DE MATERIALES Y CORTES', 'FERROMADERA - MATERIALS & CUT LIST'],
  'pdf.bomMeta': [
    '{date}  ·  {c}  ·  barra: {bar} mm  ·  kerf: {kerf} mm',
    '{date}  ·  {c}  ·  stock bar: {bar} mm  ·  kerf: {kerf} mm',
  ],
  'pdf.total': ['TOTAL: {c}', 'TOTAL: {c}'],
  'pdf.barsNeeded': ['Barras necesarias: {n} x {m} m', 'Bars needed: {n} x {m} m'],
  'pdf.barRow': ['Barra {i}:  {cuts}   (sobra {mm} mm)', 'Bar {i}:  {cuts}   ({mm} mm left)'],
  'pdf.over': [
    'Atencion: el corte de {mm} mm supera el largo de barra',
    'Warning: the {mm} mm cut exceeds the bar length',
  ],
  'pdf.cost': ['COSTO ESTIMADO: ${c}', 'ESTIMATED COST: ${c}'],
  'png.set': ['DIMENSIONES DEL CONJUNTO', 'OVERALL DIMENSIONS'],
  'png.tbl': ['PIEZAS (dimensiones de fabricacion)', 'PIECES (fabrication dimensions)'],
  'png.h': ['Horizontal:', 'Horizontal:'],
  'png.v': ['Vertical:', 'Vertical:'],
  'png.thPiece': ['PIEZA', 'PIECE'],
  'png.len': ['LARGO', 'LENGTH'],
  'png.wid': ['ANCHO', 'WIDTH'],
  'png.hei': ['ALTO', 'HEIGHT'],
};

let current: Lang = 'es';
const subs: (() => void)[] = [];

export function getLang(): Lang { return current; }

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_LANG, lang);
  } catch { /* sin almacenamiento */ }
  applyStatic();
  for (const fn of subs) fn();
}

/** Suscribe un callback para re-renderizar al cambiar idioma. */
export function onLangChange(fn: () => void): void { subs.push(fn); }

/** Traduce una clave, con interpolación de {variables}. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let out = entry ? entry[current === 'es' ? 0 : 1] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/**
 * Cuenta con su sustantivo: «1 pieza», «3 piezas».
 *
 * Único lugar donde vive la regla del plural. Español e inglés la forman
 * agregando «s» a las palabras que la app pluraliza —pieza/piece, barra/bar—;
 * el día que entre un idioma que no, se cambia acá y en ningún otro lado.
 */
export function plural(n: number, key: string): string {
  return `${n} ${t(key)}${n === 1 ? '' : 's'}`;
}

/** Locale para fechas según idioma. */
export function localeDate(): string {
  return new Date().toLocaleDateString(t('locale'));
}

/** Aplica traducciones a los elementos estáticos del documento. */
export function applyStatic(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-tip]').forEach(el => {
    el.setAttribute('data-tip', t(el.dataset.i18nTip!));
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel!));
  });
}

/** Idioma inicial: guardado > idioma del navegador > español. */
export function initLang(): Lang {
  let lang: Lang | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LS_LANG);
      if (saved === 'es' || saved === 'en') lang = saved;
    }
  } catch { /* sin almacenamiento */ }
  if (!lang && typeof navigator !== 'undefined') {
    lang = navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  current = lang ?? 'es';
  return current;
}
