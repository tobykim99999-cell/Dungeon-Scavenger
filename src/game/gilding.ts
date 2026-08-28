import type { Equipment, Item } from './types';

export const GILDED_LOADOUT_KEY = 'abyss-gilded-loadout';
export const GILDED_VAULT_KEY = 'abyss-gilded-vault';
export const TOWN_LOADOUT_KEY = 'abyss-town-loadout';
export const ESCAPE_SCROLL_RECOVERY_CHANCE = 0.2;

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
  return floor > selectedFloor && recoveryRoll < ESCAPE_SCROLL_RECOVERY_CHANCE;
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
): { vault: VaultEquipment[]; added: VaultEquipment[] } {
  const next = [...vault];
  const added: VaultEquipment[] = [];

  for (const type of ['weapon', 'armor'] as const) {
    const equipment = pending[type];
    if (!equipment) continue;
    const id = `${type}|${equipment.name}|${equipment.power}|${equipment.rarity ?? 'common'}`;
    const existing = next.find((item) => item.id === id);
    if (existing) continue;
    const item: VaultEquipment = { ...equipment, id, type, gilded: true };
    next.push(item);
    added.push(item);
  }

  return { vault: next, added };
}

export function equipmentMatchesItem(equipment: Equipment | undefined, item: Item): boolean {
  return Boolean(
    equipment &&
    (item.type === 'weapon' || item.type === 'armor') &&
    equipment.name === item.name &&
    equipment.power === item.power &&
    (equipment.rarity ?? 'common') === item.rarity,
  );
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
  };
}
