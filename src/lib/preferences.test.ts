import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  writePreferences,
} from './preferences';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('preferences storage boundary', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('returns defaults when no preference exists', () => {
    expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
  });

  it('round trips validated mute preferences', () => {
    writePreferences({ version: 1, muted: true }, storage);

    expect(readPreferences(storage)).toEqual({ version: 1, muted: true });
  });

  it('discards corrupt, obsolete, and structurally invalid values', () => {
    const invalidValues = ['not-json', '{"version":1}', '{"version":2,"muted":true}'];

    for (const value of invalidValues) {
      storage.setItem(PREFERENCES_STORAGE_KEY, value);
      expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    }
  });
});
