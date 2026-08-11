import * as THREE from 'three';
import { jsPDF } from 'jspdf';
import type { Piece } from '../app/state';
import type { ViewName } from '../model/types';
import { pieceDims } from '../model/materials';
import { calcBOM } from '../model/bom';
import { cloneForExport, disposeClonedMaterials } from '../scene/builders';
import { downloadBlob, stamp } from './model3d';
import { localeDate, plural, t } from '../app/i18n';

const viewLabel = (v: ViewName): string =>
  t(v === 'front' ? 'pdf.viewFront' : v === 'side' ? 'pdf.viewSide' : 'pdf.viewTop');
const COTA_H = '#c22222'; // cota horizontal (rojo)
const COTA_V = '#1a5fa8'; // cota vertical (azul)

interface RenderedView {
  canvas: HTMLCanvasElement;
  labelH: string;
  labelV: string;
}

/**
 * Renderer y escena de exportación, creados una sola vez y reutilizados.
 *
 * Antes se construía un `WebGLRenderer` por vista y se lo liberaba con
 * `dispose()`, que suelta los recursos de Three.js pero **no el contexto
 * WebGL**. Cada PDF de planos abría tres contextos y el navegador sólo tolera
 * unos dieciséis: a las seis exportaciones mataba los más viejos, incluido el
 * del visor principal, que quedaba congelado hasta recargar la página.
 */
let exportRenderer: THREE.WebGLRenderer | null = null;
let exportScene: THREE.Scene | null = null;

function getExportRenderer(W: number, H: number): THREE.WebGLRenderer {
  // Si el contexto se perdió por otra vía (reinicio del driver), se rehace.
  if (exportRenderer?.getContext().isContextLost()) {
    exportRenderer.dispose();
    exportRenderer = null;
  }
  if (!exportRenderer) {
    exportRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    exportRenderer.setPixelRatio(1);
  }
  exportRenderer.setSize(W, H, false);
  return exportRenderer;
}

/** Escena fija de exportación: fondo claro, luces y grilla. Sin las piezas. */
function getExportScene(): THREE.Scene {
  if (!exportScene) {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0xf5f5f0);
    s.add(new THREE.AmbientLight(0xffffff, 2.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2);
    dl.position.set(500, 1000, 500);
    s.add(dl);
    s.add(new THREE.GridHelper(4000, 80, 0xcccccc, 0xdddddd));
    exportScene = s;
  }
  return exportScene;
}

/**
 * Renderiza una vista ortográfica sobre fondo claro y dibuja las cotas
 * generales del conjunto encima. Devuelve el canvas listo para componer.
 */
