export const POTION_LOOT_CHANCE = 1 / 6;
export const MATERIAL_LOOT_CHANCE = 0.25;
export const WEAPON_LOOT_CHANCE = 0.15;
export const ARMOR_LOOT_CHANCE = 0.15;
export const MONSTER_MATERIAL_DROP_CHANCE = 0.15;
export const MONSTER_POTION_DROP_CHANCE = 0.1;

export type RegularLootType = 'potion' | 'material' | 'weapon' | 'armor' | 'nothing';
export type MonsterLootType = 'material' | 'potion' | 'nothing';

export function rollRegularLootType(roll: number): RegularLootType {
  if (roll < POTION_LOOT_CHANCE) return 'potion';
  if (roll < POTION_LOOT_CHANCE + MATERIAL_LOOT_CHANCE) return 'material';
  if (roll < POTION_LOOT_CHANCE + MATERIAL_LOOT_CHANCE + WEAPON_LOOT_CHANCE) return 'weapon';
  if (roll < POTION_LOOT_CHANCE + MATERIAL_LOOT_CHANCE + WEAPON_LOOT_CHANCE + ARMOR_LOOT_CHANCE) return 'armor';
  return 'nothing';
}

export function rollMonsterLootType(roll: number): MonsterLootType {
  if (roll < MONSTER_MATERIAL_DROP_CHANCE) return 'material';
  if (roll < MONSTER_MATERIAL_DROP_CHANCE + MONSTER_POTION_DROP_CHANCE) return 'potion';
  return 'nothing';
}
