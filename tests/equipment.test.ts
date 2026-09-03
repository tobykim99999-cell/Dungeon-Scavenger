import { describe, expect, it } from 'vitest';
import {
  BOSS_PURPLE_DROP_CHANCE,
  equipmentAffixBonus,
  equipmentStorageId,
  getEnhancementBonus,
  getEnhancementCost,
  getEnhancementGain,
  getEnhancementLevel,
  getEnhancementMaxLevel,
  getEnhancementSuccessChance,
  getEquipmentScore,
  getEquipmentTier,
  isCarryableEquipment,
  isDarkGoldEquipment,
  isPremiumPickupTier,
  rollBossRewardTiers,
  rollEnhancementSuccess,
  resolveSetBonus,
  shouldCriticalHit,
  shouldDropDarkGoldFromChest,
  shouldDropPurpleFromBoss,
} from '../src/game/equipment';
import type { Equipment } from '../src/game/types';

describe('equipment tiers', () => {
  it('orders legacy and explicit equipment into the expected carry rules', () => {
    expect(getEquipmentTier({})).toBe('common');
    expect(getEquipmentTier({ gilded: true })).toBe('gold');
    expect(getEquipmentTier({ tier: 'dark-gold' })).toBe('dark-gold');
    expect(isCarryableEquipment({ tier: 'common' })).toBe(false);
    expect(isCarryableEquipment({ tier: 'gold' })).toBe(true);
    expect(isCarryableEquipment({ tier: 'dark-gold' })).toBe(true);
    expect(isCarryableEquipment({ tier: 'purple' })).toBe(true);
  });

  it('uses an exact ten percent chest boundary for dark-gold equipment', () => {
    expect(shouldDropDarkGoldFromChest(0)).toBe(true);
    expect(shouldDropDarkGoldFromChest(0.0999)).toBe(true);
    expect(shouldDropDarkGoldFromChest(0.1)).toBe(false);
  });

  it('uses an exact sixty percent purple event starting with the second map boss', () => {
    expect(BOSS_PURPLE_DROP_CHANCE).toBe(0.6);
    expect(shouldDropPurpleFromBoss(10, 0)).toBe(false);
    expect(shouldDropPurpleFromBoss(20, 0.5999)).toBe(true);
    expect(shouldDropPurpleFromBoss(20, 0.6)).toBe(false);
    expect(shouldDropPurpleFromBoss(40, 0)).toBe(true);
    expect(shouldDropPurpleFromBoss(21, 0)).toBe(false);
  });

  it('always returns two gold-or-better boss rewards and upgrades only one on success', () => {
    expect(rollBossRewardTiers(10, 0, 0)).toEqual(['gold', 'gold']);
    expect(rollBossRewardTiers(20, 0.2, 0.2)).toEqual(['purple', 'gold']);
    expect(rollBossRewardTiers(20, 0.2, 0.8)).toEqual(['gold', 'purple']);
    expect(rollBossRewardTiers(20, 0.8, 0.2)).toEqual(['gold', 'gold']);
  });

  it('identifies only dark-gold equipment for chest beam effects', () => {
    expect(isDarkGoldEquipment({ tier: 'dark-gold' })).toBe(true);
    expect(isDarkGoldEquipment({ tier: 'gold' })).toBe(false);
    expect(isDarkGoldEquipment({ tier: 'purple' })).toBe(false);
  });

  it('animates only dark-gold and purple equipment pickups', () => {
    expect(isPremiumPickupTier('common')).toBe(false);
    expect(isPremiumPickupTier('gold')).toBe(false);
    expect(isPremiumPickupTier('dark-gold')).toBe(true);
    expect(isPremiumPickupTier('purple')).toBe(true);
  });

  it('scores equipment from power, quality, affixes and enhancement', () => {
    expect(getEquipmentScore('weapon', { name: '缺口短剑', power: 2, tier: 'common' })).toBe(6);
    expect(getEquipmentScore('weapon', {
      name: '黯星战刃',
      power: 25,
      tier: 'dark-gold',
      enhancementLevel: 8,
      affixes: [{ stat: 'defense', value: 3, label: '坚韧' }],
    })).toBe(157);
    expect(getEquipmentScore('armor', {
      name: '深渊回响',
      power: 21,
      tier: 'purple',
      affixes: [{ stat: 'attack', value: 2, label: '锋锐' }],
      setBonus: { stat: 'maxHp', value: 12, label: '深渊血脉' },
    })).toBe(118);
  });

  it('uses the bounded enhancement curve for each equipment tier', () => {
    expect(getEnhancementMaxLevel('gold')).toBe(7);
    expect(getEnhancementMaxLevel('dark-gold')).toBe(10);
    expect(getEnhancementMaxLevel('purple')).toBe(15);
    expect(getEnhancementLevel({ tier: 'purple', enhancementLevel: 99 })).toBe(15);
    expect(getEnhancementLevel({ tier: 'gold', enhancementLevel: -3 })).toBe(0);
    expect(getEnhancementCost('gold', 7)).toBe(420);
    expect(getEnhancementCost('dark-gold', 10)).toBe(1200);
    expect(getEnhancementCost('purple', 15)).toBe(3600);
    expect(getEnhancementCost('purple', 16)).toBe(0);
  });

  it('gives premium weapons more attack and armor both defense and health', () => {
    expect(getEnhancementGain('weapon', 'gold')).toEqual({ attack: 1, defense: 0, maxHp: 0 });
    expect(getEnhancementGain('weapon', 'dark-gold')).toEqual({ attack: 2, defense: 0, maxHp: 0 });
    expect(getEnhancementGain('weapon', 'purple')).toEqual({ attack: 2, defense: 0, maxHp: 0 });
    expect(getEnhancementGain('armor', 'gold')).toEqual({ attack: 0, defense: 1, maxHp: 1 });
    expect(getEnhancementGain('armor', 'dark-gold')).toEqual({ attack: 0, defense: 1, maxHp: 2 });
    expect(getEnhancementGain('armor', 'purple')).toEqual({ attack: 0, defense: 1, maxHp: 3 });
    expect(getEnhancementBonus('weapon', { power: 20, name: '守墓誓约', tier: 'purple', enhancementLevel: 15 }))
      .toEqual({ attack: 30, defense: 0, maxHp: 0 });
  });

  it('reduces enhancement success by target level and equipment quality', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((level) => getEnhancementSuccessChance('gold', level)))
      .toEqual([100, 95, 90, 85, 80, 70, 60]);
    expect([1, 5, 6, 10].map((level) => getEnhancementSuccessChance('dark-gold', level)))
      .toEqual([95, 75, 65, 25]);
    expect([1, 5, 6, 10, 11, 12, 13, 14, 15].map((level) => getEnhancementSuccessChance('purple', level)))
      .toEqual([90, 70, 60, 20, 17, 14, 11, 8, 5]);
    expect(rollEnhancementSuccess('purple', 10, 0.1999)).toBe(true);
    expect(rollEnhancementSuccess('purple', 10, 0.2)).toBe(false);
  });
});

