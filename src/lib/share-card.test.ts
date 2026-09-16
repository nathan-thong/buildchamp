import { describe, expect, it } from 'vitest';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../data/runtime-snapshot';
import { DRAFT_SLOT_ORDER, type DraftSlot } from '../domain/draft-engine';
import type { SelectionDetails } from '../domain/selection-details';
import { createShareCardData } from './share-card';

describe('share card data', () => {
  it('maps a complete locked build to the six visible share-card rows', () => {
    const champion = BUNDLED_CHAMPION_SNAPSHOT.champions.find(
      (candidate) => !candidate.excluded && candidate.variants[0],
    );
    const variant = champion?.variants[0];
    if (!champion || !variant) {
      throw new Error('The bundled snapshot should contain a usable champion variant.');
    }

    const details = Object.fromEntries(
      DRAFT_SLOT_ORDER.map((slot) => [
        slot,
        { champion, variant, component: variant.components[slot] },
      ]),
    ) as Partial<Record<DraftSlot, SelectionDetails>>;

    const data = createShareCardData(BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion, details);

    expect(data).toMatchObject({
      championName: champion.name,
      artworkRef: champion.assetRefs.defaultSplash,
      snapshotVersion: BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion,
    });
    expect(data?.slots).toHaveLength(6);
    expect(data?.slots.map((slot) => slot.label)).toEqual(['Body', 'Q', 'W', 'E', 'R', 'Passive']);
    expect(data?.slots.map((slot) => slot.componentName)).toEqual(
      DRAFT_SLOT_ORDER.map((slot) => variant.components[slot].name),
    );
  });

  it('does not offer a card for an incomplete build', () => {
    expect(
      createShareCardData(BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion, { q: undefined }),
    ).toBeNull();
  });
});
