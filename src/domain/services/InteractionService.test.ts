import { describe, expect, it } from 'vitest';
import { Interactable } from '../entities/Interactable';
import { Vec3 } from '../values/Vec3';
import { InteractionService } from './InteractionService';

const rock = new Interactable('r1', '石', new Vec3(3, 1, 0), null, ['これは石だ。']);
const tree = new Interactable('t1', '木', new Vec3(0, 4, 8), 'これは木です', []);
const service = new InteractionService();

describe('InteractionService.nearestWithin', () => {
  it('範囲内で最も近い対象を返す', () => {
    const near = new Interactable('r2', '石', new Vec3(1, 1, 0), null, ['…']);
    const found = service.nearestWithin(Vec3.ZERO, [rock, near, tree], 5);
    expect(found?.id).toBe('r2');
  });

  it('範囲外の対象は返さない', () => {
    expect(service.nearestWithin(Vec3.ZERO, [tree], 5)).toBeNull();
    expect(service.nearestWithin(Vec3.ZERO, [rock], 2.9)).toBeNull();
  });

  it('距離判定は水平距離で行う(高さは無視)', () => {
    const tall = new Interactable('t2', '木', new Vec3(0, 100, 2), 'これは木です', []);
    expect(service.nearestWithin(Vec3.ZERO, [tall], 3)?.id).toBe('t2');
  });

  it('対象が空なら null', () => {
    expect(service.nearestWithin(Vec3.ZERO, [], 10)).toBeNull();
  });
});
