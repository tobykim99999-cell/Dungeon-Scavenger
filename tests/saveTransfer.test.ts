import { describe, expect, it } from 'vitest';
import {
  SAVE_BACKUP_FORMAT,
  SAVE_BACKUP_VERSION,
  SAVE_STORAGE_KEYS,
  createSaveBackup,
  parseSaveBackup,
  restoreSaveBackup,
} from '../src/game/saveTransfer';

function createMemoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe('save transfer', () => {
  it('exports only the owned persistent save keys', () => {
    const storage = createMemoryStorage({
      'abyss-banked-gold': '860',
      'unrelated-setting': 'keep-private',
    });
    const backup = createSaveBackup(storage, new Date('2026-09-04T08:00:00.000Z'));

    expect(backup).toEqual({
      format: SAVE_BACKUP_FORMAT,
      version: SAVE_BACKUP_VERSION,
      exportedAt: '2026-09-04T08:00:00.000Z',
      data: Object.fromEntries(SAVE_STORAGE_KEYS.map((key) => [
        key,
        key === 'abyss-banked-gold' ? '860' : null,
      ])),
    });
    expect(JSON.stringify(backup)).not.toContain('keep-private');
  });

  it('rejects malformed or incompatible backups', () => {
    expect(parseSaveBackup(null)).toBeNull();
    expect(parseSaveBackup({ format: SAVE_BACKUP_FORMAT, version: 99 })).toBeNull();
    expect(parseSaveBackup({
      format: SAVE_BACKUP_FORMAT,
      version: SAVE_BACKUP_VERSION,
      exportedAt: 'not-a-date',
      data: {},
    })).toBeNull();
  });

  it('restores all owned keys without touching unrelated storage', () => {
    const source = createMemoryStorage({
      'abyss-banked-gold': '860',
      'abyss-highest-unlocked-region': '3',
    });
    const backup = createSaveBackup(source, new Date('2026-09-04T08:00:00.000Z'));
    const target = createMemoryStorage({
      'abyss-banked-gold': '10',
      'abyss-gilded-vault': '[{"old":true}]',
      'unrelated-setting': 'unchanged',
    });

    restoreSaveBackup(target, backup);

    expect(target.values.get('abyss-banked-gold')).toBe('860');
    expect(target.values.get('abyss-highest-unlocked-region')).toBe('3');
    expect(target.values.has('abyss-gilded-vault')).toBe(false);
    expect(target.values.get('unrelated-setting')).toBe('unchanged');
  });
});
