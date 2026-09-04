import { describe, expect, it } from 'vitest';
import {
  FOURTH_BOSS_BURN_TURNS,
  FOURTH_BOSS_CONTROL_TURNS,
  FOURTH_BOSS_HEAL_TURNS,
  getFourthBossBurnDamage,
  getFourthBossHealingAmount,
  getBossChargeReinforcement,
  getBossSkill,
  getBossSkillDamage,
  getBossSkillForPhase,
  getBossSkillTiles,
  getThirdBossReleaseSummonCount,
  resolveShieldDamage,
  shouldEnterBossSecondPhase,
  shouldStartFourthBossHealing,
} from '../src/game/bossSkills';

const arena = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 1 as const));

describe('regional boss skills', () => {
  it('assigns a distinct skill to the first five regions', () => {
    const skills = [10, 20, 30, 40, 50].map((floor) => getBossSkill(floor));
    expect(new Set(skills.map((skill) => skill.id)).size).toBe(5);
    expect(getBossSkill(60).id).toBe('void-rift');
  });

  it('creates telegraphed danger patterns that leave an adjacent escape', () => {
    const target = { x: 4, y: 4 };
    for (const floor of [10, 20, 30, 40, 50]) {
      const danger = getBossSkillTiles(getBossSkill(floor), target, arena);
      const adjacent = [
        { x: 3, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 5 },
      ];
      expect(adjacent.some((point) => !danger.some((tile) => tile.x === point.x && tile.y === point.y))).toBe(true);
    }
  });

  it('creates dense irregular meteor clusters while preserving an adjacent escape', () => {
    let rollIndex = 0;
    const rolls = [0.08, 0.32, 0.58, 0.84, 0.15, 0.72, 0.41, 0.93, 0.27, 0.66];
    const target = { x: 4, y: 4 };
    const danger = getBossSkillTiles(
      getBossSkill(40),
      target,
      arena,
      () => rolls[rollIndex++ % rolls.length],
    );
    const adjacent = [
      { x: 3, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 5 },
    ];
    expect(danger.length).toBeGreaterThanOrEqual(20);
    expect(adjacent.some((point) => !danger.some((tile) => tile.x === point.x && tile.y === point.y))).toBe(true);
  });

  it('keeps skill damage meaningful while respecting part of player defense', () => {
    const skill = getBossSkill(20);
    expect(getBossSkillDamage(skill, 18, 0)).toBeGreaterThan(getBossSkillDamage(skill, 18, 12));
    expect(getBossSkillDamage(skill, 18, 999)).toBe(2);
  });

  it('adds capped summons and a proportional shield only to the fifth boss', () => {
    expect(getBossChargeReinforcement(40, 315, 0)).toEqual({ shield: 0, summonCount: 0 });
    expect(getBossChargeReinforcement(50, 375, 0)).toEqual({ shield: 57, summonCount: 2 });
    expect(getBossChargeReinforcement(50, 375, 3)).toEqual({ shield: 57, summonCount: 1 });
    expect(getBossChargeReinforcement(50, 375, 4)).toEqual({ shield: 57, summonCount: 0 });
  });

  it('summons up to two minions on each third boss cast with a total cap of five', () => {
    expect(getThirdBossReleaseSummonCount(20, 0)).toBe(0);
    expect(getThirdBossReleaseSummonCount(30, 0)).toBe(2);
    expect(getThirdBossReleaseSummonCount(30, 3)).toBe(2);
    expect(getThirdBossReleaseSummonCount(30, 4)).toBe(1);
    expect(getThirdBossReleaseSummonCount(30, 5)).toBe(0);
  });

  it('starts two invulnerable healing phases at the fourth boss health thirds', () => {
    expect(shouldStartFourthBossHealing(40, 211, 315, 0)).toBe(false);
    expect(shouldStartFourthBossHealing(40, 210, 315, 0)).toBe(true);
    expect(shouldStartFourthBossHealing(40, 106, 315, 1)).toBe(false);
    expect(shouldStartFourthBossHealing(40, 105, 315, 1)).toBe(true);
    expect(shouldStartFourthBossHealing(40, 50, 315, 2)).toBe(false);
    expect(shouldStartFourthBossHealing(30, 100, 255, 0)).toBe(false);
  });

  it('heals one fifth to one third of a lost health third per recovery turn', () => {
    expect(FOURTH_BOSS_HEAL_TURNS).toBe(3);
    expect(getFourthBossHealingAmount(315, 0)).toBe(21);
    expect(getFourthBossHealingAmount(315, 0.999)).toBe(35);
    expect(FOURTH_BOSS_CONTROL_TURNS).toBe(2);
    expect(FOURTH_BOSS_BURN_TURNS).toBe(3);
    expect(getFourthBossBurnDamage(100)).toBe(5);
    expect(getFourthBossBurnDamage(24)).toBe(3);
  });

  it('lets shields absorb damage before health', () => {
    expect(resolveShieldDamage(57, 20)).toEqual({ absorbed: 20, healthDamage: 0, remainingShield: 37 });
    expect(resolveShieldDamage(12, 20)).toEqual({ absorbed: 12, healthDamage: 8, remainingShield: 0 });
  });

  it('unlocks a random second skill after the fifth boss reaches half health', () => {
    expect(shouldEnterBossSecondPhase(50, 188, 375, false)).toBe(false);
    expect(shouldEnterBossSecondPhase(50, 187, 375, false)).toBe(true);
    expect(shouldEnterBossSecondPhase(50, 120, 375, true)).toBe(false);
    expect(shouldEnterBossSecondPhase(40, 120, 315, false)).toBe(false);

    expect(getBossSkillForPhase(50, false, 0.9).id).toBe('void-rift');
    expect(getBossSkillForPhase(50, true, 0.49).id).toBe('void-rift');
    expect(getBossSkillForPhase(50, true, 0.5)).toMatchObject({
      id: 'annihilation-cross',
      chargeTurns: 2,
    });
  });

  it('creates a cross-shaped danger area for the second phase skill', () => {
    const danger = getBossSkillTiles(getBossSkillForPhase(50, true, 0.8), { x: 4, y: 4 }, arena);
    expect(danger).toHaveLength(9);
    expect(danger).toContainEqual({ x: 2, y: 4 });
    expect(danger).toContainEqual({ x: 4, y: 6 });
    expect(danger).not.toContainEqual({ x: 3, y: 3 });
  });
});
