import * as THREE from 'three';
import type { PieceData, PieceParams, PieceType, ProjectState, Unit, Vec3 } from '../model/types';
import { MAT, pieceDims } from '../model/materials';
import { buildPieceMesh, disposeObject, setHighlight } from '../scene/builders';
import type { Viewer } from '../scene/viewer';
import { t } from './i18n';

export interface Piece extends PieceData {
  mesh: THREE.Object3D;
}
export interface PieceGroup {
  id: number;
  name: string;
  obj: THREE.Group;
}

const vec = (v: { x: number; y: number; z: number }): Vec3 => ({ x: v.x, y: v.y, z: v.z });

const LS_AUTOSAVE = 'fm3_autosave';

/**
 * Estado central: piezas, grupos, selección, historial.
 * Las mallas 3D viven junto a los datos; la geometría siempre se
 * reconstruye desde `params` (única fuente de verdad).
 */
export class Store {
  pieces: Piece[] = [];
  groups: PieceGroup[] = [];
  sel: Unit[] = [];
  idCounter = 0;
  groupCounter = 0;

  private undoStack: ProjectState[] = [];
  private redoStack: ProjectState[] = [];
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners: (() => void)[] = [];

  constructor(private viewer: Viewer) {}

  /** Suscribe un callback que se dispara ante cualquier cambio estructural. */
  onChange(fn: () => void): void { this.listeners.push(fn); }
  notify(): void { for (const fn of this.listeners) fn(); }

  pieceById(id: number): Piece | undefined { return this.pieces.find(p => p.id === id); }
  groupById(id: number): PieceGroup | undefined { return this.groups.find(g => g.id === id); }

  unitObj(u: Unit): THREE.Object3D | undefined {
    return u.t === 'p' ? this.pieceById(u.id)?.mesh : this.groupById(u.id)?.obj;
  }

  /** Piezas cubiertas por la selección (incluye miembros de grupos). */
  selectedPieces(): Piece[] {
    const out: Piece[] = [];
    for (const u of this.sel) {
      if (u.t === 'p') {
        const p = this.pieceById(u.id);
        if (p) out.push(p);
      } else {
        out.push(...this.pieces.filter(p => p.groupId === u.id));
      }
    }
    return out;
  }

  isPieceSelected(id: number): boolean {
    const p = this.pieceById(id);
    return this.sel.some(u => (u.t === 'p' && u.id === id) || (u.t === 'g' && p?.groupId === u.id));
  }

  /* ── Selección ─────────────────────────────────────────────── */

  setSel(units: Unit[]): void {
    for (const p of this.pieces) setHighlight(p.mesh, false);
    const seen = new Set<string>();
    this.sel = units.filter(u => {
      const key = u.t + u.id;
      if (seen.has(key) || !this.unitObj(u)) return false;
      seen.add(key);
      return true;
    });
    for (const p of this.selectedPieces()) setHighlight(p.mesh, true);
    this.notify();
  }

  toggleSel(unit: Unit): void {
    const i = this.sel.findIndex(u => u.t === unit.t && u.id === unit.id);
    const next = [...this.sel];
    if (i >= 0) next.splice(i, 1);
    else next.push(unit);
    this.setSel(next);
  }

  /* ── Alta / edición de piezas ──────────────────────────────── */

  createPiece(type: PieceType, params: PieceParams, opts: {
    name?: string; color?: string; pos?: THREE.Vector3; rot?: THREE.Euler;
  } = {}): Piece {
    const id = ++this.idCounter;
    const data: PieceData = {
      id, type, params: { ...params },
      color: opts.color ?? MAT[type].color,
      opacity: 1, visible: true,
      name: opts.name ?? `${t(MAT[type].label)} #${id}`,
      groupId: null,
    };
    const mesh = buildPieceMesh(data);
    if (opts.pos) mesh.position.copy(opts.pos);
    else mesh.position.y = pieceDims(data)[2] / 2; // apoyada en el piso
    if (opts.rot) mesh.rotation.copy(opts.rot);
    this.viewer.root.add(mesh);
    const piece: Piece = { ...data, mesh };
    this.pieces.push(piece);
    return piece;
  }

