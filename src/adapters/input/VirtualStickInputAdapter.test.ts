import { describe, expect, it } from 'vitest';
import { zoneForTouch } from './VirtualStickInputAdapter';

describe('zoneForTouch', () => {
  it('上半分から開始したタッチは見回しになる', () => {
    expect(zoneForTouch(0, 800)).toBe('look');
    expect(zoneForTouch(399, 800)).toBe('look');
  });

  it('下半分から開始したタッチは移動になる', () => {
    expect(zoneForTouch(401, 800)).toBe('stick');
    expect(zoneForTouch(800, 800)).toBe('stick');
  });

  it('中央線ちょうどは移動(下半分)に含める', () => {
    expect(zoneForTouch(400, 800)).toBe('stick');
  });
});
