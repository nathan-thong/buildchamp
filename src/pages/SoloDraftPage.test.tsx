import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createSeededRandom } from '../domain/draft-engine';
import { NORMAL_DRAFT_FIXTURE, RESTRICTED_DRAFT_FIXTURE } from '../domain/draft-engine-fixtures';
import { SOLO_RUN_STORAGE_KEY } from '../lib/solo-run-storage';
import { SoloDraftPage } from './SoloDraftPage';

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

describe('solo gameplay', () => {
  it('keeps draft choices compact and exposes one expandable details panel', async () => {
    const user = userEvent.setup();
    render(<SoloDraftPage storage={new MemoryStorage()} random={createSeededRandom(3)} />);

    expect(screen.queryByRole('img', { name: /champion artwork/i })).not.toBeInTheDocument();
    expect(screen.getByText(/live snapshot/i)).toBeInTheDocument();
    expect(screen.queryByText(/example champion/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Full details')).toHaveLength(6);

    await user.click(screen.getAllByRole('button', { name: 'Full details' })[0]!);

    expect(screen.getByRole('region', { name: 'Expanded component details' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Expanded component details' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Hide details' })).toBeInTheDocument();
  });

  it('shows unavailable components without making them selectable', () => {
    render(
      <SoloDraftPage
        random={createSeededRandom(4)}
        snapshot={RESTRICTED_DRAFT_FIXTURE}
        storage={new MemoryStorage()}
      />,
    );

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requires original kit.').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: /unavailable/i })).toHaveLength(0);
  });

  it('requires a deliberate confirmation and restores a locked choice after remount', async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    const props = {
      random: createSeededRandom(6),
      snapshot: NORMAL_DRAFT_FIXTURE,
      storage,
    } as const;
    const first = render(<SoloDraftPage {...props} />);

    await user.click(screen.getByRole('button', { name: /01 \/ body/i }));
    const lockButton = screen.getByRole('button', { name: 'Lock Body' });
    await user.click(lockButton);

    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be changed/i);
    expect(screen.getByRole('button', { name: 'Confirm lock Body' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm lock Body' }));
    expect(screen.getByRole('listitem', { name: /body slot, locked/i })).toBeInTheDocument();
    expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toContain('"round":1');

    first.unmount();
    render(<SoloDraftPage {...props} />);

    expect(screen.getByRole('listitem', { name: /body slot, locked/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/round 2 of six/i)).toBeInTheDocument();
  });

  it('reveals the six-part build and starts Play Again with a fresh run', async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    render(
      <SoloDraftPage
        random={createSeededRandom(10)}
        snapshot={NORMAL_DRAFT_FIXTURE}
        storage={storage}
      />,
    );

    for (let lock = 0; lock < 6; lock += 1) {
      const choice = screen
        .getAllByRole('button')
        .find((button) => button.hasAttribute('data-choice-slot'));
      if (!choice) {
        throw new Error(`No component choice was available for lock ${lock + 1}.`);
      }

      const draftSlot = choice.getAttribute('data-choice-slot');
      const labels = {
        body: 'Body',
        q: 'Q',
        w: 'W',
        e: 'E',
        r: 'R',
        passive: 'Passive',
      } as const;
      const label = labels[draftSlot as keyof typeof labels];
      await user.click(choice);
      await user.click(screen.getByRole('button', { name: `Lock ${label}` }));
      await user.click(screen.getByRole('button', { name: `Confirm lock ${label}` }));
    }

    expect(screen.getByRole('heading', { name: 'Your composite champion' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByText(/six parts/i)).toBeInTheDocument();
    expect(screen.getByText(/no automated power score/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /play again/i }));

    expect(screen.getByRole('heading', { level: 1, name: 'Choose a slot' })).toBeInTheDocument();
    expect(screen.getByLabelText(/round 1 of six/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your composite champion' }),
    ).not.toBeInTheDocument();
    expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toContain('"round":0');
  });
});
