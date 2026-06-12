import { Collider } from '../values/Collider';
import { Interactable } from './Interactable';
import { Npc } from './Npc';
import { Portal } from './Portal';

/** ワールド。複数のポータルと、インタラクト対象オブジェクト・衝突体・NPCを持つ */
export class World {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly portals: readonly Portal[],
    public readonly interactables: readonly Interactable[] = [],
    public readonly colliders: readonly Collider[] = [],
    public readonly npcs: readonly Npc[] = [],
  ) {}

  getPortal(portalId: string): Portal {
    const portal = this.portals.find((p) => p.id === portalId);
    if (!portal) throw new Error(`unknown portal: ${portalId} in world ${this.id}`);
    return portal;
  }
}
