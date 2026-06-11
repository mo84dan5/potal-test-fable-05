import { Interactable } from './Interactable';
import { Portal } from './Portal';

/** ワールド。ポータルを1つと、インタラクト対象オブジェクトを持つ */
export class World {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly portal: Portal,
    public readonly interactables: readonly Interactable[] = [],
  ) {}
}
