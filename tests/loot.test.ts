import { describe, expect, it } from 'vitest';
import {
  ARMOR_LOOT_CHANCE,
  MATERIAL_LOOT_CHANCE,
  MONSTER_MATERIAL_DROP_CHANCE,
  MONSTER_POTION_DROP_CHANCE,
  POTION_LOOT_CHANCE,
  WEAPON_LOOT_CHANCE,
  rollMonsterLootType,
  rollRegularLootType,
} from '../src/game/loot';

describe('regular loot probabilities', () => {
  it('reduces the chest potion chance by one third while keeping materials unchanged', () => {
    expect(POTION_LOOT_CHANCE).toBeCloseTo(0.1667, 4);
    expect(MATERIAL_LOOT_CHANCE).toBe(0.25);
    expect(rollRegularLootType(0)).toBe('potion');
    expect(rollRegularLootType(POTION_LOOT_CHANCE - 0.0001)).toBe('potion');
    expect(rollRegularLootType(POTION_LOOT_CHANCE)).toBe('material');
    expect(rollRegularLootType(POTION_LOOT_CHANCE + MATERIAL_LOOT_CHANCE - 0.0001)).toBe('material');
  });

  it('keeps fifteen percent each for weapons and armor, then leaves the rest empty', () => {
    expect(WEAPON_LOOT_CHANCE).toBe(0.15);
    expect(ARMOR_LOOT_CHANCE).toBe(0.15);
    const weaponStart = POTION_LOOT_CHANCE + MATERIAL_LOOT_CHANCE;
    const armorStart = weaponStart + WEAPON_LOOT_CHANCE;
    const emptyStart = armorStart + ARMOR_LOOT_CHANCE;
    expect(rollRegularLootType(weaponStart)).toBe('weapon');
    expect(rollRegularLootType(armorStart - 0.0001)).toBe('weapon');
    expect(rollRegularLootType(armorStart)).toBe('armor');
    expect(rollRegularLootType(emptyStart - 0.0001)).toBe('armor');
    expect(rollRegularLootType(emptyStart)).toBe('nothing');
    expect(rollRegularLootType(0.9999)).toBe('nothing');
  });
});

describe('normal monster loot probabilities', () => {
  it('keeps materials at fifteen percent and reduces potions to ten percent', () => {
    expect(MONSTER_MATERIAL_DROP_CHANCE).toBe(0.15);
    expect(MONSTER_POTION_DROP_CHANCE).toBe(0.1);
    expect(rollMonsterLootType(0)).toBe('material');
    expect(rollMonsterLootType(0.1499)).toBe('material');
    expect(rollMonsterLootType(0.15)).toBe('potion');
    expect(rollMonsterLootType(0.2499)).toBe('potion');
    expect(rollMonsterLootType(0.25)).toBe('nothing');
    expect(rollMonsterLootType(0.9999)).toBe('nothing');
  });
});
