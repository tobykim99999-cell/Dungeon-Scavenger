import {
  GILDED_LOADOUT_KEY,
  GILDED_VAULT_KEY,
  TOWN_LOADOUT_KEY,
} from './gilding';
import { HEROIC_UNLOCK_KEY } from './heroic';
import { MATERIAL_VAULT_KEY } from './materials';
import { REGION_PROGRESS_KEY } from './regions';

export const SAVE_BACKUP_FORMAT = 'abyss-scavenger-save';
export const SAVE_BACKUP_VERSION = 1;

export const SAVE_STORAGE_KEYS = [
  'abyss-banked-gold',
  GILDED_LOADOUT_KEY,
  GILDED_VAULT_KEY,
  TOWN_LOADOUT_KEY,
  MATERIAL_VAULT_KEY,
  REGION_PROGRESS_KEY,
  HEROIC_UNLOCK_KEY,
] as const;

export type SaveStorageKey = (typeof SAVE_STORAGE_KEYS)[number];

export interface SaveBackup {
  format: typeof SAVE_BACKUP_FORMAT;
  version: typeof SAVE_BACKUP_VERSION;
  exportedAt: string;
  data: Record<SaveStorageKey, string | null>;
}

export function createSaveBackup(storage: Pick<Storage, 'getItem'>, exportedAt = new Date()): SaveBackup {
  const data = Object.fromEntries(
    SAVE_STORAGE_KEYS.map((key) => [key, storage.getItem(key)]),
  ) as Record<SaveStorageKey, string | null>;

  return {
    format: SAVE_BACKUP_FORMAT,
    version: SAVE_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data,
  };
}

export function parseSaveBackup(value: unknown): SaveBackup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SaveBackup>;
  if (
    candidate.format !== SAVE_BACKUP_FORMAT ||
    candidate.version !== SAVE_BACKUP_VERSION ||
    typeof candidate.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.exportedAt)) ||
    !candidate.data ||
    typeof candidate.data !== 'object'
  ) {
    return null;
  }

  const rawData = candidate.data as Record<string, unknown>;
  const data = {} as Record<SaveStorageKey, string | null>;
  for (const key of SAVE_STORAGE_KEYS) {
    const storedValue = rawData[key];
    if (storedValue !== null && typeof storedValue !== 'string') return null;
    data[key] = storedValue;
  }

  return {
    format: SAVE_BACKUP_FORMAT,
    version: SAVE_BACKUP_VERSION,
    exportedAt: candidate.exportedAt,
    data,
  };
}

export function restoreSaveBackup(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  backup: SaveBackup,
): void {
  for (const key of SAVE_STORAGE_KEYS) {
    const value = backup.data[key];
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  }
}
