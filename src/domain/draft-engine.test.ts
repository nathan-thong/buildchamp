import { describe, expect, it } from 'vitest';

import snapshotArtifact from '../data/snapshots/16.17.1.json';
import { validateChampionSnapshot } from '../data/snapshot-pipeline.ts';

import {
  autopick,
  createRun,
  createSeededRandom,
  currentRound,
  DRAFT_SLOT_ORDER,
  freshRematch,
  getLegalOffers,
  hasLegalContinuation,
  hasLegalContinuationAfterSelection,
  lockFinalChoice,
  lockSelection,
  selectionForSlot,
  type RandomSource,
  type RunState,
} from './draft-engine.ts';
import {
  ADVERSARIAL_DRAFT_FIXTURE,
  NORMAL_DRAFT_FIXTURE,
  RESTRICTED_DRAFT_FIXTURE,
  VARIANT_DRAFT_FIXTURE,
} from './draft-engine-fixtures.ts';

const SNAPSHOT = validateChampionSnapshot(snapshotArtifact);

describe('draft engine', () => {
  it('completes ordinary and restricted runs with every slot filled exactly once', () => {
    for (const fixture of [NORMAL_DRAFT_FIXTURE, RESTRICTED_DRAFT_FIXTURE]) {
      const completed = runToCompletion(fixture, createSeededRandom(42));

      expect(completed.status).toBe('complete');
      expect(completed.round).toBe(6);
      expect(completed.completion?.picks).toHaveLength(6);
      expect(Object.keys(completed.completion?.build ?? {}).sort()).toEqual(
        [...DRAFT_SLOT_ORDER].sort(),
      );
      expect(new Set(completed.usedChampionIds).size).toBe(6);
    }
  });

  it('replays the same run from the same injected seed', () => {
    const first = runToCompletion(NORMAL_DRAFT_FIXTURE, createSeededRandom(1234));
    const second = runToCompletion(NORMAL_DRAFT_FIXTURE, createSeededRandom(1234));

    expect(first.picks).toEqual(second.picks);
    expect(first.completion).toEqual(second.completion);
  });

  it('keeps every pre-final offer selectable and completable', () => {
    let state = createRun(RESTRICTED_DRAFT_FIXTURE, createSeededRandom(7));

    while (state.status === 'drafting') {
      const minimumChoices = state.round < 5 ? 2 : 1;
      expect(state.offer.selectableComponents.length).toBeGreaterThanOrEqual(minimumChoices);
      expect(hasLegalContinuation(RESTRICTED_DRAFT_FIXTURE, state)).toBe(true);

      for (const slot of state.offer.selectableSlots) {
        expect(
          hasLegalContinuationAfterSelection(
            RESTRICTED_DRAFT_FIXTURE,
            state,
            selectionForSlot(state.offer, slot),
          ),
        ).toBe(true);
      }

      state = autopick(RESTRICTED_DRAFT_FIXTURE, state, createSeededRandom(state.round + 100));
    }
  });

  it('runs thousands of seeded ordinary drafts without invariant failures', () => {
    for (let seed = 1; seed <= 1_000; seed += 1) {
      const completed = runToCompletion(NORMAL_DRAFT_FIXTURE, createSeededRandom(seed));
      expect(completed.status).toBe('complete');
      expect(completed.completion?.picks).toHaveLength(6);
      expect(new Set(completed.usedChampionIds).size).toBe(6);
    }
  });

  it('uses one weight per base champion before selecting a variant', () => {
    const firstFormRun = createRun(VARIANT_DRAFT_FIXTURE, sequenceRandom([0.36, 0.99]));
    const firstPlainRun = createRun(VARIANT_DRAFT_FIXTURE, sequenceRandom([0.37]));

    expect(firstFormRun.offer.championId).toBe('form-champ');
    expect(firstFormRun.offer.variantId).toBe('form-champ-light');
    expect(firstPlainRun.offer.championId).toBe('plain-a');
    expect(
      getLegalOffers(VARIANT_DRAFT_FIXTURE, firstFormRun).filter(
        (offer) => offer.championId === 'form-champ',
      ),
    ).toHaveLength(2);
  });

  it('never repeats a base champion across variants', () => {
    for (let seed = 1; seed <= 250; seed += 1) {
      const completed = runToCompletion(VARIANT_DRAFT_FIXTURE, createSeededRandom(seed));
      const formPicks = completed.picks.filter((pick) => pick.championId === 'form-champ');

      expect(new Set(completed.usedChampionIds).size).toBe(6);
      expect(formPicks.length).toBeLessThanOrEqual(1);
    }
  });

  it('rejects the adversarial trap while preserving a legal run', () => {
    const initial = createRun(ADVERSARIAL_DRAFT_FIXTURE, createSeededRandom(3));
    const legalOffers = getLegalOffers(ADVERSARIAL_DRAFT_FIXTURE, initial);

    expect(hasLegalContinuation(ADVERSARIAL_DRAFT_FIXTURE, initial)).toBe(true);
    expect(legalOffers.map((offer) => offer.championId)).not.toContain('trap');
    expect(initial.offer.championId).not.toBe('trap');

    for (let seed = 1; seed <= 250; seed += 1) {
      const completed = runToCompletion(ADVERSARIAL_DRAFT_FIXTURE, createSeededRandom(seed));
      expect(completed.status).toBe('complete');
      expect(new Set(completed.usedChampionIds).size).toBe(6);
    }
  });

  it('forces the sole final component and starts rematches cleanly', () => {
    let state = createRun(NORMAL_DRAFT_FIXTURE, createSeededRandom(12));
    while (state.status === 'drafting' && state.round < 5) {
      state = autopick(NORMAL_DRAFT_FIXTURE, state, createSeededRandom(state.round + 1));
    }

    expect(state.status).toBe('drafting');
    expect(currentRound(state)).toBe(6);
    expect(state.offer.selectableComponents).toHaveLength(1);

    const completed = lockFinalChoice(NORMAL_DRAFT_FIXTURE, state);
    expect(completed.status).toBe('complete');
    expect(completed.completion?.build).toBeDefined();
    expect(() => lockFinalChoice(NORMAL_DRAFT_FIXTURE, completed)).toThrow(/active draft/i);

    const rematch = freshRematch(NORMAL_DRAFT_FIXTURE, createSeededRandom(99));
    expect(rematch.status).toBe('drafting');
    expect(rematch.round).toBe(0);
    expect(rematch.picks).toEqual([]);
    expect(rematch.usedChampionIds).toEqual([]);
  });

  it('validates current offers, open slots, and unavailable components at lock time', () => {
    const state = createRun(RESTRICTED_DRAFT_FIXTURE, createSeededRandom(4));
    const selectableSlot = state.offer.selectableSlots[0];
    if (!selectableSlot) {
      throw new Error('Fixture should expose a selectable slot.');
    }
    const selection = selectionForSlot(state.offer, selectableSlot);

    expect(() =>
      lockSelection(RESTRICTED_DRAFT_FIXTURE, state, {
        ...selection,
        offerId: 'stale-offer',
      }),
    ).toThrow(/current offer/i);

    const unavailableSlot = DRAFT_SLOT_ORDER.find(
      (slot) => state.offer.components[slot].availability.status === 'unavailable',
    );
    if (!unavailableSlot) {
      throw new Error('Restricted fixture should expose an unavailable component.');
    }

    expect(() => selectionForSlot(state.offer, unavailableSlot)).toThrow(
      /not selectable|unavailable/i,
    );
    expect(() => lockSelection(RESTRICTED_DRAFT_FIXTURE, state, selection)).not.toThrow();
  });

  it('completes the bundled snapshot without runtime data dependencies', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const completed = runToCompletion(SNAPSHOT, createSeededRandom(seed));
      expect(completed.status).toBe('complete');
      expect(completed.completion?.snapshotVersion).toBe('16.17.1');
      expect(completed.picks).toHaveLength(6);
      expect(new Set(completed.usedChampionIds).size).toBe(6);
    }
  }, 30_000);
});

function runToCompletion(
  snapshot: Parameters<typeof createRun>[0],
  random: RandomSource,
): RunState {
  let state: RunState = createRun(snapshot, random);
  while (state.status === 'drafting') {
    state = autopick(snapshot, state, random);
  }
  return state;
}

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}
