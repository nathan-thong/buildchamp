import { describe, expect, it } from 'vitest';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../data/runtime-snapshot';
import { getVariantDisplayLabel, formatSourceName } from './selection-details';

describe('variant display labels', () => {
  it('hides compatibility labels for champions without alternate variants', () => {
    for (const championId of ['aurelion-sol', 'leblanc']) {
      const champion = BUNDLED_CHAMPION_SNAPSHOT.champions.find(
        (candidate) => candidate.id === championId,
      );
      const variant = champion?.variants[0];
      if (!champion || !variant) {
        throw new Error(`The snapshot should contain ${championId}.`);
      }

      expect(getVariantDisplayLabel(champion, variant)).toBeUndefined();
      expect(formatSourceName({ champion, variant, component: variant.components.q })).toBe(
        champion.name,
      );
    }
  });

  it('keeps labels for champions with multiple draft variants', () => {
    const champion = BUNDLED_CHAMPION_SNAPSHOT.champions.find(
      (candidate) => candidate.id === 'jayce',
    );
    const variant = champion?.variants.find((candidate) => candidate.id === 'jayce-hammer');
    if (!champion || !variant) {
      throw new Error('The snapshot should contain Jayce Hammer.');
    }

    expect(getVariantDisplayLabel(champion, variant)).toBe('Hammer');
    expect(formatSourceName({ champion, variant, component: variant.components.q })).toBe(
      'Jayce · Hammer',
    );
  });
});
