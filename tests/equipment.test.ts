import { describe, expect, it } from 'vitest';
import {
  BOSS_PURPLE_DROP_CHANCE,
  equipmentAffixBonus,
  equipmentStorageId,
  getEquipmentTier,
  isCarryableEquipment,
  isDarkGoldEquipment,
  rollBossRewardTiers,
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
  });
});