function renderOrthoView(root: THREE.Object3D, view: ViewName, W: number, H: number): RenderedView {
  const exportRoot = cloneForExport(root);
  const box = new THREE.Box3().setFromObject(exportRoot);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 500;

  const renderer = getExportRenderer(W, H);
  const scene = getExportScene();

  const asp = W / H;
  const oh = maxDim * 0.72;
  const ow = oh * asp;
  const cam = new THREE.OrthographicCamera(-ow, ow, oh, -oh, -30000, 30000);
  if (view === 'front') {
    cam.position.set(center.x, center.y, center.z + maxDim * 3);
  } else if (view === 'side') {
    cam.position.set(center.x + maxDim * 3, center.y, center.z);
  } else {
    cam.position.set(center.x, center.y + maxDim * 3, center.z);
    cam.up.set(0, 0, -1);
  }
  cam.lookAt(center);
  cam.updateProjectionMatrix();

  // Copiar a canvas 2D y dibujar cotas
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // La escena es compartida: el clon entra sólo para este render y sale
  // siempre, incluso si falla, o quedaría duplicado en la vista siguiente.
  scene.add(exportRoot);
  try {
    renderer.render(scene, cam);
    ctx.drawImage(renderer.domElement, 0, 0);
  } finally {
    scene.remove(exportRoot);
    disposeClonedMaterials(exportRoot);
  }

  const proj = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
  };
  const mn = box.min, mx = box.max;
  const corners = [
    proj(mn.x, mn.y, mn.z), proj(mx.x, mn.y, mn.z), proj(mn.x, mx.y, mn.z), proj(mx.x, mx.y, mn.z),
    proj(mn.x, mn.y, mx.z), proj(mx.x, mn.y, mx.z), proj(mn.x, mx.y, mx.z), proj(mx.x, mx.y, mx.z),
  ];
  const sx1 = Math.min(...corners.map(c => c.x));
  const sx2 = Math.max(...corners.map(c => c.x));
  const sy1 = Math.min(...corners.map(c => c.y));
  const sy2 = Math.max(...corners.map(c => c.y));

  let labelH: string, labelV: string;
  if (view === 'front') { labelH = `${Math.round(size.x)} mm`; labelV = `${Math.round(size.y)} mm`; }
  else if (view === 'side') { labelH = `${Math.round(size.z)} mm`; labelV = `${Math.round(size.y)} mm`; }
  else { labelH = `${Math.round(size.x)} mm`; labelV = `${Math.round(size.z)} mm`; }

  const S = W / 800; // escala de trazos relativa al tamaño del render
  ctx.lineWidth = 1.5 * S;
  ctx.font = `bold ${11 * S}px 'JetBrains Mono', monospace`;

  // Cota horizontal (arriba)
  const hy = sy1 - 20 * S;
  ctx.strokeStyle = COTA_H;
  ctx.fillStyle = COTA_H;
  ctx.beginPath(); ctx.moveTo(sx1, hy); ctx.lineTo(sx2, hy); ctx.stroke();
  for (const [x, d] of [[sx1, 1], [sx2, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, hy);
    ctx.lineTo(x + 7 * S * d, hy - 4 * S);
    ctx.lineTo(x + 7 * S * d, hy + 4 * S);
    ctx.closePath(); ctx.fill();
  }
  ctx.setLineDash([3 * S, 4 * S]);
  ctx.lineWidth = 0.8 * S;
  ctx.strokeStyle = COTA_H + '99';
  ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx1, hy - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx2, sy1); ctx.lineTo(sx2, hy - 2); ctx.stroke();
  ctx.setLineDash([]);
  const tw1 = ctx.measureText(labelH).width;
  ctx.fillStyle = 'rgba(245,245,240,0.88)';
  ctx.fillRect((sx1 + sx2) / 2 - tw1 / 2 - 4 * S, hy - 17 * S, tw1 + 8 * S, 14 * S);
  ctx.fillStyle = COTA_H;
  ctx.fillText(labelH, (sx1 + sx2) / 2 - tw1 / 2, hy - 5 * S);

  // Cota vertical (derecha)
  const vx = sx2 + 20 * S;
  ctx.strokeStyle = COTA_V;
  ctx.fillStyle = COTA_V;
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath(); ctx.moveTo(vx, sy1); ctx.lineTo(vx, sy2); ctx.stroke();
  for (const [y, d] of [[sy1, 1], [sy2, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.lineTo(vx - 4 * S, y + 7 * S * d);
    ctx.lineTo(vx + 4 * S, y + 7 * S * d);
    ctx.closePath(); ctx.fill();
  }
  ctx.setLineDash([3 * S, 4 * S]);
  ctx.lineWidth = 0.8 * S;
  ctx.strokeStyle = COTA_V + '99';
  ctx.beginPath(); ctx.moveTo(sx2, sy1); ctx.lineTo(vx - 2, sy1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(vx - 2, sy2); ctx.stroke();
  ctx.setLineDash([]);
  const tw2 = ctx.measureText(labelV).width;
  ctx.save();
  ctx.translate(vx + 18 * S, (sy1 + sy2) / 2 + tw2 / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(245,245,240,0.88)';
  ctx.fillRect(-4 * S, -14 * S, tw2 + 8 * S, 14 * S);
  ctx.fillStyle = COTA_V;
  ctx.fillText(labelV, 0, 0);
  ctx.restore();

  return { canvas: cv, labelH, labelV };
}

/* ── PNG ─────────────────────────────────────────────────────── */

export function exportViewPNG(root: THREE.Object3D, pieces: Piece[], view: ViewName): void {
  const VIEW_W = 2400, VIEW_H = 1800;
  const { canvas: viewCanvas, labelH, labelV } = renderOrthoView(root, view, VIEW_W, VIEW_H);

  const S = VIEW_W / 900;
  const TABLE_W = Math.round(330 * S);
  const HEADER_H = Math.round(56 * S);
  const ROW_H = Math.round(24 * S);
  const rows = pieces.map(p => {
    const [L, A, H] = pieceDims(p);
    return { name: p.name, L, A, H };
  });
  const TOTAL_W = VIEW_W + TABLE_W;
  const TOTAL_H = Math.max(VIEW_H + HEADER_H, HEADER_H + rows.length * ROW_H + Math.round(140 * S));

  const cv = document.createElement('canvas');
  cv.width = TOTAL_W;
  cv.height = TOTAL_H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);
  // Encabezado
  ctx.fillStyle = '#16181b';
  ctx.fillRect(0, 0, TOTAL_W, HEADER_H);
  ctx.fillStyle = '#f07b26';
  ctx.font = `bold ${Math.round(19 * S)}px 'Inter', sans-serif`;
  ctx.fillText(`FERROMADERA — ${viewLabel(view)}`, 14 * S, 30 * S);
  ctx.fillStyle = '#9aa';
  ctx.font = `${Math.round(11 * S)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`${plural(pieces.length, 'w.piece')}  |  ${localeDate()}  |  ${t('pdf.unit')}`, 14 * S, 48 * S);
  ctx.drawImage(viewCanvas, 0, HEADER_H);

  // Tabla lateral
  ctx.fillStyle = '#ccc';
  ctx.fillRect(VIEW_W, HEADER_H, Math.round(2 * S), TOTAL_H - HEADER_H);
  const TX = VIEW_W + Math.round(12 * S);
  let ty = HEADER_H + Math.round(16 * S);
  ctx.fillStyle = '#16181b';
  ctx.fillRect(TX - 4 * S, ty, TABLE_W - 20 * S, 52 * S);
  ctx.fillStyle = '#f07b26';
  ctx.font = `bold ${Math.round(10 * S)}px 'Inter', sans-serif`;
  ctx.fillText(t('png.set'), TX + 6 * S, ty + 15 * S);
  ctx.font = `bold ${Math.round(11 * S)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = COTA_H;
  ctx.fillText(`${t('png.h')} ${labelH}`, TX + 6 * S, ty + 31 * S);
  ctx.fillStyle = '#7db2e8';
  ctx.fillText(`${t('png.v')}   ${labelV}`, TX + 6 * S, ty + 46 * S);
  ty += Math.round(64 * S);

  ctx.fillStyle = '#f07b26';
  ctx.font = `bold ${Math.round(10 * S)}px 'Inter', sans-serif`;
  ctx.fillText(t('png.tbl'), TX, ty);
  ty += Math.round(14 * S);
  ctx.fillStyle = '#24282d';
  ctx.fillRect(TX - 4 * S, ty, TABLE_W - 20 * S, ROW_H);
  ctx.fillStyle = '#f07b26';
  ctx.font = `bold ${Math.round(8 * S)}px 'JetBrains Mono', monospace`;
  ctx.fillText(t('png.thPiece'), TX, ty + 15 * S);
  ctx.fillText(t('png.len'), TX + 168 * S, ty + 15 * S);
  ctx.fillText(t('png.wid'), TX + 226 * S, ty + 15 * S);
  ctx.fillText(t('png.hei'), TX + 278 * S, ty + 15 * S);
  ty += ROW_H;
  rows.forEach((r, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#eeeeea';
    ctx.fillRect(TX - 4 * S, ty, TABLE_W - 20 * S, ROW_H);
    ctx.font = `${Math.round(8 * S)}px 'Inter', sans-serif`;
    ctx.fillStyle = '#222';
    let nm = r.name;
    while (ctx.measureText(nm).width > 155 * S && nm.length > 4) nm = nm.slice(0, -1);
    if (nm !== r.name) nm += '…';
    ctx.fillText(nm, TX, ty + 15 * S);
    ctx.font = `bold ${Math.round(8 * S)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = COTA_V;
    ctx.fillText(String(r.L), TX + 168 * S, ty + 15 * S);
    ctx.fillStyle = '#555';
    ctx.fillText(String(r.A), TX + 226 * S, ty + 15 * S);
    ctx.fillText(String(r.H), TX + 278 * S, ty + 15 * S);
    ty += ROW_H;
  });

  cv.toBlob(blob => {
    if (blob) downloadBlob(blob, `ferromadera_${view}_${stamp()}.png`);
  }, 'image/png');
}

/* ── PDF de planos (jsPDF) ───────────────────────────────────── */

/** Construye el documento de planos (retornado para poder verificarlo en tests). */
export function buildPlansPDF(root: THREE.Object3D, pieces: Piece[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 841.89
  const PH = doc.internal.pageSize.getHeight();  // 595.28
  const M = 24, HEADER = 34, FOOTER = 18;
  const COL_W = (PW - M * 3) / 2;
  const VIEW_H = PH - HEADER - FOOTER - M * 2;
  const SCALE = 3; // sobremuestreo para nitidez

  const renderJpeg = (view: ViewName) => {
    const { canvas } = renderOrthoView(root, view, Math.round(COL_W * SCALE), Math.round(VIEW_H * SCALE));
    return canvas.toDataURL('image/jpeg', 0.93);
  };

  const chrome = (page: number, total: number) => {
    doc.setFillColor(22, 24, 27);
    doc.rect(0, 0, PW, HEADER, 'F');
    doc.setTextColor(240, 123, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(t('pdf.plansTitle'), M, 22);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${localeDate()}  ·  ${plural(pieces.length, 'w.piece')}  ·  ${t('pdf.unit')}`, PW - M, 22, { align: 'right' });
    doc.setFillColor(22, 24, 27);
    doc.rect(0, PH - FOOTER, PW, FOOTER, 'F');
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text(`FerroMadera · ${t('pdf.sheet', { a: page, b: total })}`, M, PH - 6);
  };

  const viewTitle = (label: string, x: number, y: number) => {
    doc.setTextColor(240, 123, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x, y);
  };

  // Página 1: frontal + lateral
  chrome(1, 2);
  const iy = HEADER + M;
  viewTitle(viewLabel('front'), M, iy - 7);
  doc.addImage(renderJpeg('front'), 'JPEG', M, iy, COL_W, VIEW_H);
  viewTitle(viewLabel('side'), M * 2 + COL_W, iy - 7);
  doc.addImage(renderJpeg('side'), 'JPEG', M * 2 + COL_W, iy, COL_W, VIEW_H);

  // Página 2: superior + resumen de materiales
  doc.addPage();
  chrome(2, 2);
  viewTitle(viewLabel('top'), M, iy - 7);
  doc.addImage(renderJpeg('top'), 'JPEG', M, iy, COL_W, VIEW_H);

  const bom = calcBOM(pieces);
  let y = iy + 4;
  const mx = M * 2 + COL_W + 4;
  doc.setTextColor(240, 123, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(t('pdf.summary'), mx, y);
  y += 6;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.4);
  doc.line(mx, y, PW - M, y);
  y += 14;
  let totalW = 0;
  for (const g of bom) {
    totalW += g.weight;
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${t(g.label)}  ${g.prof} mm`, mx, y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    const qty = g.linear ? `${(g.totalLen / 1000).toFixed(2)} m` : `${g.totalArea.toFixed(3)} m²`;
    doc.text(`${plural(g.count, 'w.piece')}  ·  ${qty}  ·  ${g.weight.toFixed(2)} kg`, mx + 8, y);
    y += 15;
    if (y > PH - FOOTER - 30) break;
  }
  y += 4;
  doc.setTextColor(240, 123, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(t('pdf.totalWeight', { kg: totalW.toFixed(2) }), mx, y);
  return doc;
}

export function exportPlansPDF(root: THREE.Object3D, pieces: Piece[]): void {
  buildPlansPDF(root, pieces).save(`ferromadera_planos_${stamp()}.pdf`);
}
