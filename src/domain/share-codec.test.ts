import { describe, expect, it } from 'vitest';

import { NORMAL_DRAFT_FIXTURE } from './draft-engine-fixtures';
import {
  createRun,
  createSeededRandom,
  lockSelection,
  selectionForSlot,
  type Completion,
} from './draft-engine';
import {
  createSharePath,
  decodeShareResult,
  encodeShareResult,
  MAX_SHARE_PAYLOAD_LENGTH,
} from './share-codec';

function completeFixture(): Completion {
  let state = createRun(NORMAL_DRAFT_FIXTURE, createSeededRandom(13));
  const random = createSeededRandom(14);

  for (let lock = 0; lock < 6; lock += 1) {
    if (state.status !== 'drafting') {
      throw new Error('The fixture completed before all six locks.');
    }

    const slot = state.offer.selectableSlots[0];
    if (!slot) {
      throw new Error('The fixture should expose a selectable slot.');
    }

    state = lockSelection(NORMAL_DRAFT_FIXTURE, state, selectionForSlot(state.offer, slot), random);
  }

  if (state.status !== 'complete') {
    throw new Error('The fixture did not complete after six locks.');
  }

  return state.completion;
}

describe('share result codec', () => {
  it('round trips only the pinned identifiers for every slot', () => {
    const completion = completeFixture();
    const encoded = encodeShareResult(completion);

    expect(encoded).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThanOrEqual(MAX_SHARE_PAYLOAD_LENGTH);
    expect(createSharePath(completion)).toBe(`/build/${encoded}`);

    const decoded = decodeShareResult(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }

    expect(decoded.value.snapshotVersion).toBe(completion.snapshotVersion);
    for (const slot of ['body', 'q', 'w', 'e', 'r', 'passive'] as const) {
      expect(decoded.value.build[slot]).toEqual({
        championId: completion.build[slot].championId,
        variantId: completion.build[slot].variantId,
        slot,
        componentId: completion.build[slot].componentId,
      });
    }
  });

  it('rejects malformed, oversized, and unsupported payloads', () => {
    expect(decodeShareResult('demo')).toEqual({ ok: false, reason: 'malformed' });
    expect(decodeShareResult('v1.not-base64-json')).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(decodeShareResult('v2.eyJ2IjoyfQ')).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
    expect(decodeShareResult(`v1.${'a'.repeat(MAX_SHARE_PAYLOAD_LENGTH)}`)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});
