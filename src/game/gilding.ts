import type { Equipment, Item } from './types';
import { equipmentStorageId, getEquipmentTier } from './equipment';

export const GILDED_LOADOUT_KEY = 'abyss-gilded-loadout';
export const GILDED_VAULT_KEY = 'abyss-gilded-vault';
export const TOWN_LOADOUT_KEY = 'abyss-town-loadout';
export const ESCAPE_SCROLL_FLOOR_CHANCE = 0.35;

export interface GildedLoadout {
  weapon?: Equipment;
  armor?: Equipment;
}

export interface VaultEquipment extends Equipment {
  id: string;
  type: 'weapon' | 'armor';
}

export interface TownLoadoutSelection {
  weaponId?: string;
  armorId?: string;
}

export interface PendingGildedEquipment extends Equipment {
  type: 'weapon' | 'armor';
}

export interface GildedMergeResult {
  vault: VaultEquipment[];
  added: VaultEquipment[];
  carried: VaultEquipment[];
}

export interface VaultDeletionResult {
  vault: VaultEquipment[];
  loadout: TownLoadoutSelection;
  deleted?: VaultEquipment;
}

export function chooseAltarFloors(blockStart: number, random: () => number): number[] {
  if (!Number.isInteger(blockStart) || blockStart < 1 || (blockStart - 1) % 10 !== 0) {
    throw new Error('Altar floor blocks must start at 1, 11, 21, and so on.');
  }

  const floors = Array.from({ length: 10 }, (_, index) => blockStart + index);
  for (let index = floors.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [floors[index], floors[other]] = [floors[other], floors[index]];
  }

  const count = random() < 0.35 ? 1 : 2;
  return floors.slice(0, count).sort((a, b) => a - b);
}

export function chooseEscapeScrollFloor(blockStart: number, random: () => number): number {
  if (!Number.isInteger(blockStart) || blockStart < 1 || (blockStart - 1) % 10 !== 0) {
    throw new Error('Escape scroll blocks must start at 1, 11, 21, and so on.');
  }
  return blockStart + Math.floor(random() * 10);
}

export function shouldPlaceEscapeScroll(
  floor: number,
  selectedFloor: number,
  hasScroll: boolean,
  recoveryRoll: number,
): boolean {
  if (hasScroll) return false;
  if (floor === selectedFloor) return true;
  return recoveryRoll < ESCAPE_SCROLL_FLOOR_CHANCE;
}

export function parseGildedLoadout(value: string | null): GildedLoadout {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Partial<Record<'weapon' | 'armor', unknown>>;
    return {
      weapon: parseEquipment(parsed.weapon),
      armor: parseEquipment(parsed.armor),
    };
  } catch {
    return {};
  }
}

export function parseGildedVault(value: string | null): VaultEquipment[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Partial<VaultEquipment>;
      if (
        typeof candidate.id !== 'string' ||
        (candidate.type !== 'weapon' && candidate.type !== 'armor') ||
        typeof candidate.name !== 'string' ||
        typeof candidate.power !== 'number'
      ) {
        return [];
      }
      return [{
        id: candidate.id,
        type: candidate.type,
        name: candidate.name,
        power: candidate.power,
        rarity: candidate.rarity ?? 'common',
        gilded: true,
        tier: parseEquipmentTier(candidate.tier),
        affixes: parseAffixes(candidate.affixes),
        setId: candidate.setId,
        setName: candidate.setName,
        setBonus: parseAffix(candidate.setBonus),
        ...parseEnhancementLevel(candidate.enhancementLevel),
      }];
    });
  } catch {
    return [];
  }
}

export function parseTownLoadout(value: string | null): TownLoadoutSelection {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<TownLoadoutSelection>;
    return {
      weaponId: typeof parsed.weaponId === 'string' ? parsed.weaponId : undefined,
      armorId: typeof parsed.armorId === 'string' ? parsed.armorId : undefined,
    };
  } catch {
    return {};
  }
}

export function mergeGildedEquipment(
  vault: VaultEquipment[],
  pending: GildedLoadout,
): GildedMergeResult {
  const entries = (['weapon', 'armor'] as const).flatMap((type) => {
    const equipment = pending[type];
    return equipment ? [{ ...equipment, type }] : [];
  });
  return mergePendingGildedEquipment(vault, entries);
}

