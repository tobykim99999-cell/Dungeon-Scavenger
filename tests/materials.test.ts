import { describe, expect, it } from 'vitest';
import {
  createMerchantOffers,
  getFloorMaterial,
  getRegionMaterial,
  JAR_MATERIAL_COST,
  mergeMaterials,
  parseMaterialVault,
  rollJarEquipmentTier,
  spendRegionMaterials,
} from '../src/game/materials';

describe('regional materials', () => {
  it('uses a distinct material name for the first five maps', () => {
    expect(getFloorMaterial(1).name).toBe('灰岩结晶');
    expect(getFloorMaterial(11).name).toBe('潮蚀珍珠');
    expect(getFloorMaterial(21).name).toBe('深井菌核');
    expect(getFloorMaterial(31).name).toBe('熔火矿心');
    expect(getFloorMaterial(41).name).toBe('无光碎片');
  });

  it('merges carried stacks and safely parses the local material vault', () => {
    const merged = mergeMaterials(
      [{ ...getRegionMaterial(0), quantity: 4 }],
      [{ ...getRegionMaterial(0), quantity: 7 }, { ...getRegionMaterial(1), quantity: 3 }],
    );
    expect(merged.map((item) => item.quantity)).toEqual([11, 3]);
    expect(parseMaterialVault(JSON.stringify(merged))).toEqual(merged);
  });

  it('spends exactly one hundred matching materials and leaves other regions untouched', () => {
    expect(JAR_MATERIAL_COST).toBe(100);
    const stored = [
      { ...getRegionMaterial(0), quantity: 112 },
      { ...getRegionMaterial(1), quantity: 80 },
    ];
    expect(spendRegionMaterials(stored, 0)).toEqual({
      success: true,
      balances: [{ ...getRegionMaterial(0), quantity: 12 }, { ...getRegionMaterial(1), quantity: 80 }],
    });
    expect(spendRegionMaterials(stored, 1)).toEqual({ success: false, balances: stored });
  });

  it('keeps purple out of the first jar and unlocks its five percent chance from the second', () => {
    expect(rollJarEquipmentTier(0, 0)).toBe('gold');
    expect(rollJarEquipmentTier(0, 0.7999)).toBe('gold');
    expect(rollJarEquipmentTier(0, 0.8)).toBe('dark-gold');
    expect(rollJarEquipmentTier(0, 0.9999)).toBe('dark-gold');
    expect(rollJarEquipmentTier(1, 0.7499)).toBe('gold');
    expect(rollJarEquipmentTier(1, 0.75)).toBe('dark-gold');
    expect(rollJarEquipmentTier(1, 0.9499)).toBe('dark-gold');
    expect(rollJarEquipmentTier(1, 0.95)).toBe('purple');
  });

  it('offers exactly one jar for each unlocked map', () => {
    const offers = createMerchantOffers(2, [{ ...getRegionMaterial(1), quantity: 100 }]);
    expect(offers).toHaveLength(3);
    expect(offers.map((offer) => offer.canBuy)).toEqual([false, true, false]);
  });
});
