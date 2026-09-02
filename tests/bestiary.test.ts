import { describe, expect, it } from 'vitest';
import { createBestiaryRegions } from '../src/game/bestiary';
import { getBossStats, getEnemyStats } from '../src/game/progression';
import { getRegionTheme } from '../src/game/themes';

describe('unlocked monster bestiary', () => {
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
});
