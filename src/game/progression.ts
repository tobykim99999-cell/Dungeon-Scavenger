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

export interface EnemyBaseStats {
  hp: number;
  attack: number;
  defense: number;
  reward: number;
}

export type EnemyStats = EnemyBaseStats;
export type EnemyDifficultyProfile = 'standard' | 'normal-fifth' | 'heroic';

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
    hp: 75 + floor * 6,
    attack: 8 + Math.ceil(floor * 0.75),
    defense: 3 + Math.floor(floor / 4),
    reward: 40 + floor * 6,
  };
}

export function getEnemyAttackDamage(
  attack: number,
  playerDefense: number,
  variance: number,
  isBoss: boolean,
): number {
  const effectiveDefense = Math.floor(Math.max(0, playerDefense) * (isBoss ? 0.75 : 1));
  return Math.max(isBoss ? 2 : 1, Math.max(0, attack) - effectiveDefense + variance);
}

export function getEnemyStats(
  base: EnemyBaseStats,
  floor: number,
  profile: EnemyDifficultyProfile = 'standard',
): EnemyStats {
  const normalized = Math.max(1, Math.floor(floor));
  const scale = 1 + Math.max(0, normalized - 1) * 0.18;
  const hpMultiplier = profile === 'normal-fifth' ? 1.12 : profile === 'heroic' ? 1.08 : 1;
  const attackMultiplier = profile === 'normal-fifth' ? 1.22 : profile === 'heroic' ? 1.12 : 1;
  const defenseBonus = profile === 'standard' ? 0 : 1;
  return {
    hp: Math.round(base.hp * scale * hpMultiplier),
    attack: Math.round(base.attack * scale * attackMultiplier),
    defense: base.defense + Math.floor(normalized / 4) + defenseBonus,
    reward: base.reward + normalized,
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
