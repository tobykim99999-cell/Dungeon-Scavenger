import { getRegion, getRegionIndex } from './regions';
import type { EquipmentTier, TownMaterialBalance } from './types';

export const MATERIAL_VAULT_KEY = 'abyss-material-vault';
export const JAR_MATERIAL_COST = 100;

const MATERIAL_NAMES = ['灰岩结晶', '潮蚀珍珠', '深井菌核', '熔火矿心', '无光碎片'];

export interface MaterialTradeResult {
  balances: TownMaterialBalance[];
  success: boolean;
}

export function getRegionMaterial(regionIndex: number): TownMaterialBalance {
  const normalized = Math.max(0, Math.floor(regionIndex));
  return {
    regionIndex: normalized,
    name: MATERIAL_NAMES[Math.min(normalized, MATERIAL_NAMES.length - 1)],
    quantity: 0,
  };
}

export function getFloorMaterial(floor: number): TownMaterialBalance {
  return getRegionMaterial(getRegionIndex(floor));
}

export function parseMaterialVault(value: string | null): TownMaterialBalance[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Partial<TownMaterialBalance>;
      if (
        typeof candidate.regionIndex !== 'number' ||
        typeof candidate.quantity !== 'number' ||
        candidate.quantity <= 0
      ) {
        return [];
      }
      const material = getRegionMaterial(candidate.regionIndex);
      return [{ ...material, quantity: Math.floor(candidate.quantity) }];
    });
  } catch {
    return [];
  }
}

export function mergeMaterials(
  stored: TownMaterialBalance[],
  incoming: TownMaterialBalance[],
): TownMaterialBalance[] {
  const quantities = new Map<number, number>();
  for (const material of [...stored, ...incoming]) {
    quantities.set(
      material.regionIndex,
      (quantities.get(material.regionIndex) ?? 0) + Math.max(0, Math.floor(material.quantity)),
    );
  }
  return [...quantities.entries()]
    .filter(([, quantity]) => quantity > 0)
    .sort(([a], [b]) => a - b)
    .map(([regionIndex, quantity]) => ({ ...getRegionMaterial(regionIndex), quantity }));
}

export function spendRegionMaterials(
  stored: TownMaterialBalance[],
  regionIndex: number,
  cost = JAR_MATERIAL_COST,
): MaterialTradeResult {
  const current = stored.find((material) => material.regionIndex === regionIndex)?.quantity ?? 0;
  if (current < cost) return { balances: [...stored], success: false };
  const balances = stored.flatMap((material) => {
    if (material.regionIndex !== regionIndex) return [material];
    const quantity = material.quantity - cost;
    return quantity > 0 ? [{ ...material, quantity }] : [];
  });
  return { balances, success: true };
}

export function rollJarEquipmentTier(regionIndex: number, roll: number): EquipmentTier {
  const goldChance = regionIndex <= 0 ? 0.8 : 0.75;
  if (roll < goldChance) return 'gold';
  if (regionIndex <= 0 || roll < 0.95) return 'dark-gold';
  return 'purple';
}

export function createMerchantOffers(
  highestUnlockedRegion: number,
  balances: TownMaterialBalance[],
) {
  return Array.from({ length: Math.max(0, highestUnlockedRegion) + 1 }, (_, regionIndex) => {
    const material = getRegionMaterial(regionIndex);
    const quantity = balances.find((entry) => entry.regionIndex === regionIndex)?.quantity ?? 0;
    return {
      ...material,
      quantity,
      regionName: getRegion(regionIndex).name,
      cost: JAR_MATERIAL_COST,
      canBuy: quantity >= JAR_MATERIAL_COST,
    };
  });
}
