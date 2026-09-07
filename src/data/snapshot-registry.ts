import historicalSnapshotArtifact from './snapshots/15.17.1.json';
import type { ChampionSnapshot } from './snapshot-schema';
import { validateChampionSnapshot } from './snapshot-pipeline';
import { BUNDLED_CHAMPION_SNAPSHOT } from './runtime-snapshot';

const HISTORICAL_CHAMPION_SNAPSHOT = validateChampionSnapshot(historicalSnapshotArtifact);

const SNAPSHOTS_BY_VERSION: ReadonlyMap<string, ChampionSnapshot> = new Map([
  [HISTORICAL_CHAMPION_SNAPSHOT.dataDragonVersion, HISTORICAL_CHAMPION_SNAPSHOT],
  [BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion, BUNDLED_CHAMPION_SNAPSHOT],
]);

export function getChampionSnapshot(version: string): ChampionSnapshot | null {
  return SNAPSHOTS_BY_VERSION.get(version) ?? null;
}

export function listChampionSnapshotVersions(): readonly string[] {
  return [...SNAPSHOTS_BY_VERSION.keys()];
}
