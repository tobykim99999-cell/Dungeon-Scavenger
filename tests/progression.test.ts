import { describe, expect, it } from 'vitest';
import { advanceStage, getBossStats, hasBossAfterFloor } from '../src/game/progression';

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
      hp: 75,
      attack: 12,
      defense: 3,
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
