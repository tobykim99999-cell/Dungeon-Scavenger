import { describe, expect, it, vi } from 'vitest';
import { GameScene } from '../src/game/GameScene';
import { MAP_HEIGHT, MAP_WIDTH, type Dungeon, type Point } from '../src/game/dungeon';
import { createTrialSnapshot, createTrialWarden, generateTrialArena } from '../src/game/trial';
import type { AdventureMode, Enemy, GameCommand } from '../src/game/types';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

type SceneHarness = {
  status: string;
  adventureMode: AdventureMode;
  floor: number;
  bossStage: boolean;
  bossDefeated: boolean;
  bossExitChoice: boolean;
  dungeon: Dungeon;
  player: Point & { hp: number };
  enemies: Enemy[];
  visible: Set<string>;
  handleCommand(command: GameCommand): void;
  buildLevel(): void;
  finishTurn(): void;
  updateVision(): void;
};

function createScene() {
  const scene = new GameScene() as unknown as SceneHarness;
  const snapshot = createTrialSnapshot({ attack: 4, defense: 1, maxHp: 24, crit: 0, bleed: 0 });
  const boss: Enemy = {
    ...snapshot.boss, id: 'trial-warden', name: 'Test Warden', x: 11, y: 11,
    maxHp: snapshot.boss.hp, hp: 40, isBoss: true, alerted: true,
    frame: 98, tint: 0xc4dce1, scale: 2.8, trialWarden: createTrialWarden(),
  };
  Object.assign(scene, {
    status: 'active', adventureMode: 'trial', floor: 1, bossStage: true, bossDefeated: false,
    dungeon: generateTrialArena(1), enemies: [boss], trialSnapshot: snapshot,
    tweenToGrid: vi.fn(), playSound: vi.fn(), emitUiState: vi.fn(),
    cancelAutoMove: vi.fn(), stopHeldMovement: vi.fn(),
  });
  Object.assign(scene.player, { x: 14, y: 10, hp: 12 });
  const build = vi.spyOn(scene, 'buildLevel').mockImplementation(() => {});
  const finish = vi.spyOn(scene, 'finishTurn').mockImplementation(() => {});
  return { scene, boss, build, finish };
}

describe('trial scene exit transitions', () => {
  it.each(['hunt', 'charge', 'echo', 'stagger', 'recovery'] as const)(
    'walking over the original boss tile during %s is only a normal action', (phase) => {
      const { scene, boss, build, finish } = createScene();
      boss.trialWarden!.phase = phase;
      scene.handleCommand({ action: 'move', direction: 'up' });
      expect(scene.player).toMatchObject({ x: 14, y: 9, hp: 12 });
      expect(scene.floor).toBe(1);
      expect(scene.bossStage).toBe(true);
      expect(scene.bossDefeated).toBe(false);
      expect(scene.bossExitChoice).toBe(false);
      expect(scene.enemies[0]).toBe(boss);
      expect(boss.hp).toBe(40);
      expect(build).not.toHaveBeenCalled();
      expect(finish).toHaveBeenCalledOnce();
    },
  );

  it('keeps the exit hidden and the entire trial visible after crossing the center repeatedly', () => {
    const { scene, build, finish } = createScene();
    const setVisible = vi.fn();
    const graphics = {
      clear: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis(),
    };
    Object.assign(scene, { fogGraphics: graphics, exitSprite: { setVisible } });
    for (const direction of ['up', 'down', 'up', 'right', 'left'] as const) {
      scene.handleCommand({ action: 'move', direction });
      scene.updateVision();
      expect(scene.visible.size).toBe(MAP_WIDTH * MAP_HEIGHT);
      expect(setVisible).toHaveBeenLastCalledWith(false);
    }
    expect(build).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledTimes(5);
  });

  it('only offers the exit choice on the actual boss defeat tile', () => {
    const { scene, build, finish } = createScene();
    scene.bossDefeated = true;
    scene.enemies = [];
    scene.dungeon.exit = { x: 11, y: 11 };
    scene.handleCommand({ action: 'move', direction: 'up' });
    expect(scene.bossExitChoice).toBe(false);
    expect(finish).toHaveBeenCalledOnce();
    Object.assign(scene.player, { x: 11, y: 12 });
    scene.handleCommand({ action: 'move', direction: 'up' });
    expect(scene.bossExitChoice).toBe(true);
    expect(build).not.toHaveBeenCalled();
    expect(scene.floor).toBe(1);
  });

  it.each(['normal', 'heroic'] as const)('still descends from ordinary %s floors', (mode) => {
    const { scene, build, finish } = createScene();
    scene.adventureMode = mode;
    scene.bossStage = false;
    scene.bossDefeated = true;
    scene.handleCommand({ action: 'move', direction: 'up' });
    expect(scene.floor).toBe(2);
    expect(build).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
  });

  it('still enters a normal boss stage after the tenth ordinary floor', () => {
    const { scene, build } = createScene();
    scene.adventureMode = 'normal';
    scene.floor = 10;
    scene.bossStage = false;
    scene.bossDefeated = true;
    scene.handleCommand({ action: 'move', direction: 'up' });
    expect(scene.floor).toBe(10);
    expect(scene.bossStage).toBe(true);
    expect(build).toHaveBeenCalledOnce();
  });
});
