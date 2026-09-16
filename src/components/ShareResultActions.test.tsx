import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShareCardPng, type ShareCardData } from '../lib/share-card';
import { ShareResultActions } from './ShareResultActions';

vi.mock('../lib/share-card', () => ({
  createShareCardPng: vi.fn(),
}));

const originalClipboard = navigator.clipboard;
const originalShare = navigator.share;
const originalClipboardItem = globalThis.ClipboardItem;

const testShareCard: ShareCardData = {
  championName: 'Ahri',
  variantLabel: 'Nine-Tailed',
  artworkRef: 'https://example.com/ahri.jpg',
  snapshotVersion: '16.17.1',
  slots: ['Body', 'Q', 'W', 'E', 'R', 'Passive'].map((label) => ({
    label,
    componentName: `${label} component`,
    sourceName: 'Ahri',
    iconRef: 'https://example.com/ahri.png',
  })),
};

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: originalClipboard,
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: originalShare,
  });
  Object.defineProperty(globalThis, 'ClipboardItem', {
    configurable: true,
    value: originalClipboardItem,
  });
});

describe('ShareResultActions', () => {
  it('communicates copy success through an accessible status', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ShareResultActions sharePath="/build/v1.test" />);

    await user.click(screen.getByRole('button', { name: 'Copy result link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/build/v1.test`);
    expect(screen.getByRole('status')).toHaveTextContent(/link copied/i);
  });

  it('communicates copy failure and exposes native share when supported', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });

    render(<ShareResultActions sharePath="/build/v1.test" />);

    expect(screen.getByRole('button', { name: 'Share result' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy result link' }));
    expect(screen.getByRole('status')).toHaveTextContent(/sharing failed/i);

    await user.click(screen.getByRole('button', { name: 'Share result' }));
    expect(share).toHaveBeenCalledWith({
      title: 'BuildChamp result',
      text: 'Look at this BuildChamp composite champion.',
      url: `${window.location.origin}/build/v1.test`,
    });
    expect(screen.getByRole('status')).toHaveTextContent(/share sheet opened/i);
  });

  it('creates and copies a branded PNG when image clipboard support is available', async () => {
    const user = userEvent.setup();
    const png = new Blob(['png'], { type: 'image/png' });
    const write = vi.fn().mockResolvedValue(undefined);
    const clipboardItem = class TestClipboardItem {
      readonly items: Record<string, Blob>;

      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    };

    vi.mocked(createShareCardPng).mockResolvedValue(png);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: clipboardItem,
    });

    render(<ShareResultActions shareCard={testShareCard} sharePath="/build/v1.test" />);

    await user.click(screen.getByRole('button', { name: 'Copy as PNG' }));

    expect(createShareCardPng).toHaveBeenCalledWith(testShareCard);
    expect(write).toHaveBeenCalledTimes(1);
    const clipboardItems = write.mock.calls[0]?.[0] as InstanceType<typeof clipboardItem>[];
    expect(clipboardItems).toHaveLength(1);
    expect(clipboardItems[0]?.items['image/png']).toBe(png);
    expect(screen.getByRole('status')).toHaveTextContent(/png copied/i);
  });

  it('explains when PNG clipboard support is unavailable', async () => {
    const user = userEvent.setup();
    const write = vi.fn();

    vi.mocked(createShareCardPng).mockRejectedValue(new Error('canvas unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: class TestClipboardItem {},
    });

    render(<ShareResultActions shareCard={testShareCard} sharePath="/build/v1.test" />);

    await user.click(screen.getByRole('button', { name: 'Copy as PNG' }));

    expect(screen.getByRole('status')).toHaveTextContent(/png copy isn't available/i);
    expect(write).not.toHaveBeenCalled();
  });
});
