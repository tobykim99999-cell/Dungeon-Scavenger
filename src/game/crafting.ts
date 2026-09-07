import { equipmentStorageId, getEquipmentTier } from './equipment';
import { GILDED_VAULT_KEY, parseGildedVault, type VaultEquipment } from './gilding';
import { HEROIC_UNLOCK_KEY, HEROIC_REGION_COUNT, getHeroicDifficultyFloor, parseHeroicUnlock } from './heroic';
import { REGION_PROGRESS_KEY, getRegion, parseRegionProgress } from './regions';
import { REFINED_MATERIAL_VAULT_KEY, getRefinedMaterialName, parseRefinedMaterials, type RefinedMaterialType } from './dismantling';
import type { EquipmentTier, Item } from './types';

export type CraftingTier = Exclude<EquipmentTier, 'common'>;
export interface CraftingRecipe {
  tier: CraftingTier;
  type: 'weapon' | 'armor';
  level: number;
}

export interface CraftingLevel {
  level: number;
  regionIndex: number;
  label: string;
}

const CRAFT_MATERIALS: Record<CraftingTier, RefinedMaterialType> = {
  gold: 'metal-fragment',
  'dark-gold': 'dark-gold-core',
  purple: 'set-fragment',
};

export function getCraftingLevels(highestRegion: number, heroicUnlocked: boolean): CraftingLevel[] {
  const count = Math.min(5, Math.max(1, Math.floor(highestRegion) + 1));
  const normal = Array.from({ length: count }, (_, regionIndex) => {
    const region = getRegion(regionIndex);
    return { level: region.endFloor, regionIndex, label: `Lv.${region.endFloor} · ${region.name}` };
  });
  const heroic = heroicUnlocked ? Array.from({ length: HEROIC_REGION_COUNT }, (_, regionIndex) => {
    const level = getHeroicDifficultyFloor(regionIndex, 10);
    return { level, regionIndex, label: `Lv.${level} · 英雄 ${getRegion(regionIndex).name}` };
  }) : [];
  return [...normal, ...heroic];
}

export function getCraftingCost(tier: CraftingTier, level: number) {
  if (!Object.hasOwn(CRAFT_MATERIALS, tier) || !Number.isSafeInteger(level) || level < 1 || level > 125) {
    throw new Error('无效的打造品质或等级。');
  }
  const materialType = CRAFT_MATERIALS[tier];
  const quantity = tier === 'gold' ? 20 + level * 2
    : tier === 'dark-gold' ? 12 + level : 10 + Math.ceil(level * 0.8);
  const gold = (tier === 'gold' ? 100 : tier === 'dark-gold' ? 200 : 400) * (1 + level / 5);
  return { materialType, materialName: getRefinedMaterialName(materialType), quantity, gold };
}

export function craftStoredEquipment(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  recipe: CraftingRecipe,
  generate: (regionIndex: number) => Item,
) {
  if (recipe.type !== 'weapon' && recipe.type !== 'armor') throw new Error('只能打造武器或护甲。');
  const level = getCraftingLevels(
    parseRegionProgress(storage.getItem(REGION_PROGRESS_KEY)),
    parseHeroicUnlock(storage.getItem(HEROIC_UNLOCK_KEY)),
  ).find((entry) => entry.level === recipe.level);
  if (!level) throw new Error('该打造等级尚未解锁。');
  const cost = getCraftingCost(recipe.tier, recipe.level);
  const keys = [GILDED_VAULT_KEY, REFINED_MATERIAL_VAULT_KEY, 'abyss-banked-gold'];
  const previous = keys.map((key) => storage.getItem(key));
  const vault = parseGildedVault(previous[0]);
  const materials = parseRefinedMaterials(previous[1]);
  const bankedGold = Number(previous[2] ?? '0');
  if (!Number.isSafeInteger(bankedGold) || bankedGold < cost.gold) throw new Error(`入库古币不足，需要 ${cost.gold} 枚。`);
  const balance = materials.find((entry) => entry.type === cost.materialType);
  if (!balance || balance.quantity < cost.quantity) throw new Error(`${cost.materialName}不足，需要 ${cost.quantity} 份。`);

  const item = generate(level.regionIndex);
  if (item.type !== recipe.type || getEquipmentTier(item) !== recipe.tier) throw new Error('打造品质不匹配，未扣除费用。');
  const id = equipmentStorageId(recipe.type, item);
  if (vault.some((entry) => entry.id === id)) throw new Error('仓库已有完全相同属性的装备，本次未扣除费用。');
  const equipment: VaultEquipment = {
    id, type: recipe.type, name: item.name, power: item.power, rarity: item.rarity,
    gilded: true, tier: recipe.tier, enhancementLevel: 0, craftingLevel: recipe.level,
    affixes: item.affixes, setId: item.setId, setName: item.setName, setBonus: item.setBonus,
  };
  balance.quantity -= cost.quantity;
  const nextMaterials = materials.filter((entry) => entry.quantity > 0);
  const nextVault = [...vault, equipment];
  const values = [JSON.stringify(nextVault), JSON.stringify(nextMaterials), String(bankedGold - cost.gold)];
  const written: number[] = [];
  try {
    for (const [index, key] of keys.entries()) {
      storage.setItem(key, values[index]);
      written.push(index);
    }
  } catch (error) {
    for (const index of written.reverse()) {
      if (previous[index] === null) storage.removeItem(keys[index]);
      else storage.setItem(keys[index], previous[index]!);
    }
    throw error;
  }
  return { equipment, vault: nextVault, materials: nextMaterials, bankedGold: bankedGold - cost.gold };
}
