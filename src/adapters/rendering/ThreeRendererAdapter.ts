import * as THREE from 'three';
import { GameSession } from '../../domain/entities/GameSession';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';
import { World } from '../../domain/entities/World';
import { Vec3 } from '../../domain/values/Vec3';
import { WORLD_DEFS, WorldObjectSpec } from '../../config/worldContent';

export interface ScreenPoint {
  x: number;
  y: number;
  /** カメラの前方かつ画面近傍に投影されたか */
  visible: boolean;
}

interface WorldView {
  scene: THREE.Scene;
  /** ポータルID → 「向こう側」を映す面メッシュ */
  portalSurfaces: Map<string, THREE.Mesh>;
  /** ポータルID → 面マテリアル(テクスチャは毎フレーム割当) */
  portalMaterials: Map<string, THREE.ShaderMaterial>;
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
  /** 現在ワールドのポータルに毎フレーム割り当てるレンダーターゲットのプール */
  private readonly renderTargetPool: THREE.WebGLRenderTarget[] = [];
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
    const maxPortals = Math.max(
      ...this.session.allWorlds.map((w) => w.portals.length),
    );
    for (let i = 0; i < maxPortals; i++) {
      this.renderTargetPool.push(new THREE.WebGLRenderTarget(size.x, size.y));
    }

    for (const world of this.session.allWorlds) {
      this.views.set(world.id, this.buildWorld(world, size));
    }

