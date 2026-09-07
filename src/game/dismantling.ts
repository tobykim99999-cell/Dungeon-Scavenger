import { equipmentStorageId, getEquipmentTier, getEnhancementLevel } from './equipment';
import {
  deleteVaultEquipment,
  GILDED_LOADOUT_KEY,
  GILDED_VAULT_KEY,
  TOWN_LOADOUT_KEY,
  parseGildedLoadout,
  parseGildedVault,
  parseTownLoadout,
} from './gilding';
import type { Equipment } from './types';

export const REFINED_MATERIAL_VAULT_KEY = 'abyss-refined-material-vault';

export type RefinedMaterialType = 'metal-fragment' | 'dark-gold-core' | 'set-fragment';

export interface RefinedMaterialBalance {
  type: RefinedMaterialType;
  name: string;
  quantity: number;
}

const REFINED_MATERIAL_NAMES: Record<RefinedMaterialType, string> = {
  'metal-fragment': '金属碎片',
  'dark-gold-core': '暗金核心',
  'set-fragment': '套装碎片',
};

export function getRefinedMaterialName(type: RefinedMaterialType): string {
  return REFINED_MATERIAL_NAMES[type];
}

export function getDismantleReward(equipment: Pick<Equipment, 'power' | 'tier' | 'gilded' | 'enhancementLevel'>): RefinedMaterialBalance | null {
  const tier = getEquipmentTier(equipment);
  if (tier === 'common' || !Number.isFinite(equipment.power) || equipment.power < 0) return null;
  const level = getEnhancementLevel(equipment);
  if (tier === 'purple') {
    return {
      type: 'set-fragment',
      name: REFINED_MATERIAL_NAMES['set-fragment'],
      quantity: 3 + Math.ceil(Math.max(1, equipment.power) / 10) + Math.floor(level / 3),
    };
  }
  if (tier === 'dark-gold') {
    return {
      type: 'dark-gold-core',
      name: REFINED_MATERIAL_NAMES['dark-gold-core'],
      quantity: 2 + Math.ceil(Math.max(1, equipment.power) / 10) + Math.floor(level / 3),
    };
  }
  return {
    type: 'metal-fragment',
    name: REFINED_MATERIAL_NAMES['metal-fragment'],
    quantity: 5 + Math.ceil(Math.max(1, equipment.power) / 6) + Math.floor(level / 2),
  };
}

export function parseRefinedMaterials(value: string | null): RefinedMaterialBalance[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const balances: RefinedMaterialBalance[] = parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Partial<RefinedMaterialBalance>;
      if (
        (candidate.type !== 'metal-fragment' && candidate.type !== 'dark-gold-core' && candidate.type !== 'set-fragment') ||
        typeof candidate.quantity !== 'number' ||
        !Number.isSafeInteger(candidate.quantity) ||
        candidate.quantity <= 0
      ) return [];
      return [{
        type: candidate.type,
        name: REFINED_MATERIAL_NAMES[candidate.type],
        quantity: Math.floor(candidate.quantity),
      }];
    });
    return mergeRefinedMaterials([], balances);
  } catch {
    return [];
  }
}

export function mergeRefinedMaterials(
  stored: RefinedMaterialBalance[],
  incoming: RefinedMaterialBalance[],
): RefinedMaterialBalance[] {
  const quantities = new Map<RefinedMaterialType, number>();
  for (const material of [...stored, ...incoming]) {
    if (!Number.isSafeInteger(material.quantity) || material.quantity <= 0) continue;
    const quantity = (quantities.get(material.type) ?? 0) + material.quantity;
    if (!Number.isSafeInteger(quantity)) throw new Error('分解材料数量超出上限。');
    quantities.set(
      material.type,
      quantity,
    );
  }
  return [...quantities.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([type, quantity]) => ({ type, name: REFINED_MATERIAL_NAMES[type], quantity }));
}

export function dismantleStoredEquipment(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  targetId: string,
) {
  const keys = [GILDED_VAULT_KEY, TOWN_LOADOUT_KEY, REFINED_MATERIAL_VAULT_KEY, GILDED_LOADOUT_KEY];
  const previous = keys.map((key) => storage.getItem(key));
  const vault = parseGildedVault(previous[0]);
  const loadout = parseTownLoadout(previous[1]);
  const equipment = vault.find((item) => item.id === targetId);
  if (!equipment) return null;
  const reward = getDismantleReward(equipment);
  if (!reward) return null;

  const result = deleteVaultEquipment(vault, loadout, targetId);
  const materials = mergeRefinedMaterials(parseRefinedMaterials(previous[2]), [reward]);
  // Remove the migrated copy too, so an old save cannot resurrect the dismantled item.
  const legacy = parseGildedLoadout(previous[3]);
  const legacyEquipment = legacy[equipment.type];
  if (legacyEquipment && equipmentStorageId(equipment.type, legacyEquipment) === targetId) {
    delete legacy[equipment.type];
  }
  const values = [
    JSON.stringify(result.vault),
    JSON.stringify(result.loadout),
    JSON.stringify(materials),
    previous[3] === null ? null : JSON.stringify(legacy),
  ];
  const written: number[] = [];
  try {
    for (const [index, key] of keys.entries()) {
      if (values[index] === previous[index]) continue;
      if (values[index] === null) storage.removeItem(key);
      else storage.setItem(key, values[index]!);
      written.push(index);
    }
  } catch (error) {
    for (const index of written.reverse()) {
      if (previous[index] === null) storage.removeItem(keys[index]);
      else storage.setItem(keys[index], previous[index]!);
    }
    throw error;
  }
  return { vault: result.vault, loadout: result.loadout, materials, reward, equipment };
}
