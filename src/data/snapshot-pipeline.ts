import {
  CHAMPION_DATA_SCHEMA_VERSION,
  ChampionSnapshotSchema,
  CompatibilityManifestSchema,
  DATA_DRAGON_LOCALE,
  IMPORTER_VERSION,
  RawDataDragonSourceSchema,
  type BodyStats,
  type BodyStatsOverride,
  type Champion,
  type ChampionSnapshot,
  type CompatibilityEntry,
  type CompatibilityManifest,
  type CompatibilityVariant,
  type Component,
  type ComponentOverride,
  type DisplayValue,
  type DraftVariant,
  type RawChampion,
  type RawChampionSummary,
  type RawDataDragonSource,
  type RawSpell,
  type Slot,
} from './snapshot-schema.ts';
import {
  communityDragonSpellId,
  isCommunityDragonSpellId,
  type AlternateSpellRecord,
  type AlternateSpellCatalog,
} from './alternate-spell-source.ts';
import { SnapshotPipelineError } from './snapshot-errors.ts';

const SLOT_ORDER: readonly Slot[] = ['body', 'q', 'w', 'e', 'r', 'passive'];
const DATA_DRAGON_HOST = 'https://ddragon.leagueoflegends.com';

export type NormalizeSnapshotOptions = {
  dataDragonVersion: string;
  generatedAt: string;
  sourceHash: string;
  manifest: CompatibilityManifest;
  alternateSpellSources?: AlternateSpellCatalog;
  importerVersion?: string;
};

export { SnapshotPipelineError } from './snapshot-errors.ts';

