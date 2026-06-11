export interface StickState {
  /** 正規化済みスティック値(右が正、|(x,y)| ≤ 1) */
  x: number;
  /** 正規化済みスティック値(下が正) */
  y: number;
}

export interface VirtualStickCallbacks {
  /** 指を離した瞬間(はじき判定より先に呼ばれる) */
  onStickEnd(): void;
  /** はじいて離した瞬間(ダッシュ)。dx/dy はスワイプ全体の移動量 [px] */
  onDash(dx: number, dy: number): void;
}

const STICK_RADIUS = 70; // [px] ベース円の半径(正規化の分母)
const DASH_MAX_TIME = 250; // [ms] はじき とみなす最大接触時間
const DASH_MIN_DISTANCE = 40; // [px] はじき とみなす最小距離

/**
 * 吸い付き型の仮想パッド入力アダプタ。
 * 画面の任意の場所をタッチするとそこが原点になり、ドラッグ量を正規化して提供する。
 * パッドUI(ベース円+ノブ)のDOM表示もこのアダプタが担う。
 */
export class VirtualStickInputAdapter {
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private startTime = 0;
  private stick: StickState | null = null;

  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: VirtualStickCallbacks,
  ) {
    this.base = createOverlay('stick-base');
    this.knob = createOverlay('stick-knob');

    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onCancel);
  }

  /** 現在のスティック値。指を離していれば null */
  getStick(): StickState | null {
    return this.stick;
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onUp);
    this.element.removeEventListener('pointercancel', this.onCancel);
    this.base.remove();
    this.knob.remove();
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // マルチタッチの2本目以降は無視
    this.pointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.startTime = e.timeStamp;
    this.stick = { x: 0, y: 0 };
    this.element.setPointerCapture(e.pointerId);

    moveTo(this.base, this.originX, this.originY);
    moveTo(this.knob, this.originX, this.originY);
    this.base.style.display = 'block';
    this.knob.style.display = 'block';
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    let dx = e.clientX - this.originX;
    let dy = e.clientY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx *= STICK_RADIUS / len;
      dy *= STICK_RADIUS / len;
    }
    this.stick = { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS };
    moveTo(this.knob, this.originX + dx, this.originY + dy);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;

    // 停止 → ダッシュの順で通知し、はじいた場合はダッシュの勢いだけが残る
    this.callbacks.onStickEnd();

    const elapsed = e.timeStamp - this.startTime;
    const dx = e.clientX - this.originX;
    const dy = e.clientY - this.originY;
    if (elapsed < DASH_MAX_TIME && Math.hypot(dx, dy) > DASH_MIN_DISTANCE) {
      this.callbacks.onDash(dx, dy);
    }
    this.release();
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.callbacks.onStickEnd();
    this.release();
  };

  private release(): void {
    this.pointerId = null;
    this.stick = null;
    this.base.style.display = 'none';
    this.knob.style.display = 'none';
  }
}

function createOverlay(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

function moveTo(el: HTMLElement, x: number, y: number): void {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}
