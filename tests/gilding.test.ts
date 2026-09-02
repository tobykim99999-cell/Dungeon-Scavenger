import { describe, expect, it } from 'vitest';
import {
  canGildEquipment,
  chooseAltarFloors,
  chooseEscapeScrollFloor,
  deleteVaultEquipment,
  equipmentMatchesItem,
  mergeGildedEquipment,
  mergePendingGildedEquipment,
  parseGildedLoadout,
  parseGildedVault,
  shouldPlaceEscapeScroll,
} from '../src/game/gilding';
import { advanceStage } from '../src/game/progression';

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('gilding altar frequency', () => {
  it('places no more than two altars in each ten-floor block', () => {
    for (let blockStart = 1; blockStart <= 91; blockStart += 10) {
      const floors = chooseAltarFloors(blockStart, sequence([0.12, 0.84, 0.37, 0.66, 0.21]));
      expect(floors.length).toBeGreaterThanOrEqual(1);
      expect(floors.length).toBeLessThanOrEqual(2);
      expect(new Set(floors).size).toBe(floors.length);
      expect(floors.every((floor) => floor >= blockStart && floor < blockStart + 10)).toBe(true);
    }
  });

  it('can schedule only one altar for a quieter block', () => {
    const floors = chooseAltarFloors(11, () => 0.1);
    expect(floors).toHaveLength(1);
  });
});

describe('gilded equipment storage', () => {
  it('restores valid equipment as gilded', () => {
    expect(parseGildedLoadout('{"weapon":{"name":"熔火长剑","power":14,"rarity":"rare"}}')).toEqual({
      weapon: {
        name: '熔火长剑',
        power: 14,
        rarity: 'rare',
        gilded: true,
        tier: 'gold',
        affixes: [],
        setId: undefined,
        setName: undefined,
        setBonus: undefined,
      },
      armor: undefined,
    });
  });

  it('ignores malformed storage data', () => {
    expect(parseGildedLoadout('not-json')).toEqual({});
    expect(parseGildedLoadout('{"armor":{"name":42}}')).toEqual({
      weapon: undefined,
      armor: undefined,
    });
  });

  it('stores different gilded equipment and deduplicates identical pieces', () => {
    const pending = {
      weapon: { name: '熔火长剑', power: 14, rarity: 'rare' as const, gilded: true },
    };
    const first = mergeGildedEquipment([], pending);
    const second = mergeGildedEquipment(first.vault, pending);

    expect(first.added).toHaveLength(1);
    expect(second.added).toHaveLength(0);
    expect(parseGildedVault(JSON.stringify(second.vault))).toEqual(first.vault);
  });

  it('persists a sanitized enhancement level with warehouse equipment', () => {
    const vault = mergePendingGildedEquipment([], [{
      type: 'weapon',
      name: '熔火长剑',
      power: 14,
      rarity: 'rare',
      gilded: true,
      enhancementLevel: 4,
    }]).vault;
    expect(parseGildedVault(JSON.stringify(vault))[0].enhancementLevel).toBe(4);
  });

  it('matches a discarded pending item by type and exact equipment values', () => {
    const equipment = { name: '熔火长剑', power: 14, rarity: 'rare' as const, gilded: true };
    const item = {
      id: 'item-1',
      type: 'weapon' as const,
      name: '熔火长剑',
      description: '攻击 +14',
      power: 14,
      rarity: 'rare' as const,
      gilded: true,
    };

    expect(equipmentMatchesItem(equipment, item)).toBe(true);
    expect(equipmentMatchesItem({ ...equipment, power: 13 }, item)).toBe(false);
  });

  it('never offers permanent town equipment to a gilding altar', () => {
    expect(canGildEquipment({})).toBe(true);
    expect(canGildEquipment({ gilded: true })).toBe(false);
    expect(canGildEquipment({ vaultId: 'weapon|熔火长剑|14|rare' })).toBe(false);
    expect(canGildEquipment({ gilded: false, vaultId: 'vault-item' })).toBe(false);
  });

  it('carries multiple same-type items across the floor ten boss into floor eleven', () => {
    const afterBoss = advanceStage(10, true);
    const pending = [
      { type: 'weapon' as const, name: '熔火长剑', power: 12, rarity: 'rare' as const, gilded: true },
      { type: 'weapon' as const, name: '守墓人钉锤', power: 14, rarity: 'rare' as const, gilded: true },
    ];
    const settled = mergePendingGildedEquipment([], pending);

    expect(afterBoss).toEqual({ floor: 11, bossStage: false });
    expect(settled.vault.map((item) => item.name)).toEqual(['熔火长剑', '守墓人钉锤']);
    expect(parseGildedVault(JSON.stringify(settled.vault))).toHaveLength(2);
  });

  it('permanently deletes a vault item and clears it from the equipped slot', () => {
    const vault = mergePendingGildedEquipment([], [
      { type: 'weapon', name: '熔火长剑', power: 12, rarity: 'rare', gilded: true },
      { type: 'armor', name: '深岩板甲', power: 10, rarity: 'rare', gilded: true },
    ]).vault;
    const weapon = vault.find((item) => item.type === 'weapon')!;
    const armor = vault.find((item) => item.type === 'armor')!;
    const result = deleteVaultEquipment(
      vault,
      { weaponId: weapon.id, armorId: armor.id },
      weapon.id,
    );

    expect(result.deleted?.id).toBe(weapon.id);
    expect(result.vault).toEqual([armor]);
    expect(result.loadout).toEqual({ armorId: armor.id });
  });
});

describe('single held escape scroll', () => {
  it('selects one random normal floor before the first boss checkpoint', () => {
    expect(chooseEscapeScrollFloor(1, () => 0)).toBe(1);
    expect(chooseEscapeScrollFloor(1, () => 0.49)).toBe(5);
    expect(chooseEscapeScrollFloor(1, () => 0.999)).toBe(10);
  });

  it('places the scroll inside the selected starting region', () => {
    expect(chooseEscapeScrollFloor(11, () => 0)).toBe(11);
    expect(chooseEscapeScrollFloor(11, () => 0.999)).toBe(20);
    expect(chooseEscapeScrollFloor(31, () => 0.5)).toBe(36);
  });

  it('guarantees the selected floor and never creates a second held scroll', () => {
    expect(shouldPlaceEscapeScroll(6, 6, false, 0.9)).toBe(true);
    expect(shouldPlaceEscapeScroll(6, 6, true, 0)).toBe(false);
    expect(shouldPlaceEscapeScroll(12, 6, true, 0)).toBe(false);
  });

  it('gives every normal floor a higher chance when no scroll is held', () => {
    expect(shouldPlaceEscapeScroll(5, 6, false, 0.34)).toBe(true);
    expect(shouldPlaceEscapeScroll(7, 6, false, 0.34)).toBe(true);
    expect(shouldPlaceEscapeScroll(7, 6, false, 0.35)).toBe(false);
    expect(shouldPlaceEscapeScroll(18, 6, false, 0.8)).toBe(false);
  });
});