export function formatZodIssues(error: { issues: readonly zodIssue[] }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

type zodIssue = {
  path: PropertyKey[];
  message: string;
};

export function validateRawDataDragonSource(input: unknown): RawDataDragonSource {
  const result = RawDataDragonSourceSchema.safeParse(input);
  if (!result.success) {
    throw new SnapshotPipelineError(
      `Raw Data Dragon source is invalid. Fix the source data and retry: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data;
}

export function validateCompatibilityManifest(input: unknown): CompatibilityManifest {
  const result = CompatibilityManifestSchema.safeParse(input);
  if (!result.success) {
    throw new SnapshotPipelineError(
      `Compatibility manifest is invalid. Fix the manifest before importing: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data;
}

export function validateChampionSnapshot(input: unknown): ChampionSnapshot {
  const result = ChampionSnapshotSchema.safeParse(input);
  if (!result.success) {
    throw new SnapshotPipelineError(
      `Normalized champion snapshot is invalid. Fix the importer or manifest: ${formatZodIssues(result.error)}`,
    );
  }

  return result.data;
}

export function toChampionId(riotId: string): string {
  return riotId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function dataDragonChampionUrl(version: string, championId: string): string {
  return `${DATA_DRAGON_HOST}/cdn/${version}/data/${DATA_DRAGON_LOCALE}/champion/${championId}.json`;
}

export function dataDragonAssetUrl(version: string, type: string, fileName: string): string {
  return `${DATA_DRAGON_HOST}/cdn/${version}/img/${type}/${fileName}`;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objectValue)
        .sort()
        .map((key) => [key, canonicalizeJson(objectValue[key])]),
    );
  }

  return value;
}

export function serializeSnapshot(input: ChampionSnapshot): string {
  const snapshot = validateChampionSnapshot(input);
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function normalizeChampionSnapshot(
  input: unknown,
  options: NormalizeSnapshotOptions,
): ChampionSnapshot {
  const source = validateRawDataDragonSource(input);
  const manifest = validateCompatibilityManifest(options.manifest);

  if (source.version !== options.dataDragonVersion) {
    throw new SnapshotPipelineError(
      `Data Dragon version mismatch: requested ${options.dataDragonVersion}, source reports ${source.version}.`,
    );
  }

  if (source.summary.version !== source.version) {
    throw new SnapshotPipelineError(
      `Champion index version mismatch: source reports ${source.version}, index reports ${source.summary.version}.`,
    );
  }

  const manifestEntries = indexManifestEntries(manifest, options.dataDragonVersion);
  const summaryEntries = Object.entries(source.summary.data).sort(([, left], [, right]) =>
    toChampionId(left.id).localeCompare(toChampionId(right.id)),
  );
  const sourceChampionIds = new Set(summaryEntries.map(([, summary]) => toChampionId(summary.id)));

  for (const [summaryKey, summary] of summaryEntries) {
    if (summaryKey !== summary.id) {
      throw new SnapshotPipelineError(
        `Champion index key ${summaryKey} does not match its champion id ${summary.id}.`,
      );
    }
  }

  for (const entry of manifest.entries) {
    const championId = toChampionId(entry.championId);
    if (!sourceChampionIds.has(championId)) {
      throw new SnapshotPipelineError(
        `Compatibility manifest entry ${entry.championId} does not match a champion in the ${source.version} source.`,
      );
    }
  }

  const summaryChampionIds = new Set(summaryEntries.map(([summaryKey]) => summaryKey));
  for (const detailKey of Object.keys(source.details)) {
    if (!summaryChampionIds.has(detailKey)) {
      throw new SnapshotPipelineError(
        `Champion detail ${detailKey} is not present in the champion index; remove the stale detail or refresh the source together.`,
      );
    }
  }

  const champions = summaryEntries.map(([summaryKey, summary]) => {
    const detail = source.details[summaryKey];
    if (!detail) {
      throw new SnapshotPipelineError(
        `Missing champion detail for ${summary.id}. Fetch the detail endpoint before normalizing.`,
      );
    }

    assertDetailMatchesSummary(detail, summary, source.version);
    const championId = toChampionId(summary.id);
    const compatibility = manifestEntries.get(championId);

    return normalizeChampion(summary, detail, championId, compatibility, options);
  });

  const snapshot: ChampionSnapshot = {
    schemaVersion: CHAMPION_DATA_SCHEMA_VERSION,
    dataDragonVersion: options.dataDragonVersion,
    locale: DATA_DRAGON_LOCALE,
    generatedAt: options.generatedAt,
    source: {
      provider: 'riot-data-dragon',
      versionUrl: `${DATA_DRAGON_HOST}/cdn/${options.dataDragonVersion}/data/${DATA_DRAGON_LOCALE}/champion.json`,
    },
    generation: {
      importerVersion: options.importerVersion ?? IMPORTER_VERSION,
      sourceHash: options.sourceHash,
      sourceChampionCount: champions.length,
    },
    indexes: buildEligibilityIndexes(champions),
    champions,
  };

  return validateChampionSnapshot(snapshot);
}

function indexManifestEntries(
  manifest: CompatibilityManifest,
  dataDragonVersion: string,
): Map<string, CompatibilityEntry> {
  const indexed = new Map<string, CompatibilityEntry>();

  for (const entry of manifest.entries) {
    if (entry.reviewedForDataDragonVersion !== dataDragonVersion) {
      throw new SnapshotPipelineError(
        `Compatibility entry ${entry.championId} was reviewed for ${entry.reviewedForDataDragonVersion}, not ${dataDragonVersion}. Review the exception before importing this version.`,
      );
    }

    const championId = toChampionId(entry.championId);
    if (indexed.has(championId)) {
      throw new SnapshotPipelineError(
        `Compatibility manifest contains duplicate champion identity ${championId}.`,
      );
    }
    indexed.set(championId, entry);
  }

  return indexed;
}

function assertDetailMatchesSummary(
  detail: RawChampion,
  summary: RawChampionSummary,
  version: string,
): void {
  if (detail.id !== summary.id || detail.key !== summary.key) {
    throw new SnapshotPipelineError(
      `Champion detail mismatch for ${summary.id}: expected id/key ${summary.id}/${summary.key}, received ${detail.id}/${detail.key}.`,
    );
  }

  if (detail.name !== summary.name || detail.title !== summary.title) {
    throw new SnapshotPipelineError(
      `Champion detail mismatch for ${summary.id}: name or title differs from the champion index.`,
    );
  }

  if (detail.image.full !== summary.image.full) {
    throw new SnapshotPipelineError(
      `Champion detail mismatch for ${summary.id}: image filename differs from the champion index.`,
    );
  }

  if (detail.spells.length < 4) {
    throw new SnapshotPipelineError(
      `Champion ${summary.id} has ${detail.spells.length} spells; four Q/W/E/R source slots are required.`,
    );
  }

  if (detail.version && detail.version !== version) {
    throw new SnapshotPipelineError(
      `Champion detail version mismatch for ${summary.id}: expected ${version}, received ${detail.version}.`,
    );
  }
}

function normalizeChampion(
  summary: RawChampionSummary,
  detail: RawChampion,
  championId: string,
  compatibility: CompatibilityEntry | undefined,
  options: NormalizeSnapshotOptions,
): Champion {
  const assetRefs = {
    icon: dataDragonAssetUrl(options.dataDragonVersion, 'champion', summary.image.full),
    defaultSplash: dataDragonAssetUrl(
      options.dataDragonVersion,
      'champion/splash',
      `${summary.id}_0.jpg`,
    ),
    defaultLoading: dataDragonAssetUrl(
      options.dataDragonVersion,
      'champion/loading',
      `${summary.id}_0.jpg`,
    ),
  };

  if (compatibility?.excludeChampion) {
    return {
      id: championId,
      riotKey: summary.key,
      name: summary.name,
      title: summary.title,
      excluded: true,
      exclusionReason: compatibility.excludeChampion.reason,
      randomWeight: 0,
      assetRefs,
      variants: [],
    };
  }

  const variants = compatibility?.variants
    ? compatibility.variants.map((variant) =>
        normalizeVariant(summary, detail, championId, variant, options),
      )
    : [normalizeVariant(summary, detail, championId, undefined, options)];

  return {
    id: championId,
    riotKey: summary.key,
    name: summary.name,
    title: summary.title,
    excluded: false,
    randomWeight: 1,
    assetRefs,
    variants,
  };
}

function normalizeVariant(
  summary: RawChampionSummary,
  detail: RawChampion,
  championId: string,
  compatibility: CompatibilityVariant | undefined,
  options: NormalizeSnapshotOptions,
): DraftVariant {
  const variantId = compatibility?.id ?? `${championId}-default`;
  const variantLabel = compatibility?.label;
  const overrides = compatibility?.componentOverrides;
  const detailUrl = dataDragonChampionUrl(options.dataDragonVersion, summary.id);
  const defaultSpellIds: Record<Exclude<Slot, 'body' | 'passive'>, string> = {
    q: detail.spells[0].id,
    w: detail.spells[1].id,
    e: detail.spells[2].id,
    r: detail.spells[3].id,
  };

  const components = {
    body: normalizeBodyComponent(summary, detail, championId, variantId, overrides?.body, options),
    q: normalizeAbilityComponent(
      detail,
      championId,
      variantId,
      'q',
      resolveSpellIds('q', defaultSpellIds.q, overrides?.q),
      overrides?.q,
      detailUrl,
      options,
    ),
    w: normalizeAbilityComponent(
      detail,
      championId,
      variantId,
      'w',
      resolveSpellIds('w', defaultSpellIds.w, overrides?.w),
      overrides?.w,
      detailUrl,
      options,
    ),
    e: normalizeAbilityComponent(
      detail,
      championId,
      variantId,
      'e',
      resolveSpellIds('e', defaultSpellIds.e, overrides?.e),
      overrides?.e,
      detailUrl,
      options,
    ),
    r: normalizeAbilityComponent(
      detail,
      championId,
      variantId,
      'r',
      resolveSpellIds('r', defaultSpellIds.r, overrides?.r),
      overrides?.r,
      detailUrl,
      options,
    ),
    passive: normalizePassiveComponent(
      detail,
      championId,
      variantId,
      overrides?.passive,
      detailUrl,
      options,
    ),
  } satisfies DraftVariant['components'];

  return {
    id: variantId,
    championId,
    ...(variantLabel ? { label: variantLabel } : {}),
    components,
  };
}

function resolveSpellIds(
  slot: Exclude<Slot, 'body' | 'passive'>,
  defaultSpellId: string,
  override: ComponentOverride | undefined,
): string[] {
  if (override?.sourceSpellIds) {
    return override.sourceSpellIds;
  }

  if (!defaultSpellId) {
    throw new SnapshotPipelineError(
      `No source spell is available for the ${slot.toUpperCase()} slot.`,
    );
  }

  return [defaultSpellId];
}

function getSourceSpells(
  detail: RawChampion,
  championId: string,
  slot: Slot,
  sourceSpellIds: readonly string[],
  fallbackSourceSpellIds: readonly string[] | undefined,
  sourceDataValueNames: readonly string[] | undefined,
  sourceDataValueSourceSpellIds: readonly string[] | undefined,
  sourceDataValueMultipliers: Readonly<Record<string, number>> | undefined,
  alternateSpellSources: AlternateSpellCatalog | undefined,
  detailUrl: string,
): Array<{ spell: RawSpell; index: number; sourceRefs?: string[] }> {
  if (sourceDataValueMultipliers && !sourceDataValueNames) {
    throw new SnapshotPipelineError(
      `Compatibility mapping for ${championId} ${slot.toUpperCase()} cannot provide sourceDataValueMultipliers without sourceDataValueNames.`,
    );
  }

  if (sourceDataValueSourceSpellIds) {
    if (!sourceDataValueNames) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} cannot provide sourceDataValueSourceSpellIds without sourceDataValueNames.`,
      );
    }
    if (sourceDataValueSourceSpellIds.length !== sourceSpellIds.length) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} must provide one sourceDataValueSourceSpellIds entry per selected source spell.`,
      );
    }
    if (sourceDataValueSourceSpellIds.some((spellId) => !isCommunityDragonSpellId(spellId))) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} may select sourceDataValueSourceSpellIds only for CommunityDragon spell references.`,
      );
    }
  }

  if (
    (sourceDataValueNames || sourceDataValueMultipliers) &&
    sourceSpellIds.some((spellId) => !isCommunityDragonSpellId(spellId))
  ) {
    throw new SnapshotPipelineError(
      `Compatibility mapping for ${championId} ${slot.toUpperCase()} may select sourceDataValueNames only for CommunityDragon spell references.`,
    );
  }

  if (fallbackSourceSpellIds && fallbackSourceSpellIds.length !== sourceSpellIds.length) {
    throw new SnapshotPipelineError(
      `Compatibility mapping for ${championId} ${slot.toUpperCase()} must provide one fallback source spell per selected source spell.`,
    );
  }

  return sourceSpellIds.map((spellId, sourceIndex) => {
    if (isCommunityDragonSpellId(spellId)) {
      const alternateId = communityDragonSpellId(spellId);
      const fallbackSpellId = fallbackSourceSpellIds?.[sourceIndex];
      if (!fallbackSpellId) {
        throw new SnapshotPipelineError(
          `Compatibility mapping for ${championId} ${slot.toUpperCase()} must provide fallbackSourceSpellIds for CommunityDragon spell ${alternateId}.`,
        );
      }

      const fallbackIndex = detail.spells.findIndex((spell) => spell.id === fallbackSpellId);
      if (fallbackIndex < 0) {
        throw new SnapshotPipelineError(
          `Compatibility mapping for ${championId} ${slot.toUpperCase()} references missing fallback source spell ${fallbackSpellId}. Check the manifest against the requested Data Dragon version.`,
        );
      }

      const alternateSpell = alternateSpellSources?.[championId]?.[alternateId];
      if (!alternateSpell) {
        throw new SnapshotPipelineError(
          `CommunityDragon source for ${championId} is missing alternate spell ${alternateId}. Check the versioned source and manifest mapping.`,
        );
      }

      const valueSourceSpellId = sourceDataValueSourceSpellIds?.[sourceIndex] ?? spellId;
      const valueSourceId = communityDragonSpellId(valueSourceSpellId);
      const valueSourceSpell = alternateSpellSources?.[championId]?.[valueSourceId];
      if (!valueSourceSpell) {
        throw new SnapshotPipelineError(
          `CommunityDragon source for ${championId} is missing alternate DataValue source spell ${valueSourceId}. Check the versioned source and manifest mapping.`,
        );
      }

      return {
        spell: applyAlternateSpell(
          detail.spells[fallbackIndex],
          alternateSpell,
          selectAlternateLevelTip(
            valueSourceSpell,
            sourceDataValueNames,
            sourceDataValueMultipliers,
            championId,
            slot,
          ),
        ),
        index: fallbackIndex,
        sourceRefs: [alternateSpell.sourceRef, `${detailUrl}#/spells/${fallbackIndex}`],
      };
    }

    if (fallbackSourceSpellIds) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} cannot provide fallbackSourceSpellIds for Data Dragon spell ${spellId}.`,
      );
    }

    const index = detail.spells.findIndex((spell) => spell.id === spellId);
    if (index < 0) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} references missing source spell ${spellId}. Check the manifest against the requested Data Dragon version.`,
      );
    }

    return { spell: detail.spells[index], index };
  });
}