    window.addEventListener('resize', this.onResize);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** ワールド座標をスクリーン座標 [px] へ投影する(吹き出しの位置決め用) */
  projectToScreen(p: Vec3): ScreenPoint {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
      visible: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
    };
  }

  render(): void {
    const world = this.session.currentWorld;
    const view = this.viewOf(world.id);
    this.syncCamera(this.session.player);

    // 現在ワールドの各ポータルについて、接続先ワールドをレンダーターゲットへ描画する
    world.portals.forEach((portal, index) => {
      const rt = this.renderTargetPool[index];
      const targetWorld = this.session.getWorld(portal.targetWorldId);
      const targetPortal = targetWorld.getPortal(portal.targetPortalId);
      const targetView = this.viewOf(targetWorld.id);

      // 仮想カメラ姿勢 = M(出口) × FlipY180 × M(入口)⁻¹ × メインカメラ姿勢
      const m = this.portalMatrix(targetPortal)
        .multiply(new THREE.Matrix4().makeRotationY(Math.PI))
        .multiply(this.portalMatrix(portal).invert())
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

      // 接続先シーンの全ポータル面を隠して再帰描画・フィードバックを防ぐ
      this.setPortalSurfacesVisible(targetView, false);
      this.renderer.setRenderTarget(rt);
      this.renderer.render(targetView.scene, this.virtualCamera);
      this.setPortalSurfacesVisible(targetView, true);

      const material = view.portalMaterials.get(portal.id);
      if (material) material.uniforms.portalTexture.value = rt.texture;
    });

    this.renderer.setRenderTarget(null);
    this.renderer.render(view.scene, this.camera);
  }

  private setPortalSurfacesVisible(view: WorldView, visible: boolean): void {
    for (const surface of view.portalSurfaces.values()) {
      surface.visible = visible;
    }
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
    for (const rt of this.renderTargetPool) rt.setSize(size.x, size.y);
    for (const view of this.views.values()) {
      for (const material of view.portalMaterials.values()) {
        (material.uniforms.resolution.value as THREE.Vector2).copy(size);
      }
    }
  };

  // --- 以下、ワールドのシーン構築(プレゼンテーション都合の見た目定義) ---

  private buildWorld(world: World, size: THREE.Vector2): WorldView {
    const scene = new THREE.Scene();
    const def = WORLD_DEFS.find((d) => d.id === world.id);
    this.buildEnvironment(scene, world.id);
    if (def) this.buildObjects(scene, def.objects);

    const portalSurfaces = new Map<string, THREE.Mesh>();
    const portalMaterials = new Map<string, THREE.ShaderMaterial>();
    for (const portal of world.portals) {
      const frameColor =
        def?.portals.find((p) => p.id === portal.id)?.frameColor ?? 0xffffff;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          portalTexture: { value: null },
          resolution: { value: size.clone() },
        },
        vertexShader: PORTAL_VERTEX_SHADER,
        fragmentShader: PORTAL_FRAGMENT_SHADER,
        side: THREE.DoubleSide,
      });
      const surface = this.buildPortalMeshes(scene, portal, frameColor, material);
      portalSurfaces.set(portal.id, surface);
      portalMaterials.set(portal.id, material);
    }
    return { scene, portalSurfaces, portalMaterials };
  }

  private buildEnvironment(scene: THREE.Scene, worldId: string): void {
    switch (worldId) {
      case 'day': {
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 30, 90);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.1));
        const sun = new THREE.DirectionalLight(0xfff4d6, 1.4);
        sun.position.set(10, 20, 8);
        scene.add(sun);
        this.addGround(scene, 'grass');
        break;
      }
      case 'night': {
        scene.background = new THREE.Color(0x0b1026);
        scene.fog = new THREE.Fog(0x0b1026, 30, 90);
        scene.add(new THREE.HemisphereLight(0x8899ff, 0x221144, 0.5));
        const moonLight = new THREE.DirectionalLight(0xaabbff, 0.7);
        moonLight.position.set(-8, 18, -6);
        scene.add(moonLight);
        this.addGround(scene, 'dirt');

        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(2.4, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0xf3f1d8 }),
        );
        moon.position.set(-20, 26, -34);
        scene.add(moon);
        scene.add(this.buildStars());
        break;
      }
      case 'snow': {
        scene.background = new THREE.Color(0xdce9f5);
        scene.fog = new THREE.Fog(0xdce9f5, 25, 80);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xcfe0ee, 1.0));
        const winterSun = new THREE.DirectionalLight(0xeef6ff, 0.9);
        winterSun.position.set(6, 16, 10);
        scene.add(winterSun);
        this.addGround(scene, 'snow');
        break;
      }
      case 'ruins': {
        scene.background = new THREE.Color(0xffb37a);
        scene.fog = new THREE.Fog(0xffb37a, 28, 85);
        scene.add(new THREE.HemisphereLight(0xffd9b0, 0x6b4a33, 0.9));
        const dusk = new THREE.DirectionalLight(0xffa45e, 1.1);
        dusk.position.set(-12, 8, -10);
        scene.add(dusk);
        this.addGround(scene, 'stone');

        const sun = new THREE.Mesh(
          new THREE.SphereGeometry(3, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
        );
        sun.position.set(-30, 8, -38);
        scene.add(sun);
        break;
      }
    }
  }

  private addGround(scene: THREE.Scene, pattern: GroundPattern): void {
    const texture = createGroundTexture(pattern);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshLambertMaterial({ map: texture }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  private buildStars(): THREE.Points {
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
    return new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 }),
    );
  }

  private buildObjects(scene: THREE.Scene, specs: WorldObjectSpec[]): void {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x9b9b8f });
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xbfe3ff,
      emissive: 0x88c9ff,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xd8c49a });

    for (const spec of specs) {
      switch (spec.kind) {
        case 'tree': {
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
            trunkMat,
          );
          trunk.position.y = 1.1;
          const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 10), leafMat);
          leaves.position.y = 3.6;
          tree.add(trunk, leaves);
          tree.position.set(spec.x, 0, spec.z);
          scene.add(tree);
          break;
        }
        case 'rock': {
          const s = spec.size ?? 0.6;
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s), rockMat);
          rock.position.set(spec.x, s * 0.6, spec.z);
          scene.add(rock);
          break;
        }
        case 'crystal': {
          const h = spec.size ?? 1.6;
          const color = spec.color ?? 0x66ffee;
          const crystal = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, h, 6),
            new THREE.MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.8,
              roughness: 0.3,
            }),
          );
          crystal.position.set(spec.x, h / 2, spec.z);
          scene.add(crystal);
          break;
        }
        case 'ice': {
          const h = spec.size ?? 2.2;
          const ice = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 7), iceMat);
          ice.position.set(spec.x, h / 2, spec.z);
          scene.add(ice);
          break;
        }
        case 'pillar': {
          const h = spec.size ?? 3;
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.62, h, 10),
            pillarMat,
          );
          pillar.position.set(spec.x, h / 2, spec.z);
          scene.add(pillar);
          break;
        }
      }
    }
  }

  /** ポータルの門枠と「向こう側」を映す面を配置し、面メッシュを返す */
  private buildPortalMeshes(
    scene: THREE.Scene,
    portal: Portal,
    frameColor: number,
    material: THREE.ShaderMaterial,
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

    const surface = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    surface.position.y = h / 2;
    group.add(surface);

    scene.add(group);
    return surface;
  }
}

