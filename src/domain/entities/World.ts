import { Portal } from './Portal';

/** ワールド。ポータルを1つ持つ(拡張時は複数化する) */
export class World {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly portal: Portal,
  ) {}
}
