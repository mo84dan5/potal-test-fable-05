import { Collider } from '../values/Collider';
import { Interactable } from './Interactable';
import { Portal } from './Portal';

/** ワールド。ポータルを1つと、インタラクト対象オブジェクト・衝突体を持つ */
export class World {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly portal: Portal,
    public readonly interactables: readonly Interactable[] = [],
    public readonly colliders: readonly Collider[] = [],
  ) {}
}
