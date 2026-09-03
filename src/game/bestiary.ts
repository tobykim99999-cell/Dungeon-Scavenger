import { getBossSkill } from './bossSkills';
import { getBossStats, getEnemyStats } from './progression';
import { getRegion } from './regions';
import { getRegionTheme } from './themes';
import type { BestiaryCreature, BestiaryRegion, BestiaryStatRange } from './types';

function range(first: number, last: number): BestiaryStatRange {
  return { min: Math.min(first, last), max: Math.max(first, last) };
}

export function createBestiaryRegions(highestUnlockedRegion: number): BestiaryRegion[] {
  const regionCount = Math.max(0, Math.floor(highestUnlockedRegion)) + 1;
  return Array.from({ length: regionCount }, (_, index) => {
    const region = getRegion(index);
    const theme = getRegionTheme(region.startFloor);
    const enemies: BestiaryCreature[] = theme.enemies.map((template) => {
      const profile = index === 4 ? 'normal-fifth' : 'standard';
      const first = getEnemyStats(template, region.startFloor, profile);
      const last = getEnemyStats(template, region.endFloor, profile);
      return {
        name: template.name,
        kind: 'enemy',
        frame: template.frame,
        tint: template.tint,
        scale: template.scale,
        hp: range(first.hp, last.hp),
        attack: range(first.attack, last.attack),
        defense: range(first.defense, last.defense),
        reward: range(first.reward, last.reward),
      };
    });
    const bossStats = getBossStats(region.endFloor);
    const skill = getBossSkill(region.endFloor);
    const boss: BestiaryCreature = {
      name: theme.boss.name,
      kind: 'boss',
      frame: theme.boss.frame,
      tint: theme.boss.tint,
      scale: theme.boss.scale,
      hp: range(bossStats.hp, bossStats.hp),
      attack: range(bossStats.attack, bossStats.attack),
      defense: range(bossStats.defense, bossStats.defense),
      reward: range(bossStats.reward, bossStats.reward),
      skillName: skill.name,
      skillDescription: `${skill.description} 危险范围：${skill.dangerDescription}。`,
    };
    return {
      index,
      name: region.name,
      floorLabel: `${region.startFloor}～${region.endFloor} 层`,
      enemies,
      boss,
    };
  });
}