// --- 地面のプロシージャル模様(外部アセット不要・シード付きで決定的) ---

type GroundPattern = 'grass' | 'dirt' | 'snow' | 'stone';

/** 線形合同法の擬似乱数(リロードしても同じ模様になる) */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function createGroundTexture(pattern: GroundPattern): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  const rand = seededRandom(0xc0ffee);

  switch (pattern) {
    case 'grass': {
      ctx.fillStyle = '#5cab5c';
      ctx.fillRect(0, 0, size, size);
      // まだら(明暗のパッチ)
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(60,120,60,0.18)' : 'rgba(140,200,120,0.14)';
        const r = 12 + rand() * 26;
        ctx.beginPath();
        ctx.ellipse(rand() * size, rand() * size, r, r * (0.5 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // 草むらの短いタッチ
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 260; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const len = 3 + rand() * 5;
        const lean = (rand() - 0.5) * 3;
        ctx.strokeStyle = rand() < 0.5 ? 'rgba(40,100,45,0.55)' : 'rgba(120,190,100,0.5)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + lean, y - len);
        ctx.stroke();
      }
      break;
    }
    case 'dirt': {
      ctx.fillStyle = '#3c2f5c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(35,25,70,0.35)' : 'rgba(90,70,140,0.18)';
        const r = 14 + rand() * 30;
        ctx.beginPath();
        ctx.ellipse(rand() * size, rand() * size, r, r * (0.4 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      // かすかに光る粒
      for (let i = 0; i < 90; i++) {
        const a = 0.25 + rand() * 0.45;
        ctx.fillStyle = rand() < 0.3 ? `rgba(170,150,255,${a})` : `rgba(110,95,180,${a})`;
        const r = 0.6 + rand() * 1.4;
        ctx.beginPath();
        ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'snow': {
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(0, 0, size, size);
      // 風紋(なだらかな波線)
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const baseY = (i + rand() * 0.6) * (size / 9);
        ctx.strokeStyle = 'rgba(200,220,238,0.7)';
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= size; x += 16) {
          ctx.lineTo(x, baseY + Math.sin((x / size) * Math.PI * 2 + i) * 5 + (rand() - 0.5) * 2);
        }
        ctx.stroke();
      }
      // きらめき
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rand() < 0.4 ? 'rgba(255,255,255,0.9)' : 'rgba(190,215,245,0.6)';
        const r = 0.6 + rand() * 1.2;
        ctx.beginPath();
        ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'stone': {
      ctx.fillStyle = '#c9a36a';
      ctx.fillRect(0, 0, size, size);
      // 石畳(4×4タイルの目地。端の線はタイル境界でリピートが繋がる)
      const tile = size / 4;
      ctx.strokeStyle = 'rgba(140,105,60,0.85)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        const o = i * tile;
        ctx.beginPath();
        ctx.moveTo(o, 0);
        ctx.lineTo(o, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, o);
        ctx.lineTo(size, o);
        ctx.stroke();
      }
      // タイルごとの色むら
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          ctx.fillStyle = `rgba(${150 + rand() * 60},${115 + rand() * 45},${60 + rand() * 35},0.25)`;
          ctx.fillRect(tx * tile + 2, ty * tile + 2, tile - 4, tile - 4);
        }
      }
      // ひび
      ctx.strokeStyle = 'rgba(120,90,50,0.6)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        let x = rand() * size;
        let y = rand() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let step = 0; step < 5; step++) {
          x += (rand() - 0.5) * 30;
          y += (rand() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
  }

  return new THREE.CanvasTexture(canvas);
}