function selectAlternateLevelTip(
  alternate: AlternateSpellRecord,
  sourceDataValueNames: readonly string[] | undefined,
  sourceDataValueMultipliers: Readonly<Record<string, number>> | undefined,
  championId: string,
  slot: Slot,
): AlternateSpellRecord['leveltip'] | undefined {
  if (!sourceDataValueNames) {
    return alternate.leveltip;
  }

  const valuesByName = new Map(
    (alternate.sourceValues ?? []).map((sourceValue) => [sourceValue.name, sourceValue]),
  );
  const selectedValues = sourceDataValueNames.map((name) => {
    const sourceValue = valuesByName.get(name);
    if (!sourceValue) {
      throw new SnapshotPipelineError(
        `Compatibility mapping for ${championId} ${slot.toUpperCase()} references missing CommunityDragon DataValue ${name} on ${alternate.id}. Check the versioned source and manifest mapping.`,
      );
    }

    const multiplier = sourceDataValueMultipliers?.[name] ?? 1;
    return {
      label: sourceValue.label,
      effect: sourceValue.values
        .map((value) => normalizeAlternateValue(value * multiplier))
        .join('/'),
    };
  });

  return {
    label: selectedValues.map((value) => value.label),
    effect: selectedValues.map((value) => value.effect),
  };
}

