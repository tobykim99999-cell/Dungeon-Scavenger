import { describe, expect, it } from 'vitest';
import {
  SECOND_BOSS_TRIAL_TURNS, advanceSecondBossTrial, getSecondBossTrialCorners,
  getSecondBossGuardianStats, getSecondBossStormSpawns, getStormStep,
  shouldStartSecondBossTrial, type SecondBossTrial,
} from '../src/game/secondBossTrial';
import { generateBossArena, findPath, type Point } from '../src/game/dungeon';
import { getBossStats } from '../src/game/progression';
import { getAdventureDifficultyFloor } from '../src/game/heroic';

describe('second boss last stand', () => {
  it('only triggers on lethal damage to the second region boss', () => {
    expect(shouldStartSecondBossTrial(20, true, 30, 29)).toBe(false);
    expect(shouldStartSecondBossTrial(20, true, 30, 30)).toBe(true);
    expect(shouldStartSecondBossTrial(20, true, 30, 1000)).toBe(true);
    expect(shouldStartSecondBossTrial(20, false, 30, 1000)).toBe(false);
    expect(shouldStartSecondBossTrial(40, true, 30, 1000)).toBe(false);
    expect(shouldStartSecondBossTrial(20, true, 0, 1000)).toBe(false);
  });

  it('excludes the triggering action and gives 45 complete turns to kill guardians', () => {
    const state: SecondBossTrial = { phase: 'trial', turns: 0, justTriggered: true };
    expect(advanceSecondBossTrial(state, 4)).toBe('waiting');
    expect(state.turns).toBe(0);
    for (let turn = 1; turn < SECOND_BOSS_TRIAL_TURNS; turn += 1) {
      expect(advanceSecondBossTrial(state, 1)).toBe('waiting');
      expect(state.turns).toBe(turn);
    }
    expect(advanceSecondBossTrial(state, 0)).toBe('success');
    expect(state.turns).toBe(45);
  });

  it('fails exactly at turn 45 and never wins from clearing monsters on timeout', () => {
    const state: SecondBossTrial = { phase: 'trial', turns: 44, justTriggered: false };
    expect(advanceSecondBossTrial(state, 1)).toBe('failed');
    expect(state.phase).toBe('storm');
    expect(advanceSecondBossTrial(state, 0)).toBe('storm');
    expect(state.turns).toBe(46);
  });

  it('places guardians at the exact corners of a centered 11 by 11 square', () => {
    const boss = { x: 14, y: 10 };
    expect(getSecondBossTrialCorners(boss, generateBossArena(1).tiles, new Set(['14,10', '14,11'])))
      .toEqual([{ x: 9, y: 5 }, { x: 19, y: 5 }, { x: 19, y: 15 }, { x: 9, y: 15 }]);
  });

  it('keeps an intact square inside the arena at walls and avoids occupied corners', () => {
    const map = generateBossArena(1);
    for (const boss of [{ x: 2, y: 2 }, { x: 25, y: 17 }, { x: 14, y: 6 }, { x: 3, y: 16 }]) {
      const player = { x: boss.x === 25 ? boss.x - 1 : boss.x + 1, y: boss.y };
      const blocked = new Set([`${boss.x},${boss.y}`, `${player.x},${player.y}`]);
      const corners = getSecondBossTrialCorners(boss, map.tiles, blocked);
      expect(corners).toHaveLength(4);
      expect(corners[1].x - corners[0].x).toBe(10);
      expect(corners[2].y - corners[1].y).toBe(10);
      expect(corners.every((point) => map.tiles[point.y]?.[point.x] === 1 && !blocked.has(`${point.x},${point.y}`))).toBe(true);
    }
  });

  it('scales guardian attributes for normal and heroic second-region encounters', () => {
    const normal = getBossStats(20, 20);
    const heroic = getBossStats(getAdventureDifficultyFloor('heroic', 20), 20);
    expect(getSecondBossGuardianStats(normal.hp, normal.attack, normal.defense)).toEqual({ hp: 20, attack: 9, defense: 4 });
    expect(getSecondBossGuardianStats(heroic.hp, heroic.attack, heroic.defense)).toEqual({ hp: 56, attack: 27, defense: 12 });
  });

  it('creates twelve distinct storms and moves them toward the player by two walkable steps', () => {
    const { tiles } = generateBossArena(1);
    const spawns = getSecondBossStormSpawns(tiles);
    const player = { x: 14, y: 10 };
    expect(spawns).toHaveLength(12);
    expect(new Set(spawns.map((point) => `${point.x},${point.y}`)).size).toBe(12);
    for (const from of spawns) {
      const next = getStormStep(tiles, from, player);
      expect(findPath(tiles, next, player).length).toBe(findPath(tiles, from, player).length - 2);
    }
    expect(getStormStep(tiles, player, player)).toEqual(player);
  });

  it('can catch a player who keeps moving one tile each turn', () => {
    const { tiles } = generateBossArena(1);
    const winds = getSecondBossStormSpawns(tiles);
    let player: Point = { x: 14, y: 10 };
    let caught = false;
    for (let turn = 0; turn < 30 && !caught; turn += 1) {
      player = { x: player.x === 20 ? 19 : player.x + 1, y: 10 };
      for (let i = 0; i < winds.length; i += 1) winds[i] = getStormStep(tiles, winds[i], player);
      caught = winds.some((wind) => Math.abs(wind.x - player.x) + Math.abs(wind.y - player.y) <= 1);
    }
    expect(caught).toBe(true);
  });
});
