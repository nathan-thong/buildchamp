import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getChampionSnapshot } from '../data/snapshot-registry';
import type { ChampionSnapshot } from '../data/snapshot-schema';
import {
  createRun,
  createSeededRandom,
  lockSelection,
  selectionForSlot,
  type Completion,
} from '../domain/draft-engine';
import { encodeShareResult } from '../domain/share-codec';
import { ResultPage } from './ResultPage';

function completeSnapshot(snapshot: ChampionSnapshot, seed: number): Completion {
  let state = createRun(snapshot, createSeededRandom(seed));
  const random = createSeededRandom(seed + 1);

  for (let lock = 0; lock < 6; lock += 1) {
    if (state.status !== 'drafting') {
      throw new Error('The snapshot completed before all six locks.');
    }

    const slot = state.offer.selectableSlots[0];
    if (!slot) {
      throw new Error('The snapshot should expose a selectable slot.');
    }

    state = lockSelection(snapshot, state, selectionForSlot(state.offer, slot), random);
  }

  if (state.status !== 'complete') {
    throw new Error('The snapshot did not complete after six locks.');
  }

  return state.completion;
}

describe('ResultPage', () => {
  it('renders a shared build from its URL without local recovery state', () => {
    const snapshot = getChampionSnapshot('16.17.1');
    if (!snapshot) {
      throw new Error('The current snapshot should be registered.');
    }

    const completion = completeSnapshot(snapshot, 21);
    render(<ResultPage payload={encodeShareResult(completion)} />);

    expect(screen.getByRole('heading', { name: 'Your composite champion' })).toBeInTheDocument();
    expect(screen.getByText('Patch 16.17.1')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Copy result link' })).toBeInTheDocument();
  });

  it('renders a retained historical snapshot named by the shared payload', () => {
    const snapshot = getChampionSnapshot('15.17.1');
    if (!snapshot) {
      throw new Error('The historical snapshot should be registered.');
    }

    const completion = completeSnapshot(snapshot, 22);
    render(<ResultPage payload={encodeShareResult(completion)} />);

    expect(screen.getByText('Patch 15.17.1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your composite champion' })).toBeInTheDocument();
  });

  it('explains malformed and unavailable result links', () => {
    const snapshot = getChampionSnapshot('16.17.1');
    if (!snapshot) {
      throw new Error('The current snapshot should be registered.');
    }

    const completion = completeSnapshot(snapshot, 23);
    const unavailableSnapshotPayload = encodeShareResult({
      snapshotVersion: '99.99.99',
      build: completion.build,
    });

    const malformed = render(<ResultPage payload="not-a-share-link" />);
    expect(screen.getByRole('heading', { name: 'Result not available' })).toBeInTheDocument();

    malformed.unmount();
    render(<ResultPage payload={unavailableSnapshotPayload} />);
    expect(
      screen.getByRole('heading', { name: 'Result needs an older snapshot' }),
    ).toBeInTheDocument();
  });
});