function applyAlternateSpell(
  fallback: RawSpell,
  alternate: AlternateSpellRecord,
  leveltip: AlternateSpellRecord['leveltip'] | undefined,
): RawSpell {
  return {
    ...fallback,
    id: alternate.id,
    ...(alternate.cooldown ? { cooldown: alternate.cooldown } : {}),
    ...(alternate.range ? { range: alternate.range } : {}),
    ...(leveltip
      ? {
          leveltip,
          effect: [],
          effectBurn: [],
        }
      : {}),
  };
}

function normalizeBodyComponent(
  summary: RawChampionSummary,
  detail: RawChampion,
  championId: string,
  variantId: string,
  override: ComponentOverride | undefined,
  options: NormalizeSnapshotOptions,
): Component {
  if (
    override?.sourceSpellIds ||
    override?.fallbackSourceSpellIds ||
    override?.sourceDataValueNames ||
    override?.sourceDataValueSourceSpellIds ||
    override?.sourceDataValueMultipliers
  ) {
    throw new SnapshotPipelineError(
      `Body override for ${championId} ${variantId} cannot reference an ability spell.`,
    );
  }

  const bodyStats = applyBodyStatsOverride(normalizeBodyStats(detail), override?.bodyStats);
  const shortDescription =
    override?.shortDescription ??
    `${capitalize(bodyStats.attackType)} body with ${bodyStats.movementSpeed} movement speed.`;
  const fullDescription =
    override?.fullDescription ??
    `Base stats, ${bodyStats.attackType} attack type, ${bodyStats.attackRange} attack range, and ${bodyStats.movementSpeed} movement speed.`;
  const sourceUrl = dataDragonChampionUrl(options.dataDragonVersion, summary.id);

  return {
    id: `${championId}:${variantId}:body`,
    slot: 'body',
    name: override?.name ?? summary.name,
    iconRef: dataDragonAssetUrl(options.dataDragonVersion, 'champion', summary.image.full),
    shortDescription,
    fullDescription,
    values: bodyStatDisplayValues(bodyStats),
    availability: override?.availability ?? { status: 'available' },
    dependencies: override?.dependencies ?? [],
    carriedMechanics: override?.carriedMechanics ?? [],
    sourceRefs: [
      `${sourceUrl}#/stats`,
      `${sourceUrl}#/image`,
      ...(override?.bodyStats?.sourceRefs ?? []),
    ],
    bodyStats,
  };
}

