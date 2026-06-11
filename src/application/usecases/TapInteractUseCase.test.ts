import { describe, expect, it } from 'vitest';
import { GameSession } from '../../domain/entities/GameSession';
import { Interactable } from '../../domain/entities/Interactable';
import { Player } from '../../domain/entities/Player';
import { Portal } from '../../domain/entities/Portal';
import { World } from '../../domain/entities/World';
import { Vec3 } from '../../domain/values/Vec3';
import { InteractionService } from '../../domain/services/InteractionService';
import { TapInteractUseCase } from './TapInteractUseCase';

const ROCK_LINES = ['これは石だ。', 'ごつごつしている。', '何も起こらない。'];

const buildSession = (interactables: Interactable[]): GameSession => {
  const a = new World(
    'day', '昼',
    new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'night'),
    interactables,
  );
  const b = new World('night', '夜', new Portal(new Vec3(0, 0, -6), 0, 1.4, 3, 'day'));
  return new GameSession([a, b], 'day', new Player(Vec3.ZERO, Vec3.ZERO, 0, 0));
};

const buildUseCase = (session: GameSession): TapInteractUseCase =>
  new TapInteractUseCase(session, new InteractionService(), 3.5);

describe('TapInteractUseCase', () => {
  it('近くのオブジェクトをタップするとメッセージウィンドウが開く', () => {
    const rock = new Interactable('r', '石', new Vec3(2, 1, 0), null, ROCK_LINES);
    const session = buildSession([rock]);
    buildUseCase(session).execute();
    expect(session.dialogue).not.toBeNull();
    expect(session.dialogue!.currentLine).toBe('これは石だ。');
  });

  it('遠いオブジェクトはタップしても開かない', () => {
    const rock = new Interactable('r', '石', new Vec3(10, 1, 0), null, ROCK_LINES);
    const session = buildSession([rock]);
    buildUseCase(session).execute();
    expect(session.dialogue).toBeNull();
  });

  it('コメントのないオブジェクト(吹き出しのみ)は開かない', () => {
    const tree = new Interactable('t', '木', new Vec3(2, 4, 0), 'これは木です', []);
    const session = buildSession([tree]);
    buildUseCase(session).execute();
    expect(session.dialogue).toBeNull();
  });

  it('表示中にタップするとコメントが進み、最後のタップで閉じる', () => {
    const rock = new Interactable('r', '石', new Vec3(2, 1, 0), null, ROCK_LINES);
    const session = buildSession([rock]);
    const usecase = buildUseCase(session);

    usecase.execute(); // 開く: 1行目
    usecase.execute(); // 2行目
    expect(session.dialogue!.currentLine).toBe('ごつごつしている。');
    usecase.execute(); // 3行目
    expect(session.dialogue!.currentLine).toBe('何も起こらない。');
    usecase.execute(); // 閉じる
    expect(session.dialogue).toBeNull();
  });
});
