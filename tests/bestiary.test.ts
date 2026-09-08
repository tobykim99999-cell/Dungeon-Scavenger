import { describe, expect, it } from 'vitest';
import { createBestiaryRegions } from '../src/game/bestiary';
import { getBossStats, getEnemyStats } from '../src/game/progression';
import { getRegionTheme } from '../src/game/themes';

describe('unlocked monster bestiary', () => {
  it('includes the first boss control, pursuit, and permanent rage in its archive', () => {
    const description = createBestiaryRegions(0)[0].boss.skillDescription;
    expect(description).toContain('2/3、1/3');
    expect(description).toContain('禁锢玩家两回合');
    expect(description).toContain('攻击两次');
    expect(description).toContain('追近最多两格');
    expect(description).toContain('普攻与落石伤害翻倍');
  });

  it('shows exactly the unlocked regions with three enemies and one boss each', () => {
    const regions = createBestiaryRegions(2);
    expect(regions).toHaveLength(3);
    expect(regions.every((region) => region.enemies.length === 3)).toBe(true);
    expect(regions.every((region) => region.boss.kind === 'boss')).toBe(true);
  });

  it('uses the same scaled combat stats as spawned monsters', () => {
    const archive = createBestiaryRegions(0)[0];
    const template = getRegionTheme(1).enemies[2];
    expect(archive.enemies[2].defense).toEqual({
      min: getEnemyStats(template, 1).defense,
      max: getEnemyStats(template, 10).defense,
    });
    expect(archive.boss.hp.min).toBe(getBossStats(10).hp);
  });

  it('shows the fifth normal map buff in the archive', () => {
    const archive = createBestiaryRegions(4)[4];
    const template = getRegionTheme(41).enemies[2];
    expect(archive.enemies[2].attack.max).toBe(getEnemyStats(template, 50, 'normal-fifth').attack);
  });

  it('shows the fourth boss defense buff using the same values as the encounter', () => {
    const archive = createBestiaryRegions(3)[3];
    expect(archive.boss.defense).toEqual({ min: 16, max: 16 });
    expect(archive.boss.defense.min).toBe(getBossStats(40, 40).defense);
  });
});
