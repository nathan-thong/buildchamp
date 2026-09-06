import { z } from 'zod';

export const CHAMPION_DATA_SCHEMA_VERSION = 1 as const;
export const DATA_DRAGON_LOCALE = 'en_US' as const;
export const IMPORTER_VERSION = '1.2.0' as const;

const nonEmptyString = z.string().min(1);
const finiteNumber = z.number().finite();
const SNAPSHOT_SLOTS = ['body', 'q', 'w', 'e', 'r', 'passive'] as const;

export const SlotSchema = z.enum(['body', 'q', 'w', 'e', 'r', 'passive']);
export type Slot = z.infer<typeof SlotSchema>;

export const AvailabilitySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available') }).strict(),
  z
    .object({
      status: z.literal('conditional'),
      ruleId: nonEmptyString,
      summary: nonEmptyString,
    })
    .strict(),
  z
    .object({
      status: z.literal('unavailable'),
      reasonCode: z.enum([
        'requires-original-kit',
        'overwrites-other-slots',
        'nonfunctional-without-shared-system',
        'excluded-champion',
        'unsupported-data',
      ]),
      summary: nonEmptyString,
    })
    .strict(),
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const DisplayValueSchema = z
  .object({
    label: nonEmptyString,
    values: z.array(z.union([finiteNumber, nonEmptyString])).min(1),
    units: nonEmptyString.optional(),
  })
  .strict();
export type DisplayValue = z.infer<typeof DisplayValueSchema>;

export const DependencySchema = z
  .object({
    kind: z.enum(['self-state', 'resource', 'form', 'weapon', 'other-slot']),
    description: nonEmptyString,
  })
  .strict();
export type Dependency = z.infer<typeof DependencySchema>;

export const CarriedMechanicSchema = z
  .object({
    id: nonEmptyString,
    description: nonEmptyString,
  })
  .strict();
export type CarriedMechanic = z.infer<typeof CarriedMechanicSchema>;

const BodyStatValuesSchema = z
  .object({
    health: finiteNumber,
    healthRegen: finiteNumber,
    mana: finiteNumber,
    manaRegen: finiteNumber,
    armor: finiteNumber,
    magicResist: finiteNumber,
    attackDamage: finiteNumber,
    attackSpeed: finiteNumber,
  })
  .strict();

export const BodyStatsSchema = z
  .object({
    base: BodyStatValuesSchema,
    growth: BodyStatValuesSchema,
    attackRange: finiteNumber,
    attackType: z.enum(['melee', 'ranged']),
    movementSpeed: finiteNumber,
  })
  .strict();
export type BodyStats = z.infer<typeof BodyStatsSchema>;

export const BodyStatsOverrideSchema = z
  .object({
    base: BodyStatValuesSchema.partial().optional(),
    growth: BodyStatValuesSchema.partial().optional(),
    attackRange: finiteNumber.optional(),
    attackType: z.enum(['melee', 'ranged']).optional(),
    movementSpeed: finiteNumber.optional(),
    sourceRefs: z.array(nonEmptyString).min(1),
  })
  .strict();
export type BodyStatsOverride = z.infer<typeof BodyStatsOverrideSchema>;

const ComponentRecordSchema = z
  .object({
    body: z.lazy(() => ComponentSchema),
    q: z.lazy(() => ComponentSchema),
    w: z.lazy(() => ComponentSchema),
    e: z.lazy(() => ComponentSchema),
    r: z.lazy(() => ComponentSchema),
    passive: z.lazy(() => ComponentSchema),
  })
  .strict();

export const ComponentSchema = z
  .object({
    id: nonEmptyString,
    slot: SlotSchema,
    name: nonEmptyString,
    iconRef: nonEmptyString,
    shortDescription: nonEmptyString,
    fullDescription: nonEmptyString,
    cooldown: DisplayValueSchema.optional(),
    cooldowns: z.array(DisplayValueSchema).min(1).optional(),
    range: DisplayValueSchema.optional(),
    ranges: z.array(DisplayValueSchema).min(1).optional(),
    healthCost: DisplayValueSchema.optional(),
    healthCosts: z.array(DisplayValueSchema).min(1).optional(),
    values: z.array(DisplayValueSchema),
    availability: AvailabilitySchema,
    dependencies: z.array(DependencySchema),
    carriedMechanics: z.array(CarriedMechanicSchema),
    sourceRefs: z.array(nonEmptyString).min(1),
    bodyStats: BodyStatsSchema.optional(),
  })
  .strict()
  .superRefine((component, context) => {
    if (component.slot === 'body' && !component.bodyStats) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bodyStats'],
        message: 'Body components must include normalized body stats.',
      });
    }

    if (component.slot !== 'body' && component.bodyStats) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bodyStats'],
        message: 'Only Body components may include body stats.',
      });
    }
  });