function applyBodyStatsOverride(
  bodyStats: BodyStats,
  override: BodyStatsOverride | undefined,
): BodyStats {
  if (!override) {
    return bodyStats;
  }

  return {
    ...bodyStats,
    base: { ...bodyStats.base, ...override.base },
    growth: { ...bodyStats.growth, ...override.growth },
    ...(override.attackRange === undefined ? {} : { attackRange: override.attackRange }),
    ...(override.attackType === undefined ? {} : { attackType: override.attackType }),
    ...(override.movementSpeed === undefined ? {} : { movementSpeed: override.movementSpeed }),
  };
}

function normalizeBodyStats(detail: RawChampion): BodyStats {
  const stats = detail.stats as RawChampion['stats'] & {
    attackType?: 'melee' | 'ranged';
    attacktype?: 'melee' | 'ranged';
  };
  const attackType =
    stats.attackType ?? stats.attacktype ?? (stats.attackrange > 200 ? 'ranged' : 'melee');

  return {
    base: {
      health: stats.hp,
      healthRegen: stats.hpregen,
      mana: stats.mp,
      manaRegen: stats.mpregen,
      armor: stats.armor,
      magicResist: stats.spellblock,
      attackDamage: stats.attackdamage,
      attackSpeed: stats.attackspeed,
    },
    growth: {
      health: stats.hpperlevel,
      healthRegen: stats.hpregenperlevel,
      mana: stats.mpperlevel,
      manaRegen: stats.mpregenperlevel,
      armor: stats.armorperlevel,
      magicResist: stats.spellblockperlevel,
      attackDamage: stats.attackdamageperlevel,
      attackSpeed: stats.attackspeedperlevel,
    },
    attackRange: stats.attackrange,
    attackType,
    movementSpeed: stats.movespeed,
  };
}

