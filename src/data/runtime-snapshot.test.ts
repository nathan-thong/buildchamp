import { describe, expect, it } from 'vitest';

import { BUNDLED_CHAMPION_SNAPSHOT } from './runtime-snapshot';

describe('bundled runtime snapshot', () => {
  it('exposes the validated pinned champion data without a network request', () => {
    expect(BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion).toBe('16.17.1');
    expect(BUNDLED_CHAMPION_SNAPSHOT.locale).toBe('en_US');
    expect(BUNDLED_CHAMPION_SNAPSHOT.champions).toHaveLength(173);
    expect(BUNDLED_CHAMPION_SNAPSHOT.indexes.eligibleChampionIds).toContain('ahri');
  });
});