export type Component = z.infer<typeof ComponentSchema>;

export const DraftVariantSchema = z
  .object({
    id: nonEmptyString,
    championId: nonEmptyString,
    label: nonEmptyString.optional(),
    components: ComponentRecordSchema,
  })
  .strict();
export type DraftVariant = z.infer<typeof DraftVariantSchema>;

export const AssetRefsSchema = z
  .object({
    icon: nonEmptyString,
    defaultSplash: nonEmptyString,
    defaultLoading: nonEmptyString,
  })
  .strict();

export const ChampionSchema = z
  .object({
    id: nonEmptyString,
    riotKey: nonEmptyString,
    name: nonEmptyString,
    title: nonEmptyString,
    excluded: z.boolean(),
    exclusionReason: nonEmptyString.optional(),
    randomWeight: finiteNumber.min(0),
    assetRefs: AssetRefsSchema,
    variants: z.array(DraftVariantSchema),
  })
  .strict()
  .superRefine((champion, context) => {
    if (!champion.excluded && champion.variants.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'A non-excluded champion must have at least one draft variant.',
      });
    }

    if (champion.excluded && !champion.exclusionReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exclusionReason'],
        message: 'An excluded champion must explain why it is excluded.',
      });
    }

    const variantIds = new Set<string>();
    for (const [variantIndex, variant] of champion.variants.entries()) {
      if (variant.championId !== champion.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', variantIndex, 'championId'],
          message: `Variant must reference its owning champion ${champion.id}.`,
        });
      }

      if (variantIds.has(variant.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', variantIndex, 'id'],
          message: `Duplicate variant id ${variant.id}.`,
        });
      }
      variantIds.add(variant.id);

      for (const [slot, component] of Object.entries(variant.components)) {
        if (component.slot !== slot) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variants', variantIndex, 'components', slot, 'slot'],
            message: `Component slot must match its ${slot} record key.`,
          });
        }
      }
    }
  });
export type Champion = z.infer<typeof ChampionSchema>;

const SlotIndexSchema = z
  .object({
    body: z.array(nonEmptyString),
    q: z.array(nonEmptyString),
    w: z.array(nonEmptyString),
    e: z.array(nonEmptyString),
    r: z.array(nonEmptyString),
    passive: z.array(nonEmptyString),
  })
  .strict();

export const EligibilityIndexesSchema = z
  .object({
    eligibleChampionIds: z.array(nonEmptyString),
    excludedChampionIds: z.array(nonEmptyString),
    variantIdsByChampionId: z.record(z.array(nonEmptyString)),
    selectableComponentIdsBySlot: SlotIndexSchema,
  })
  .strict();
export type EligibilityIndexes = z.infer<typeof EligibilityIndexesSchema>;

