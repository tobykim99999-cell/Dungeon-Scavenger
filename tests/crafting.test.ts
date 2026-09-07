import { describe, expect, it, vi } from 'vitest';
import { craftStoredEquipment, getCraftingCost, getCraftingLevels, type CraftingRecipe, type CraftingTier } from '../src/game/crafting';
import { dismantleStoredEquipment, getDismantleReward, REFINED_MATERIAL_VAULT_KEY } from '../src/game/dismantling';
import { GILDED_VAULT_KEY, TOWN_LOADOUT_KEY, parseGildedVault } from '../src/game/gilding';
import type { Item } from '../src/game/types';
import { getEnhancementLevel } from '../src/game/equipment';

function createStorage() {
  const values = new Map([
    ['abyss-highest-unlocked-region', '4'],
    ['abyss-banked-gold', '20000'],
    [TOWN_LOADOUT_KEY, '{"weaponId":"existing-weapon"}'],
    ['abyss-material-vault', '[{"regionIndex":0,"quantity":100}]'],
    [REFINED_MATERIAL_VAULT_KEY, JSON.stringify([
      { type: 'metal-fragment', quantity: 500 },
      { type: 'dark-gold-core', quantity: 500 },
      { type: 'set-fragment', quantity: 500 },
    ])],
  ]);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function generate(recipe: CraftingRecipe): Item {
  return { id: 'generated-item', type: recipe.type, tier: recipe.tier, rarity: 'rare',
    name: '打造测试装备', description: '', power: 5 + Math.ceil(recipe.level * 0.8), gilded: true };
}

describe('equipment crafting', () => {
  it('only exposes unlocked normal levels and adds heroic levels after the heroic unlock', () => {
    expect(getCraftingLevels(0, false).map((entry) => entry.level)).toEqual([10]);
    expect(getCraftingLevels(2, false).map((entry) => entry.level)).toEqual([10, 20, 30]);
    expect(getCraftingLevels(4, true).map((entry) => entry.level)).toEqual([10, 20, 30, 40, 50, 65, 80, 95, 110, 125]);
  });

  it.each<CraftingTier>(['gold', 'dark-gold', 'purple'])('increases both costs with %s equipment level without a dismantling profit loop', (tier) => {
    let previousQuantity = 0;
    let previousGold = 0;
    for (const { level } of getCraftingLevels(4, true)) {
      const cost = getCraftingCost(tier, level);
      expect(cost.quantity).toBeGreaterThan(previousQuantity);
      expect(cost.gold).toBeGreaterThan(previousGold);
      expect(getDismantleReward({ tier, power: 5 + Math.ceil(level * 0.8), enhancementLevel: 15 })!.quantity).toBeLessThan(cost.quantity);
      previousQuantity = cost.quantity;
      previousGold = cost.gold;
    }
  });

  it.each<CraftingTier>(['gold', 'dark-gold', 'purple'])('spends matching materials and gold to add a %s item without auto-equipping', (tier) => {
    const storage = createStorage();
    const recipe: CraftingRecipe = { tier, type: 'armor', level: 50 };
    const cost = getCraftingCost(tier, 50);
    const result = craftStoredEquipment(storage, recipe, () => generate(recipe));
    expect(result.bankedGold).toBe(20000 - cost.gold);
    expect(result.materials.find((entry) => entry.type === cost.materialType)?.quantity).toBe(500 - cost.quantity);
    expect(result.materials.filter((entry) => entry.type !== cost.materialType).every((entry) => entry.quantity === 500)).toBe(true);
    const storedEquipment = parseGildedVault(storage.getItem(GILDED_VAULT_KEY))[0];
    expect(storedEquipment).toMatchObject({ tier, type: 'armor', craftingLevel: 50 });
    expect(getEnhancementLevel(storedEquipment)).toBe(0);
    expect(result.equipment.enhancementLevel).toBe(0);
    expect(storage.getItem(TOWN_LOADOUT_KEY)).toBe('{"weaponId":"existing-weapon"}');
    expect(storage.getItem('abyss-material-vault')).toBe('[{"regionIndex":0,"quantity":100}]');
    const dismantled = dismantleStoredEquipment(storage, result.equipment.id)!;
    expect(dismantled.reward.type).toBe(cost.materialType);
    expect(dismantled.reward.quantity).toBeLessThan(cost.quantity);
  });

  it('rejects insufficient materials or coins before rolling an item or changing storage', () => {
    const recipe: CraftingRecipe = { tier: 'purple', type: 'weapon', level: 50 };
    for (const [key, value] of [[REFINED_MATERIAL_VAULT_KEY, '[{"type":"metal-fragment","quantity":10000}]'], ['abyss-banked-gold', '1']]) {
      const storage = createStorage();
      storage.setItem(key, value);
      const before = new Map(storage.values);
      const roll = vi.fn(() => generate(recipe));
      expect(() => craftStoredEquipment(storage, recipe, roll)).toThrow(/不足/);
      expect(roll).not.toHaveBeenCalled();
      expect(storage.values).toEqual(before);
    }
  });

  it('rejects locked levels, invalid qualities and non-equipment requests without spending', () => {
    const storage = createStorage();
    const before = new Map(storage.values);
    const invalid = [
      { tier: 'gold', type: 'weapon', level: 125 },
      { tier: 'gold', type: 'weapon', level: 51 },
      { tier: 'common', type: 'weapon', level: 10 },
      { tier: 'gold', type: 'material', level: 10 },
    ];
    for (const recipe of invalid) {
      expect(() => craftStoredEquipment(storage, recipe as CraftingRecipe, () => generate(recipe as CraftingRecipe))).toThrow();
      expect(storage.values).toEqual(before);
    }
  });

  it('does not charge again for an identical item already in the vault', () => {
    const storage = createStorage();
    const recipe: CraftingRecipe = { tier: 'gold', type: 'weapon', level: 10 };
    craftStoredEquipment(storage, recipe, () => generate(recipe));
    const before = new Map(storage.values);
    expect(() => craftStoredEquipment(storage, recipe, () => generate(recipe))).toThrow(/完全相同/);
    expect(storage.values).toEqual(before);
  });

  it.each([GILDED_VAULT_KEY, REFINED_MATERIAL_VAULT_KEY, 'abyss-banked-gold'])('rolls back the transaction when writing %s fails', (failedKey) => {
    const storage = createStorage();
    const before = new Map(storage.values);
    const setItem = storage.setItem;
    let failed = false;
    storage.setItem = (key, value) => {
      if (key === failedKey && !failed) { failed = true; throw new Error('Quota exceeded'); }
      setItem(key, value);
    };
    const recipe: CraftingRecipe = { tier: 'gold', type: 'weapon', level: 10 };
    expect(() => craftStoredEquipment(storage, recipe, () => generate(recipe))).toThrow('Quota exceeded');
    expect(storage.values).toEqual(before);
  });
});
