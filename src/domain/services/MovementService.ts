import { Player } from '../entities/Player';
import { Vec3 } from '../values/Vec3';

export interface MovementConfig {
  /** 速度の指数減衰係数 [1/s](入力なし時) */
  damping: number;
  /** 最大速度 [m/s] */
  maxSpeed: number;
  /** 移動可能な円形範囲の半径 [m] */
  boundsRadius: number;
  /** 目標速度への追従の強さ [1/s](仮想パッド押下中) */
  acceleration: number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  damping: 2.2,
  maxSpeed: 10,
  boundsRadius: 28,
  acceleration: 8,
};

/** 慣性つき移動のドメインサービス */
export class MovementService {
  constructor(private readonly config: MovementConfig = DEFAULT_MOVEMENT_CONFIG) {}

  /** 水平方向の速度インパルスを与える(最大速度でクランプ) */
  applyImpulse(player: Player, direction: Vec3, speed: number): void {
    const len = direction.length();
    if (len === 0 || speed <= 0) return;
    const v = player.velocity.add(direction.scale(speed / len)).withY(0);
    const vLen = v.length();
    player.velocity =
      vLen > this.config.maxSpeed ? v.scale(this.config.maxSpeed / vLen) : v;
  }

  /** 1フレーム分の積分: 位置更新・速度制御(追従 or 減衰)・範囲クランプ */
  tick(player: Player, dt: number): void {
    if (dt <= 0) return;
    let pos = player.position.add(player.velocity.scale(dt)).withY(0);

    const r = Math.hypot(pos.x, pos.z);
    if (r > this.config.boundsRadius) {
      const k = this.config.boundsRadius / r;
      pos = new Vec3(pos.x * k, 0, pos.z * k);
    }
    player.position = pos;

    if (player.desiredVelocity) {
      // 仮想パッド押下中: 目標速度へ指数追従
      const blend = 1 - Math.exp(-this.config.acceleration * dt);
      player.velocity = player.velocity
        .add(player.desiredVelocity.sub(player.velocity).scale(blend))
        .withY(0);
    } else {
      // 入力なし: 慣性の指数減衰
      player.velocity = player.velocity.scale(Math.exp(-this.config.damping * dt));
    }
  }
}