export const ChampionSnapshotSchema = z
  .object({
    schemaVersion: z.literal(CHAMPION_DATA_SCHEMA_VERSION),
    dataDragonVersion: nonEmptyString,
    locale: z.literal(DATA_DRAGON_LOCALE),
    generatedAt: z.string().datetime({ offset: true }),
    source: z
      .object({
        provider: z.literal('riot-data-dragon'),
        versionUrl: z.string().url(),
      })
      .strict(),
    generation: z
      .object({
        importerVersion: nonEmptyString,
        sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
        sourceChampionCount: z.number().int().positive(),
      })
      .strict(),
    indexes: EligibilityIndexesSchema,
    champions: z.array(ChampionSchema).min(1),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const championIds = new Set<string>();
    for (const [index, champion] of snapshot.champions.entries()) {
      if (championIds.has(champion.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['champions', index, 'id'],
          message: `Duplicate champion id ${champion.id}.`,
        });
      }
      championIds.add(champion.id);
    }

    const expectedEligibleIds = snapshot.champions
      .filter((champion) => !champion.excluded)
      .map((champion) => champion.id)
      .sort();
    const expectedExcludedIds = snapshot.champions
      .filter((champion) => champion.excluded)
      .map((champion) => champion.id)
      .sort();

    if (
      JSON.stringify(snapshot.indexes.eligibleChampionIds) !== JSON.stringify(expectedEligibleIds)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['indexes', 'eligibleChampionIds'],
        message: 'Eligibility index does not match the non-excluded champion list.',
      });
    }

    if (
      JSON.stringify(snapshot.indexes.excludedChampionIds) !== JSON.stringify(expectedExcludedIds)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['indexes', 'excludedChampionIds'],
        message: 'Excluded index does not match the excluded champion list.',
      });
    }

    if (snapshot.generation.sourceChampionCount !== snapshot.champions.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['generation', 'sourceChampionCount'],
        message: 'Generation champion count does not match the normalized champion list.',
      });
    }

    const expectedVariantChampionIds = snapshot.champions.map((champion) => champion.id).sort();
    const actualVariantChampionIds = Object.keys(snapshot.indexes.variantIdsByChampionId).sort();
    if (JSON.stringify(actualVariantChampionIds) !== JSON.stringify(expectedVariantChampionIds)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['indexes', 'variantIdsByChampionId'],
        message: 'Variant index keys do not match the champion list.',
      });
    }

    for (const champion of snapshot.champions) {
      const expectedVariantIds = champion.variants.map((variant) => variant.id).sort();
      const indexedVariantIds = [
        ...(snapshot.indexes.variantIdsByChampionId[champion.id] ?? []),
      ].sort();
      if (JSON.stringify(indexedVariantIds) !== JSON.stringify(expectedVariantIds)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['indexes', 'variantIdsByChampionId', champion.id],
          message: `Variant index does not match ${champion.id}.`,
        });
      }
    }

    for (const slot of SNAPSHOT_SLOTS) {
      const expectedComponentIds = snapshot.champions
        .flatMap((champion) => champion.variants.map((variant) => variant.components[slot]))
        .filter((component) => component.availability.status !== 'unavailable')
        .map((component) => component.id)
        .sort();
      const actualComponentIds = [...snapshot.indexes.selectableComponentIdsBySlot[slot]].sort();
      if (JSON.stringify(actualComponentIds) !== JSON.stringify(expectedComponentIds)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['indexes', 'selectableComponentIdsBySlot', slot],
          message: `Selectable component index does not match the ${slot} components.`,
        });
      }
    }
  });
export type ChampionSnapshot = z.infer<typeof ChampionSnapshotSchema>;

export const RawImageSchema = z
  .object({
    full: nonEmptyString,
  })
  .passthrough();

export const RawStatsSchema = z
  .object({
    hp: finiteNumber,
    hpperlevel: finiteNumber,
    mp: finiteNumber,
    mpperlevel: finiteNumber,
    movespeed: finiteNumber,
    armor: finiteNumber,
    armorperlevel: finiteNumber,
    spellblock: finiteNumber,
    spellblockperlevel: finiteNumber,
    attackrange: finiteNumber,
    hpregen: finiteNumber,
    hpregenperlevel: finiteNumber,
    mpregen: finiteNumber,
    mpregenperlevel: finiteNumber,
    crit: finiteNumber,
    critperlevel: finiteNumber,
    attackdamage: finiteNumber,
    attackdamageperlevel: finiteNumber,
    attackspeedperlevel: finiteNumber,
    attackspeed: finiteNumber,
  })
  .passthrough();

export const RawLevelTipSchema = z
  .object({
    label: z.array(z.string()),
    effect: z.array(z.string()),
  })
  .passthrough();

const RawEffectValueSchema = z.union([finiteNumber, z.string(), z.array(finiteNumber), z.null()]);

export const RawSpellSchema = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    description: nonEmptyString,
    tooltip: nonEmptyString,
    leveltip: RawLevelTipSchema.optional(),
    cooldown: z.array(finiteNumber),
    range: z.array(finiteNumber),
    effect: z.array(RawEffectValueSchema),
    effectBurn: z.array(z.union([z.string(), z.null()])),
    cost: z.array(finiteNumber),
    resource: nonEmptyString,
    image: RawImageSchema,
  })
  .passthrough();

export const RawPassiveSchema = z
  .object({
    name: nonEmptyString,
    description: nonEmptyString,
    image: RawImageSchema,
  })
  .passthrough();

export const RawChampionSummarySchema = z
  .object({
    id: nonEmptyString,
    key: nonEmptyString,
    name: nonEmptyString,
    title: nonEmptyString,
    image: RawImageSchema,
  })
  .passthrough();

export const RawChampionSchema = z
  .object({
    id: nonEmptyString,
    key: nonEmptyString,
    name: nonEmptyString,
    title: nonEmptyString,
    image: RawImageSchema,
    stats: RawStatsSchema,
    spells: z.array(RawSpellSchema).min(4),
    passive: RawPassiveSchema,
  })
  .passthrough();

