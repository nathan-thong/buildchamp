import {
  DATA_DRAGON_LOCALE,
  RawChampionDetailResponseSchema,
  RawChampionIndexSchema,
  type RawChampion,
  type RawDataDragonSource,
} from './snapshot-schema.ts';
import {
  dataDragonChampionUrl,
  formatZodIssues,
  SnapshotPipelineError,
} from './snapshot-pipeline.ts';

export { dataDragonChampionUrl } from './snapshot-pipeline.ts';

export type JsonFetcher = (url: string) => Promise<unknown>;

export type SourceCache = {
  read: (key: string) => Promise<unknown | undefined>;
  write: (key: string, value: unknown) => Promise<void>;
};

export type FetchDataDragonSourceOptions = {
  version: string;
  locale?: typeof DATA_DRAGON_LOCALE;
  fetchJson: JsonFetcher;
  cache?: SourceCache;
  concurrency?: number;
};

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function assertDataDragonVersion(version: string): void {
  if (!VERSION_PATTERN.test(version)) {
    throw new SnapshotPipelineError(
      `Data Dragon version must be an explicit x.y.z version, received ${JSON.stringify(version)}.`,
    );
  }
}

export async function fetchDataDragonSource(
  options: FetchDataDragonSourceOptions,
): Promise<RawDataDragonSource> {
  const locale = options.locale ?? DATA_DRAGON_LOCALE;
  if (locale !== DATA_DRAGON_LOCALE) {
    throw new SnapshotPipelineError(
      `The BuildChamp snapshot pipeline currently supports only ${DATA_DRAGON_LOCALE}.`,
    );
  }
  assertDataDragonVersion(options.version);

  const indexUrl = `https://ddragon.leagueoflegends.com/cdn/${options.version}/data/${locale}/champion.json`;
  const rawIndex = await readOrFetch(
    options.cache,
    `${options.version}/${locale}/champion-index`,
    indexUrl,
    options.fetchJson,
    RawChampionIndexSchema,
    'champion index',
  );

  if (rawIndex.version !== options.version) {
    throw new SnapshotPipelineError(
      `Champion index at ${indexUrl} reports ${rawIndex.version}, expected ${options.version}.`,
    );
  }

  const summaries = Object.entries(rawIndex.data).sort(([, left], [, right]) =>
    left.id.localeCompare(right.id),
  );
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, summaries.length));
  const details = await mapConcurrent(summaries, concurrency, async ([summaryKey, summary]) => {
    const detailUrl = dataDragonChampionUrl(options.version, summary.id);
    const response = await readOrFetch(
      options.cache,
      `${options.version}/${locale}/champion/${summary.id}`,
      detailUrl,
      options.fetchJson,
      RawChampionDetailResponseSchema,
      `${summary.id} champion detail`,
    );

    if (response.version !== options.version) {
      throw new SnapshotPipelineError(
        `Champion detail for ${summary.id} at ${detailUrl} reports ${response.version}, expected ${options.version}.`,
      );
    }

    const responseEntries = Object.entries(response.data);
    if (responseEntries.length !== 1 || !response.data[summaryKey]) {
      throw new SnapshotPipelineError(
        `Champion detail for ${summary.id} must contain exactly the ${summaryKey} record.`,
      );
    }

    const detail = response.data[summaryKey];
    assertDetailIdentity(detail, summary.id, summary.key, detailUrl);
    return [summaryKey, detail] as const;
  });

  return {
    version: options.version,
    locale,
    summary: rawIndex,
    details: Object.fromEntries(details),
  };
}

async function readOrFetch<T>(
  cache: SourceCache | undefined,
  cacheKey: string,
  url: string,
  fetchJson: JsonFetcher,
  schema: { safeParse: (value: unknown) => ParseResult<T> },
  label: string,
): Promise<T> {
  let invalidCacheMessage: string | undefined;

  if (cache) {
    const cached = await readCache(cache, cacheKey);
    if (cached !== undefined) {
      const parsedCache = schema.safeParse(cached);
      if (parsedCache.success) {
        return parsedCache.data;
      }
      invalidCacheMessage = formatZodIssues(parsedCache.error);
    }
  }

  let fetched: unknown;
  try {
    fetched = await fetchJson(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const cacheHint = invalidCacheMessage
      ? ` Cached data was also invalid: ${invalidCacheMessage}`
      : '';
    throw new SnapshotPipelineError(`Could not fetch ${label} from ${url}: ${reason}.${cacheHint}`);
  }

  const parsed = schema.safeParse(fetched);
  if (!parsed.success) {
    throw new SnapshotPipelineError(
      `Data Dragon ${label} from ${url} is incomplete or invalid: ${formatZodIssues(parsed.error)}`,
    );
  }

  if (cache) {
    await writeCache(cache, cacheKey, fetched);
  }

  return parsed.data;
}

async function readCache(cache: SourceCache, key: string): Promise<unknown | undefined> {
  try {
    return await cache.read(key);
  } catch {
    return undefined;
  }
}

async function writeCache(cache: SourceCache, key: string, value: unknown): Promise<void> {
  try {
    await cache.write(key, value);
  } catch {
    // A cache is an optimization. A read-only cache must not invalidate a fresh import.
  }
}

function assertDetailIdentity(
  detail: RawChampion,
  expectedId: string,
  expectedKey: string,
  url: string,
): void {
  if (detail.id !== expectedId || detail.key !== expectedKey) {
    throw new SnapshotPipelineError(
      `Champion detail from ${url} has id/key ${detail.id}/${detail.key}; expected ${expectedId}/${expectedKey}.`,
    );
  }
}

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: readonly { path: PropertyKey[]; message: string }[] } };

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}
