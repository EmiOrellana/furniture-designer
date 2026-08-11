import * as THREE from 'three';
import type { PieceType, ProjectState, Unit, ViewName } from '../model/types';
import { MAT, PIECE_TYPES, defaultParams, pieceDims, pieceWeight } from '../model/materials';
import { barUtilization, calcBOM, packBars, totalWeight } from '../model/bom';
import { ProjectError, parseProject } from '../model/serialize';
import { Viewer, type GizmoMode } from '../scene/viewer';
import { setOpacity, visibleMeshes } from '../scene/builders';
import { Store, type Piece } from './state';
import { LABEL_LIMIT, Overlay } from './overlay';
import { TEMPLATES } from './templates';
import { applyStatic, getLang, initLang, onLangChange, plural, setLang, t, type Lang } from './i18n';
import { downloadGLB, downloadOBJ, downloadBlob, stamp } from '../export/model3d';
import { exportPlansPDF, exportViewPNG } from '../export/plans';
import { downloadMaterialsPDF } from '../export/bomPdf';

const LS_PRICES = 'fm3_prices';
const LS_SETTINGS = 'fm3_settings';

/** Tope de copias en una serie. Coincide con el `max` del input en index.html. */
const ARRAY_MAX = 100;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const nPieces = (n: number) => plural(n, 'w.piece');