function bodyStatDisplayValues(bodyStats: BodyStats): DisplayValue[] {
  return [
    { label: 'Health', values: [bodyStats.base.health] },
    { label: 'Health growth', values: [bodyStats.growth.health] },
    { label: 'Health regeneration', values: [bodyStats.base.healthRegen] },
    { label: 'Health regeneration growth', values: [bodyStats.growth.healthRegen] },
    { label: 'Mana', values: [bodyStats.base.mana] },
    { label: 'Mana growth', values: [bodyStats.growth.mana] },
    { label: 'Mana regeneration', values: [bodyStats.base.manaRegen] },
    { label: 'Mana regeneration growth', values: [bodyStats.growth.manaRegen] },
    { label: 'Armor', values: [bodyStats.base.armor] },
    { label: 'Armor growth', values: [bodyStats.growth.armor] },
    { label: 'Magic resistance', values: [bodyStats.base.magicResist] },
    { label: 'Magic resistance growth', values: [bodyStats.growth.magicResist] },
    { label: 'Attack damage', values: [bodyStats.base.attackDamage] },
    { label: 'Attack damage growth', values: [bodyStats.growth.attackDamage] },
    { label: 'Attack speed', values: [bodyStats.base.attackSpeed] },
    { label: 'Attack speed growth', values: [bodyStats.growth.attackSpeed] },
    { label: 'Attack range', values: [bodyStats.attackRange] },
    { label: 'Movement speed', values: [bodyStats.movementSpeed] },
  ];
}

function normalizeAbilityComponent(
  detail: RawChampion,
  championId: string,
  variantId: string,
  slot: Exclude<Slot, 'body' | 'passive'>,
  sourceSpellIds: readonly string[],
  override: ComponentOverride | undefined,
  detailUrl: string,
  options: NormalizeSnapshotOptions,
): Component {
  const sourceSpells = getSourceSpells(
    detail,
    championId,
    slot,
    sourceSpellIds,
    override?.fallbackSourceSpellIds,
    override?.sourceDataValueNames,
    override?.sourceDataValueSourceSpellIds,
    override?.sourceDataValueMultipliers,
    options.alternateSpellSources,
    detailUrl,
  );
  const spells = sourceSpells.map(({ spell }) => spell);
  const names = spells.map((spell) => spell.name);
  const descriptions = spells.map((spell) => normalizeSourceDescription(spell.description));
  const packageDescription = names.join(', ');
  const values = spells.flatMap((spell) =>
    spellDisplayValues(spell, spells.length > 1 ? spell.name : undefined),
  );
  const cooldowns = sourceSpells
    .map(({ spell }) => displayValue('Cooldown', spell.cooldown, spell.name))
    .filter((value): value is DisplayValue => value !== undefined);
  const ranges = sourceSpells
    .map(({ spell }) => displayValue('Range', spell.range, spell.name))
    .filter((value): value is DisplayValue => value !== undefined);
  const healthCosts = sourceSpells
    .filter(({ spell }) => isHealthCost(spell.resource))
    .map(({ spell }) => displayValue('Health cost', spell.cost, spell.name))
    .filter((value): value is DisplayValue => value !== undefined);
  const primarySpell = spells[0];

  return {
    id: `${championId}:${variantId}:${slot}`,
    slot,
    name: override?.name ?? (spells.length === 1 ? primarySpell.name : packageDescription),
    iconRef: dataDragonAssetUrl(options.dataDragonVersion, 'spell', primarySpell.image.full),
    shortDescription:
      override?.shortDescription ??
      (spells.length === 1 ? descriptions[0] : `Spell package: ${packageDescription}.`),
    fullDescription:
      override?.fullDescription ??
      descriptions
        .map((description, index) =>
          spells.length === 1 ? description : `${spells[index].name}: ${description}`,
        )
        .join('\n\n'),
    ...(cooldowns[0] ? { cooldown: cooldowns[0] } : {}),
    ...(cooldowns.length > 0 ? { cooldowns } : {}),
    ...(ranges[0] ? { range: ranges[0] } : {}),
    ...(ranges.length > 0 ? { ranges } : {}),
    ...(healthCosts[0] ? { healthCost: healthCosts[0] } : {}),
    ...(healthCosts.length > 0 ? { healthCosts } : {}),
    values,
    availability: override?.availability ?? { status: 'available' },
    dependencies: override?.dependencies ?? [],
    carriedMechanics: override?.carriedMechanics ?? [],
    sourceRefs: sourceSpells.flatMap(
      ({ index, sourceRefs }) => sourceRefs ?? [`${detailUrl}#/spells/${index}`],
    ),
  };
}

