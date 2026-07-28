import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'select' | 'move' | 'rotate';

export interface ViewerEvents {
  /** Click limpio (sin arrastre) sobre el viewport. */
  onPick(e: PointerEvent): void;
  /** Empezó un arrastre de gizmo (guardar undo). */
  onGizmoStart(): void;
  /** Terminó un arrastre de gizmo. */
  onGizmoEnd(): void;
  /** El objeto adjunto cambió durante el arrastre. */
  onGizmoChange(): void;
}

/** Encapsula renderer, cámara, luces, controles y picking. */
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;
  readonly gizmo: TransformControls;
  /** Raíz de todas las piezas y grupos. */
  readonly root: THREE.Group;
  readonly grid: THREE.GridHelper;

  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private container: HTMLElement;
  private downPos: { x: number; y: number; btn: number } | null = null;

  constructor(container: HTMLElement, events: ViewerEvents) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x212327);
    this.scene.fog = new THREE.Fog(0x212327, 6000, 16000);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 40000);
    this.camera.position.set(1250, 950, 1250);

    // Luces
    this.scene.add(new THREE.HemisphereLight(0xdde3ee, 0x3a3630, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(900, 1600, 700);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -2600; dir.shadow.camera.right = 2600;
    dir.shadow.camera.top = 2600; dir.shadow.camera.bottom = -2600;
    dir.shadow.camera.far = 6000;
    this.scene.add(dir);

    // Piso: grilla + sombra
    this.grid = new THREE.GridHelper(4000, 80, 0x555a63, 0x33373d);
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.75;
    this.scene.add(this.grid);
    const axes = new THREE.AxesHelper(130);
    axes.position.y = 0.5;
    this.scene.add(axes);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Órbita
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.09;
    this.orbit.target.set(0, 300, 0);
    this.orbit.maxPolarAngle = Math.PI * 0.52;
    this.orbit.minDistance = 80;
    this.orbit.maxDistance = 16000;

    // Gizmo de transformación
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.9);
    // r169+: el helper visual se agrega aparte; en versiones previas el control es Object3D
    const g = this.gizmo as unknown as { getHelper?: () => THREE.Object3D };
    this.scene.add(g.getHelper ? g.getHelper() : (this.gizmo as unknown as THREE.Object3D));

    this.gizmo.addEventListener('dragging-changed', (e: { value?: unknown }) => {
      const dragging = !!e.value;
      this.orbit.enabled = !dragging;
      if (dragging) events.onGizmoStart();
      else events.onGizmoEnd();
    });
    this.gizmo.addEventListener('objectChange', () => events.onGizmoChange());

    // Picking: click sin arrastre
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', e => {
      this.downPos = { x: e.clientX, y: e.clientY, btn: e.button };
    });
    dom.addEventListener('pointerup', e => {
      const d = this.downPos;
      this.downPos = null;
      if (!d || d.btn !== 0) return;
      const moved = Math.abs(e.clientX - d.x) > 5 || Math.abs(e.clientY - d.y) > 5;
      if (moved || this.gizmo.dragging || this.gizmo.axis) return;
      events.onPick(e);
    });

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private castFrom(e: { clientX: number; clientY: number }): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  /** Devuelve el pieceId golpeado por el rayo, o null. */
  pickPieceId(e: { clientX: number; clientY: number }): number | null {
    this.castFrom(e);
    const meshes: THREE.Object3D[] = [];
    this.root.traverse(c => {
      if ((c as THREE.Mesh).isMesh && c.visible) meshes.push(c);
    });
    const hits = this.raycaster.intersectObjects(meshes, false);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.pieceId === undefined) o = o.parent;
      if (o) return o.userData.pieceId as number;
    }
    return null;
  }

  /** Punto 3D bajo el cursor: sobre una pieza o sobre el plano del piso. */
  pickPoint(e: { clientX: number; clientY: number }): THREE.Vector3 | null {
    this.castFrom(e);
    const meshes: THREE.Object3D[] = [];
    this.root.traverse(c => {
      if ((c as THREE.Mesh).isMesh && c.visible) meshes.push(c);
    });
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) return hits[0].point.clone();
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(floor, pt) ? pt : null;
  }

  setGizmoMode(mode: GizmoMode, target: THREE.Object3D | null): void {
    if (mode === 'select' || !target) {
      this.gizmo.detach();
      return;
    }
    this.gizmo.setMode(mode === 'move' ? 'translate' : 'rotate');
    this.gizmo.attach(target);
  }

  setSnap(on: boolean, step: number): void {
    this.gizmo.setTranslationSnap(on ? step : null);
    this.gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(15) : null);
  }

  /** Caja envolvente de las piezas visibles (o un valor por defecto). */
  contentBox(): THREE.Box3 {
    const box = new THREE.Box3();
    let any = false;
    for (const child of this.root.children) {
      if (child.visible) { box.expandByObject(child); any = true; }
    }
    if (!any) box.set(new THREE.Vector3(-500, 0, -500), new THREE.Vector3(500, 800, 500));
    return box;
  }

  frameView(dir: 'iso' | 'front' | 'side' | 'top'): void {
    const box = this.contentBox();
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 300);
    const dist = maxDim * 1.9 + 300;
    this.orbit.target.copy(c);
    switch (dir) {
      case 'front': this.camera.position.set(c.x, c.y, c.z + dist); break;
      case 'side':  this.camera.position.set(c.x + dist, c.y, c.z); break;
      case 'top':   this.camera.position.set(c.x, c.y + dist, c.z + 1); break;
      default:      this.camera.position.set(c.x + dist * 0.72, c.y + dist * 0.62, c.z + dist * 0.72);
    }
    this.orbit.update();
  }

  frameBox(box: THREE.Box3): void {
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z, 200) * 2.2 + 200;
    const dirV = this.camera.position.clone().sub(this.orbit.target).normalize();
    this.orbit.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dirV, dist);
    this.orbit.update();
  }

  render(): void {
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }
}