export function initApp(): void {
  /* ══ Núcleo ══════════════════════════════════════════════════ */
  const viewer = new Viewer($('viewport'), {
    onPick: handlePick,
    onGizmoStart: () => store.pushUndo(),
    onGizmoEnd: () => { renderInspector(); store.scheduleAutosave(); },
    onGizmoChange: () => renderInspector(),
  });
  const store = new Store(viewer);
  const overlay = new Overlay($('overlay') as unknown as HTMLCanvasElement, viewer, store);

  let gizmoMode: GizmoMode = 'select';
  let currentType: PieceType = 'tube_square';
  let propSnapshot: ProjectState | null = null;
  let dimSig = '';
  let lastNudge = 0;
  let confirmCb: (() => void) | null = null;
  let currentTpl = 'mesa';

  /* ══ Idioma ══════════════════════════════════════════════════ */
  function updateLangButtons(): void {
    (['es', 'en'] as const).forEach(l => {
      $(`lang-${l}`).classList.toggle('active', getLang() === l);
      $(`lang-${l}`).setAttribute('aria-pressed', String(getLang() === l));
    });
  }
  $('lang-es').addEventListener('click', () => setLang('es' as Lang));
  $('lang-en').addEventListener('click', () => setLang('en' as Lang));
  onLangChange(() => {
    updateLangButtons();
    renderCatalog();
    renderNewParams(true);
    dimSig = ''; // fuerza re-render de labels de dimensiones
    renderLists();
    renderInspector();
    renderStatus();
    updateHintForMode();
    if (!$('modal-materials').hidden) refreshBOM();
  });

  /* ══ Ajustes persistentes ════════════════════════════════════ */
  function getPrices(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(LS_PRICES) ?? '{}'); } catch { return {}; }
  }
  function setPrice(key: string, val: number): void {
    const p = getPrices();
    if (val > 0) p[key] = val;
    else delete p[key];
    try { localStorage.setItem(LS_PRICES, JSON.stringify(p)); } catch { /* sin espacio */ }
  }
  function saveSettings(): void {
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify({
        snapOn: ($('snap-on') as HTMLInputElement).checked,
        snapStep: ($('snap-step') as HTMLSelectElement).value,
        barLen: ($('bom-barlen') as HTMLInputElement).value,
        kerf: ($('bom-kerf') as HTMLInputElement).value,
      }));
    } catch { /* sin espacio */ }
  }
  function loadSettings(): void {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}');
      if (s.snapOn !== undefined) ($('snap-on') as HTMLInputElement).checked = s.snapOn;
      if (s.snapStep) ($('snap-step') as HTMLSelectElement).value = s.snapStep;
      if (s.barLen) ($('bom-barlen') as HTMLInputElement).value = s.barLen;
      if (s.kerf) ($('bom-kerf') as HTMLInputElement).value = s.kerf;
    } catch { /* ajustes corruptos: ignorar */ }
  }
  const snapStep = () =>
    ($('snap-on') as HTMLInputElement).checked ? parseFloat(($('snap-step') as HTMLSelectElement).value) : 10;
  function applySnap(): void {
    viewer.setSnap(($('snap-on') as HTMLInputElement).checked, parseFloat(($('snap-step') as HTMLSelectElement).value));
    saveSettings();
  }

  /* ══ Catálogo ════════════════════════════════════════════════ */
  function renderCatalog(): void {
    $('catalog').innerHTML = PIECE_TYPES.map(ty => `
      <button class="cat-card ${ty === currentType ? 'active' : ''}" data-type="${ty}" role="option"
              aria-selected="${ty === currentType}">
        <svg aria-hidden="true"><use href="#${MAT[ty].icon}"/></svg>
        <span>${t(MAT[ty].label)}</span>
      </button>`).join('');
  }
  function renderNewParams(keepValues = false): void {
    const m = MAT[currentType];
    const prev: Record<string, string> = {};
    if (keepValues) {
      document.querySelectorAll<HTMLInputElement>('#new-params input').forEach(el => {
        prev[el.id] = el.value;
      });
    }
    const pairs = m.fields.map(f => `
      <div class="field">
        <label for="new-${f.key}">${t(f.label)} <span class="unit">${t('unit.mm')}</span></label>
        <input type="number" id="new-${f.key}" value="${f.def}" min="0.1" step="any">
      </div>`).join('');
    $('new-params').innerHTML = `
      <div class="field-pair">${pairs}</div>
      <div class="field">
        <label for="new-L">${t('field.length')} <span class="unit">${t('unit.mm')}</span></label>
        <input type="number" id="new-L" value="1000" min="1" max="12000">
      </div>
      <p class="hint">${t(m.hint)}.</p>`;
    if (keepValues) {
      for (const [id, v] of Object.entries(prev)) {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = v;
      }
    }
  }
  $('catalog').addEventListener('click', e => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.cat-card');
    if (!card) return;
    currentType = card.dataset.type as PieceType;
    renderCatalog();
    renderNewParams();
  });

  function addPieceFromUI(): void {
    store.pushUndo();
    const params = defaultParams(currentType, parseFloat(($('new-L') as HTMLInputElement).value) || 1000);
    for (const f of MAT[currentType].fields) {
      const v = parseFloat(($(`new-${f.key}`) as HTMLInputElement).value);
      if (v > 0) params[f.key] = v;
    }
    const p = store.createPiece(currentType, params);
    store.setSel([{ t: 'p', id: p.id }]);
    store.scheduleAutosave();
  }
  $('btn-add').addEventListener('click', addPieceFromUI);

  /* ══ Selección y gizmo ═══════════════════════════════════════ */
  function handlePick(e: PointerEvent): void {
    if (overlay.measuring) {
      const pt = viewer.pickPoint(e);
      if (pt) overlay.addMeasurePoint(pt);
      return;
    }
    const id = viewer.pickPieceId(e);
    if (id != null) {
      const p = store.pieceById(id);
      if (!p) return;
      const unit: Unit = p.groupId != null && !e.altKey ? { t: 'g', id: p.groupId } : { t: 'p', id: p.id };
      if (e.shiftKey) store.toggleSel(unit);
      else store.setSel([unit]);
    } else if (!e.shiftKey) {
      store.setSel([]);
    }
  }

  function updateGizmo(): void {
    const target = store.sel.length === 1 ? store.unitObj(store.sel[0]) ?? null : null;
    viewer.setGizmoMode(gizmoMode, target);
  }

  function updateHintForMode(): void {
    if (overlay.measuring) setHint(t('status.measure'));
    else if (gizmoMode === 'move') setHint(t('status.move'));
    else if (gizmoMode === 'rotate') setHint(t('status.rotate'));
    else setHint(t('status.default'));
  }

  function setGizmoMode(m: GizmoMode): void {
    gizmoMode = m;
    (['select', 'move', 'rotate'] as const).forEach(k =>
      $(`tool-${k}`).classList.toggle('active', k === m));
    updateGizmo();
    updateHintForMode();
  }
  $('tool-select').addEventListener('click', () => setGizmoMode('select'));
  $('tool-move').addEventListener('click', () => setGizmoMode('move'));
  $('tool-rotate').addEventListener('click', () => setGizmoMode('rotate'));
  $('snap-on').addEventListener('change', applySnap);
  $('snap-step').addEventListener('change', applySnap);

  (['iso', 'front', 'side', 'top'] as const).forEach(v =>
    $(`view-${v}`).addEventListener('click', () => viewer.frameView(v)));

  $('btn-grid').addEventListener('click', () => {
    viewer.grid.visible = !viewer.grid.visible;
    $('btn-grid').classList.toggle('active', viewer.grid.visible);
    $('btn-grid').setAttribute('aria-pressed', String(viewer.grid.visible));
  });
  /**
   * El botón refleja si las etiquetas se están viendo, no si están pedidas.
   * Por encima del tope se apagan solas, y antes el botón seguía encendido
   * mostrando algo que no pasaba.
   */
  function updateLabelsButton(): void {
    const viendose = overlay.showLabels && store.pieces.length <= LABEL_LIMIT;
    $('btn-labels').classList.toggle('active', viendose);
    $('btn-labels').setAttribute('aria-pressed', String(viendose));
  }
  $('btn-labels').addEventListener('click', () => {
    overlay.showLabels = !overlay.showLabels;
    updateLabelsButton();
    if (overlay.showLabels && store.pieces.length > LABEL_LIMIT) {
      toast(t('toast.labelsLimit', { n: LABEL_LIMIT }));
    }
  });
  function toggleMeasure(): void {
    overlay.measuring = !overlay.measuring;
    overlay.clearMeasure();
    $('btn-measure').classList.toggle('active', overlay.measuring);
    $('btn-measure').setAttribute('aria-pressed', String(overlay.measuring));
    viewer.renderer.domElement.style.cursor = overlay.measuring ? 'crosshair' : '';
    updateHintForMode();
  }
  $('btn-measure').addEventListener('click', toggleMeasure);
  $('btn-frame').addEventListener('click', frameSelection);
  $('btn-help').addEventListener('click', () => {
    const card = $('help-card');
    card.hidden = !card.hidden;
    $('btn-help').classList.toggle('active', !card.hidden);
    $('btn-help').setAttribute('aria-pressed', String(!card.hidden));
  });

  function frameSelection(): void {
    if (store.sel.length === 0) {
      viewer.frameView('iso');
      return;
    }
    const box = new THREE.Box3();
    for (const u of store.sel) {
      const o = store.unitObj(u);
      if (!o) continue;
      // Sólo lo visible: encuadrar por una pieza oculta dejaba aire inexplicable.
      for (const m of visibleMeshes(o)) box.expandByObject(m);
    }
    viewer.frameBox(box);
  }

  function setHint(text: string): void {
    $('status-hint').textContent = text;
  }

  /* ══ Inspector ═══════════════════════════════════════════════ */
  /*
   * Editar un campo del inspector dispara `input` en cada tecla, pero debe
   * dejar un único paso de historial: se captura el estado al empezar a editar
   * y se apila al terminar.
   *
   * Dos cuidados, los dos por la misma razón —entre el comienzo y el final de
   * una edición puede pasar cualquier otra cosa—:
   *
   *  · La captura va en el primer `input`, no al enfocar el campo. Enfocar y
   *    no tocar nada no es una edición.
   *  · Se anota en qué punto del historial se capturó. Si el historial avanzó
   *    desde entonces, la captura quedó vieja y se descarta: apilarla movería
   *    el punto de retorno más atrás de lo debido y deshacer se comería la
   *    acción intermedia.
   *
   * No alcanza con limpiar al perder el foco: si el campo se rehace por un
   * re-render, no hay `blur` que lo dispare y la captura quedaría colgada.
   */
  let propRev = -1;
  function propBeginEdit(): void {
    if (propSnapshot && propRev !== store.historyRev) propSnapshot = null;
    if (!propSnapshot) {
      propSnapshot = store.serialize();
      propRev = store.historyRev;
    }
  }
  function propCommit(): void {
    const snap = propSnapshot;
    propSnapshot = null;
    if (snap && propRev === store.historyRev) store.pushUndoState(snap);
  }
  function bindProp(id: string, onInput: () => void): void {
    const el = $(id);
    el.addEventListener('input', () => { propBeginEdit(); onInput(); });
    el.addEventListener('change', propCommit);
  }

  function renderInspector(): void {
    const insp = $('inspector');
    const selCard = $('sel-card');
    if (store.sel.length === 0) {
      insp.hidden = true;
      selCard.hidden = true;
      return;
    }
    insp.hidden = false;
    selCard.hidden = false;

    if (store.sel.length > 1) {
      $('inspector-single').hidden = true;
      $('inspector-multi').hidden = false;
      const n = store.selectedPieces().length;
      $('multi-note').textContent = t('multi.note', { u: store.sel.length, n });
      $('sel-name').textContent = t('sel.elements', { n: store.sel.length });
      $('sel-meta').textContent = nPieces(n);
      return;
    }

    $('inspector-single').hidden = false;
    $('inspector-multi').hidden = true;
    const u = store.sel[0];
    const obj = store.unitObj(u);
    if (!obj) return;

    const setIfIdle = (id: string, val: string) => {
      const el = $(id) as HTMLInputElement;
      if (document.activeElement !== el) el.value = val;
    };
    /*
     * La posición es global y la rotación es relativa al padre. Son marcos
     * distintos a propósito, y por eso las etiquetas lo dicen.
     *
     * Probé mostrar las dos en global y sale peor: al pasar el cuaternión
     * mundial a ángulos de Euler, una pieza a 30° dentro de un grupo a 90°
     * —o sea 120° en Y— se lee «-180, 60, -180», que es la misma rotación
     * escrita de otra forma. Correcto e ilegible. La rotación relativa al
     * conjunto es además la que uno quiere editar, y es lo que hacen los demás
     * programas 3D.
     */
    const wp = obj.getWorldPosition(new THREE.Vector3());
    setIfIdle('prop-px', String(Math.round(wp.x)));
    setIfIdle('prop-py', String(Math.round(wp.y)));
    setIfIdle('prop-pz', String(Math.round(wp.z)));
    (['x', 'y', 'z'] as const).forEach(ax => {
      setIfIdle(`prop-r${ax}`, String(Math.round(deg(obj.rotation[ax]))));
    });

    if (u.t === 'p') {
      const p = store.pieceById(u.id)!;
      setIfIdle('prop-name', p.name);
      $('prop-dims').hidden = false;
      $('prop-look').hidden = false;
      renderDimFields(p);
      ($('prop-color') as HTMLInputElement).value = p.color;
      ($('prop-opacity') as HTMLInputElement).value = String(Math.round(p.opacity * 100));
      $('opacity-val').textContent = `${Math.round(p.opacity * 100)}%`;
      const [L, A, H] = pieceDims(p);
      $('sel-name').textContent = p.name;
      $('sel-meta').textContent = `${L} × ${A} × ${H} mm · ${pieceWeight(p).toFixed(2)} kg`;
    } else {
      const g = store.groupById(u.id)!;
      setIfIdle('prop-name', g.name);
      $('prop-dims').hidden = true;
      $('prop-look').hidden = true;
      dimSig = '';
      const members = store.pieces.filter(p => p.groupId === g.id);
      const kg = totalWeight(members);
      $('sel-name').textContent = g.name;
      $('sel-meta').textContent = `${nPieces(members.length)} · ${kg.toFixed(2)} kg`;
    }
  }

  function renderDimFields(p: Piece): void {
    const wrap = $('prop-dims');
    const sig = `${p.type}|${p.id}|${getLang()}`;
    const keys = ['L', ...MAT[p.type].fields.map(f => f.key)];
    if (dimSig !== sig) {
      dimSig = sig;
      const fieldHtml = (key: string, label: string) => `
        <div class="field">
          <label for="dim-${key}">${label} <span class="unit">${t('unit.mm')}</span></label>
          <input type="number" id="dim-${key}" min="0.1" step="any">
        </div>`;
      wrap.innerHTML = fieldHtml('L', t('field.length')) +
        MAT[p.type].fields.map(f => fieldHtml(f.key, t(f.label))).join('');
      for (const k of keys) bindProp(`dim-${k}`, applyDims);
    }
    for (const k of keys) {
      const el = $(`dim-${k}`) as HTMLInputElement;
      if (el && document.activeElement !== el) el.value = String(p.params[k]);
    }
  }

  function applyDims(): void {
    if (store.sel.length !== 1 || store.sel[0].t !== 'p') return;
    const p = store.pieceById(store.sel[0].id);
    if (!p) return;
    const keys = ['L', ...MAT[p.type].fields.map(f => f.key)];
    let changed = false;
    for (const k of keys) {
      const v = parseFloat(($(`dim-${k}`) as HTMLInputElement).value);
      if (v > 0 && v !== p.params[k]) {
        p.params[k] = v;
        changed = true;
      }
    }
    // `rebuildPiece` avisa del cambio, y de ahí sale el refresco de las listas,
    // el inspector y los totales.
    if (changed) store.rebuildPiece(p);
  }

  function applyPosRot(): void {
    if (store.sel.length !== 1) return;
    const obj = store.unitObj(store.sel[0]);
    if (!obj?.parent) return;
    const num = (id: string) => parseFloat(($(id) as HTMLInputElement).value) || 0;
    obj.parent.updateMatrixWorld(true);
    // Posición global (se pasa al marco del padre) y rotación relativa,
    // exactamente el mismo par que muestra `renderInspector`.
    const wp = new THREE.Vector3(num('prop-px'), num('prop-py'), num('prop-pz'));
    obj.position.copy(obj.parent.worldToLocal(wp));
    obj.rotation.set(rad(num('prop-rx')), rad(num('prop-ry')), rad(num('prop-rz')));
  }

  function applyName(): void {
    if (store.sel.length !== 1) return;
    const name = ($('prop-name') as HTMLInputElement).value.trim();
    if (!name) return;
    const u = store.sel[0];
    if (u.t === 'p') {
      const p = store.pieceById(u.id);
      if (p) store.renamePiece(p, name);
    } else {
      const g = store.groupById(u.id);
      if (g) store.renameGroup(g, name);
    }
  }

  function applyColor(): void {
    store.setPiecesColor(store.selectedPieces(), ($('prop-color') as HTMLInputElement).value);
  }

  function applyOpacity(): void {
    const val = parseInt(($('prop-opacity') as HTMLInputElement).value) / 100;
    $('opacity-val').textContent = `${Math.round(val * 100)}%`;
    for (const p of store.selectedPieces()) {
      p.opacity = val;
      setOpacity(p.mesh, val);
    }
  }

  (['prop-px', 'prop-py', 'prop-pz', 'prop-rx', 'prop-ry', 'prop-rz'] as const)
    .forEach(id => bindProp(id, applyPosRot));
  bindProp('prop-name', applyName);
  bindProp('prop-color', applyColor);
  bindProp('prop-opacity', applyOpacity);

  /* ══ Acciones sobre la selección ═════════════════════════════ */
  function duplicateSelection(): void {
    if (store.sel.length === 0) return;
    store.pushUndo();
    const off = new THREE.Vector3(snapStep() * 5, 0, 0);
    // Un solo aviso para toda la tanda: si no, duplicar treinta piezas
    // rearmaría las listas treinta veces.
    store.batch(() => store.setSel(store.sel.map(u => store.duplicateUnit(u, off))));
    store.scheduleAutosave();
  }
  function mirrorSelection(axis: 'x' | 'z'): void {
    if (store.sel.length === 0) return;
    store.pushUndo();
    store.batch(() => store.setSel(store.sel.map(u => store.mirrorUnit(u, axis))));
    store.scheduleAutosave();
    toast(t('toast.mirror'));
  }
  function deleteSelection(): void {
    if (store.sel.length === 0) return;
    store.pushUndo();
    store.batch(() => {
      store.deleteUnits(store.sel);
      store.setSel([]);
    });
    store.scheduleAutosave();
  }
  function groupSelection(): void {
    const list = store.selectedPieces();
    if (list.length < 2) {
      toast(t('toast.select2'));
      return;
    }
    store.pushUndo();
    // No hay que disolver los grupos de origen: `groupPieces` se lleva sólo las
    // piezas seleccionadas y deja al resto donde estaba. Disolverlos, como se
    // hacía antes, soltaba también a los miembros que nadie había elegido.
    const grp = store.batch(() => {
      const g = store.groupPieces(list);
      store.setSel([{ t: 'g', id: g.id }]);
      return g;
    });
    store.scheduleAutosave();
    toast(t('group.created', { name: grp.name, n: list.length }));
  }
  function ungroupSelection(): void {
    const gids = new Set<number>();
    for (const u of store.sel) {
      if (u.t === 'g') gids.add(u.id);
      else {
        const p = store.pieceById(u.id);
        if (p?.groupId != null) gids.add(p.groupId);
      }
    }
    if (gids.size === 0) {
      toast(t('toast.noGroup'));
      return;
    }
    store.pushUndo();
    store.batch(() => {
      for (const gid of gids) {
        const g = store.groupById(gid);
        if (g) store.dissolveGroup(g);
      }
      store.setSel([]);
    });
    store.scheduleAutosave();
  }

  $('btn-dup').addEventListener('click', duplicateSelection);
  $('btn-del').addEventListener('click', deleteSelection);
  $('btn-mirror-x').addEventListener('click', () => mirrorSelection('x'));
  $('btn-mirror-z').addEventListener('click', () => mirrorSelection('z'));
  $('btn-array').addEventListener('click', () => {
    if (store.sel.length === 0) { toast(t('toast.selectFirst')); return; }
    openModal('modal-array');
  });
  $('btn-group-sel').addEventListener('click', () => {
    if (store.sel.length === 1 && store.sel[0].t === 'g') ungroupSelection();
    else groupSelection();
  });

  $('arr-ok').addEventListener('click', () => {
    closeModal('modal-array');
    // El `max` del input no frena a quien escribe el número a mano: sin este
    // techo, pedir 50.000 copias cuelga la pestaña.
    const count = Math.min(ARRAY_MAX, Math.max(2, parseInt(($('arr-count') as HTMLInputElement).value) || 2));
    const d = new THREE.Vector3(
      parseFloat(($('arr-dx') as HTMLInputElement).value) || 0,
      parseFloat(($('arr-dy') as HTMLInputElement).value) || 0,
      parseFloat(($('arr-dz') as HTMLInputElement).value) || 0,
    );
    if (d.lengthSq() === 0) { toast(t('toast.sepZero')); return; }
    store.pushUndo();
    const base = [...store.sel];
    store.batch(() => {
      const next = [...store.sel];
      for (let i = 1; i < count; i++) {
        const off = d.clone().multiplyScalar(i);
        for (const u of base) next.push(store.duplicateUnit(u, off));
      }
      store.setSel(next);
    });
    store.scheduleAutosave();
    toast(t('toast.series', { n: count }));
  });

  /* ══ Listas (outliner) ═══════════════════════════════════════ */
  /**
   * Marca las filas seleccionadas sin tocar el HTML.
   *
   * Antes la clase `selected` se generaba dentro del HTML, así que cada clic
   * rearmaba las dos listas enteras. El desplazamiento no se perdía —el que
   * desplaza es el panel, no la lista— pero sí se rehacía trabajo de más y se
   * destruían los nodos en cada selección.
   */
  function syncListSelection(): void {
    const pieces = new Set(store.selectedPieces().map(p => p.id));
    const groups = new Set(store.sel.filter(u => u.t === 'g').map(u => u.id));
    document.querySelectorAll<HTMLElement>('#pieces-list [data-pid]').forEach(el => {
      el.classList.toggle('selected', pieces.has(Number(el.dataset.pid)));
    });
    document.querySelectorAll<HTMLElement>('#groups-list [data-gid]').forEach(el => {
      el.classList.toggle('selected', groups.has(Number(el.dataset.gid)));
    });
  }

  /** Firma de lo que la lista muestra, sin la selección. */
  function listsSignature(): string {
    const ps = store.pieces
      .map(p => `${p.id}|${p.name}|${pieceDims(p).join('x')}|${p.color}|${p.visible ? 1 : 0}|${p.groupId ?? ''}`)
      .join(';');
    const gs = store.groups
      .map(g => `${g.id}|${g.name}|${store.pieces.filter(p => p.groupId === g.id).length}`)
      .join(';');
    return `${ps}#${gs}#${getLang()}`;
  }

  // `null` y no una cadena: ninguna firma real puede coincidir con esto.
  let listsSig: string | null = null;
  function renderLists(): void {
    $('piece-count').textContent = String(store.pieces.length);
    $('empty-hero').classList.toggle('gone', store.pieces.length > 0);

    const sig = listsSignature();
    if (sig === listsSig) {
      syncListSelection();
      return;
    }
    listsSig = sig;

    const gl = $('groups-list');
    gl.innerHTML = store.groups.map(g => {
      const n = store.pieces.filter(p => p.groupId === g.id).length;
      return `<div class="group-header" data-gid="${g.id}" role="button" tabindex="0">
        <svg aria-hidden="true"><use href="#i-group"/></svg>
        <span class="group-name">${escapeHtml(g.name)}</span>
        <span class="group-count">${n}</span>
      </div>`;
    }).join('');

    const pl = $('pieces-list');
    if (store.pieces.length === 0) {
      pl.innerHTML = `<div class="empty-list">${t('list.empty')}</div>`;
      return;
    }
    pl.innerHTML = store.pieces.map(p => {
      const [L, A, H] = pieceDims(p);
      const cls = [
        'piece-item',
        p.groupId != null ? 'grouped' : '',
        !p.visible ? 'hidden-piece' : '',
      ].join(' ');
      return `<div class="${cls}" data-pid="${p.id}" role="button" tabindex="0">
        <span class="piece-dot" style="background:${escapeHtml(p.color)}"></span>
        <span class="piece-info">
          <span class="piece-name">${escapeHtml(p.name)}</span>
          <span class="piece-dims">${L}×${A}×${H}</span>
        </span>
        <button class="eye-btn ${p.visible ? '' : 'off'}" data-eye="${p.id}"
                aria-label="${t('eye.toggle')}">
          <svg aria-hidden="true"><use href="#${p.visible ? 'i-eye' : 'i-eye-off'}"/></svg>
        </button>
      </div>`;
    }).join('');
    syncListSelection();
  }

  $('pieces-list').addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const eyeBtn = target.closest<HTMLElement>('[data-eye]');
    if (eyeBtn) {
      const p = store.pieceById(Number(eyeBtn.dataset.eye));
      if (p) {
        store.setPieceVisible(p, !p.visible);
        store.scheduleAutosave();
      }
      return;
    }
    const item = target.closest<HTMLElement>('[data-pid]');
    if (!item) return;
    const unit: Unit = { t: 'p', id: Number(item.dataset.pid) };
    if ((e as MouseEvent).shiftKey) store.toggleSel(unit);
    else store.setSel([unit]);
  });
  $('groups-list').addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-gid]');
    if (!item) return;
    store.setSel([{ t: 'g', id: Number(item.dataset.gid) }]);
  });

  function renderStatus(): void {
    const kg = totalWeight(store.pieces);
    $('status-stats').textContent = store.pieces.length === 0
      ? ''
      : `${nPieces(store.pieces.length)} · ${kg.toFixed(2)} kg`;
  }

  /* ══ Modales ═════════════════════════════════════════════════ */
  function openModal(id: string): void { $(id).hidden = false; }
  function closeModal(id: string): void { $(id).hidden = true; }
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov || (e.target as HTMLElement).closest('[data-close]')) ov.hidden = true;
    });
  });
  function anyModalOpen(): boolean {
    return [...document.querySelectorAll<HTMLElement>('.modal-overlay')].some(m => !m.hidden);
  }
  function closeAllModals(): void {
    document.querySelectorAll<HTMLElement>('.modal-overlay').forEach(m => { m.hidden = true; });
  }

  function showConfirm(title: string, msg: string, cb: () => void): void {
    $('confirm-title').textContent = title;
    $('confirm-msg').textContent = msg;
    confirmCb = cb;
    openModal('modal-confirm');
  }
  $('confirm-yes').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCb?.();
    confirmCb = null;
  });

  /* ══ BOM ═════════════════════════════════════════════════════ */
  function refreshBOM(): void {
    saveSettings();
    const bom = calcBOM(store.pieces);
    const prices = getPrices();
    const barLen = parseFloat(($('bom-barlen') as HTMLInputElement).value) || 6000;
    const kerf = parseFloat(($('bom-kerf') as HTMLInputElement).value) || 0;
    let totalW = 0, totalCost = 0, anyPrice = false;

    let html = '';
    for (const g of bom) {
      totalW += g.weight;
      const unitPrice = prices[g.key] ?? 0;
      const qty = g.linear ? g.totalLen / 1000 : g.totalArea;
      const cost = unitPrice * qty;
      if (unitPrice > 0) { totalCost += cost; anyPrice = true; }

      html += `<div class="bom-group">
        <div class="bom-group-title">${t(g.label)} <span class="prof">${g.prof} mm</span></div>
        <table class="bom-table">
          <thead><tr><th>${t('bom.thPiece')}</th><th>${t('bom.thCut')}</th><th>${t('bom.thWeight')}</th></tr></thead>
          <tbody>${g.list.map(p => `
            <tr><td>${escapeHtml(p.name)}${p.visible ? '' : ` <em>${t('bom.hidden')}</em>`}</td>
            <td>${p.params.L} mm</td><td>${pieceWeight(p).toFixed(2)} kg</td></tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td>${nPieces(g.count)}</td>
            <td>${g.linear ? `${(g.totalLen / 1000).toFixed(2)} m` : `${g.totalArea.toFixed(3)} m²`}</td>
            <td>${g.weight.toFixed(2)} kg</td>
          </tr></tfoot>
        </table>`;

      if (g.linear) {
        const bars = packBars(g.cuts, barLen, kerf);
        const usable = bars.filter(b => !b.over);
        const overs = bars.filter(b => b.over);
        const util = barUtilization(bars, barLen);
        const nBars = plural(usable.length, 'w.bar');
        html += `<div class="bom-bars">
          <span class="ok">✂ ${nBars} × ${(barLen / 1000).toFixed(1)} m</span>
          — ${t('bom.util', { p: util.toFixed(0) })}`;
        usable.forEach((b, i) => {
          html += `<br>${t('bom.barRow', { i: i + 1 })}: ${b.cuts.join(' + ')} <span class="rest">${t('bom.rest', { mm: Math.round(barLen - b.used) })}</span>`;
        });
        for (const b of overs) {
          html += `<br><span class="warn">${t('bom.over', { mm: b.cuts[0] })}</span>`;
        }
        html += '</div>';
      }

      html += `<div class="bom-price">
        <label for="price-${g.key}">${t('bom.price', { u: g.linear ? 'm' : 'm²' })}</label>
        <input type="number" id="price-${g.key}" data-price-key="${g.key}" min="0" step="any"
               value="${unitPrice || ''}" placeholder="—">
        ${unitPrice > 0 ? `<span class="subtotal">${t('bom.subtotal', { c: cost.toFixed(2) })}</span>` : ''}
      </div></div>`;
    }

    if (!html) {
      html = `<p class="bom-empty">${t('bom.empty')}</p>`;
    } else {
      html += `<div class="bom-grand">
        <span>${t('bom.totalWeight')} <b>${totalW.toFixed(2)} kg</b></span>
        ${anyPrice ? `<span>${t('bom.cost')} <b>$${totalCost.toFixed(2)}</b></span>` : ''}
      </div>`;
    }
    $('bom-content').innerHTML = html;
  }
  $('btn-bom').addEventListener('click', () => { openModal('modal-materials'); refreshBOM(); });
  $('bom-barlen').addEventListener('change', refreshBOM);
  $('bom-kerf').addEventListener('change', refreshBOM);
  $('bom-content').addEventListener('change', e => {
    const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-price-key]');
    if (!input) return;
    setPrice(input.dataset.priceKey!, parseFloat(input.value) || 0);
    refreshBOM();
  });
  $('btn-bom-pdf').addEventListener('click', () => {
    if (store.pieces.length === 0) { toast(t('toast.noPieces')); return; }
    downloadMaterialsPDF(store.pieces, {
      barLen: parseFloat(($('bom-barlen') as HTMLInputElement).value) || 6000,
      kerf: parseFloat(($('bom-kerf') as HTMLInputElement).value) || 0,
      prices: getPrices(),
    });
    toast(t('toast.bomPdf'));
  });

  /* ══ Exportar ════════════════════════════════════════════════ */
  $('btn-export').addEventListener('click', () => {
    if (store.pieces.length === 0) { toast(t('toast.noExport')); return; }
    $('png-views').hidden = true;
    openModal('modal-export');
  });
  $('exp-pdf').addEventListener('click', () => {
    closeModal('modal-export');
    exportPlansPDF(viewer.root, store.pieces);
    toast(t('toast.plans'));
  });
  $('exp-png').addEventListener('click', () => {
    $('png-views').hidden = !$('png-views').hidden;
  });
  $('png-views').addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (!btn) return;
    closeModal('modal-export');
    exportViewPNG(viewer.root, store.pieces, btn.dataset.view as ViewName);
    toast(t('toast.png'));
  });
  $('exp-glb').addEventListener('click', async () => {
    closeModal('modal-export');
    try {
      await downloadGLB(viewer.root);
      toast(t('toast.glb'));
    } catch (err) {
      toast(t('toast.glbErr', { e: err instanceof Error ? err.message : String(err) }));
    }
  });
  $('exp-obj').addEventListener('click', () => {
    closeModal('modal-export');
    downloadOBJ(viewer.root);
    toast(t('toast.obj'));
  });

  /* ══ Archivo ═════════════════════════════════════════════════ */
  function saveProject(): void {
    if (store.pieces.length === 0) { toast(t('toast.noSave')); return; }
    const json = JSON.stringify(store.serialize(), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `ferromadera_${stamp()}.fmd`);
    toast(t('toast.saved'));
  }
  $('btn-save').addEventListener('click', saveProject);
  $('btn-open').addEventListener('click', () => ($('file-input') as HTMLInputElement).click());
  /** Motivo legible de un fallo al cargar, traducido si el modelo dio una clave. */
  function loadErrorText(err: unknown): string {
    if (err instanceof ProjectError) return t(err.key, err.vars);
    return err instanceof Error ? err.message : String(err);
  }
  $('file-input').addEventListener('change', e => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    // Se limpia siempre: si no, reintentar con el mismo archivo no dispara
    // `change` y parece que el botón dejó de andar.
    const listo = (): void => { input.value = ''; };
    reader.onload = ev => {
      try {
        const project = parseProject(String(ev.target?.result));
        store.pushUndo();
        store.restore(project);
        store.setSel([]);
        viewer.frameView('iso');
        store.scheduleAutosave();
        toast(t('toast.loaded', { c: nPieces(store.pieces.length) }));
      } catch (err) {
        toast(t('toast.loadErr', { e: loadErrorText(err) }));
      }
      listo();
    };
    reader.onerror = () => {
      toast(t('toast.loadErr', { e: reader.error?.message ?? t('err.unreadable') }));
      listo();
    };
    reader.readAsText(file);
  });
  $('btn-new').addEventListener('click', () => {
    showConfirm(t('confirm.new'), t('confirm.newMsg'), () => {
      store.pushUndo();
      store.restore({ version: 3, idCounter: 0, groupCounter: 0, groups: [], pieces: [] });
      store.scheduleAutosave();
    });
  });
  $('btn-undo').addEventListener('click', () => { if (!store.undo()) toast(t('toast.noUndo')); });
  $('btn-redo').addEventListener('click', () => { if (!store.redo()) toast(t('toast.noRedo')); });

  /* ══ Plantillas ══════════════════════════════════════════════ */
  document.querySelectorAll<HTMLElement>('.tpl-card').forEach(card => {
    card.addEventListener('click', () => {
      currentTpl = card.dataset.tpl!;
      const tpl = TEMPLATES[currentTpl];
      $('tpl-title').textContent = t(tpl.title);
      $('tpl-fields').innerHTML = tpl.fields.map(f => `
        <div class="field">
          <label for="tpl-${f.key}">${t(f.label)}</label>
          <input type="number" id="tpl-${f.key}" value="${f.def}" min="1">
        </div>`).join('');
      openModal('modal-template');
    });
  });
  $('tpl-ok').addEventListener('click', () => {
    closeModal('modal-template');
    const tpl = TEMPLATES[currentTpl];
    const v: Record<string, number> = {};
    for (const f of tpl.fields) {
      v[f.key] = parseFloat(($(`tpl-${f.key}`) as HTMLInputElement).value) || f.def;
    }
    store.pushUndo();
    const made = tpl.build(store, v);
    const grp = store.groupPieces(made, t(tpl.title));
    store.setSel([{ t: 'g', id: grp.id }]);
    viewer.frameView('iso');
    store.scheduleAutosave();
    toast(t('toast.tplDone'));
  });

  /* ══ Teclado ═════════════════════════════════════════════════ */
  function nudge(dx: number, dy: number, dz: number): void {
    if (store.sel.length === 0) return;
    const now = Date.now();
    if (now - lastNudge > 1200) store.pushUndo();
    lastNudge = now;
    // El desplazamiento se pide en ejes mundiales, pero `position` es local:
    // dentro de un grupo rotado, sumarlo tal cual movía en la dirección
    // equivocada. Se lleva al marco del padre antes de aplicarlo.
    const world = new THREE.Vector3(dx, dy, dz);
    for (const u of store.sel) {
      const o = store.unitObj(u);
      if (!o) continue;
      o.parent?.updateMatrixWorld(true);
      const local = world.clone();
      if (o.parent) local.applyQuaternion(o.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
      o.position.add(local);
    }
    renderInspector();
    store.scheduleAutosave();
  }

  window.addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z') { e.preventDefault(); if (!store.undo()) toast(t('toast.noUndo')); }
    else if (ctrl && k === 'y') { e.preventDefault(); if (!store.redo()) toast(t('toast.noRedo')); }
    else if (ctrl && k === 'd') { e.preventDefault(); duplicateSelection(); }
    else if (ctrl && k === 's') { e.preventDefault(); saveProject(); }
    else if (k === 'g') setGizmoMode('move');
    else if (k === 'r') setGizmoMode('rotate');
    else if (k === 'm') toggleMeasure();
    else if (k === 'f') frameSelection();
    else if (e.key === 'Home') viewer.frameView('iso');
    else if (e.key === 'Escape') {
      if (anyModalOpen()) closeAllModals();
      else if (overlay.measuring) toggleMeasure();
      else if (gizmoMode !== 'select') setGizmoMode('select');
      else store.setSel([]);
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!anyModalOpen()) deleteSelection();
    }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-snapStep(), 0, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(snapStep(), 0, 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, 0, -snapStep()); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, 0, snapStep()); }
    else if (e.key === 'PageUp') { e.preventDefault(); nudge(0, snapStep(), 0); }
    else if (e.key === 'PageDown') { e.preventDefault(); nudge(0, -snapStep(), 0); }
  });

  /* ══ Arranque ════════════════════════════════════════════════ */
  store.onAutosaveError = () => toast(t('toast.autosaveErr'));

  /*
   * Único punto donde la interfaz reacciona al store. Antes había dos
   * mecanismos en paralelo —esta suscripción y llamadas sueltas a `renderLists`
   * repartidas por el archivo— y funcionaba de casualidad, porque toda acción
   * terminaba reseleccionando y era ese `setSel` el que redibujaba.
   *
   * Un cambio de selección no rearma las listas: sólo mueve marcas.
   */
  store.onChange(kinds => {
    if (kinds.has('structure')) {
      renderLists();
      renderStatus();
      updateLabelsButton(); // cruzar el tope de piezas apaga las etiquetas
    } else {
      syncListSelection();
    }
    renderInspector();
    updateGizmo();
  });

  initLang();
  applyStatic();
  updateLangButtons();
  renderCatalog();
  renderNewParams();
  updateHintForMode();
  loadSettings();
  applySnap();

  if (store.loadAutosave()) {
    viewer.frameView('iso');
    toast(t('toast.restored', { c: nPieces(store.pieces.length) }));
  }

  /*
   * Huella de todo lo que puede cambiar lo que se ve. Si de un cuadro al
   * siguiente no cambió nada, no hay nada que redibujar: con 60 piezas el par
   * render + etiquetas cuesta unos 2,7 ms por cuadro, y estando quieto los
   * gastaba igual, sesenta veces por segundo.
   *
   * Se comparan valores, no un resumen: dos estados distintos no pueden
   * parecer iguales. Y se leen las transformaciones LOCALES, las que muta el
   * código, no `matrixWorld`, que se recalcula al renderizar y quedaría
   * congelada justo cuando dejamos de hacerlo.
   */
  let huellaPrev: number[] = [];
  let huella: number[] = [];
  const hash = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  function algoCambio(): boolean {
    const b = huella;
    b.length = 0;
    const cam = viewer.camera;
    b.push(cam.position.x, cam.position.y, cam.position.z,
      cam.quaternion.x, cam.quaternion.y, cam.quaternion.z, cam.quaternion.w,
      cam.aspect, cam.fov);
    const cv = $('overlay') as unknown as HTMLCanvasElement;
    b.push(cv.width, cv.height);
    b.push(viewer.grid.visible ? 1 : 0);
    // El gizmo resalta el eje bajo el cursor sin que cambie nada del modelo.
    b.push(viewer.gizmo.dragging ? 1 : 0, hash(String(viewer.gizmo.axis)));
    b.push(overlay.showLabels ? 1 : 0, overlay.measuring ? 1 : 0, overlay.measurePts.length);
    for (const pt of overlay.measurePts) b.push(pt.x, pt.y, pt.z);
    b.push(store.sel.length);
    for (const u of store.sel) b.push(u.t === 'p' ? 1 : 2, u.id);
    b.push(store.groups.length);
    for (const g of store.groups) {
      const o = g.obj;
      b.push(g.id, o.visible ? 1 : 0, o.position.x, o.position.y, o.position.z,
        o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    }
    b.push(store.pieces.length);
    for (const p of store.pieces) {
      const o = p.mesh;
      // `o.id` cambia al reconstruir la malla, que es lo que pasa al editar
      // las medidas: así entran los cambios de parámetros sin listarlos.
      b.push(p.id, o.id, p.visible ? 1 : 0, p.opacity, hash(p.name), hash(p.color),
        o.position.x, o.position.y, o.position.z,
        o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    }
    let cambio = b.length !== huellaPrev.length;
    if (!cambio) {
      for (let i = 0; i < b.length; i++) {
        if (b[i] !== huellaPrev[i]) { cambio = true; break; }
      }
    }
    if (cambio) { huella = huellaPrev; huellaPrev = b; }
    return cambio;
  }

  /** Un cuadro: mover controles y, sólo si hace falta, dibujar. */
  const frame = (): void => {
    viewer.updateControls();
    if (!algoCambio()) return;
    viewer.render();
    overlay.draw();
  };
  const animate = (): void => {
    requestAnimationFrame(animate);
    frame();
  };
  animate();

  // Hook de depuración: solo en desarrollo, no se incluye en el build
  if (import.meta.env.DEV) {
    void (async () => {
      const [plans, bom, m3d, gltfL, objL] = await Promise.all([
        import('../export/plans'),
        import('../export/bomPdf'),
        import('../export/model3d'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/OBJLoader.js'),
      ]);
      (window as unknown as Record<string, unknown>).__fm = {
        store, viewer, overlay, THREE,
        // Un paso del bucle, para poder accionarlo sin depender de rAF.
        frame,
        setLang, getLang,
        buildPlansPDF: plans.buildPlansPDF,
        buildMaterialsPDF: bom.buildMaterialsPDF,
        exportGLB: m3d.exportGLB,
        exportOBJ: m3d.exportOBJ,
        GLTFLoader: gltfL.GLTFLoader,
        OBJLoader: objL.OBJLoader,
      };
    })();
  }
}
