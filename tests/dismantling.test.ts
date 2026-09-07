import { describe, expect, it } from 'vitest';
import {
  dismantleStoredEquipment,
  getDismantleReward,
  mergeRefinedMaterials,
  parseRefinedMaterials,
  REFINED_MATERIAL_VAULT_KEY,
} from '../src/game/dismantling';
import { equipmentStorageId } from '../src/game/equipment';
import {
  GILDED_LOADOUT_KEY, GILDED_VAULT_KEY, TOWN_LOADOUT_KEY,
  parseGildedLoadout, parseGildedVault, mergeGildedEquipment,
  type VaultEquipment,
} from '../src/game/gilding';

function createStorage() {
  const equipment: VaultEquipment = {
    id: 'purple-armor', type: 'armor', name: '守墓誓约', power: 40,
    tier: 'purple', gilded: true, enhancementLevel: 9,
  };
  equipment.id = equipmentStorageId(equipment.type, equipment);
  const values = new Map([
    [GILDED_VAULT_KEY, JSON.stringify([equipment])],
    [TOWN_LOADOUT_KEY, JSON.stringify({ weaponId: 'other-weapon', armorId: equipment.id })],
    ['abyss-banked-gold', '900'],
    ['abyss-material-vault', '[{"regionIndex":2,"quantity":100}]'],
  ]);
  return {
    values, equipment,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('equipment dismantling', () => {
  it('returns tier-specific refined materials with enhancement bonus', () => {
    expect(getDismantleReward({ power: 20, tier: 'gold', gilded: true, enhancementLevel: 4 })).toEqual({
      type: 'metal-fragment', name: '金属碎片', quantity: 11,
    });
    expect(getDismantleReward({ power: 30, tier: 'dark-gold', gilded: true, enhancementLevel: 6 })).toEqual({
      type: 'dark-gold-core', name: '暗金核心', quantity: 7,
    });
    expect(getDismantleReward({ power: 40, tier: 'purple', gilded: true, enhancementLevel: 9 })).toEqual({
      type: 'set-fragment', name: '套装碎片', quantity: 10,
    });
  });

  it('removes equipped gear, credits materials once, and preserves unrelated balances', () => {
    const storage = createStorage();
    const result = dismantleStoredEquipment(storage, storage.equipment.id)!;
    expect(result.vault).toEqual([]);
    expect(result.loadout).toEqual({ weaponId: 'other-weapon' });
    expect(parseRefinedMaterials(storage.getItem(REFINED_MATERIAL_VAULT_KEY))).toEqual([
      { type: 'set-fragment', name: '套装碎片', quantity: 10 },
    ]);
    const after = new Map(storage.values);
    expect(dismantleStoredEquipment(storage, storage.equipment.id)).toBeNull();
    expect(storage.values).toEqual(after);
    expect(storage.getItem('abyss-banked-gold')).toBe('900');
    expect(storage.getItem('abyss-material-vault')).toBe('[{"regionIndex":2,"quantity":100}]');
  });

  it('rejects starter equipment without changing storage', () => {
    const storage = createStorage();
    storage.setItem(GILDED_VAULT_KEY, JSON.stringify([{ ...storage.equipment, tier: 'common' }]));
    const before = new Map(storage.values);
    expect(dismantleStoredEquipment(storage, storage.equipment.id)).toBeNull();
    expect(storage.values).toEqual(before);
  });

  it.each([GILDED_VAULT_KEY, TOWN_LOADOUT_KEY, REFINED_MATERIAL_VAULT_KEY, GILDED_LOADOUT_KEY])(
    'restores the original save if writing %s fails', (failedKey) => {
      const storage = createStorage();
      const before = new Map(storage.values);
      const setItem = storage.setItem;
      let failed = false;
      storage.setItem = (key, value) => {
        if (key === failedKey && !failed) { failed = true; throw new Error('Quota exceeded'); }
        setItem(key, value);
      };
      // Include a legacy entry that changes so the final write is also covered.
      setItem(GILDED_LOADOUT_KEY, JSON.stringify({ armor: storage.equipment }));
      before.set(GILDED_LOADOUT_KEY, storage.getItem(GILDED_LOADOUT_KEY)!);
      expect(() => dismantleStoredEquipment(storage, storage.equipment.id)).toThrow('Quota exceeded');
      expect(storage.values).toEqual(before);
    },
  );

  it('does not restore dismantled legacy equipment when town storage is loaded again', () => {
    const storage = createStorage();
    const equipment = { ...storage.equipment, id: equipmentStorageId('armor', storage.equipment) };
    storage.setItem(GILDED_VAULT_KEY, JSON.stringify([equipment]));
    storage.setItem(GILDED_LOADOUT_KEY, JSON.stringify({ armor: equipment }));
    dismantleStoredEquipment(storage, equipment.id);
    expect(mergeGildedEquipment(
      parseGildedVault(storage.getItem(GILDED_VAULT_KEY)),
      parseGildedLoadout(storage.getItem(GILDED_LOADOUT_KEY)),
    ).vault).toEqual([]);
  });

  it('merges refined materials by type and ignores malformed storage', () => {
    expect(parseRefinedMaterials('[{"type":"metal-fragment","quantity":4},{"type":"bad","quantity":99}]')).toEqual([
      { type: 'metal-fragment', name: '金属碎片', quantity: 4 },
    ]);
    expect(mergeRefinedMaterials(
      [{ type: 'metal-fragment', name: '金属碎片', quantity: 4 }],
      [{ type: 'metal-fragment', name: '金属碎片', quantity: 3 }, { type: 'set-fragment', name: '套装碎片', quantity: 2 }],
    )).toEqual([
      { type: 'metal-fragment', name: '金属碎片', quantity: 7 },
      { type: 'set-fragment', name: '套装碎片', quantity: 2 },
    ]);
  });
});
