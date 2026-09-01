import { describe, expect, it } from 'vitest';
import { getRegionTheme, listRegionThemes } from '../src/game/themes';

describe('regional visual themes', () => {
  it('maps each of the first five ten-floor regions to a distinct theme', () => {
    expect(getRegionTheme(1).id).toBe('gray-mine');
    expect(getRegionTheme(11).id).toBe('sunken-gallery');
    expect(getRegionTheme(21).id).toBe('forgotten-well');
    expect(getRegionTheme(31).id).toBe('molten-fault');
    expect(getRegionTheme(41).id).toBe('lightless-ruins');
  });

  it('keeps scene palettes, walls, chests and bosses visually distinct', () => {
    const themes = listRegionThemes();
    expect(new Set(themes.map((theme) => theme.floorColors.join(','))).size).toBe(5);
    expect(new Set(themes.map((theme) => `${theme.wallFrame}:${theme.wallTint}`)).size).toBe(5);
    expect(new Set(themes.map((theme) => theme.chestTint)).size).toBe(5);
    expect(new Set(themes.map((theme) => theme.boss.name)).size).toBe(5);
    expect(new Set(themes.map((theme) => theme.boss.tint)).size).toBe(5);
  });

  it('provides three unique named enemies per region', () => {
    for (const theme of listRegionThemes()) {
      expect(theme.enemies).toHaveLength(3);
      expect(new Set(theme.enemies.map((enemy) => enemy.name)).size).toBe(3);
    }
  });

  it('changes appearance without silently multiplying the existing balance curve', () => {
    for (const theme of listRegionThemes()) {
      expect(theme.enemies.map((enemy) => enemy.hp)).toEqual([5, 7, 11]);
      expect(theme.enemies.map((enemy) => enemy.attack)).toEqual([3, 4, 5]);
    }
  });

  it('keeps deeper unknown regions on the lightless theme', () => {
    expect(getRegionTheme(99).id).toBe('lightless-ruins');
  });
});
