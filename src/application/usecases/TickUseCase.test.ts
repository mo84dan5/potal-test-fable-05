import { describe, expect, it } from 'vitest';
import { GameSession } from '../../domain/entities/GameSession';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';
import { World } from '../../domain/entities/World';
import { Vec3 } from '../../domain/values/Vec3';
import { MovementService } from '../../domain/services/MovementService';
import { PortalTraversalService } from '../../domain/services/PortalTraversalService';
import { TickUseCase } from './TickUseCase';

const buildSession = (player: Player): GameSession => {
  const a = new World('day', '昼', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'night'));
  const b = new World('night', '夜', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'day'));
  return new GameSession([a, b], 'day', player);
};

const buildTick = (session: GameSession): TickUseCase =>
  new TickUseCase(session, new MovementService(), new PortalTraversalService());

describe('TickUseCase', () => {
  it('ポータルに向かって進むと通過しワールドが切り替わる', () => {
    const player = new Player(new Vec3(0, 0, -5.5), new Vec3(0, 0, -2), 0, 0);
    const session = buildSession(player);

    const result = buildTick(session).execute(0.5);

    expect(result.traversed).toBe(true);
    expect(session.currentWorldId).toBe('night');
    // (0,0,-6.5) が出口ポータル系へ写像され、出口の表側 z=-5.5 に出る
    expect(player.position.z).toBeCloseTo(-5.5);
    // 視点は反転し、出口ポータルから遠ざかる向きになる
    expect(player.forward.z).toBeCloseTo(1);
  });

  it('ポータルに届かなければ何も切り替わらない', () => {
    const player = new Player(new Vec3(0, 0, 4), new Vec3(0, 0, -1), 0, 0);
    const session = buildSession(player);

    const result = buildTick(session).execute(0.016);

    expect(result.traversed).toBe(false);
    expect(session.currentWorldId).toBe('day');
  });

  it('ポータル面の幅の外を通っても切り替わらない', () => {
    const player = new Player(new Vec3(8, 0, -5.5), new Vec3(0, 0, -4), 0, 0);
    const session = buildSession(player);

    const result = buildTick(session).execute(0.5);

    expect(result.traversed).toBe(false);
    expect(session.currentWorldId).toBe('day');
  });

  it('コライダーのあるオブジェクトはすり抜けられない(押し出し+壁ずり)', () => {
    const player = new Player(new Vec3(0, 0, 0), new Vec3(0, 0, -6), 0, 0);
    const rock = { position: new Vec3(0, 0, -2), radius: 0.5 };
    const a = new World(
      'day', '昼',
      new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'night'),
      [], [rock],
    );
    const b = new World('night', '夜', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'day'));
    const session = new GameSession([a, b], 'day', player);

    const result = buildTick(session).execute(0.3); // 衝突なしなら z=-1.8(石の内側)まで進む

    expect(result.traversed).toBe(false);
    // 石の表面(z = -2 + 0.85)で止まる
    expect(player.position.z).toBeCloseTo(-1.15);
    // 石へ向かう速度成分は打ち消されている
    expect(player.velocity.z).toBeCloseTo(0);
  });
});
