export const REGION_PROGRESS_KEY = 'abyss-highest-unlocked-region';

const REGION_NAMES = ['灰岩矿脉', '沉没回廊', '遗忘深井', '熔火断层', '无光遗迹'];

export interface RegionDefinition {
  index: number;
  name: string;
  startFloor: number;
  endFloor: number;
}

export function getRegionIndex(floor: number): number {
  return Math.max(0, Math.floor((floor - 1) / 10));
}

export function getRegion(index: number): RegionDefinition {
  const normalized = Math.max(0, Math.floor(index));
  return {
    index: normalized,
    name: REGION_NAMES[normalized] ?? `深渊区间 ${normalized + 1}`,
    startFloor: normalized * 10 + 1,
    endFloor: normalized * 10 + 10,
  };
}

export function unlockRegion(currentHighest: number, escapeFloor: number): number {
  return Math.max(Math.max(0, Math.floor(currentHighest)), getRegionIndex(escapeFloor));
}

export function parseRegionProgress(value: string | null): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
