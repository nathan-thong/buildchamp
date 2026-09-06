import snapshotArtifact from './snapshots/16.17.1.json';
import { validateChampionSnapshot } from './snapshot-pipeline';

/**
 * The solo client only consumes this immutable, build-time snapshot. Keeping
 * validation at the import seam makes accidental runtime Data Dragon access
 * unnecessary and turns malformed generated data into a startup error.
 */
export const BUNDLED_CHAMPION_SNAPSHOT = validateChampionSnapshot(snapshotArtifact);
