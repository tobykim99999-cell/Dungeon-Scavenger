import { describe, expect, it } from 'vitest';
import {
  getAdventureDifficultyFloor,
  getHeroicDifficultyFloor,
  HEROIC_FIRST_DIFFICULTY_FLOOR,
  HEROIC_REGION_DIFFICULTY_GAP,
  parseHeroicUnlock,
  shouldUnlockHeroic,
} from '../src/game/heroic';

describe('heroic expedition progression', () => {
  it('starts above the fifth normal region and spaces regions farther apart', () => {
    expect(HEROIC_FIRST_DIFFICULTY_FLOOR).toBeGreaterThan(50);
    expect(HEROIC_REGION_DIFFICULTY_GAP).toBeGreaterThan(10);
    expect([0, 1, 2, 3, 4].map((index) => getHeroicDifficultyFloor(index, 1)))
      .toEqual([56, 71, 86, 101, 116]);
  });

  it('keeps displayed floors while mapping combat to heroic difficulty', () => {
    expect(getAdventureDifficultyFloor('normal', 10)).toBe(10);
    expect(getAdventureDifficultyFloor('heroic', 1)).toBe(56);
    expect(getAdventureDifficultyFloor('heroic', 10)).toBe(65);
    expect(getAdventureDifficultyFloor('heroic', 11)).toBe(71);
    expect(getAdventureDifficultyFloor('heroic', 50)).toBe(125);
  });

  it('unlocks only after defeating the fifth normal boss', () => {
    expect(shouldUnlockHeroic('normal', 40)).toBe(false);
    expect(shouldUnlockHeroic('normal', 50)).toBe(true);
    expect(shouldUnlockHeroic('heroic', 50)).toBe(false);
    expect(parseHeroicUnlock('1')).toBe(true);
    expect(parseHeroicUnlock(null)).toBe(false);
  });
});
