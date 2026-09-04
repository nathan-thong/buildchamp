import type { Slot } from '../domain/slots';

/**
 * Interface-only data for Slice 1. This is deliberately not champion data and
 * must be replaced by a validated snapshot before the solo draft is playable.
 */
export const FOUNDATION_CHAMPION = {
  name: 'Example champion',
  codename: 'EXAMPLE-01',
  eyebrow: 'EXAMPLE',
  artLabel: 'Example champion silhouette',
} as const;

export type FoundationComponent = {
  readonly name: 'Example';
};

export const FOUNDATION_COMPONENTS = {
  Body: {
    name: 'Example',
  },
  Q: {
    name: 'Example',
  },
  W: {
    name: 'Example',
  },
  E: {
    name: 'Example',
  },
  R: {
    name: 'Example',
  },
  Passive: {
    name: 'Example',
  },
} satisfies Readonly<Record<Slot, FoundationComponent>>;
