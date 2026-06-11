import { describe, expect, it } from 'vitest';
import { GameSession } from '../../domain/entities/GameSession';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';
import { World } from '../../domain/entities/World';
import { Vec3 } from '../../domain/values/Vec3';
import { ApplyStickUseCase } from './ApplyStickUseCase';

const buildSession = (yaw = 0): GameSession => {
  const a = new World('day', '昼', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'night'));
  const b = new World('night', '夜', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'day'));
  return new GameSession([a, b], 'day', new Player(Vec3.ZERO, Vec3.ZERO, yaw, 0));
};

describe('ApplyStickUseCase', () => {
  it('上に倒すと前方(-Z)への目標速度になる(倒し切り=最大歩行速度)', () => {
    const session = buildSession();
    new ApplyStickUseCase(session, 6).execute({ x: 0, y: -1 }, 0.016);
    expect(session.player.desiredVelocity).not.toBeNull();
    expect(session.player.desiredVelocity!.z).toBeCloseTo(-6);
    expect(session.player.desiredVelocity!.x).toBeCloseTo(0);
  });

  it('倒し量が半分なら速度も半分になる', () => {
    const session = buildSession();
    new ApplyStickUseCase(session, 6).execute({ x: 0, y: -0.5 }, 0.016);
    expect(session.player.desiredVelocity!.length()).toBeCloseTo(3);
  });

  it('デッドゾーン内では目標速度が解除される', () => {
    const session = buildSession();
    session.player.desiredVelocity = new Vec3(1, 0, 0);
    new ApplyStickUseCase(session, 6).execute({ x: 0.05, y: 0.05 }, 0.016);
    expect(session.player.desiredVelocity).toBeNull();
  });

  it('スティックが null(指を離した)なら目標速度が解除される', () => {
    const session = buildSession();
    session.player.desiredVelocity = new Vec3(1, 0, 0);
    new ApplyStickUseCase(session, 6).execute(null, 0.016);
    expect(session.player.desiredVelocity).toBeNull();
  });

  it('右に倒すと進行方向(右=−π/2相対)へヨーが指数追従で旋回する', () => {
    const session = buildSession(0);
    const usecase = new ApplyStickUseCase(session, 6, 4.5);
    usecase.execute({ x: 1, y: 0 }, 0.1);
    // 1ステップで Δ = −π/2 × (1 − e^(−4.5×0.1))
    expect(session.player.yaw).toBeCloseTo((-Math.PI / 2) * (1 - Math.exp(-0.45)));
  });

  it('右に倒し続けるとカーブ移動になる(ヨーが減少し続ける)', () => {
    const session = buildSession(0);
    const usecase = new ApplyStickUseCase(session, 6, 4.5);
    let prev = session.player.yaw;
    for (let i = 0; i < 10; i++) {
      usecase.execute({ x: 1, y: 0 }, 0.1);
      expect(session.player.yaw).toBeLessThan(prev);
      prev = session.player.yaw;
    }
    // 目標速度は「その時点の視点」の右方向を向く(right(yaw) = (cos yaw, 0, −sin yaw))
    const yawBefore = session.player.yaw;
    usecase.execute({ x: 1, y: 0 }, 0.1);
    const d = session.player.desiredVelocity!;
    expect(d.x / 6).toBeCloseTo(Math.cos(yawBefore));
    expect(d.z / 6).toBeCloseTo(-Math.sin(yawBefore));
  });

  it('真上に倒している間はヨーが変化しない', () => {
    const session = buildSession(0.3);
    new ApplyStickUseCase(session, 6).execute({ x: 0, y: -1 }, 0.1);
    expect(session.player.yaw).toBeCloseTo(0.3);
  });

  it('下に引くと旋回せずに後進する(見回しは発火しない)', () => {
    const session = buildSession(0.3);
    new ApplyStickUseCase(session, 6).execute({ x: 0, y: 1 }, 0.1);
    // ヨーは維持され、目標速度は後方(+forwardの逆)を向く
    expect(session.player.yaw).toBeCloseTo(0.3);
    const d = session.player.desiredVelocity!;
    const f = session.player.forward;
    expect(d.x / 6).toBeCloseTo(-f.x);
    expect(d.z / 6).toBeCloseTo(-f.z);
  });

  it('後方斜め(下右)でも旋回しない', () => {
    const session = buildSession(0);
    new ApplyStickUseCase(session, 6).execute({ x: 0.5, y: 0.866 }, 0.1);
    expect(session.player.yaw).toBeCloseTo(0);
    expect(session.player.desiredVelocity).not.toBeNull();
  });

  it('真横(右)は従来どおり旋回する(境界は旋回に含む)', () => {
    const session = buildSession(0);
    new ApplyStickUseCase(session, 6, 4.5).execute({ x: 1, y: 0 }, 0.1);
    expect(session.player.yaw).toBeLessThan(0);
  });
});
