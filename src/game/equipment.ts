import type {
  BonusStat,
  Equipment,
  EquipmentAffix,
  EquipmentTier,
} from './types';

export const DARK_GOLD_CHEST_CHANCE = 0.1;
export const BOSS_PURPLE_DROP_CHANCE = 0.6;

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
