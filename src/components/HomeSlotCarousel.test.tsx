import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeSlotCarousel } from './HomeSlotCarousel';

class ImmediateImage {
  onload: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class DeferredImage {
  static pending: DeferredImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    DeferredImage.pending.push(this);
  }

  static resolveAll() {
    const pending = [...DeferredImage.pending];
    DeferredImage.pending = [];
    pending.forEach((image) => image.onload?.());
  }

  static rejectAll() {
    const pending = [...DeferredImage.pending];
    DeferredImage.pending = [];
    pending.forEach((image) => image.onerror?.());
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('HomeSlotCarousel', () => {
  afterEach(() => {
    DeferredImage.pending = [];
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders one snapshot-backed icon for each slot and rotates a lane', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', ImmediateImage);
    const { container } = render(<HomeSlotCarousel />);
    await act(flushPromises);
    const bodySlot = container.querySelector('[data-carousel-slot="Body"]');
    const initialBodyIcon = bodySlot?.getAttribute('data-icon-id');

    expect(container.querySelectorAll('.home-build-card__slot')).toHaveLength(6);
    expect(container.querySelectorAll('.home-build-card__slot-icon')).toHaveLength(6);
    expect(initialBodyIcon).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3_200);
      await flushPromises();
    });

    expect(bodySlot?.getAttribute('data-icon-id')).not.toBe(initialBodyIcon);
  });

  it('leaves the randomized frame static when reduced motion is preferred', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', ImmediateImage);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(
        () =>
          ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }) as unknown as MediaQueryList,
      ),
    );

    const { container } = render(<HomeSlotCarousel />);
    await act(flushPromises);
    const bodySlot = container.querySelector('[data-carousel-slot="Body"]');
    const initialBodyIcon = bodySlot?.getAttribute('data-icon-id');

    act(() => vi.advanceTimersByTime(3_600));

    expect(bodySlot?.getAttribute('data-icon-id')).toBe(initialBodyIcon);
  });

  it('keeps the linked body splash and current icons until the next frame is loaded', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image', DeferredImage);
    const { container } = render(<HomeSlotCarousel />);
    const bodySlot = container.querySelector('[data-carousel-slot="Body"]');
    const art = container.querySelector('.home-build-card__art');

    if (!bodySlot || !art) {
      throw new Error('Home carousel frame is not rendered.');
    }

    expect(art.getAttribute('data-body-preview-id')).toBeNull();
    DeferredImage.resolveAll();
    await act(flushPromises);

    const initialBodyIcon = bodySlot.getAttribute('data-icon-id');
    expect(initialBodyIcon).toBeTruthy();
    expect(art.getAttribute('data-body-preview-id')).toBe(initialBodyIcon);
    expect(art.querySelector('.home-build-card__splash')).toHaveAttribute(
      'data-preview-id',
      initialBodyIcon,
    );
    const initialFrame = [...container.querySelectorAll('[data-carousel-slot]')].map((slot) =>
      slot.getAttribute('data-icon-id'),
    );

    act(() => vi.advanceTimersByTime(3_200));

    expect(bodySlot.getAttribute('data-icon-id')).toBe(initialBodyIcon);
    expect(art.getAttribute('data-body-preview-id')).toBe(initialBodyIcon);
    expect(
      [...container.querySelectorAll('[data-carousel-slot]')].map((slot) =>
        slot.getAttribute('data-icon-id'),
      ),
    ).toEqual(initialFrame);

    DeferredImage.rejectAll();
    await act(flushPromises);

    expect(bodySlot.getAttribute('data-icon-id')).toBe(initialBodyIcon);
    expect(art.getAttribute('data-body-preview-id')).toBe(initialBodyIcon);

    act(() => vi.advanceTimersByTime(3_200));

    DeferredImage.resolveAll();
    await act(flushPromises);

    const nextBodyIcon = bodySlot.getAttribute('data-icon-id');
    expect(nextBodyIcon).not.toBe(initialBodyIcon);
    expect(art.getAttribute('data-body-preview-id')).toBe(nextBodyIcon);
    expect(art.querySelector('.home-build-card__splash')).toHaveAttribute(
      'data-preview-id',
      nextBodyIcon,
    );
  });
});
