import { getRegionIndex } from './regions';
import type { AdventureMode } from './types';

export const HEROIC_UNLOCK_KEY = 'abyss-heroic-unlocked';
export const HEROIC_REGION_COUNT = 5;
export const HEROIC_FIRST_DIFFICULTY_FLOOR = 56;
export const HEROIC_REGION_DIFFICULTY_GAP = 15;

export function parseHeroicUnlock(value: string | null): boolean {
  return value === '1' || value === 'true';
}

export function getHeroicDifficultyFloor(regionIndex: number, localFloor: number): number {
  const region = Math.max(0, Math.floor(regionIndex));
  const local = Math.min(10, Math.max(1, Math.floor(localFloor)));
  return HEROIC_FIRST_DIFFICULTY_FLOOR + region * HEROIC_REGION_DIFFICULTY_GAP + local - 1;
}

export function getAdventureDifficultyFloor(mode: AdventureMode, floor: number): number {
  const normalized = Math.max(1, Math.floor(floor));
  if (mode === 'normal') return normalized;
  const regionIndex = getRegionIndex(normalized);
  const localFloor = ((normalized - 1) % 10) + 1;
  return getHeroicDifficultyFloor(regionIndex, localFloor);
}

export function shouldUnlockHeroic(mode: AdventureMode, defeatedBossFloor: number): boolean {
  return mode === 'normal' && defeatedBossFloor >= 50 && defeatedBossFloor % 10 === 0;
}
