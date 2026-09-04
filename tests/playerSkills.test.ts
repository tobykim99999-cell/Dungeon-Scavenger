import { describe, expect, it } from 'vitest';
import {
  createPlayerSkillCooldowns,
  getChargedStrikeDamage,
  getGuardedDamage,
  getShockwaveDamage,
  tickPlayerSkillCooldowns,
} from '../src/game/playerSkills';

describe('player active skills', () => {
  it('ticks cooldowns without immediately reducing the skill just used', () => {
    const cooldowns = { ...createPlayerSkillCooldowns(), guard: 4, shockwave: 3 };
    expect(tickPlayerSkillCooldowns(cooldowns, 'guard')).toMatchObject({
      guard: 4,
      shockwave: 2,
    });
  });

  it('makes charged strike ignore defense and scale the resulting hit', () => {
    expect(getChargedStrikeDamage(30, 10, 0, false)).toBe(41);
    expect(getChargedStrikeDamage(30, 10, 0, true)).toBe(83);
  });

  it('keeps shockwave weaker than a focused attack while damaging adjacent targets', () => {
    expect(getShockwaveDamage(30, 5)).toBe(18);
    expect(getShockwaveDamage(1, 99)).toBe(1);
  });

  it('halves direct damage but always keeps a meaningful minimum hit', () => {
    expect(getGuardedDamage(31)).toBe(16);
    expect(getGuardedDamage(1)).toBe(1);
  });
});
