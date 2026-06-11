import { describe, expect, it } from 'vitest';
import { Player } from '../entities/Player';
import { Vec3 } from '../values/Vec3';
import { MovementService } from './MovementService';

const newPlayer = (): Player => new Player(Vec3.ZERO, Vec3.ZERO, 0, 0);

describe('MovementService', () => {
  it('applyImpulse は方向を正規化して速度を加える', () => {
    const service = new MovementService();
    const player = newPlayer();
    service.applyImpulse(player, new Vec3(0, 0, -10), 3);
    expect(player.velocity.z).toBeCloseTo(-3);
    expect(player.velocity.length()).toBeCloseTo(3);
  });

  it('applyImpulse は最大速度でクランプされる', () => {
    const service = new MovementService({ damping: 2, maxSpeed: 5, boundsRadius: 30 });
    const player = newPlayer();
    service.applyImpulse(player, new Vec3(1, 0, 0), 100);
    expect(player.velocity.length()).toBeCloseTo(5);
  });

  it('tick は位置を積分し速度を指数減衰させる', () => {
    const service = new MovementService({ damping: 1, maxSpeed: 10, boundsRadius: 30 });
    const player = newPlayer();
    player.velocity = new Vec3(2, 0, 0);
    service.tick(player, 0.5);
    expect(player.position.x).toBeCloseTo(1);
    expect(player.velocity.x).toBeCloseTo(2 * Math.exp(-0.5));
  });

  it('tick は移動範囲の円内に位置をクランプする', () => {
    const service = new MovementService({ damping: 1, maxSpeed: 10, boundsRadius: 28 });
    const player = newPlayer();
    player.position = new Vec3(100, 0, 0);
    service.tick(player, 0.016);
    expect(Math.hypot(player.position.x, player.position.z)).toBeLessThanOrEqual(28.0001);
  });

  it('高さは常に y=0 に保たれる', () => {
    const service = new MovementService();
    const player = newPlayer();
    player.velocity = new Vec3(0, 5, 1);
    service.tick(player, 1);
    expect(player.position.y).toBe(0);
  });
});
