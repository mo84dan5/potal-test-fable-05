import { describe, expect, it } from 'vitest';
import { GameSession } from '../../domain/entities/GameSession';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';
import { World } from '../../domain/entities/World';
import { Vec3 } from '../../domain/values/Vec3';
import { MovementService } from '../../domain/services/MovementService';
import { ApplyFlickUseCase } from './ApplyFlickUseCase';

const buildSession = (yaw = 0): GameSession => {
  const a = new World('day', '昼', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'night'));
  const b = new World('night', '夜', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'day'));
  return new GameSession([a, b], 'day', new Player(Vec3.ZERO, Vec3.ZERO, yaw, 0));
};

describe('ApplyFlickUseCase', () => {
  it('上フリック(dy<0)で前方(-Z)へ進む', () => {
    const session = buildSession();
    new ApplyFlickUseCase(session, new MovementService()).execute({ dx: 0, dy: -100 });
    expect(session.player.velocity.z).toBeCloseTo(-3.5); // 100px × gain 0.035
    expect(session.player.velocity.x).toBeCloseTo(0);
  });

  it('右フリック(dx>0)で右(+X)へ進む', () => {
    const session = buildSession();
    new ApplyFlickUseCase(session, new MovementService()).execute({ dx: 100, dy: 0 });
    expect(session.player.velocity.x).toBeCloseTo(3.5);
    expect(session.player.velocity.z).toBeCloseTo(0);
  });

  it('視点が90°左(yaw=π/2)を向いていれば上フリックは -X へ進む', () => {
    const session = buildSession(Math.PI / 2);
    new ApplyFlickUseCase(session, new MovementService()).execute({ dx: 0, dy: -100 });
    expect(session.player.velocity.x).toBeCloseTo(-3.5);
    expect(session.player.velocity.z).toBeCloseTo(0);
  });

  it('移動量ゼロでは何も起きない', () => {
    const session = buildSession();
    new ApplyFlickUseCase(session, new MovementService()).execute({ dx: 0, dy: 0 });
    expect(session.player.velocity.length()).toBe(0);
  });
});
