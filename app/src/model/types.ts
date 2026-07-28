/** Tipos del dominio — sin dependencia de Three.js ni del DOM. */

export type PieceType = 'tube_square' | 'tube_rect' | 'tube_round' | 'angle' | 'flat' | 'wood';

/** Parámetros de fabricación en mm. `L` siempre presente; el resto según el tipo. */
export interface PieceParams {
  L: number;
  a?: number; // perfil / ala
  e?: number; // espesor (pared, ala o placa)
  w?: number; // base / ancho
  h?: number; // altura
  d?: number; // diámetro
  [k: string]: number | undefined;
}

export interface PieceData {
  id: number;
  type: PieceType;
  params: PieceParams;
  color: string;
  opacity: number;
  visible: boolean;
  name: string;
  groupId: number | null;
}

export interface Vec3 { x: number; y: number; z: number; }

export interface PieceSnapshot extends PieceData {
  pos: Vec3;
  rot: Vec3;
}

export interface GroupSnapshot {
  id: number;
  name: string;
  pos: Vec3;
  rot: Vec3;
}

/** Formato de proyecto v3 (.fmd). */
export interface ProjectState {
  version: 3;
  app?: string;
  idCounter: number;
  groupCounter: number;
  groups: GroupSnapshot[];
  pieces: PieceSnapshot[];
}

/** Unidad de selección: pieza suelta o grupo. */
export interface Unit { t: 'p' | 'g'; id: number; }

export type ViewName = 'front' | 'side' | 'top';
