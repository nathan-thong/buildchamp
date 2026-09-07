import { fireEvent, render, screen } from '@testing-library/react';
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

class FailingStorage implements Storage {
  get length(): number {
    return 0;
  }

  clear(): void {
    // Nothing to clear.
  }

  getItem(): string | null {
    return null;
  }

  key(): string | null {
    return null;
  }

  removeItem(): void {
    // Nothing to remove.
  }

  setItem(): void {
    throw new Error('storage unavailable');
  }
}

const SLOT_LABELS = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
} as const;

function firstChoice(): HTMLButtonElement {
  const choice = document.querySelector<HTMLButtonElement>('button[data-choice-slot]');
  if (!choice) {
    throw new Error('No component choice was rendered.');
  }

  return choice;
}

async function completeRun(user: ReturnType<typeof userEvent.setup>) {
  for (let lock = 0; lock < 6; lock += 1) {
    const choice = firstChoice();
    const draftSlot = choice.dataset.choiceSlot as keyof typeof SLOT_LABELS;
    await user.click(choice);
    await user.click(
      screen.getByRole('button', { name: `Lock ${SLOT_LABELS[draftSlot]} permanently` }),
    );
  }
}

describe('solo gameplay', () => {
  it('opens one offer disclosure in a popup and restores the card layout on close', async () => {
    const user = userEvent.setup();
    render(<SoloDraftPage storage={new MemoryStorage()} random={createSeededRandom(3)} />);

    expect(screen.getByRole('heading', { name: 'Choose one part to keep.' })).toBeInTheDocument();
    expect(document.querySelector('.panel__status')).toHaveTextContent('Patch 16.17.1');
    expect(screen.getAllByRole('button', { name: /full details for/i })).toHaveLength(6);

    const firstDisclosure = screen.getAllByRole('button', { name: /full details for/i })[0]!;
    const secondDisclosure = screen.getAllByRole('button', { name: /full details for/i })[1]!;
    const firstDetailsId = firstDisclosure.getAttribute('aria-controls');

    expect(firstDetailsId).toBeTruthy();
    expect(document.getElementById(firstDetailsId!)).toHaveAttribute('hidden');

    await user.click(firstDisclosure);

    expect(firstDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(firstDetailsId!)).not.toHaveAttribute('hidden');
    expect(screen.getAllByRole('dialog', { name: /details for/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /close details for/i }));

    await user.click(secondDisclosure);

    expect(firstDisclosure).toHaveAttribute('aria-expanded', 'false');
    expect(secondDisclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('dialog', { name: /details for/i })).toHaveLength(1);
  });

  it('shows unavailable components without making them selectable or calling them portable', () => {
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
    expect(screen.queryByText('Portable')).not.toBeInTheDocument();
  });

  it('keeps selection provisional until one explicit lock and restores locked choices after remount', async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    const props = {
      random: createSeededRandom(6),
      snapshot: NORMAL_DRAFT_FIXTURE,
      storage,
    } as const;
    const first = render(<SoloDraftPage {...props} />);

    const bodyChoice = screen.getByRole('button', { name: /01 \/ body/i });
    await user.click(bodyChoice);
    expect(bodyChoice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lock Body permanently' })).toBeEnabled();

    const qChoice = screen.getByRole('button', { name: /02 \/ q/i });
    await user.click(qChoice);
    expect(bodyChoice).toHaveAttribute('aria-pressed', 'false');
    expect(qChoice).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Lock Q permanently' }));

    expect(screen.getByRole('listitem', { name: /q slot, locked/i })).toBeInTheDocument();
    expect(document.querySelector('.round-counter')).toHaveAccessibleName('Round 2 of six');
    expect(screen.getByRole('status')).toHaveTextContent(
      /Q locked permanently\. New offer: (alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel)\. Round 2 of six/i,
    );
    expect(screen.queryByRole('button', { name: /confirm lock/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a component' })).toBeDisabled();
    expect(document.activeElement).toHaveTextContent('Choose one part to keep.');
    expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toContain('"round":1');

    first.unmount();
    render(<SoloDraftPage {...props} />);

    expect(screen.getByRole('listitem', { name: /q slot, locked/i })).toBeInTheDocument();
    expect(document.querySelector('.round-counter')).toHaveAccessibleName('Round 2 of six');
    expect(screen.getByRole('status')).toHaveTextContent(/draft restored/i);
  });

  it('keeps the draft playable and explains when recovery storage is unavailable', async () => {
    const user = userEvent.setup();
    render(
      <SoloDraftPage
        random={createSeededRandom(12)}
        snapshot={NORMAL_DRAFT_FIXTURE}
        storage={new FailingStorage()}
      />,
    );

    expect(screen.getByText(/could not save recovery/i)).toBeInTheDocument();

    const choice = firstChoice();
    const draftSlot = choice.dataset.choiceSlot as keyof typeof SLOT_LABELS;
    await user.click(choice);
    await user.click(
      screen.getByRole('button', { name: `Lock ${SLOT_LABELS[draftSlot]} permanently` }),
    );

    expect(screen.getByRole('heading', { name: 'Choose one part to keep.' })).toBeInTheDocument();
    expect(screen.getByText(/could not save recovery/i)).toBeInTheDocument();
  });

  it('guards rapid repeated lock activation and commits only once', () => {
    render(
      <SoloDraftPage
        random={createSeededRandom(7)}
        snapshot={NORMAL_DRAFT_FIXTURE}
        storage={new MemoryStorage()}
      />,
    );

    fireEvent.click(firstChoice());
    const lockButton = screen.getByRole('button', { name: /lock .* permanently/i });
    fireEvent.click(lockButton);
    fireEvent.click(lockButton);

    expect(document.querySelector('.round-counter')).toHaveAccessibleName('Round 2 of six');
    expect(screen.getAllByRole('listitem', { name: /locked/i })).toHaveLength(1);
  });

  it('reveals the six-part build, exposes every source, and starts Play Again fresh', async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    render(
      <SoloDraftPage
        random={createSeededRandom(10)}
        snapshot={NORMAL_DRAFT_FIXTURE}
        storage={storage}
      />,
    );

    await completeRun(user);

    expect(screen.getByRole('heading', { name: 'Your composite champion' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Composite ability icons' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Composite ability icons' }).querySelectorAll('img'),
    ).toHaveLength(5);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /full details for/i })).toHaveLength(6);
    expect(
      screen.getAllByText(/from (alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel)/i),
    ).not.toHaveLength(0);
    expect(screen.queryByText(/no score/i)).not.toBeInTheDocument();

    const firstDetailsButton = screen.getAllByRole('button', { name: /full details for/i })[0]!;
    await user.click(firstDetailsButton);
    expect(screen.getAllByRole('dialog', { name: /details for/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /play again/i }));

    expect(screen.getByRole('heading', { name: 'Choose one part to keep.' })).toBeInTheDocument();
    expect(document.querySelector('.round-counter')).toHaveAccessibleName('Round 1 of six');
    expect(
      screen.queryByRole('heading', { name: 'Your composite champion' }),
    ).not.toBeInTheDocument();
    expect(storage.getItem(SOLO_RUN_STORAGE_KEY)).toContain('"round":0');
  });
});