export function mergePendingGildedEquipment(
  vault: VaultEquipment[],
  pending: PendingGildedEquipment[],
): GildedMergeResult {
  const next = [...vault];
  const added: VaultEquipment[] = [];
  const carried: VaultEquipment[] = [];

  for (const equipment of pending) {
    const { type } = equipment;
    const id = equipmentStorageId(type, equipment);
    const existing = next.find((item) => item.id === id);
    if (existing) {
      if (!carried.some((item) => item.id === existing.id)) carried.push(existing);
      continue;
    }
    const item: VaultEquipment = {
      ...equipment,
      id,
      type,
      gilded: true,
      tier: getEquipmentTier(equipment),
      affixes: equipment.affixes?.map((affix) => ({ ...affix })) ?? [],
      setId: equipment.setId,
      setName: equipment.setName,
      setBonus: equipment.setBonus ? { ...equipment.setBonus } : undefined,
    };
    next.push(item);
    added.push(item);
    carried.push(item);
  }

  return { vault: next, added, carried };
}

export function equipmentMatchesItem(equipment: Equipment | undefined, item: Item): boolean {
  return Boolean(equipment && (item.type === 'weapon' || item.type === 'armor')) &&
    equipmentStorageId(item.type as 'weapon' | 'armor', equipment!) === equipmentStorageId(item.type as 'weapon' | 'armor', item);
}

export function canGildEquipment(equipment: Pick<Equipment, 'gilded' | 'vaultId' | 'tier'>): boolean {
  return !equipment.vaultId && getEquipmentTier(equipment) === 'common';
}

export function deleteVaultEquipment(
  vault: VaultEquipment[],
  loadout: TownLoadoutSelection,
  targetId: string,
): VaultDeletionResult {
  const deleted = vault.find((item) => item.id === targetId);
  if (!deleted) return { vault: [...vault], loadout: { ...loadout } };

  const nextLoadout = { ...loadout };
  if (nextLoadout.weaponId === targetId) delete nextLoadout.weaponId;
  if (nextLoadout.armorId === targetId) delete nextLoadout.armorId;
  return {
    vault: vault.filter((item) => item.id !== targetId),
    loadout: nextLoadout,
    deleted,
  };
}

function parseEquipment(value: unknown): Equipment | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Equipment>;
  if (typeof candidate.name !== 'string' || typeof candidate.power !== 'number') return undefined;

  return {
    name: candidate.name,
    power: candidate.power,
    rarity: candidate.rarity ?? 'common',
    gilded: true,
    tier: parseEquipmentTier(candidate.tier),
    affixes: parseAffixes(candidate.affixes),
    setId: candidate.setId,
    setName: candidate.setName,
    setBonus: parseAffix(candidate.setBonus),
    ...parseEnhancementLevel(candidate.enhancementLevel),
  };
}

function parseAffixes(value: unknown): Equipment['affixes'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const affix = parseAffix(entry);
    return affix ? [affix] : [];
  });
}

function parseEquipmentTier(value: unknown): NonNullable<Equipment['tier']> {
  return value === 'common' || value === 'gold' || value === 'dark-gold' || value === 'purple'
    ? value
    : 'gold';
}

function parseEnhancementLevel(value: unknown): Pick<Equipment, 'enhancementLevel'> {
  if (typeof value !== 'number' || !Number.isFinite(value)) return {};
  const enhancementLevel = Math.max(0, Math.floor(value));
  return enhancementLevel > 0 ? { enhancementLevel } : {};
}

function parseAffix(value: unknown): Equipment['setBonus'] {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<NonNullable<Equipment['setBonus']>>;
  const validStats = ['attack', 'defense', 'maxHp', 'crit', 'bleed'];
  if (
    !validStats.includes(candidate.stat ?? '') ||
    typeof candidate.value !== 'number' ||
    typeof candidate.label !== 'string'
  ) {
    return undefined;
  }
  return { stat: candidate.stat!, value: candidate.value, label: candidate.label };
}