export const RawChampionIndexSchema = z
  .object({
    type: nonEmptyString,
    format: nonEmptyString,
    version: nonEmptyString,
    data: z.record(RawChampionSummarySchema).refine((data) => Object.keys(data).length > 0, {
      message: 'Champion index must contain at least one champion.',
    }),
  })
  .passthrough();

export const RawChampionDetailResponseSchema = z
  .object({
    type: nonEmptyString,
    format: nonEmptyString,
    version: nonEmptyString,
    data: z.record(RawChampionSchema).refine((data) => Object.keys(data).length > 0, {
      message: 'Champion detail response must contain a champion.',
    }),
  })
  .passthrough();

export const RawDataDragonSourceSchema = z
  .object({
    version: nonEmptyString,
    locale: z.literal(DATA_DRAGON_LOCALE),
    summary: RawChampionIndexSchema,
    details: z.record(RawChampionSchema),
  })
  .strict();
export type RawChampionSummary = z.infer<typeof RawChampionSummarySchema>;
export type RawChampion = z.infer<typeof RawChampionSchema>;
export type RawChampionIndex = z.infer<typeof RawChampionIndexSchema>;
export type RawChampionDetailResponse = z.infer<typeof RawChampionDetailResponseSchema>;
export type RawDataDragonSource = z.infer<typeof RawDataDragonSourceSchema>;

export const ComponentOverrideSchema = z
  .object({
    availability: AvailabilitySchema.optional(),
    bodyStats: BodyStatsOverrideSchema.optional(),
    iconRef: z.string().url().optional(),
    sourceSpellIds: z.array(nonEmptyString).min(1).optional(),
    fallbackSourceSpellIds: z.array(nonEmptyString).min(1).optional(),
    sourceDataValueNames: z.array(nonEmptyString).min(1).optional(),
    sourceDataValueSourceSpellIds: z.array(nonEmptyString).min(1).optional(),
    sourceDataValueMultipliers: z.record(finiteNumber).optional(),
    name: nonEmptyString.optional(),
    shortDescription: nonEmptyString.optional(),
    fullDescription: nonEmptyString.optional(),
    dependencies: z.array(DependencySchema).optional(),
    carriedMechanics: z.array(CarriedMechanicSchema).optional(),
  })
  .strict();
export type ComponentOverride = z.infer<typeof ComponentOverrideSchema>;

const ComponentOverridesSchema = z
  .object({
    body: ComponentOverrideSchema.optional(),
    q: ComponentOverrideSchema.optional(),
    w: ComponentOverrideSchema.optional(),
    e: ComponentOverrideSchema.optional(),
    r: ComponentOverrideSchema.optional(),
    passive: ComponentOverrideSchema.optional(),
  })
  .strict();

export const CompatibilityVariantSchema = z
  .object({
    id: nonEmptyString,
    label: nonEmptyString,
    componentOverrides: ComponentOverridesSchema,
  })
  .strict();
export type CompatibilityVariant = z.infer<typeof CompatibilityVariantSchema>;

const AssetOverridesSchema = z
  .object({
    defaultSplash: z.string().url().optional(),
    defaultLoading: z.string().url().optional(),
  })
  .strict();
export type AssetOverrides = z.infer<typeof AssetOverridesSchema>;

export const CompatibilityEntrySchema = z
  .object({
    championId: nonEmptyString,
    excludeChampion: z.object({ reason: nonEmptyString }).strict().optional(),
    assetOverrides: AssetOverridesSchema.optional(),
    variants: z.array(CompatibilityVariantSchema).optional(),
    notes: z.array(nonEmptyString).min(1),
    sourceRefs: z.array(nonEmptyString).min(1),
    reviewedForDataDragonVersion: nonEmptyString,
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.excludeChampion && entry.variants && entry.variants.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'An excluded champion cannot also define draft variants.',
      });
    }

    const variantIds = entry.variants?.map((variant) => variant.id) ?? [];
    if (new Set(variantIds).size !== variantIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Compatibility variants must have unique ids.',
      });
    }
  });
export type CompatibilityEntry = z.infer<typeof CompatibilityEntrySchema>;

export const CompatibilityManifestSchema = z
  .object({
    schemaVersion: z.literal(CHAMPION_DATA_SCHEMA_VERSION),
    entries: z.array(CompatibilityEntrySchema),
  })
  .strict();
export type CompatibilityManifest = z.infer<typeof CompatibilityManifestSchema>;