function normalizePassiveComponent(
  detail: RawChampion,
  championId: string,
  variantId: string,
  override: ComponentOverride | undefined,
  detailUrl: string,
  options: NormalizeSnapshotOptions,
): Component {
  if (
    override?.sourceSpellIds ||
    override?.fallbackSourceSpellIds ||
    override?.sourceDataValueNames ||
    override?.sourceDataValueSourceSpellIds ||
    override?.sourceDataValueMultipliers
  ) {
    throw new SnapshotPipelineError(
      `Passive override for ${championId} ${variantId} cannot reference an ability spell.`,
    );
  }

  return {
    id: `${championId}:${variantId}:passive`,
    slot: 'passive',
    name: override?.name ?? detail.passive.name,
    iconRef: dataDragonAssetUrl(options.dataDragonVersion, 'passive', detail.passive.image.full),
    shortDescription:
      override?.shortDescription ?? normalizeSourceDescription(detail.passive.description),
    fullDescription:
      override?.fullDescription ?? normalizeSourceDescription(detail.passive.description),
    values: [],
    availability: override?.availability ?? { status: 'available' },
    dependencies: override?.dependencies ?? [],
    carriedMechanics: override?.carriedMechanics ?? [],
    sourceRefs: [`${detailUrl}#/passive`],
  };
}

function spellDisplayValues(spell: RawSpell, labelPrefix: string | undefined): DisplayValue[] {
  const levelLabels = spell.leveltip?.label ?? [];
  const levelEffects = spell.leveltip?.effect ?? [];
  const hasLevelTip = levelLabels.length > 0 || levelEffects.length > 0;
  const count = hasLevelTip
    ? Math.max(levelLabels.length, levelEffects.length)
    : Math.max(spell.effectBurn.length, spell.effect.length);
  const values: DisplayValue[] = [];

  for (let index = 0; index < count; index += 1) {
    const rawValue = firstDisplayValue(
      levelEffects[index],
      spell.effectBurn[index],
      spell.effect[index],
    );
    if (rawValue === undefined) {
      continue;
    }

    const sourceLabel = normalizeSourceDescription(levelLabels[index] || `Effect ${index + 1}`);
    if (isIgnoredResourceCostLabel(sourceLabel, spell.resource)) {
      continue;
    }
    values.push({
      label: labelPrefix ? `${labelPrefix} — ${sourceLabel}` : sourceLabel,
      values: parseDisplayValues(rawValue),
    });
  }

  return values;
}

function firstDisplayValue(
  ...candidates: Array<string | number | number[] | null | undefined>
): string | number | number[] | undefined {
  return candidates.find((candidate) => {
    if (candidate === null || candidate === undefined) {
      return false;
    }
    return typeof candidate === 'number' || Array.isArray(candidate) || candidate.trim().length > 0;
  }) as string | number | number[] | undefined;
}

function parseDisplayValues(value: string | number | number[]): Array<number | string> {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (typeof value === 'number') {
    return [value];
  }

  return value.split('/').map((part) => {
    const trimmed = part.trim();
    const numericValue = Number(trimmed);
    return trimmed.length > 0 && Number.isFinite(numericValue) ? numericValue : trimmed;
  });
}

function displayValue(
  label: string,
  values: readonly number[],
  sourceName: string | undefined,
): DisplayValue | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return {
    label: sourceName ? `${sourceName} — ${label}` : label,
    values: [...values],
  };
}

function isHealthCost(resource: string): boolean {
  return /\b(?:health|hp)\b/i.test(resource);
}

function isIgnoredResourceCostLabel(label: string, resource: string): boolean {
  return /\bcost\b/i.test(label) && !isHealthCost(resource);
}

