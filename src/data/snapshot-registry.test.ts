import { describe, expect, it } from 'vitest';

import { getChampionSnapshot, listChampionSnapshotVersions } from './snapshot-registry';

describe('champion snapshot registry', () => {
  it('retains the current and prior snapshots for shared result links', () => {
    expect(getChampionSnapshot('16.17.1')?.dataDragonVersion).toBe('16.17.1');
    expect(getChampionSnapshot('15.17.1')?.dataDragonVersion).toBe('15.17.1');
    expect(listChampionSnapshotVersions()).toEqual(['15.17.1', '16.17.1']);
  });

  it('returns no snapshot for an unavailable version', () => {
    expect(getChampionSnapshot('99.99.99')).toBeNull();
  });
});
