import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Component } from '../data/snapshot-schema';
import { ComponentCard, ComponentDetailsPanel } from './ComponentCard';

const RANKED_COOLDOWN_COMPONENT: Component = {
  id: 'test:ranked-cooldown:q',
  slot: 'q',
  name: 'Ranked cooldown',
  iconRef: 'https://example.com/icon.png',
  shortDescription: 'A test ability with a cooldown that changes by rank.',
  fullDescription: 'A test ability with a cooldown that changes by rank.',
  cooldown: { label: 'Ranked cooldown — Cooldown', values: [14, 13, 12, 11, 10] },
  cooldowns: [{ label: 'Ranked cooldown — Cooldown', values: [14, 13, 12, 11, 10] }],
  values: [],
  availability: { status: 'available' },
  dependencies: [],
  carriedMechanics: [],
  sourceRefs: ['https://example.com/source'],
};

describe('ComponentCard', () => {
  it('summarizes ranked cooldowns compactly and preserves every rank in full details', () => {
    render(
      <>
        <ComponentCard
          component={RANKED_COOLDOWN_COMPONENT}
          onToggleDetails={() => undefined}
          slot="q"
          state="selectable"
        />
        <ComponentDetailsPanel component={RANKED_COOLDOWN_COMPONENT} />
      </>,
    );

    expect(screen.getByText('14 → 10 s')).toBeInTheDocument();
    expect(screen.getByText('14 / 13 / 12 / 11 / 10 s')).toBeInTheDocument();
  });
});
