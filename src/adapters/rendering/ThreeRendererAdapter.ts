import * as THREE from 'three';
import { GameSession } from '../../domain/entities/GameSession';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';

interface WorldView {
  scene: THREE.Scene;
  portalSurface: THREE.Mesh;
}

const PORTAL_VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 仮想カメラはメインカメラと同じ射影行列を使うため、
// スクリーン空間UVでレンダーターゲットを引くと正しい視差になる
const PORTAL_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D portalTexture;
  uniform vec2 resolution;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    gl_FragColor = texture2D(portalTexture, uv);
  }
`;

/** ドメインの状態を three.js で描画するプレゼンテーションアダプタ */
export class ThreeRendererAdapter {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly virtualCamera: THREE.PerspectiveCamera;
  private readonly renderTarget: THREE.WebGLRenderTarget;
  private readonly portalMaterial: THREE.ShaderMaterial;
  private readonly views = new Map<string, WorldView>();

  constructor(
    container: HTMLElement,
    private readonly session: GameSession,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.05,
      300,
    );
    this.camera.rotation.order = 'YXZ';
    this.virtualCamera = this.camera.clone();

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y);
    this.portalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        portalTexture: { value: this.renderTarget.texture },
        resolution: { value: size.clone() },
      },
      vertexShader: PORTAL_VERTEX_SHADER,
      fragmentShader: PORTAL_FRAGMENT_SHADER,
    });

    this.views.set('day', this.buildDayWorld(session.getWorld('day').portal));
    this.views.set('night', this.buildNightWorld(session.getWorld('night').portal));

    window.addEventListener('resize', this.onResize);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  render(): void {
    const current = this.viewOf(this.session.currentWorldId);
    const otherWorldId = this.session.currentWorld.portal.targetWorldId;
    const other = this.viewOf(otherWorldId);

    this.syncCamera(this.session.player);

    // 1. 仮想カメラ姿勢 = M(出口) × FlipY180 × M(入口)⁻¹ × メインカメラ姿勢
    const fromPortal = this.session.currentWorld.portal;
    const toPortal = this.session.getWorld(otherWorldId).portal;
    const m = this.portalMatrix(toPortal)
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
      .multiply(this.portalMatrix(fromPortal).invert())
      .multiply(this.camera.matrixWorld);
    m.decompose(
      this.virtualCamera.position,
      this.virtualCamera.quaternion,
      this.virtualCamera.scale,
    );
    this.virtualCamera.projectionMatrix.copy(this.camera.projectionMatrix);
    this.virtualCamera.projectionMatrixInverse.copy(
      this.camera.projectionMatrixInverse,
    );

    // 2. 接続先ワールドをレンダーターゲットへ描画(出口ポータル面は隠して再帰を防ぐ)
    other.portalSurface.visible = false;
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(other.scene, this.virtualCamera);
    this.renderer.setRenderTarget(null);
    other.portalSurface.visible = true;

    // 3. 現在ワールドを描画(ポータル面はスクリーン空間UVでRTを表示)
    this.renderer.render(current.scene, this.camera);
  }

  private viewOf(worldId: string): WorldView {
    const view = this.views.get(worldId);
    if (!view) throw new Error(`view not built for world: ${worldId}`);
    return view;
  }

  private syncCamera(player: Player): void {
    const eye = player.eyePosition;
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(player.pitch, player.yaw, 0);
    this.camera.updateMatrixWorld();
  }

  private portalMatrix(portal: Portal): THREE.Matrix4 {
    return new THREE.Matrix4()
      .makeRotationY(portal.yaw)
      .setPosition(portal.position.x, portal.position.y, portal.position.z);
  }

  private readonly onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderTarget.setSize(size.x, size.y);
    (this.portalMaterial.uniforms.resolution.value as THREE.Vector2).copy(size);
  };

  // --- 以下、ワールドのシーン構築(プレゼンテーション都合の見た目定義) ---

  private buildDayWorld(portal: Portal): WorldView {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 30, 90);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4d6, 1.4);
    sun.position.set(10, 20, 8);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshLambertMaterial({ color: 0x5cab5c }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const treeSpots: Array<[number, number]> = [
      [-8, -2], [9, -4], [-12, 8], [13, 9], [-5, 14], [6, 16], [-15, -8], [16, -10],
    ];
    for (const [x, z] of treeSpots) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8), trunkMat);
      trunk.position.y = 1.1;
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 10), leafMat);
      leaves.position.y = 3.6;
      tree.add(trunk, leaves);
      tree.position.set(x, 0, z);
      scene.add(tree);
    }

    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9b9b8f });
    const rockSpots: Array<[number, number, number]> = [
      [4, 6, 0.7], [-6, 5, 0.5], [10, 2, 0.9], [-3, -12, 0.6],
    ];
    for (const [x, z, s] of rockSpots) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s), rockMat);
      rock.position.set(x, s * 0.6, z);
      scene.add(rock);
    }

    const portalSurface = this.buildPortalMeshes(scene, portal, 0xffc04d);
    return { scene, portalSurface };
  }

  private buildNightWorld(portal: Portal): WorldView {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1026);
    scene.fog = new THREE.Fog(0x0b1026, 30, 90);

    scene.add(new THREE.HemisphereLight(0x8899ff, 0x221144, 0.5));
    const moonLight = new THREE.DirectionalLight(0xaabbff, 0.7);
    moonLight.position.set(-8, 18, -6);
    scene.add(moonLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshLambertMaterial({ color: 0x3c2f5c }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xf3f1d8 }),
    );
    moon.position.set(-20, 26, -34);
    scene.add(moon);

    // 星空(座標は決め打ちの擬似乱数で生成)
    const starPositions: number[] = [];
    for (let i = 0; i < 400; i++) {
      const a = i * 2.39996; // 黄金角でばらけさせる
      const r = 60 + (i % 37);
      const y = 12 + ((i * 7919) % 70);
      starPositions.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    scene.add(
      new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 })),
    );

    const crystalSpots: Array<[number, number, number, number]> = [
      [-7, -3, 1.6, 0x66ffee], [8, -5, 2.2, 0xff66dd], [-11, 7, 1.8, 0x66aaff],
      [12, 10, 1.4, 0xaaff66], [-4, 13, 2.0, 0xff9966], [5, 17, 1.7, 0x66ffee],
    ];
    for (const [x, z, h, color] of crystalSpots) {
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, h, 6),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.8,
          roughness: 0.3,
        }),
      );
      crystal.position.set(x, h / 2, z);
      scene.add(crystal);
    }

    const portalSurface = this.buildPortalMeshes(scene, portal, 0x7df9ff);
    return { scene, portalSurface };
  }

  /** ポータルの門枠と「向こう側」を映す面を配置し、面メッシュを返す */
  private buildPortalMeshes(
    scene: THREE.Scene,
    portal: Portal,
    frameColor: number,
  ): THREE.Mesh {
    const group = new THREE.Group();
    group.position.set(portal.position.x, 0, portal.position.z);
    group.rotation.y = portal.yaw;

    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      emissive: frameColor,
      emissiveIntensity: 0.55,
      roughness: 0.4,
    });
    const w = portal.halfWidth * 2;
    const h = portal.height;
    const t = 0.22; // 枠の太さ
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h + t, t), frameMat);
    left.position.set(-portal.halfWidth - t / 2, (h + t) / 2, 0);
    const right = left.clone();
    right.position.x = portal.halfWidth + t / 2;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + t * 2, t, t), frameMat);
    lintel.position.set(0, h + t / 2, 0);
    group.add(left, right, lintel);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      this.portalMaterial,
    );
    surface.position.y = h / 2;
    (surface.material as THREE.ShaderMaterial).side = THREE.DoubleSide;
    group.add(surface);

    scene.add(group);
    return surface;
  }
}
