import { describe, expect, it } from 'vitest';
import { advanceStage, getBossStats, getChestCount, getEnemyCount, getEnemyStats, hasBossAfterFloor } from '../src/game/progression';
import { INVENTORY_CAPACITY } from '../src/game/types';

describe('boss floor progression', () => {
  it('places a boss checkpoint after every ten normal floors', () => {
    expect([10, 20, 30, 100].every(hasBossAfterFloor)).toBe(true);
    expect([0, 1, 9, 11, 19, 21].some(hasBossAfterFloor)).toBe(false);
  });

  it('inserts a boss stage between floor ten and floor eleven', () => {
    expect(advanceStage(9, false)).toEqual({ floor: 10, bossStage: false });
    expect(advanceStage(10, false)).toEqual({ floor: 10, bossStage: true });
    expect(advanceStage(10, true)).toEqual({ floor: 11, bossStage: false });
  });

  it('gives the first boss its designed combat values', () => {
    expect(getBossStats(10)).toEqual({
      hp: 135,
      attack: 12,
      defense: 5,
      reward: 100,
    });
  });

  it('keeps increasing boss strength and rewards', () => {
    const floorTen = getBossStats(10);
    const floorTwenty = getBossStats(20);

    expect(floorTwenty.hp).toBeGreaterThan(floorTen.hp);
    expect(floorTwenty.attack).toBeGreaterThan(floorTen.attack);
    expect(floorTwenty.defense).toBeGreaterThan(floorTen.defense);
    expect(floorTwenty.reward).toBeGreaterThan(floorTen.reward);
  });
});

describe('normal enemy stat scaling', () => {
  it('includes real defense growth in normal monster stats', () => {
    const base = { hp: 11, attack: 5, defense: 1, reward: 8 };
    expect(getEnemyStats(base, 1)).toEqual({ hp: 11, attack: 5, defense: 1, reward: 9 });
    expect(getEnemyStats(base, 10)).toEqual({ hp: 29, attack: 13, defense: 3, reward: 18 });
    expect(getEnemyStats(base, 20).defense).toBe(6);
  });
});

describe('normal enemy counts', () => {
  it('keeps the first region lighter', () => {
    expect(getEnemyCount(1)).toBe(4);
    expect(getEnemyCount(5)).toBe(7);
    expect(getEnemyCount(10)).toBe(10);
  });

  it('returns to the existing cap after the first region', () => {
    expect(getEnemyCount(11)).toBe(18);
    expect(getEnemyCount(30)).toBe(18);
  });
});

describe('inventory capacity', () => {
  it('provides eighteen dungeon inventory slots', () => {
    expect(INVENTORY_CAPACITY).toBe(18);
  });
});

describe('normal chest counts', () => {
  it('uses two chests early and three chests late in every region', () => {
    expect(getChestCount(1)).toBe(2);
    expect(getChestCount(5)).toBe(2);
    expect(getChestCount(6)).toBe(3);
    expect(getChestCount(10)).toBe(3);
    expect(getChestCount(11)).toBe(2);
    expect(getChestCount(16)).toBe(3);
  });
});
