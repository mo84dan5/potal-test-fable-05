import { Interactable } from '../entities/Interactable';
import { Vec3 } from '../values/Vec3';

/** インタラクト対象の近接判定を行うドメインサービス */
export class InteractionService {
  /** 水平距離が range 以内で最も近い対象を返す(なければ null) */
  nearestWithin(
    from: Vec3,
    interactables: readonly Interactable[],
    range: number,
  ): Interactable | null {
    let nearest: Interactable | null = null;
    let nearestDist = range;
    for (const it of interactables) {
      const d = it.horizontalDistanceFrom(from);
      if (d <= nearestDist) {
        nearest = it;
        nearestDist = d;
      }
    }
    return nearest;
  }
}
