import type { AdventureMode } from './types';
import type { EnemyStats } from './progression';

export type EliteAffix = 'bulwark' | 'frenzy' | 'vampiric';

export interface EliteAffixDefinition {
  id: EliteAffix;
  label: string;
  color: number;
}

export const ELITE_AFFIXES: readonly EliteAffixDefinition[] = [
  { id: 'bulwark', label: '坚甲', color: 0x78b8e8 },
  { id: 'frenzy', label: '狂怒', color: 0xe86d5c },
  { id: 'vampiric', label: '吸血', color: 0xc867a7 },
];

export function shouldSpawnHeroicElite(mode: AdventureMode, floor: number): boolean {
  if (mode !== 'heroic' || !Number.isInteger(floor) || floor <= 0) return false;
  const floorInRegion = ((floor - 1) % 10) + 1;
  return floorInRegion === 5 || floorInRegion === 10;
}

export function getEliteStats(stats: EnemyStats): EnemyStats {
  return {
    hp: Math.round(stats.hp * 1.8),
    attack: Math.round(stats.attack * 1.3),
    defense: stats.defense + 3,
    reward: Math.round(stats.reward * 2.5),
  };
}

export function rollEliteAffix(roll: number): EliteAffixDefinition {
  const normalized = Math.min(0.999999, Math.max(0, roll));
  return ELITE_AFFIXES[Math.floor(normalized * ELITE_AFFIXES.length)];
}

export function getEliteBulwarkShield(maxHp: number): number {
  return Math.max(1, Math.ceil(Math.max(1, maxHp) * 0.3));
}

export function getEliteFrenzyAttack(attack: number): number {
  return Math.max(1, Math.ceil(Math.max(1, attack) * 1.25));
}

export function getEliteLifeSteal(actualDamage: number): number {
  return Math.max(1, Math.ceil(Math.max(1, actualDamage) * 0.4));
}