function normalizeAlternateValue(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeSourceDescription(description: string): string {
  const normalized = description
    .replace(/<br\s*\/?>(\r?\n)?/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length === 0) {
    throw new SnapshotPipelineError('A source description contains no readable text.');
  }

  return normalized;
}

function buildEligibilityIndexes(champions: readonly Champion[]) {
  const eligibleChampionIds = champions
    .filter((champion) => !champion.excluded)
    .map((champion) => champion.id)
    .sort();
  const excludedChampionIds = champions
    .filter((champion) => champion.excluded)
    .map((champion) => champion.id)
    .sort();
  const variantIdsByChampionId = Object.fromEntries(
    champions.map((champion) => [
      champion.id,
      champion.variants.map((variant) => variant.id).sort(),
    ]),
  );
  const selectableComponentIdsBySlot = Object.fromEntries(
    SLOT_ORDER.map((slot) => [
      slot,
      champions
        .flatMap((champion) => champion.variants.map((variant) => variant.components[slot]))
        .filter((component) => component.availability.status !== 'unavailable')
        .map((component) => component.id)
        .sort(),
    ]),
  );

  return {
    eligibleChampionIds,
    excludedChampionIds,
    variantIdsByChampionId,
    selectableComponentIdsBySlot,
  };
}

export function createPatchChangeReport(
  previousInput: unknown,
  currentInput: ChampionSnapshot,
  manifestInput: CompatibilityManifest,
): string {
  const current = validateChampionSnapshot(currentInput);
  const previous =
    previousInput === undefined ? undefined : validateChampionSnapshot(previousInput);
  const manifest = validateCompatibilityManifest(manifestInput);
  const previousById = new Map(previous?.champions.map((champion) => [champion.id, champion]));
  const currentById = new Map(current.champions.map((champion) => [champion.id, champion]));
  const addedChampionIds = current.champions
    .filter((champion) => !previousById.has(champion.id))
    .map((champion) => champion.id);
  const removedChampionIds = (previous?.champions ?? [])
    .filter((champion) => !currentById.has(champion.id))
    .map((champion) => champion.id);
  const changedChampionIds = new Set([...addedChampionIds, ...removedChampionIds]);
  const valueChanges: string[] = [];
  const variantChanges: string[] = [];

  if (previous) {
    for (const currentChampion of current.champions) {
      const previousChampion = previousById.get(currentChampion.id);
      if (!previousChampion) {
        continue;
      }

      const previousVariants = new Map(
        previousChampion.variants.map((variant) => [variant.id, variant]),
      );
      const currentVariants = new Map(
        currentChampion.variants.map((variant) => [variant.id, variant]),
      );

      for (const variant of currentChampion.variants) {
        if (!previousVariants.has(variant.id)) {
          variantChanges.push(`${currentChampion.name} / ${variant.id}: added`);
          changedChampionIds.add(currentChampion.id);
        }
      }
      for (const variant of previousChampion.variants) {
        if (!currentVariants.has(variant.id)) {
          variantChanges.push(`${previousChampion.name} / ${variant.id}: removed`);
          changedChampionIds.add(currentChampion.id);
        }
      }

      for (const currentVariant of currentChampion.variants) {
        const previousVariant = previousVariants.get(currentVariant.id);
        if (!previousVariant) {
          continue;
        }

        for (const slot of SLOT_ORDER) {
          const currentComponent = currentVariant.components[slot];
          const previousComponent = previousVariant.components[slot];
          if (!previousComponent) {
            continue;
          }

          const previousValues = componentValueFingerprint(previousComponent);
          const currentValues = componentValueFingerprint(currentComponent);
          if (previousValues !== currentValues) {
            valueChanges.push(
              `${currentChampion.name} / ${currentVariant.label ?? currentVariant.id} / ${slot}: values changed\n  previous: ${previousValues}\n  current: ${currentValues}`,
            );
            changedChampionIds.add(currentChampion.id);
          }
        }
      }
    }
  }

  const affectedExceptions = manifest.entries.filter((entry) =>
    changedChampionIds.has(toChampionId(entry.championId)),
  );
  const lines = [
    '# Champion data change report',
    '',
    `- Previous snapshot: ${previous?.dataDragonVersion ?? 'none'}`,
    `- Current snapshot: ${current.dataDragonVersion}`,
    `- Champions: ${current.champions.length} (${current.indexes.eligibleChampionIds.length} eligible, ${current.indexes.excludedChampionIds.length} excluded)`,
    '',
    '## Champion additions',
    ...formatReportItems(addedChampionIds),
    '',
    '## Champion removals',
    ...formatReportItems(removedChampionIds),
    '',
    '## Variant changes',
    ...formatReportItems(variantChanges),
    '',
    '## Value changes',
    ...formatReportItems(valueChanges),
    '',
    '## Affected compatibility exceptions',
    ...formatReportItems(
      affectedExceptions.map(
        (entry) =>
          `${entry.championId}: ${entry.notes[0]} (reviewed for ${entry.reviewedForDataDragonVersion})`,
      ),
    ),
  ];

  return `${lines.join('\n')}\n`;
}

function componentValueFingerprint(component: Component): string {
  return stableJsonStringify({
    bodyStats: component.bodyStats,
    cooldown: component.cooldown,
    cooldowns: component.cooldowns,
    healthCost: component.healthCost,
    healthCosts: component.healthCosts,
    range: component.range,
    ranges: component.ranges,
    values: component.values,
  });
}

function formatReportItems(items: readonly string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- None'];
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