  /** Reconstruye la malla tras cambiar `params`, conservando transformación. */
  rebuildPiece(p: Piece): void {
    const parent = p.mesh.parent ?? this.viewer.root;
    const pos = p.mesh.position.clone();
    const rot = p.mesh.rotation.clone();
    const wasAttached = this.viewer.gizmo.object === p.mesh;
    if (wasAttached) this.viewer.gizmo.detach();
    parent.remove(p.mesh);
    disposeObject(p.mesh);
    p.mesh = buildPieceMesh(p);
    p.mesh.position.copy(pos);
    p.mesh.rotation.copy(rot);
    parent.add(p.mesh);
    if (this.isPieceSelected(p.id)) setHighlight(p.mesh, true);
    if (wasAttached) this.viewer.gizmo.attach(p.mesh);
  }

  /* ── Grupos ────────────────────────────────────────────────── */

  groupPieces(list: Piece[], name?: string): PieceGroup {
    const gid = ++this.groupCounter;
    const g = new THREE.Group();
    const box = new THREE.Box3();
    for (const p of list) box.expandByObject(p.mesh);
    g.position.copy(box.getCenter(new THREE.Vector3()));
    this.viewer.root.add(g);
    this.viewer.root.updateMatrixWorld(true);
    for (const p of list) {
      g.attach(p.mesh);
      p.groupId = gid;
    }
    const grp: PieceGroup = { id: gid, name: name ?? t('group.name', { n: gid }), obj: g };
    this.groups.push(grp);
    return grp;
  }

  dissolveGroup(grp: PieceGroup): void {
    this.viewer.root.updateMatrixWorld(true);
    for (const ch of [...grp.obj.children]) this.viewer.root.attach(ch);
    for (const p of this.pieces) if (p.groupId === grp.id) p.groupId = null;
    if (this.viewer.gizmo.object === grp.obj) this.viewer.gizmo.detach();
    this.viewer.root.remove(grp.obj);
    this.groups = this.groups.filter(g => g !== grp);
  }

  /** Disuelve grupos que quedaron con menos de 2 miembros. */
  private cleanupGroups(): void {
    for (const g of [...this.groups]) {
      const n = this.pieces.filter(p => p.groupId === g.id).length;
      if (n < 2) this.dissolveGroup(g);
    }
  }

  /* ── Duplicar / espejo / eliminar ──────────────────────────── */

  private clonePieceData(p: Piece, groupId: number | null): Piece {
    const id = ++this.idCounter;
    const data: PieceData = {
      id, type: p.type, params: { ...p.params },
      color: p.color, opacity: p.opacity, visible: p.visible,
      name: `${p.name.replace(/ #\d+$/, '')} #${id}`,
      groupId,
    };
    return { ...data, mesh: buildPieceMesh(data) };
  }

  duplicateUnit(u: Unit, offset: THREE.Vector3): Unit {
    this.viewer.root.updateMatrixWorld(true);
    if (u.t === 'p') {
      const p = this.pieceById(u.id)!;
      const np = this.clonePieceData(p, null);
      np.mesh.position.copy(p.mesh.getWorldPosition(new THREE.Vector3())).add(offset);
      np.mesh.quaternion.copy(p.mesh.getWorldQuaternion(new THREE.Quaternion()));
      this.viewer.root.add(np.mesh);
      this.pieces.push(np);
      return { t: 'p', id: np.id };
    }
    const g = this.groupById(u.id)!;
    const gid = ++this.groupCounter;
    const ng = new THREE.Group();
    ng.position.copy(g.obj.position).add(offset);
    ng.rotation.copy(g.obj.rotation);
    this.viewer.root.add(ng);
    for (const p of this.pieces.filter(x => x.groupId === u.id)) {
      const np = this.clonePieceData(p, gid);
      np.mesh.position.copy(p.mesh.position);
      np.mesh.rotation.copy(p.mesh.rotation);
      ng.add(np.mesh);
      this.pieces.push(np);
    }
    this.groups.push({ id: gid, name: t('group.copy', { name: g.name }), obj: ng });
    return { t: 'g', id: gid };
  }

  mirrorUnit(u: Unit, axis: 'x' | 'z'): Unit {
    const nu = this.duplicateUnit(u, new THREE.Vector3());
    const obj = this.unitObj(nu)!;
    if (axis === 'x') {
      obj.position.x *= -1;
      obj.rotation.y *= -1;
      obj.rotation.z *= -1;
    } else {
      obj.position.z *= -1;
      obj.rotation.y *= -1;
      obj.rotation.x *= -1;
    }
    return nu;
  }

