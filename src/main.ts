import { GameSession } from './domain/entities/GameSession';
import { Interactable } from './domain/entities/Interactable';
import { Player } from './domain/entities/Player';
import { Portal } from './domain/entities/Portal';
import { World } from './domain/entities/World';
import { Vec3 } from './domain/values/Vec3';
import { InteractionService } from './domain/services/InteractionService';
import { MovementService } from './domain/services/MovementService';
import { PortalTraversalService } from './domain/services/PortalTraversalService';
import {
  BUBBLE_RANGE,
  DAY_OBJECTS,
  INTERACT_RANGE,
  NIGHT_OBJECTS,
  PORTAL_BUBBLE,
  PORTAL_BUBBLE_ANCHOR_Y,
  WorldObjectSpec,
} from './config/worldContent';
import { ApplyDashUseCase } from './application/usecases/ApplyDashUseCase';
import { ApplyLookUseCase } from './application/usecases/ApplyLookUseCase';
import { ApplyStickUseCase } from './application/usecases/ApplyStickUseCase';
import { NearbyBubbleUseCase } from './application/usecases/NearbyBubbleUseCase';
import { StopMovementUseCase } from './application/usecases/StopMovementUseCase';
import { TapInteractUseCase } from './application/usecases/TapInteractUseCase';
import { TickUseCase } from './application/usecases/TickUseCase';
import { VirtualStickInputAdapter } from './adapters/input/VirtualStickInputAdapter';
import { ThreeRendererAdapter } from './adapters/rendering/ThreeRendererAdapter';

// --- ドメインの組み立て(ワールド定義) ---
const PORTAL_HALF_WIDTH = 1.4;
const PORTAL_HEIGHT = 3;

const toInteractables = (specs: WorldObjectSpec[], worldId: string): Interactable[] =>
  specs.map(
    (s, i) =>
      new Interactable(
        `${worldId}-${s.kind}-${i}`,
        s.name,
        new Vec3(s.x, s.anchorY, s.z),
        s.bubble ?? null,
        s.dialogue ?? [],
      ),
  );

const portalInteractable = (worldId: string): Interactable =>
  new Interactable(
    `${worldId}-portal`,
    'ポータル',
    new Vec3(0, PORTAL_BUBBLE_ANCHOR_Y, -6),
    PORTAL_BUBBLE,
    [],
  );

const dayWorld = new World(
  'day',
  '昼の世界',
  new Portal(new Vec3(0, 0, -6), 0, PORTAL_HALF_WIDTH, PORTAL_HEIGHT, 'night'),
  [...toInteractables(DAY_OBJECTS, 'day'), portalInteractable('day')],
);
const nightWorld = new World(
  'night',
  '夜の世界',
  new Portal(new Vec3(0, 0, -6), 0, PORTAL_HALF_WIDTH, PORTAL_HEIGHT, 'day'),
  [...toInteractables(NIGHT_OBJECTS, 'night'), portalInteractable('night')],
);
const player = new Player(new Vec3(0, 0, 4), Vec3.ZERO, 0, 0);
const session = new GameSession([dayWorld, nightWorld], 'day', player);

// --- サービス・ユースケース ---
const movement = new MovementService();
const traversal = new PortalTraversalService();
const interaction = new InteractionService();
const applyStick = new ApplyStickUseCase(session);
const applyDash = new ApplyDashUseCase(session, movement);
const applyLook = new ApplyLookUseCase(session);
const stopMovement = new StopMovementUseCase(session, movement);
const tapInteract = new TapInteractUseCase(session, interaction, INTERACT_RANGE);
const nearbyBubble = new NearbyBubbleUseCase(session, interaction, BUBBLE_RANGE);
const tick = new TickUseCase(session, movement, traversal);

// --- アダプタ(描画・入力) ---
const container = document.getElementById('app');
const worldNameEl = document.getElementById('world-name');
const hintEl = document.getElementById('hint');
const bubbleEl = document.getElementById('bubble');
const dialogEl = document.getElementById('dialog');
const dialogTextEl = document.getElementById('dialog-text');
if (!container || !worldNameEl || !hintEl || !bubbleEl || !dialogEl || !dialogTextEl) {
  throw new Error('required DOM elements are missing');
}

const renderer = new ThreeRendererAdapter(container, session);
const stickInput = new VirtualStickInputAdapter(renderer.canvas, {
  onStickEnd: () => stopMovement.execute(),
  onDash: (dx, dy) => applyDash.execute({ dx, dy }),
  onLook: (dx, dy) => applyLook.execute(dx, dy),
  onTap: () => tapInteract.execute(),
});

// --- 吹き出し・メッセージウィンドウのUI更新 ---
function updateInteractionUi(): void {
  if (session.dialogue) {
    dialogTextEl!.textContent = session.dialogue.currentLine;
    dialogEl!.classList.add('visible');
  } else {
    dialogEl!.classList.remove('visible');
  }

  const target = nearbyBubble.execute();
  if (target) {
    const point = renderer.projectToScreen(target.position);
    if (point.visible) {
      bubbleEl!.textContent = target.bubbleText;
      bubbleEl!.style.left = `${point.x}px`;
      bubbleEl!.style.top = `${point.y}px`;
      bubbleEl!.classList.add('visible');
      return;
    }
  }
  bubbleEl!.classList.remove('visible');
}

setTimeout(() => hintEl.classList.add('hidden'), 5000);

// --- ゲームループ ---
let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30); // タブ復帰時の暴走防止
  lastTime = now;

  applyStick.execute(stickInput.getStick());
  const result = tick.execute(dt);
  if (result.traversed) {
    worldNameEl!.textContent = session.currentWorld.name;
  }

  updateInteractionUi();
  renderer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
