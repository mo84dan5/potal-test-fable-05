import { GameSession } from './domain/entities/GameSession';
import { Player } from './domain/entities/Player';
import { Portal } from './domain/entities/Portal';
import { World } from './domain/entities/World';
import { Vec3 } from './domain/values/Vec3';
import { MovementService } from './domain/services/MovementService';
import { PortalTraversalService } from './domain/services/PortalTraversalService';
import { ApplyFlickUseCase } from './application/usecases/ApplyFlickUseCase';
import { ApplyLookUseCase } from './application/usecases/ApplyLookUseCase';
import { TickUseCase } from './application/usecases/TickUseCase';
import { TouchInputAdapter } from './adapters/input/TouchInputAdapter';
import { ThreeRendererAdapter } from './adapters/rendering/ThreeRendererAdapter';

// --- ドメインの組み立て(ワールド定義) ---
const PORTAL_HALF_WIDTH = 1.4;
const PORTAL_HEIGHT = 3;

const dayWorld = new World(
  'day',
  '昼の世界',
  new Portal(new Vec3(0, 0, -6), 0, PORTAL_HALF_WIDTH, PORTAL_HEIGHT, 'night'),
);
const nightWorld = new World(
  'night',
  '夜の世界',
  new Portal(new Vec3(0, 0, -6), 0, PORTAL_HALF_WIDTH, PORTAL_HEIGHT, 'day'),
);
const player = new Player(new Vec3(0, 0, 4), Vec3.ZERO, 0, 0);
const session = new GameSession([dayWorld, nightWorld], 'day', player);

// --- サービス・ユースケース ---
const movement = new MovementService();
const traversal = new PortalTraversalService();
const applyFlick = new ApplyFlickUseCase(session, movement);
const applyLook = new ApplyLookUseCase(session);
const tick = new TickUseCase(session, movement, traversal);

// --- アダプタ(描画・入力) ---
const container = document.getElementById('app');
const worldNameEl = document.getElementById('world-name');
const hintEl = document.getElementById('hint');
if (!container || !worldNameEl || !hintEl) {
  throw new Error('required DOM elements are missing');
}

const renderer = new ThreeRendererAdapter(container, session);
new TouchInputAdapter(renderer.canvas, {
  onFlick: (dx, dy) => applyFlick.execute({ dx, dy }),
  onLook: (dx, dy) => applyLook.execute(dx, dy),
});

setTimeout(() => hintEl.classList.add('hidden'), 5000);

// --- ゲームループ ---
let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30); // タブ復帰時の暴走防止
  lastTime = now;

  const result = tick.execute(dt);
  if (result.traversed) {
    worldNameEl!.textContent = session.currentWorld.name;
  }

  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
