import { z } from 'zod';

import type { SourceCache } from './data-dragon-source.ts';
import { SnapshotPipelineError } from './snapshot-errors.ts';
import type { CompatibilityManifest } from './snapshot-schema.ts';

export const COMMUNITY_DRAGON_SPELL_PREFIX = 'communitydragon:' as const;

const COMMUNITY_DRAGON_HOST = 'https://raw.communitydragon.org';
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const CommunityDragonDataValueSchema = z
  .object({
    name: z.string().min(1),
    values: z.array(z.number().finite()).optional(),
  })
  .passthrough();

const CommunityDragonSpellDataSchema = z
  .object({
    DataValues: z.array(CommunityDragonDataValueSchema).optional(),
    cooldownTime: z.array(z.number().finite()).nullable().optional(),
    castRange: z.array(z.number().finite()).nullable().optional(),
    castRangeDisplayOverride: z.array(z.number().finite()).nullable().optional(),
    mClientData: z
      .object({
        mTooltipData: z
          .object({
            mLists: z
              .object({
                LevelUp: z
                  .object({
                    Elements: z
                      .array(
                        z
                          .object({
                            type: z.string().min(1).optional(),
                            multiplier: z.number().finite().optional(),
                          })
                          .passthrough(),
                      )
                      .optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const CommunityDragonSpellObjectSchema = z
  .object({
    ObjectName: z.string().min(1).optional(),
    mScriptName: z.string().min(1).optional(),
    mSpell: CommunityDragonSpellDataSchema,
  })
  .passthrough();

const CommunityDragonBinSchema = z.record(z.unknown());

type CommunityDragonSpellData = z.infer<typeof CommunityDragonSpellDataSchema>;

export type AlternateSpellRecord = {
  id: string;
  cooldown?: number[];
  range?: number[];
  leveltip?: {
    label: string[];
    effect: string[];
  };
  sourceValues?: AlternateSpellValue[];
  sourceRef: string;
};

export type AlternateSpellValue = {
  name: string;
  label: string;
  values: number[];
};

export type AlternateSpellCatalog = Readonly<
  Record<string, Readonly<Record<string, AlternateSpellRecord>>>
>;

export type FetchCommunityDragonSpellSourceOptions = {
  version: string;
  championIds: readonly string[];
  fetchJson: (url: string) => Promise<unknown>;
  cache?: SourceCache;
  concurrency?: number;
};

export function isCommunityDragonSpellId(sourceSpellId: string): boolean {
  return sourceSpellId.startsWith(COMMUNITY_DRAGON_SPELL_PREFIX);
}

export function communityDragonSpellId(sourceSpellId: string): string {
  if (!isCommunityDragonSpellId(sourceSpellId)) {
    throw new SnapshotPipelineError(
      `Expected a CommunityDragon spell id, received ${JSON.stringify(sourceSpellId)}.`,
    );
  }

  const spellId = sourceSpellId.slice(COMMUNITY_DRAGON_SPELL_PREFIX.length);
  if (!spellId) {
    throw new SnapshotPipelineError('A CommunityDragon spell reference must include a spell id.');
  }
  return spellId;
}

export function communityDragonChampionUrl(version: string, championId: string): string {
  const pathId = championId.toLowerCase().replaceAll('-', '');
  return `${COMMUNITY_DRAGON_HOST}/${communityDragonVersion(version)}/game/data/characters/${pathId}/${pathId}.bin.json`;
}

export function communityDragonChampionIdsForManifest(manifest: CompatibilityManifest): string[] {
  return manifest.entries
    .filter((entry) =>
      entry.variants?.some((variant) =>
        (['q', 'w', 'e', 'r'] as const).some((slot) =>
          variant.componentOverrides[slot]?.sourceSpellIds?.some(isCommunityDragonSpellId),
        ),
      ),
    )
    .map((entry) => entry.championId.toLowerCase());
}

export async function fetchCommunityDragonSpellSource(
  options: FetchCommunityDragonSpellSourceOptions,
): Promise<AlternateSpellCatalog> {
  assertVersion(options.version);

  const championIds = [
    ...new Set(options.championIds.map((championId) => championId.toLowerCase())),
  ]
    .sort()
    .map((championId) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(championId)) {
        throw new SnapshotPipelineError(
          `CommunityDragon champion id must be a normalized id, received ${JSON.stringify(championId)}.`,
        );
      }
      return championId;
    });

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, championIds.length || 1));
  const records = await mapConcurrent(championIds, concurrency, async (championId) => {
    const url = communityDragonChampionUrl(options.version, championId);
    const raw = await readOrFetch(
      options.cache,
      `${options.version}/communitydragon/${championId}`,
      url,
      options.fetchJson,
    );
    return [championId, parseCommunityDragonChampionBin(raw, url)] as const;
  });

  return Object.fromEntries(records);
}

export function parseCommunityDragonChampionBin(
  raw: unknown,
  sourceRef: string,
): Readonly<Record<string, AlternateSpellRecord>> {
  const parsed = CommunityDragonBinSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SnapshotPipelineError(`CommunityDragon source ${sourceRef} is not a JSON object.`);
  }

  const spells = new Map<string, AlternateSpellRecord>();
  for (const [objectPath, objectValue] of Object.entries(parsed.data)) {
    const spellObject = CommunityDragonSpellObjectSchema.safeParse(objectValue);
    if (!spellObject.success) {
      continue;
    }

    const spellIds = [spellObject.data.ObjectName, spellObject.data.mScriptName].filter(
      (spellId): spellId is string => Boolean(spellId),
    );
    if (spellIds.length === 0) {
      continue;
    }

    const record = normalizeCommunityDragonSpell(spellIds[0], spellObject.data.mSpell, sourceRef);
    for (const spellId of spellIds) {
      if (!spells.has(spellId)) {
        spells.set(spellId, record);
      }
    }

    const pathSpellId = objectPath.split('/').at(-1);
    if (pathSpellId && !spells.has(pathSpellId)) {
      spells.set(pathSpellId, record);
    }
  }

  return Object.fromEntries(spells);
}

function normalizeCommunityDragonSpell(
  id: string,
  spell: CommunityDragonSpellData,
  sourceRef: string,
): AlternateSpellRecord {
  const cooldown = normalizePerRankValues(spell.cooldownTime);
  const range = normalizePerRankValues(
    spell.castRangeDisplayOverride ??
      (spell.castRange?.some((value) => value > 10_000) ? undefined : spell.castRange),
  );
  const normalizedValues = normalizeLevelTip(spell.DataValues, spell);

  return {
    id,
    ...(cooldown ? { cooldown } : {}),
    ...(range ? { range } : {}),
    ...(normalizedValues.leveltip ? { leveltip: normalizedValues.leveltip } : {}),
    ...(normalizedValues.sourceValues.length
      ? { sourceValues: normalizedValues.sourceValues }
      : {}),
    sourceRef,
  };
}

function normalizePerRankValues(
  values: readonly number[] | null | undefined,
): number[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const perRankValues = values.length > 1 ? values.slice(1) : [...values];
  return perRankValues.length > 0 ? perRankValues.map(normalizeNumber) : undefined;
}

function normalizeLevelTip(
  dataValues: readonly { name: string; values?: readonly number[] }[] | undefined,
  spell: CommunityDragonSpellData,
): {
  leveltip?: { label: string[]; effect: string[] };
  sourceValues: AlternateSpellValue[];
} {
  const normalizedSourceValues = (dataValues ?? [])
    .map((dataValue) => {
      const values = normalizePerRankValues(dataValue.values);
      return values
        ? {
            name: dataValue.name,
            label: humanizeDataValueName(dataValue.name),
            values,
          }
        : undefined;
    })
    .filter((value): value is AlternateSpellValue => value !== undefined);

  if (normalizedSourceValues.length === 0) {
    return { sourceValues: [] };
  }

  const displayElements = spell.mClientData?.mTooltipData?.mLists?.LevelUp?.Elements;
  const displayMultipliers = new Map(
    (displayElements ?? [])
      .filter((element): element is { type: string; multiplier?: number } => Boolean(element.type))
      .map((element) => [element.type, element.multiplier ?? 1]),
  );
  const sourceValues = normalizedSourceValues.map((sourceValue) => {
    const multiplier = displayMultipliers.get(sourceValue.name) ?? 1;
    return {
      ...sourceValue,
      values: sourceValue.values.map((value) => normalizeNumber(value * multiplier)),
    };
  });
  const sourceValuesByNameWithDisplayMultipliers = new Map(
    sourceValues.map((sourceValue) => [sourceValue.name, sourceValue]),
  );
  const displayValues = displayElements?.length
    ? displayElements.flatMap((element) => {
        if (!element.type) {
          return [];
        }
        const sourceValue = sourceValuesByNameWithDisplayMultipliers.get(element.type);
        return sourceValue ? [sourceValue] : [];
      })
    : sourceValues;

  const levelTip = displayValues
    .map((sourceValue) => ({
      label: sourceValue.label,
      effect: sourceValue.values.join('/'),
    }))
    .filter((value): value is { label: string; effect: string } => value !== undefined);

  if (levelTip.length === 0) {
    return { sourceValues };
  }

  return {
    leveltip: {
      label: levelTip.map((value) => value.label),
      effect: levelTip.map((value) => value.effect),
    },
    sourceValues,
  };
}

function normalizeNumber(value: number): number {
  return Number(value.toFixed(4));
}

function humanizeDataValueName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bAd\b/g, 'AD')
    .replace(/\bAs\b/g, 'AS')
    .replace(/\bHp\b/g, 'HP')
    .replace(/\bPerc\b/g, '%')
    .trim();
}

function assertVersion(version: string): void {
  if (!VERSION_PATTERN.test(version)) {
    throw new SnapshotPipelineError(
      `CommunityDragon version must be an explicit x.y.z version, received ${JSON.stringify(version)}.`,
    );
  }
}

function communityDragonVersion(dataDragonVersion: string): string {
  return dataDragonVersion.split('.').slice(0, 2).join('.');
}

async function readOrFetch(
  cache: SourceCache | undefined,
  cacheKey: string,
  url: string,
  fetchJson: (url: string) => Promise<unknown>,
): Promise<unknown> {
  if (cache) {
    try {
      const cached = await cache.read(cacheKey);
      if (cached !== undefined && CommunityDragonBinSchema.safeParse(cached).success) {
        return cached;
      }
    } catch {
      // A cache is an optimization; a fresh fetch remains authoritative.
    }
  }

  let fetched: unknown;
  try {
    fetched = await fetchJson(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new SnapshotPipelineError(
      `Could not fetch CommunityDragon source from ${url}: ${reason}.`,
    );
  }

  if (!CommunityDragonBinSchema.safeParse(fetched).success) {
    throw new SnapshotPipelineError(`CommunityDragon source from ${url} is not a JSON object.`);
  }

  if (cache) {
    try {
      await cache.write(cacheKey, fetched);
    } catch {
      // A cache is an optimization; a read-only cache must not invalidate a fresh import.
    }
  }

  return fetched;
}

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