describe('equipment affixes and sets', () => {
  const purple = (type: 'weapon' | 'armor', setId: string): Equipment => ({
    name: '守墓誓约',
    power: type === 'weapon' ? 12 : 10,
    tier: 'purple',
    gilded: true,
    affixes: [{ stat: type === 'weapon' ? 'attack' : 'defense', value: 3, label: '远古' }],
    setId,
    setName: '守墓誓约',
    setBonus: { stat: 'attack', value: 5, label: '誓约之刃' },
  });

  it('adds only matching affix stats', () => {
    const weapon = purple('weapon', 'grave-oath');
    expect(equipmentAffixBonus(weapon, 'attack')).toBe(3);
    expect(equipmentAffixBonus(weapon, 'defense')).toBe(0);
    expect(equipmentAffixBonus({ affixes: [{ stat: 'maxHp', value: 9, label: '不朽' }] }, 'maxHp')).toBe(9);
  });

  it('uses exact percentage boundaries for critical hits', () => {
    expect(shouldCriticalHit(20, 0.1999)).toBe(true);
    expect(shouldCriticalHit(20, 0.2)).toBe(false);
    expect(shouldCriticalHit(0, 0)).toBe(false);
    expect(shouldCriticalHit(100, 0.9999)).toBe(true);
  });

  it('activates a set only for matching purple weapon and armor names', () => {
    expect(resolveSetBonus(purple('weapon', 'grave-oath'), purple('armor', 'grave-oath'))).toEqual({
      setName: '守墓誓约',
      affix: { stat: 'attack', value: 5, label: '誓约之刃' },
    });
    expect(resolveSetBonus(purple('weapon', 'grave-oath'), purple('armor', 'deep-echo'))).toBeNull();
  });

  it('keeps same-name equipment with different affixes as separate warehouse items', () => {
    const first = purple('weapon', 'grave-oath');
    const second = {
      ...first,
      affixes: [{ stat: 'defense' as const, value: 3, label: '远古' }],
    };
    expect(equipmentStorageId('weapon', first)).not.toBe(equipmentStorageId('weapon', second));
    expect(equipmentStorageId('weapon', first)).toBe(equipmentStorageId('weapon', {
      ...first,
      enhancementLevel: 8,
    }));
  });
});
