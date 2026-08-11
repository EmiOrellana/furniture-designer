import { jsPDF } from 'jspdf';
import type { PieceData } from '../model/types';
import { pieceWeight } from '../model/materials';
import { calcBOM, packBars } from '../model/bom';
import { downloadBlob, stamp } from './model3d';
import { localeDate, plural, t } from '../app/i18n';

export interface BomPdfOptions {
  barLen: number;
  kerf: number;
  prices: Record<string, number>;
}

/** Genera el PDF de lista de materiales y cortes. Devuelve el blob (para tests). */
export function buildMaterialsPDF(pieces: PieceData[], opts: BomPdfOptions): Blob {
  const { barLen, kerf, prices } = opts;
  const bom = calcBOM(pieces);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 42;
  const CW = PW - M * 2;
  const date = localeDate();

  let page = 1;
  let y = 0;

  const footer = () => {
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`FerroMadera · ${t('pdf.sheetN', { a: page })} · ${date}`, M, PH - 20);
  };
  const newPage = () => {
    footer();
    doc.addPage();
    page++;
    y = M;
  };
  const ensure = (needed: number) => {
    if (y + needed > PH - 44) newPage();
  };

  // Encabezado principal
  doc.setFillColor(22, 24, 27);
  doc.rect(0, 0, PW, 64, 'F');
  doc.setTextColor(240, 123, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(t('pdf.bomTitle'), M, 30);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(t('pdf.bomMeta', { date, c: plural(pieces.length, 'w.piece'), bar: barLen, kerf }), M, 47);
  y = 86;

  let totalWeight = 0;
  let totalCost = 0;
  let anyPrice = false;

  for (const g of bom) {
    totalWeight += g.weight;
    ensure(60);

    // Banda de sección
    doc.setFillColor(36, 40, 45);
    doc.rect(M, y - 13, CW, 20, 'F');
    doc.setFillColor(240, 123, 38);
    doc.rect(M, y - 13, 3.5, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${t(g.label).toUpperCase()}  ·  ${g.prof} mm`, M + 12, y);
    y += 20;

    // Tabla de piezas
    ensure(16 + g.list.length * 14 + 20);
    doc.setFillColor(232, 232, 228);
    doc.rect(M, y - 10, CW, 14, 'F');
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(7.5);
    doc.text(t('bom.thPiece').toUpperCase(), M + 6, y);
    doc.text(t('bom.thCut').toUpperCase(), M + CW * 0.55, y, { align: 'right' });
    doc.text(t('bom.thWeight').toUpperCase(), M + CW * 0.72, y, { align: 'right' });
    y += 14;
    doc.setFont('helvetica', 'normal');
    g.list.forEach((p, i) => {
      ensure(14);
      if (i % 2 === 1) {
        doc.setFillColor(246, 246, 243);
        doc.rect(M, y - 10, CW, 13, 'F');
      }
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(8.5);
      doc.text(p.name.length > 46 ? p.name.slice(0, 45) + '…' : p.name, M + 6, y);
      doc.setTextColor(26, 95, 168);
      doc.text(`${p.params.L} mm`, M + CW * 0.55, y, { align: 'right' });
      doc.setTextColor(90, 90, 90);
      doc.text(`${pieceWeight(p).toFixed(2)} kg`, M + CW * 0.72, y, { align: 'right' });
      y += 13;
    });

    // Total del grupo
    ensure(18);
    doc.setFillColor(255, 243, 232);
    doc.rect(M, y - 10, CW, 15, 'F');
    doc.setTextColor(196, 90, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(t('pdf.total', { c: plural(g.count, 'w.piece') }), M + 6, y + 1);
    const qty = g.linear ? `${(g.totalLen / 1000).toFixed(2)} m` : `${g.totalArea.toFixed(3)} m²`;
    doc.text(qty, M + CW * 0.55, y + 1, { align: 'right' });
    doc.text(`${g.weight.toFixed(2)} kg`, M + CW * 0.72, y + 1, { align: 'right' });
    const price = prices[g.key] ?? 0;
    if (price > 0) {
      const cost = price * (g.linear ? g.totalLen / 1000 : g.totalArea);
      totalCost += cost;
      anyPrice = true;
      doc.text(`$${cost.toFixed(2)}`, M + CW, y + 1, { align: 'right' });
    }
    y += 20;

    // Optimización de barras
    if (g.linear) {
      const bars = packBars(g.cuts, barLen, kerf);
      const usable = bars.filter(b => !b.over);
      const overs = bars.filter(b => b.over);
      ensure(14 + usable.length * 11 + overs.length * 11);
      doc.setTextColor(46, 125, 90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(t('pdf.barsNeeded', { n: usable.length, m: (barLen / 1000).toFixed(1) }), M + 6, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.setFontSize(7.5);
      usable.forEach((b, i) => {
        ensure(11);
        doc.text(t('pdf.barRow', { i: i + 1, cuts: b.cuts.join(' + '), mm: Math.round(barLen - b.used) }), M + 14, y);
        y += 11;
      });
      for (const b of overs) {
        ensure(11);
        doc.setTextColor(200, 60, 60);
        doc.text(t('pdf.over', { mm: b.cuts[0] }), M + 14, y);
        y += 11;
      }
    }
    y += 16;
  }

  // Totales finales
  ensure(46);
  doc.setDrawColor(240, 123, 38);
  doc.setLineWidth(1);
  doc.line(M, y, M + CW, y);
  y += 18;
  doc.setTextColor(196, 90, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(t('pdf.totalWeight', { kg: totalWeight.toFixed(2) }), M, y);
  if (anyPrice) {
    y += 17;
    doc.text(t('pdf.cost', { c: totalCost.toFixed(2) }), M, y);
  }
  footer();

  return doc.output('blob');
}

export function downloadMaterialsPDF(pieces: PieceData[], opts: BomPdfOptions): void {
  const blob = buildMaterialsPDF(pieces, opts);
  downloadBlob(blob, `ferromadera_materiales_${stamp()}.pdf`);
}
