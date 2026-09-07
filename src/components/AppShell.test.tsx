import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';

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

describe('AppShell', () => {
  it('persists the mute preference across shell mounts', async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    const shell = {
      children: <p>Test content</p>,
      currentRoute: 'home' as const,
      storage,
    };

    const first = render(<AppShell {...shell} />);
    expect(screen.getByRole('button', { name: 'Mute sound' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument();

    first.unmount();
    render(<AppShell {...shell} />);

    expect(screen.getByRole('button', { name: 'Turn sound on' })).toBeInTheDocument();
  });
});
