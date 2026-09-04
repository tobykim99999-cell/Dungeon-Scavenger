import { describe, expect, it } from 'vitest';
import {
  getEliteBulwarkShield,
  getEliteFrenzyAttack,
  getEliteLifeSteal,
  getEliteStats,
  rollEliteAffix,
  shouldSpawnHeroicElite,
} from '../src/game/elite';

describe('heroic elite enemies', () => {
  it('adds one elite rhythm point on the fifth and tenth normal floors of every heroic region', () => {
    expect([5, 10, 15, 20, 45, 50].every((floor) => shouldSpawnHeroicElite('heroic', floor))).toBe(true);
    expect([1, 4, 6, 9, 11, 49].some((floor) => shouldSpawnHeroicElite('heroic', floor))).toBe(false);
    expect(shouldSpawnHeroicElite('normal', 5)).toBe(false);
  });

  it('raises elite combat stats without changing the base input', () => {
    const base = { hp: 100, attack: 30, defense: 8, reward: 20 };
    expect(getEliteStats(base)).toEqual({ hp: 180, attack: 39, defense: 11, reward: 50 });
    expect(base).toEqual({ hp: 100, attack: 30, defense: 8, reward: 20 });
  });

  it('selects one of three evenly divided affixes', () => {
    expect(rollEliteAffix(0).id).toBe('bulwark');
    expect(rollEliteAffix(0.34).id).toBe('frenzy');
    expect(rollEliteAffix(0.99).id).toBe('vampiric');
  });

  it('calculates each elite affix effect from scaled combat values', () => {
    expect(getEliteBulwarkShield(180)).toBe(54);
    expect(getEliteFrenzyAttack(39)).toBe(49);
    expect(getEliteLifeSteal(21)).toBe(9);
  });
});
