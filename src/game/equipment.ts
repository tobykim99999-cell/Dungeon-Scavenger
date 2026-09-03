import type {
  BonusStat,
  Equipment,
  EquipmentAffix,
  EquipmentTier,
} from './types';

export const DARK_GOLD_CHEST_CHANCE = 0.1;
export const BOSS_PURPLE_DROP_CHANCE = 0.6;

export interface EnhancementGain {
  attack: number;
  defense: number;
  maxHp: number;
}

const ENHANCEMENT_MAX_LEVEL: Record<EquipmentTier, number> = {
  common: 0,
  gold: 7,
  'dark-gold': 10,
  purple: 15,
};

const ENHANCEMENT_COST_BASE: Record<EquipmentTier, number> = {
  common: 0,
  gold: 60,
  'dark-gold': 120,
  purple: 240,
};

export function getEquipmentTier(equipment: Pick<Equipment, 'tier' | 'gilded'>): EquipmentTier {
  if (equipment.tier) return equipment.tier;
  return equipment.gilded ? 'gold' : 'common';
}

export function equipmentTierLabel(tier: EquipmentTier): string {
  const labels: Record<EquipmentTier, string> = {
    common: '普通',
    gold: '金装',
    'dark-gold': '暗金',
    purple: '紫装',
  };
  return labels[tier];
}

export function isCarryableEquipment(equipment: Pick<Equipment, 'tier' | 'gilded'>): boolean {
  return getEquipmentTier(equipment) !== 'common';
}

export function getEnhancementLevel(
  equipment: Pick<Equipment, 'enhancementLevel' | 'tier' | 'gilded'>,
): number {
  const level = Math.max(0, Math.floor(equipment.enhancementLevel ?? 0));
  return Math.min(level, getEnhancementMaxLevel(getEquipmentTier(equipment)));
}

export function getEnhancementMaxLevel(tier: EquipmentTier): number {
  return ENHANCEMENT_MAX_LEVEL[tier];
}

export function getEnhancementCost(tier: EquipmentTier, nextLevel: number): number {
  if (nextLevel < 1 || nextLevel > getEnhancementMaxLevel(tier)) return 0;
  return ENHANCEMENT_COST_BASE[tier] * nextLevel;
}

export function getEnhancementGain(
  type: 'weapon' | 'armor',
  tier: EquipmentTier,
): EnhancementGain {
  if (tier === 'common') return { attack: 0, defense: 0, maxHp: 0 };
  if (type === 'armor') {
    return {
      attack: 0,
      defense: 1,
      maxHp: tier === 'gold' ? 1 : tier === 'dark-gold' ? 2 : 3,
    };
  }
  return {
    attack: tier === 'gold' ? 1 : 2,
    defense: 0,
    maxHp: 0,
  };
}

export function getEnhancementBonus(
  type: 'weapon' | 'armor',
  equipment: Equipment,
): EnhancementGain {
  const gain = getEnhancementGain(type, getEquipmentTier(equipment));
  const level = getEnhancementLevel(equipment);
  return {
    attack: gain.attack * level,
    defense: gain.defense * level,
    maxHp: gain.maxHp * level,
  };
}

function equipmentAffixScore(affix: EquipmentAffix): number {
  if (affix.stat === 'attack' || affix.stat === 'defense') return affix.value * 2;
  if (affix.stat === 'maxHp') return affix.value * 0.5;
  if (affix.stat === 'crit') return affix.value * 0.8;
  return affix.value * 3;
}

export function getEquipmentScore(type: 'weapon' | 'armor', equipment: Equipment): number {
  const enhancement = getEnhancementBonus(type, equipment);
  const primaryPower = equipment.power + (type === 'weapon' ? enhancement.attack : enhancement.defense);
  const affixScore = (equipment.affixes ?? []).reduce(
    (total, affix) => total + equipmentAffixScore(affix),
    0,
  );
  const tierScore: Record<EquipmentTier, number> = {
    common: 0,
    gold: 12,
    'dark-gold': 28,
    purple: 48,
  };
  const setPotential = equipment.setBonus ? equipmentAffixScore(equipment.setBonus) * 0.5 : 0;
  return Math.max(1, Math.round(
    primaryPower * 3 +
    enhancement.maxHp * 0.5 +
    affixScore +
    tierScore[getEquipmentTier(equipment)] +
    setPotential,
  ));
}