  deleteUnits(units: Unit[]): void {
    for (const u of units) {
      if (u.t === 'g') {
        const g = this.groupById(u.id);
        if (!g) continue;
        for (const p of this.pieces.filter(x => x.groupId === u.id)) {
          g.obj.remove(p.mesh);
          disposeObject(p.mesh);
        }
        this.pieces = this.pieces.filter(x => x.groupId !== u.id);
        if (this.viewer.gizmo.object === g.obj) this.viewer.gizmo.detach();
        this.viewer.root.remove(g.obj);
        this.groups = this.groups.filter(x => x !== g);
      } else {
        const p = this.pieceById(u.id);
        if (!p) continue;
        if (this.viewer.gizmo.object === p.mesh) this.viewer.gizmo.detach();
        (p.mesh.parent ?? this.viewer.root).remove(p.mesh);
        disposeObject(p.mesh);
        this.pieces = this.pieces.filter(x => x !== p);
      }
    }
    this.cleanupGroups();
  }

  /* ── Serialización / historial ─────────────────────────────── */

  serialize(): ProjectState {
    return {
      version: 3, app: 'ferromadera',
      idCounter: this.idCounter,
      groupCounter: this.groupCounter,
      groups: this.groups.map(g => ({
        id: g.id, name: g.name,
        pos: vec(g.obj.position), rot: vec(g.obj.rotation),
      })),
      pieces: this.pieces.map(p => ({
        id: p.id, type: p.type, params: { ...p.params },
        color: p.color, opacity: p.opacity, visible: p.visible,
        name: p.name, groupId: p.groupId,
        pos: vec(p.mesh.position), rot: vec(p.mesh.rotation),
      })),
    };
  }

  restore(s: ProjectState): void {
    this.viewer.gizmo.detach();
    for (const p of this.pieces) disposeObject(p.mesh);
    this.viewer.root.clear();
    this.pieces = [];
    this.groups = [];
    this.sel = [];
    this.idCounter = s.idCounter ?? 0;
    this.groupCounter = s.groupCounter ?? 0;
    for (const gs of s.groups ?? []) {
      const g = new THREE.Group();
      g.position.set(gs.pos.x, gs.pos.y, gs.pos.z);
      g.rotation.set(gs.rot.x, gs.rot.y, gs.rot.z);
      this.viewer.root.add(g);
      this.groups.push({ id: gs.id, name: gs.name, obj: g });
    }
    for (const ps of s.pieces ?? []) {
      const data: PieceData = {
        id: ps.id, type: ps.type, params: { ...ps.params },
        color: ps.color, opacity: ps.opacity ?? 1, visible: ps.visible !== false,
        name: ps.name, groupId: ps.groupId ?? null,
      };
      const mesh = buildPieceMesh(data);
      mesh.position.set(ps.pos.x, ps.pos.y, ps.pos.z);
      mesh.rotation.set(ps.rot.x, ps.rot.y, ps.rot.z);
      const parent = data.groupId != null ? this.groupById(data.groupId)?.obj : null;
      (parent ?? this.viewer.root).add(mesh);
      this.pieces.push({ ...data, mesh });
    }
    this.notify();
  }

  pushUndo(): void {
    this.undoStack.push(this.serialize());
    this.redoStack = [];
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.scheduleAutosave();
  }

  undo(): boolean {
    const s = this.undoStack.pop();
    if (!s) return false;
    this.redoStack.push(this.serialize());
    this.restore(s);
    this.scheduleAutosave();
    return true;
  }

  redo(): boolean {
    const s = this.redoStack.pop();
    if (!s) return false;
    this.undoStack.push(this.serialize());
    this.restore(s);
    this.scheduleAutosave();
    return true;
  }

  scheduleAutosave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_AUTOSAVE, JSON.stringify(this.serialize()));
      } catch { /* almacenamiento lleno o bloqueado */ }
    }, 700);
  }

  loadAutosave(): boolean {
    try {
      const raw = localStorage.getItem(LS_AUTOSAVE);
      if (!raw) return false;
      const data = JSON.parse(raw) as ProjectState;
      if (!data.pieces?.length) return false;
      this.restore(data);
      return true;
    } catch {
      return false;
    }
  }
}
