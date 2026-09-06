import { describe, expect, it } from 'vitest';

import {
  createRun,
  createSeededRandom,
  lockSelection,
  selectionForSlot,
} from '../domain/draft-engine';
import { NORMAL_DRAFT_FIXTURE } from '../domain/draft-engine-fixtures';
import { clearSoloRun, readSoloRun, SOLO_RUN_STORAGE_KEY, writeSoloRun } from './solo-run-storage';

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

describe('solo run storage boundary', () => {
  it('round trips an active run from compact references', () => {
    const storage = new MemoryStorage();
    const initial = createRun(NORMAL_DRAFT_FIXTURE, createSeededRandom(8));
    const slot = initial.offer.selectableSlots[0];
    if (!slot) {
      throw new Error('Fixture should expose a selectable slot.');
    }
    const state = lockSelection(
      NORMAL_DRAFT_FIXTURE,
      initial,
      selectionForSlot(initial.offer, slot),
      createSeededRandom(9),
    );

    if (state.status !== 'drafting') {
      throw new Error('The fixture should not complete after one lock.');
    }

    writeSoloRun(state, storage);
    const restored = readSoloRun(NORMAL_DRAFT_FIXTURE, storage);

    expect(restored?.round).toBe(state.round);
    expect(restored?.lockedBuild).toEqual(state.lockedBuild);
    expect(restored?.offer.id).toBe(state.offer.id);
    expect(restored?.offer.champion.name).toBe(state.offer.champion.name);
  });

  it('discards malformed, obsolete, and illegal stored runs', () => {
    const storage = new MemoryStorage();
    const invalidValues = [
      'not-json',
      '{"schemaVersion":1}',
      JSON.stringify({
        schemaVersion: 1,
        snapshotVersion: 'old-version',
        round: 0,
        usedChampionIds: [],
        lockedBuild: {},
        picks: [],
        offer: { id: 'missing::offer', championId: 'missing', variantId: 'offer' },
      }),
    ];

    for (const value of invalidValues) {
      storage.setItem(SOLO_RUN_STORAGE_KEY, value);
      expect(readSoloRun(NORMAL_DRAFT_FIXTURE, storage)).toBeNull();
      expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toBeNull();
    }
  });

  it('clears an active run when a new run starts', () => {
    const storage = new MemoryStorage();
    storage.setItem(SOLO_RUN_STORAGE_KEY, 'stored');

    clearSoloRun(storage);

    expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toBeNull();
  });
});
