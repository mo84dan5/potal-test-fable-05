import { GameSession } from '../../domain/entities/GameSession';

export interface StickInput {
  /** 正規化済みスティック値(右が正、|(x,y)| ≤ 1) */
  x: number;
  /** 正規化済みスティック値(下が正) */
  y: number;
}

const DEAD_ZONE = 0.12;

/**
 * 仮想パッドのスティック値を毎フレーム目標速度と自動旋回へ変換するユースケース。
 * stick が null(指を離している)なら目標速度を解除する。
 */
export class ApplyStickUseCase {
  constructor(
    private readonly session: GameSession,
    /** 最大歩行速度 [m/s](スティックを倒し切ったとき) */
    private readonly walkSpeed = 6,
    /** 進行方向への旋回の追従の強さ [1/s] */
    private readonly steerRate = 4.5,
  ) {}

  execute(stick: StickInput | null, dt: number): void {
    const player = this.session.player;
    const magnitude = stick ? Math.hypot(stick.x, stick.y) : 0;
    if (!stick || magnitude < DEAD_ZONE) {
      player.desiredVelocity = null;
      return;
    }

    // 上に倒す(y<0)= 前進、引っ張り量で速度が決まる
    const direction = player.right
      .scale(stick.x)
      .add(player.forward.scale(-stick.y));
    const dirLen = direction.length();
    if (dirLen === 0) return;
    const unit = direction.scale(1 / dirLen);
    player.desiredVelocity = unit.scale(Math.min(1, magnitude) * this.walkSpeed);

    // 自動旋回: 進行方向の方位へヨーを指数追従させる
    const targetYaw = Math.atan2(-unit.x, -unit.z);
    const delta = wrapAngle(targetYaw - player.yaw);
    player.yaw += delta * (1 - Math.exp(-this.steerRate * dt));
  }
}

/** 角度差を [-π, π] に正規化する */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
