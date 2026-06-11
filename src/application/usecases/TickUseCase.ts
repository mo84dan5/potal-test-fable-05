import { GameSession } from '../../domain/entities/GameSession';
import { MovementService } from '../../domain/services/MovementService';
import { PortalTraversalService } from '../../domain/services/PortalTraversalService';

export interface TickResult {
  /** このフレームでポータルを通過したか */
  traversed: boolean;
}

/** 1フレーム分のゲーム状態更新(移動+ポータル通過判定)を行うユースケース */
export class TickUseCase {
  constructor(
    private readonly session: GameSession,
    private readonly movement: MovementService,
    private readonly traversal: PortalTraversalService,
  ) {}

  execute(dt: number): TickResult {
    const player = this.session.player;
    const before = player.position;

    this.movement.tick(player, dt);

    const portal = this.session.currentWorld.portal;
    if (this.traversal.hasCrossed(portal, before, player.position)) {
      const dest = this.session.getWorld(portal.targetWorldId);
      this.traversal.traverse(player, portal, dest.portal);
      this.session.moveToWorld(dest.id);
      return { traversed: true };
    }
    return { traversed: false };
  }
}
