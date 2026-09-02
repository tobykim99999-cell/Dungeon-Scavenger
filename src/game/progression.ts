export interface BossStats {
  hp: number;
  attack: number;
  defense: number;
  reward: number;
}

export interface StageProgress {
  floor: number;
  bossStage: boolean;
}

export function hasBossAfterFloor(floor: number): boolean {
  return Number.isInteger(floor) && floor > 0 && floor % 10 === 0;
}

export function advanceStage(floor: number, bossStage: boolean): StageProgress {
  if (bossStage) return { floor: floor + 1, bossStage: false };
  if (hasBossAfterFloor(floor)) return { floor, bossStage: true };
  return { floor: floor + 1, bossStage: false };
}

export function getBossStats(floor: number): BossStats {
  return {
    hp: 45 + floor * 3,
    attack: 6 + Math.ceil(floor * 0.6),
    defense: 1 + Math.floor(floor / 5),
    reward: 40 + floor * 6,
  };
}

export function getEnemyCount(floor: number): number {
  const normalized = Math.max(1, Math.floor(floor));
  if (normalized <= 10) return Math.min(10, 3 + Math.ceil(normalized * 0.7));
  return Math.min(5 + normalized * 2, 18);
}

export function getChestCount(floor: number): number {
  const normalized = Math.max(1, Math.floor(floor));
  const floorInRegion = ((normalized - 1) % 10) + 1;
  return floorInRegion <= 5 ? 2 : 3;
}
