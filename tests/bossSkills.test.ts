import { describe, expect, it } from 'vitest';
import { getBossSkill, getBossSkillDamage, getBossSkillTiles } from '../src/game/bossSkills';

const arena = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 1 as const));

describe('regional boss skills', () => {
  it('assigns a distinct skill to the first five regions', () => {
    const skills = [10, 20, 30, 40, 50].map((floor) => getBossSkill(floor));
    expect(new Set(skills.map((skill) => skill.id)).size).toBe(5);
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

  it('keeps skill damage meaningful while respecting part of player defense', () => {
    const skill = getBossSkill(20);
    expect(getBossSkillDamage(skill, 18, 0)).toBeGreaterThan(getBossSkillDamage(skill, 18, 12));
    expect(getBossSkillDamage(skill, 18, 999)).toBe(2);
  });
});
