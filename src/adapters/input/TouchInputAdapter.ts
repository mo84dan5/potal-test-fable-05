export interface GestureCallbacks {
  /** フリック確定時(指を離した瞬間)。dx/dy はスワイプ全体の移動量 [px] */
  onFlick(dx: number, dy: number): void;
  /** ドラッグ中の移動デルタ [px] */
  onLook(dx: number, dy: number): void;
}

const DECIDE_DISTANCE = 12; // [px] ジェスチャ種別を確定する移動距離
const DECIDE_TIME = 120; // [ms] これより速く動き出したらフリック候補
const FLICK_MAX_TIME = 280; // [ms] フリックとみなす最大接触時間
const FLICK_MIN_DISTANCE = 30; // [px] フリックとみなす最小距離

type GestureMode = 'pending' | 'flick-candidate' | 'drag';

/**
 * Pointer Events からフリック/ドラッグを判定する入力アダプタ。
 * マウスでも同一ロジックで動作する。
 */
export class TouchInputAdapter {
  private pointerId: number | null = null;
  private mode: GestureMode = 'pending';
  private startTime = 0;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: GestureCallbacks,
  ) {
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onCancel);
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onUp);
    this.element.removeEventListener('pointercancel', this.onCancel);
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // マルチタッチの2本目以降は無視
    this.pointerId = e.pointerId;
    this.mode = 'pending';
    this.startTime = e.timeStamp;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.element.setPointerCapture(e.pointerId);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    const elapsed = e.timeStamp - this.startTime;
    const totalDist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);

    if (this.mode === 'pending' && totalDist > DECIDE_DISTANCE) {
      this.mode = elapsed < DECIDE_TIME ? 'flick-candidate' : 'drag';
    }
    if (this.mode === 'flick-candidate' && elapsed > FLICK_MAX_TIME) {
      this.mode = 'drag'; // 押しっぱなしになったらドラッグへ昇格
    }

    if (this.mode === 'drag') {
      this.callbacks.onLook(e.clientX - this.lastX, e.clientY - this.lastY);
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    const elapsed = e.timeStamp - this.startTime;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const isFlick =
      this.mode !== 'drag' &&
      elapsed < FLICK_MAX_TIME &&
      Math.hypot(dx, dy) > FLICK_MIN_DISTANCE;

    if (isFlick) this.callbacks.onFlick(dx, dy);
    this.pointerId = null;
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.pointerId = null;
  };
}
