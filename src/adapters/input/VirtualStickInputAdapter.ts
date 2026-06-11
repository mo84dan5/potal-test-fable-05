export interface StickState {
  /** 正規化済みスティック値(右が正、|(x,y)| ≤ 1) */
  x: number;
  /** 正規化済みスティック値(下が正) */
  y: number;
}

export interface VirtualStickCallbacks {
  /** 移動スティックが終わった瞬間(指を離した/2本目が触れた)。はじき判定より先に呼ばれる */
  onStickEnd(): void;
  /** はじいて離した瞬間(ダッシュ)。dx/dy はスワイプ全体の移動量 [px] */
  onDash(dx: number, dy: number): void;
  /** 見回しスワイプの移動デルタ [px](右・下が正、指の本数で平均化済み) */
  onLook(dx: number, dy: number): void;
  /** タップ(短時間・微小移動で離した)した瞬間 */
  onTap(x: number, y: number): void;
}

const STICK_RADIUS = 70; // [px] ベース円の半径(正規化の分母)
const DASH_MAX_TIME = 250; // [ms] はじき とみなす最大接触時間
const DASH_MIN_DISTANCE = 40; // [px] はじき とみなす最小距離
const TAP_MAX_TIME = 300; // [ms] タップとみなす最大接触時間
const TAP_MAX_DISTANCE = 10; // [px] タップとみなす最大移動量

type Mode = 'idle' | 'stick' | 'look';

/**
 * タッチ開始位置から操作ゾーンを判定する。
 * 画面の上半分(境界含まず)= 見回し、下半分(中央線含む)= 移動。
 */
export function zoneForTouch(y: number, screenHeight: number): 'look' | 'stick' {
  return y < screenHeight / 2 ? 'look' : 'stick';
}

/**
 * タッチ入力アダプタ。
 * 1本指・下半分開始: 吸い付き型の仮想パッド(移動・はじきダッシュ)。
 * 1本指・上半分開始: 見回しスワイプ。
 * 2本指: 開始位置によらず見回しスワイプ(2本目が触れた時点でスティックは終了し、全指を離すまで見回しモード)。
 * パッドUI(ベース円+ノブ)のDOM表示もこのアダプタが担う。
 */
export class VirtualStickInputAdapter {
  private mode: Mode = 'idle';
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** タップ判定用: ポインタごとの開始位置・時刻 */
  private readonly starts = new Map<number, { x: number; y: number; t: number }>();

  private stickPointerId: number | null = null;
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

  /** 現在のスティック値。移動操作中でなければ null */
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
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.starts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    this.element.setPointerCapture(e.pointerId);

    if (this.mode === 'idle') {
      // 開始位置の上下でモードを決定(ジェスチャ中は変わらない)
      if (zoneForTouch(e.clientY, window.innerHeight) === 'look') {
        this.mode = 'look';
        return;
      }
      this.mode = 'stick';
      this.stickPointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.startTime = e.timeStamp;
      this.stick = { x: 0, y: 0 };
      moveTo(this.base, this.originX, this.originY);
      moveTo(this.knob, this.originX, this.originY);
      this.base.style.display = 'block';
      this.knob.style.display = 'block';
    } else if (this.mode === 'stick') {
      // 2本目の指: 移動を即時終了して見回しモードへ
      this.endStick();
      this.mode = 'look';
    }
    // look モード中の追加タッチはそのまま見回しに参加する
  };

  private readonly onMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;

    if (this.mode === 'stick' && e.pointerId === this.stickPointerId) {
      let dx = e.clientX - this.originX;
      let dy = e.clientY - this.originY;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx *= STICK_RADIUS / len;
        dy *= STICK_RADIUS / len;
      }
      this.stick = { x: dx / STICK_RADIUS, y: dy / STICK_RADIUS };
      moveTo(this.knob, this.originX + dx, this.originY + dy);
    } else if (this.mode === 'look') {
      // 指ごとのデルタを本数で平均化して見回しに適用する
      const scale = 1 / this.pointers.size;
      this.callbacks.onLook(
        (e.clientX - prev.x) * scale,
        (e.clientY - prev.y) * scale,
      );
    }

    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const start = this.starts.get(e.pointerId);
    this.starts.delete(e.pointerId);

    if (this.mode === 'stick' && e.pointerId === this.stickPointerId) {
      // 停止 → ダッシュの順で通知し、はじいた場合はダッシュの勢いだけが残る
      this.endStick();

      const elapsed = e.timeStamp - this.startTime;
      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      if (elapsed < DASH_MAX_TIME && Math.hypot(dx, dy) > DASH_MIN_DISTANCE) {
        this.callbacks.onDash(dx, dy);
      }
      this.mode = 'idle';
    } else if (this.mode === 'look' && this.pointers.size === 0) {
      this.mode = 'idle';
    }

    // タップ: 最後の1本が短時間・微小移動で離れたとき(ダッシュとは距離で排他)
    if (start && this.pointers.size === 0) {
      const elapsed = e.timeStamp - start.t;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (elapsed < TAP_MAX_TIME && dist < TAP_MAX_DISTANCE) {
        this.callbacks.onTap(e.clientX, e.clientY);
      }
    }
  };

  private readonly onCancel = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.starts.delete(e.pointerId);

    if (this.mode === 'stick' && e.pointerId === this.stickPointerId) {
      this.endStick();
      this.mode = 'idle';
    } else if (this.mode === 'look' && this.pointers.size === 0) {
      this.mode = 'idle';
    }
  };

  /** スティック操作を終了して停止を通知し、パッドUIを隠す */
  private endStick(): void {
    this.callbacks.onStickEnd();
    this.stickPointerId = null;
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
