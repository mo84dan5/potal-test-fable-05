import { GameSession } from '../../domain/entities/GameSession';
import { MovementService } from '../../domain/services/MovementService';

export interface FlickInput {
  /** スクリーン水平移動量 [px](右が正) */
  dx: number;
  /** スクリーン垂直移動量 [px](下が正) */
  dy: number;
}

/** フリック入力を視点基準の移動インパルスへ変換するユースケース */
export class ApplyFlickUseCase {
  constructor(
    private readonly session: GameSession,
    private readonly movement: MovementService,
    /** スワイプ長[px] → 速度[m/s] の変換係数 */
    private readonly gain = 0.035,
  ) {}

  execute(input: FlickInput): void {
    const magnitude = Math.hypot(input.dx, input.dy);
    if (magnitude === 0) return;

    const player = this.session.player;
    // 上スワイプ(dy<0)= 前進、右スワイプ(dx>0)= 右移動
    const direction = player.right
      .scale(input.dx)
      .add(player.forward.scale(-input.dy));
    this.movement.applyImpulse(player, direction, magnitude * this.gain);
  }
}
