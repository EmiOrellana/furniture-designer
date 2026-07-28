import * as THREE from 'three';
import type { Store } from './state';
import type { Viewer } from '../scene/viewer';
import { pieceDims } from '../model/materials';

/** Capa 2D sobre el viewport: etiquetas de piezas y herramienta de medición. */
export class Overlay {
  showLabels = true;
  measuring = false;
  measurePts: THREE.Vector3[] = [];

  private ctx: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private viewer: Viewer,
    private store: Store,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const fit = () => {
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    window.addEventListener('resize', fit);
    fit();
  }

  resize(): void {
    const parent = this.canvas.parentElement!;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  addMeasurePoint(pt: THREE.Vector3): void {
    if (this.measurePts.length >= 2) this.measurePts = [];
    this.measurePts.push(pt);
  }

  clearMeasure(): void { this.measurePts = []; }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  draw(): void {
    const c = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    this.drawMeasure(w, h);
    this.drawLabels(w, h);
  }

  private project(p: THREE.Vector3, w: number, h: number) {
    const v = p.clone().project(this.viewer.camera);
    return { x: ((v.x + 1) / 2) * w, y: ((-v.y + 1) / 2) * h, behind: v.z > 1 };
  }

  private drawMeasure(w: number, h: number): void {
    if (!this.measuring || this.measurePts.length === 0) return;
    const c = this.ctx;
    const pts = this.measurePts.map(p => this.project(p, w, h));
    for (const pt of pts) {
      if (pt.behind) continue;
      c.beginPath();
      c.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      c.fillStyle = '#f07b26';
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.stroke();
    }
    if (this.measurePts.length === 2 && !pts[0].behind && !pts[1].behind) {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      c.lineTo(pts[1].x, pts[1].y);
      c.strokeStyle = '#f07b26';
      c.lineWidth = 2;
      c.setLineDash([6, 4]);
      c.stroke();
      c.setLineDash([]);
      const a = this.measurePts[0], b = this.measurePts[1];
      const d = a.distanceTo(b);
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const t1 = `${Math.round(d)} mm`;
      const t2 = `ΔX ${Math.round(Math.abs(b.x - a.x))}  ΔY ${Math.round(Math.abs(b.y - a.y))}  ΔZ ${Math.round(Math.abs(b.z - a.z))}`;
      c.font = "bold 13px 'JetBrains Mono', monospace";
      const bw = Math.max(c.measureText(t1).width, c.measureText(t2).width) + 18;
      c.fillStyle = 'rgba(22,24,27,.94)';
      this.roundRect(mx - bw / 2, my - 40, bw, 36, 6);
      c.fill();
      c.strokeStyle = '#f07b26';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#f07b26';
      c.fillText(t1, mx - bw / 2 + 9, my - 24);
      c.font = "10px 'JetBrains Mono', monospace";
      c.fillStyle = '#a2a8b0';
      c.fillText(t2, mx - bw / 2 + 9, my - 11);
    }
  }

  private drawLabels(w: number, h: number): void {
    const pieces = this.store.pieces;
    if (!this.showLabels || pieces.length === 0 || pieces.length > 60) return;
    const c = this.ctx;
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    for (const p of pieces) {
      if (!p.visible) continue;
      box.setFromObject(p.mesh);
      box.getCenter(center);
      const pt = this.project(center, w, h);
      if (pt.behind || pt.x < 0 || pt.x > w || pt.y < 0 || pt.y > h) continue;

      const [L, A, H] = pieceDims(p);
      const selected = this.store.isPieceSelected(p.id);
      const line1 = p.name;
      const line2 = `${L}×${A}×${H}`;
      const fs = 11, pad = 6, lh = fs + 3;
      c.font = `500 ${fs}px 'Inter', sans-serif`;
      const w1 = c.measureText(line1).width;
      c.font = `${fs - 1}px 'JetBrains Mono', monospace`;
      const w2 = c.measureText(line2).width;
      const bw = Math.max(w1, w2) + pad * 2;
      const bh = 2 * lh + pad * 2 - 3;
      let bx = pt.x - bw / 2;
      let by = pt.y - bh - 12;
      bx = Math.max(4, Math.min(w - bw - 4, bx));
      by = Math.max(4, Math.min(h - bh - 4, by));

      c.fillStyle = selected ? 'rgba(240,123,38,.94)' : 'rgba(22,24,27,.78)';
      c.strokeStyle = selected ? '#ff8f3d' : '#3d434b';
      c.lineWidth = 1;
      this.roundRect(bx, by, bw, bh, 5);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(pt.x, pt.y);
      c.lineTo(bx + bw / 2, by + bh);
      c.strokeStyle = selected ? 'rgba(240,123,38,.6)' : 'rgba(90,90,90,.5)';
      c.stroke();
      c.font = `600 ${fs}px 'Inter', sans-serif`;
      c.fillStyle = selected ? '#1a1006' : '#e9eaec';
      c.fillText(line1, bx + pad, by + pad + fs - 1);
      c.font = `${fs - 1}px 'JetBrains Mono', monospace`;
      c.fillStyle = selected ? 'rgba(26,16,6,.8)' : '#8d939b';
      c.fillText(line2, bx + pad, by + pad + fs + lh - 2);
    }
  }
}
