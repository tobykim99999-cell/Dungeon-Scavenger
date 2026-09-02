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
  it('uses the requested potion and material probabilities', () => {
    expect(POTION_LOOT_CHANCE).toBe(0.25);
    expect(MATERIAL_LOOT_CHANCE).toBe(0.25);
    expect(rollRegularLootType(0)).toBe('potion');
    expect(rollRegularLootType(0.2499)).toBe('potion');
    expect(rollRegularLootType(0.25)).toBe('material');
    expect(rollRegularLootType(0.4999)).toBe('material');
  });

  it('uses fifteen percent each for weapons and armor, then twenty percent empty', () => {
    expect(WEAPON_LOOT_CHANCE).toBe(0.15);
    expect(ARMOR_LOOT_CHANCE).toBe(0.15);
    expect(rollRegularLootType(0.5)).toBe('weapon');
    expect(rollRegularLootType(0.6499)).toBe('weapon');
    expect(rollRegularLootType(0.65)).toBe('armor');
    expect(rollRegularLootType(0.7999)).toBe('armor');
    expect(rollRegularLootType(0.8)).toBe('nothing');
    expect(rollRegularLootType(0.9999)).toBe('nothing');
  });
});

describe('normal monster loot probabilities', () => {
  it('drops only materials or potions at fifteen percent each', () => {
    expect(MONSTER_MATERIAL_DROP_CHANCE).toBe(0.15);
    expect(MONSTER_POTION_DROP_CHANCE).toBe(0.15);
    expect(rollMonsterLootType(0)).toBe('material');
    expect(rollMonsterLootType(0.1499)).toBe('material');
    expect(rollMonsterLootType(0.15)).toBe('potion');
    expect(rollMonsterLootType(0.2999)).toBe('potion');
    expect(rollMonsterLootType(0.3)).toBe('nothing');
    expect(rollMonsterLootType(0.9999)).toBe('nothing');
  });
});