export function getEnhancementSuccessChance(tier: EquipmentTier, nextLevel: number): number {
  if (nextLevel < 1 || nextLevel > getEnhancementMaxLevel(tier)) return 0;
  const base = tier === 'gold' ? 100 : tier === 'dark-gold' ? 95 : tier === 'purple' ? 90 : 0;
  const earlyPenalty = Math.min(nextLevel - 1, 4) * 5;
  const advancedPenalty = Math.max(0, Math.min(nextLevel - 5, 5)) * 10;
  const masteryPenalty = Math.max(0, nextLevel - 10) * 3;
  return Math.max(5, base - earlyPenalty - advancedPenalty - masteryPenalty);
}

export function rollEnhancementSuccess(
  tier: EquipmentTier,
  nextLevel: number,
  roll: number,
): boolean {
  return roll < getEnhancementSuccessChance(tier, nextLevel) / 100;
}

export function equipmentAffixBonus(
  equipment: Pick<Equipment, 'affixes'> | undefined,
  stat: BonusStat,
): number {
  return equipment?.affixes
    ?.filter((affix) => affix.stat === stat)
    .reduce((total, affix) => total + affix.value, 0) ?? 0;
}

export function shouldCriticalHit(chancePercent: number, roll: number): boolean {
  const chance = Math.min(100, Math.max(0, chancePercent)) / 100;
  return roll < chance;
}

export function resolveSetBonus(
  weapon: Equipment,
  armor: Equipment,
): { setName: string; affix: EquipmentAffix } | null {
  if (
    getEquipmentTier(weapon) !== 'purple' ||
    getEquipmentTier(armor) !== 'purple' ||
    !weapon.setId ||
    weapon.setId !== armor.setId
  ) {
    return null;
  }
  const affix = weapon.setBonus ?? armor.setBonus;
  const setName = weapon.setName ?? armor.setName;
  return affix && setName ? { setName, affix } : null;
}

export function equipmentStorageId(type: 'weapon' | 'armor', equipment: Equipment): string {
  const affixes = (equipment.affixes ?? [])
    .map((affix) => `${affix.stat}:${affix.value}`)
    .sort()
    .join(',');
  return [
    type,
    equipment.name,
    equipment.power,
    equipment.rarity ?? 'common',
    getEquipmentTier(equipment),
    affixes,
    equipment.setId ?? '',
    equipment.setBonus ? `${equipment.setBonus.stat}:${equipment.setBonus.value}` : '',
  ].join('|');
}

export function shouldDropDarkGoldFromChest(roll: number): boolean {
  return roll < DARK_GOLD_CHEST_CHANCE;
}

export function shouldDropPurpleFromBoss(floor: number, roll: number): boolean {
  return floor >= 20 && floor % 10 === 0 && roll < BOSS_PURPLE_DROP_CHANCE;
}

export function rollBossRewardTiers(
  floor: number,
  purpleRoll: number,
  purpleSlotRoll: number,
): readonly [EquipmentTier, EquipmentTier] {
  const tiers: [EquipmentTier, EquipmentTier] = ['gold', 'gold'];
  if (shouldDropPurpleFromBoss(floor, purpleRoll)) {
    tiers[purpleSlotRoll < 0.5 ? 0 : 1] = 'purple';
  }
  return tiers;
}

export function isDarkGoldEquipment(equipment: Pick<Equipment, 'tier' | 'gilded'>): boolean {
  return getEquipmentTier(equipment) === 'dark-gold';
}

export function isPremiumPickupTier(tier: EquipmentTier): tier is 'dark-gold' | 'purple' {
  return tier === 'dark-gold' || tier === 'purple';
}
