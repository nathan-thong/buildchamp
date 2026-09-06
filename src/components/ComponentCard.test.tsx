import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { Component } from '../data/snapshot-schema';
import { NORMAL_DRAFT_FIXTURE } from '../domain/draft-engine-fixtures';
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

const CONDITIONAL_COMPONENT: Component = {
  ...RANKED_COOLDOWN_COMPONENT,
  id: 'test:conditional:q',
  name: 'Conditional ability',
  availability: {
    status: 'conditional',
    ruleId: 'needs-target',
    summary: 'Only while a target is nearby.',
  },
};

const UNAVAILABLE_COMPONENT: Component = {
  ...RANKED_COOLDOWN_COMPONENT,
  id: 'test:unavailable:q',
  name: 'Unavailable ability',
  shortDescription: 'Requires the original kit.',
  fullDescription: 'This ability cannot function without the original kit.',
  availability: {
    status: 'unavailable',
    reasonCode: 'requires-original-kit',
    summary: 'Requires original kit.',
  },
};

describe('ComponentCard', () => {
  it('keeps ranked values in a popup and exposes a unique disclosure relationship', async () => {
    const user = userEvent.setup();

    function StatefulCard() {
      const [detailsOpen, setDetailsOpen] = useState(false);

      return (
        <ComponentCard
          component={RANKED_COOLDOWN_COMPONENT}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          slot="q"
          state="selectable"
        />
      );
    }

    render(<StatefulCard />);

    const disclosure = screen.getByRole('button', { name: 'Full details for Ranked cooldown' });
    const detailsId = disclosure.getAttribute('aria-controls');
    const details = document.getElementById(detailsId!);

    expect(detailsId).toBeTruthy();
    expect(details).toHaveAttribute('hidden');
    expect(details).toHaveAttribute('role', 'dialog');
    expect(screen.getByText('14 → 10 s')).toBeInTheDocument();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(details).not.toHaveAttribute('hidden');
    expect(screen.getByRole('dialog', { name: 'Details for Ranked cooldown' })).toBeVisible();
    expect(screen.getByText('14 / 13 / 12 / 11 / 10 s')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close details for Ranked cooldown' }));

    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(details).toHaveAttribute('hidden');
  });

  it('shows the snapshot condition without adding a portable badge', () => {
    render(<ComponentCard component={CONDITIONAL_COMPONENT} slot="q" state="selectable" />);

    expect(screen.getByText('Conditional: Only while a target is nearby.')).toBeInTheDocument();
    expect(screen.queryByText('Portable')).not.toBeInTheDocument();
  });

  it('renders unavailable components as non-selectable with their reason', () => {
    render(<ComponentCard component={UNAVAILABLE_COMPONENT} slot="q" state="unavailable" />);

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('Requires original kit.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unavailable ability/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Portable')).not.toBeInTheDocument();
  });

  it('exposes full body metrics in the popup', () => {
    const bodyComponent = NORMAL_DRAFT_FIXTURE.champions[0]!.variants[0]!.components.body;
    render(
      <ComponentCard
        component={bodyComponent}
        detailsOpen
        onToggleDetails={() => undefined}
        slot="body"
        state="locked"
      />,
    );

    expect(screen.getByRole('dialog', { name: /details for/i })).toBeVisible();
    expect(screen.getByLabelText('Full body stats')).toBeInTheDocument();
    expect(screen.getByText('Attack type')).toBeInTheDocument();
    expect(screen.getAllByText('Health')).toHaveLength(2);
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getAllByText('Health regen')).toHaveLength(2);
  });

  it('can render the read-only details presentation independently', () => {
    render(<ComponentDetailsPanel component={RANKED_COOLDOWN_COMPONENT} />);

    expect(
      screen.getByText('A test ability with a cooldown that changes by rank.'),
    ).toBeInTheDocument();
  });
});
