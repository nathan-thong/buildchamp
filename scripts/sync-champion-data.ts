import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchDataDragonSource, type SourceCache } from '../src/data/data-dragon-source.ts';
import {
  communityDragonChampionIdsForManifest,
  fetchCommunityDragonSpellSource,
} from '../src/data/alternate-spell-source.ts';
import { DEFAULT_COMPATIBILITY_MANIFEST } from '../src/data/compatibility-manifest.ts';
import {
  createPatchChangeReport,
  normalizeChampionSnapshot,
  serializeSnapshot,
  SnapshotPipelineError,
  stableJsonStringify,
} from '../src/data/snapshot-pipeline.ts';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CACHE_DIRECTORY = join(PROJECT_ROOT, '.cache', 'champion-data');
const DEFAULT_SNAPSHOT_DIRECTORY = join(PROJECT_ROOT, 'src', 'data', 'snapshots');
const DEFAULT_REPORT_DIRECTORY = join(PROJECT_ROOT, 'data', 'champion-reports');

type SyncOptions = {
  version: string;
  generatedAt: string;
  cacheDirectory: string;
  snapshotPath: string;
  reportPath: string;
  previousPath: string | undefined;
};

class FileJsonCache implements SourceCache {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  async read(key: string): Promise<unknown | undefined> {
    const cachePath = this.pathFor(key);
    try {
      return JSON.parse(await readFile(cachePath, 'utf8')) as unknown;
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async write(key: string, value: unknown): Promise<void> {
    const cachePath = this.pathFor(key);
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  private pathFor(key: string): string {
    const segments = key.split('/');
    if (segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))) {
      throw new SnapshotPipelineError(`Unsafe champion-data cache key ${key}.`);
    }
    return join(this.directory, ...segments) + '.json';
  }
}

function parseOptions(argumentsList: readonly string[]): SyncOptions {
  let version: string | undefined;
  let generatedAt: string | undefined;
  let cacheDirectory = DEFAULT_CACHE_DIRECTORY;
  let snapshotPath: string | undefined;
  let reportPath: string | undefined;
  let previousPath: string | undefined;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      printUsage();
      process.exitCode = 0;
      throw new SnapshotPipelineError('');
    }

    const [flag, inlineValue] = argument.split('=', 2);
    const value = inlineValue ?? argumentsList[++index];
    if (!value || value.startsWith('--')) {
      throw new SnapshotPipelineError(`Missing value for ${flag}.`);
    }

    switch (flag) {
      case '--version':
      case '-v':
        version = value;
        break;
      case '--generated-at':
        generatedAt = value;
        break;
      case '--cache-dir':
        cacheDirectory = resolveFromProject(value);
        break;
      case '--output':
        snapshotPath = resolveFromProject(value);
        break;
      case '--report':
        reportPath = resolveFromProject(value);
        break;
      case '--previous':
        previousPath = resolveFromProject(value);
        break;
      default:
        throw new SnapshotPipelineError(`Unknown argument ${flag}. Use --help for usage.`);
    }
  }

  if (!version) {
    throw new SnapshotPipelineError(
      'An explicit Data Dragon version is required. Pass --version x.y.z.',
    );
  }
  if (!generatedAt) {
    throw new SnapshotPipelineError(
      'A deterministic generation timestamp is required. Pass --generated-at YYYY-MM-DDTHH:mm:ss.sssZ.',
    );
  }

  return {
    version,
    generatedAt,
    cacheDirectory,
    snapshotPath: snapshotPath ?? join(DEFAULT_SNAPSHOT_DIRECTORY, `${version}.json`),
    reportPath: reportPath ?? join(DEFAULT_REPORT_DIRECTORY, `${version}.md`),
    previousPath,
  };
}

function resolveFromProject(value: string): string {
  return isAbsolute(value) ? value : resolve(PROJECT_ROOT, value);
}

function printUsage(): void {
  console.log(`Usage: pnpm sync:champion-data -- --version x.y.z --generated-at ISO_TIMESTAMP

Options:
  --version, -v       Explicit Data Dragon version (required)
  --generated-at      Stable ISO timestamp recorded in the snapshot (required)
  --previous PATH     Previous snapshot used to produce a change report
  --output PATH       Snapshot output path (default: src/data/snapshots/<version>.json)
  --report PATH       Report output path (default: data/champion-reports/<version>.md)
  --cache-dir PATH    Raw source cache directory (default: .cache/champion-data)
`);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BuildChamp champion-data importer' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }
  return response.json() as Promise<unknown>;
}

async function readJsonFile(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SnapshotPipelineError(`Could not read JSON file ${path}: ${reason}`);
  }
}

async function writeIfChanged(path: string, contents: string): Promise<boolean> {
  try {
    const previous = await readFile(path, 'utf8');
    if (previous === contents) {
      return false;
    }
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
  return true;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const cache = new FileJsonCache(options.cacheDirectory);
  const source = await fetchDataDragonSource({
    version: options.version,
    fetchJson,
    cache,
  });
  const alternateSpellSources = await fetchCommunityDragonSpellSource({
    version: options.version,
    championIds: communityDragonChampionIdsForManifest(DEFAULT_COMPATIBILITY_MANIFEST),
    fetchJson,
    cache,
  });
  const sourceHash = createHash('sha256')
    .update(stableJsonStringify({ dataDragon: source, alternateSpells: alternateSpellSources }))
    .digest('hex');
  const snapshot = normalizeChampionSnapshot(source, {
    dataDragonVersion: options.version,
    generatedAt: options.generatedAt,
    sourceHash,
    manifest: DEFAULT_COMPATIBILITY_MANIFEST,
    alternateSpellSources,
  });
  const previous = options.previousPath ? await readJsonFile(options.previousPath) : undefined;
  const report = createPatchChangeReport(previous, snapshot, DEFAULT_COMPATIBILITY_MANIFEST);
  const snapshotChanged = await writeIfChanged(options.snapshotPath, serializeSnapshot(snapshot));
  const reportChanged = await writeIfChanged(options.reportPath, report);

  console.log(
    `Imported ${snapshot.champions.length} champions (${snapshot.indexes.eligibleChampionIds.length} eligible, ${snapshot.indexes.excludedChampionIds.length} excluded) from Data Dragon ${snapshot.dataDragonVersion}.`,
  );
  console.log(`${snapshotChanged ? 'Wrote' : 'Kept'} ${options.snapshotPath}`);
  console.log(`${reportChanged ? 'Wrote' : 'Kept'} ${options.reportPath}`);
}

void main().catch((error: unknown) => {
  if (error instanceof SnapshotPipelineError && error.message.length === 0) {
    return;
  }
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Champion data import failed: ${reason}`);
  process.exitCode = 1;
});
