import { describe, expect, it } from 'vitest';
import { canStackItems, itemQuantity } from '../src/game/inventory';
import type { Item } from '../src/game/types';

const potion = (overrides: Partial<Item> = {}): Item => ({
  id: 'potion-1',
  type: 'potion',
  name: '止血药剂',
  description: '恢复 11 点生命',
  power: 11,
  rarity: 'common',
  ...overrides,
});

describe('inventory potion stacks', () => {
  it('stacks potions with identical effects and rarity', () => {
    expect(canStackItems(potion(), potion({ id: 'potion-2' }))).toBe(true);
  });

  it('keeps different healing values and rarity in separate slots', () => {
    expect(canStackItems(potion(), potion({ power: 13 }))).toBe(false);
    expect(canStackItems(potion(), potion({ rarity: 'rare' }))).toBe(false);
  });

  it('never stacks equipment with potions', () => {
    expect(canStackItems(potion(), {
      id: 'weapon-1',
      type: 'weapon',
      name: '裂纹弯刀',
      description: '攻击 +4',
      power: 4,
      rarity: 'common',
    })).toBe(false);
  });

  it('treats a missing or invalid quantity as one', () => {
    expect(itemQuantity(potion())).toBe(1);
    expect(itemQuantity(potion({ quantity: 4 }))).toBe(4);
    expect(itemQuantity(potion({ quantity: 0 }))).toBe(1);
  });
});
