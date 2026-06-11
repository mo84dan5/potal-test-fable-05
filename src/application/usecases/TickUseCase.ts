import { GameSession } from '../../domain/entities/GameSession';
import { CollisionService } from '../../domain/services/CollisionService';
import { MovementService } from '../../domain/services/MovementService';
import { PortalTraversalService } from '../../domain/services/PortalTraversalService';

export interface TickResult {
  /** このフレームでポータルを通過したか */
  traversed: boolean;
}

/** 1フレーム分のゲーム状態更新(移動+衝突解決+ポータル通過判定)を行うユースケース */
export class TickUseCase {
  constructor(
    private readonly session: GameSession,
    private readonly movement: MovementService,
    private readonly traversal: PortalTraversalService,
    private readonly collision: CollisionService = new CollisionService(),
  ) {}

  execute(dt: number): TickResult {
    const player = this.session.player;
    const before = player.position;

    this.movement.tick(player, dt);
    // 押し出し後の位置でポータル判定する(押し戻されたフレームの誤通過を防ぐ)
    this.collision.resolve(player, this.session.currentWorld.colliders);

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
