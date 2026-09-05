import {
  ChampionSnapshotSchema,
  type ChampionSnapshot,
  type Component,
} from '../data/snapshot-schema.ts';

import { DRAFT_SLOT_ORDER, type DraftSlot } from './draft-engine.ts';

type FixtureVariantDefinition = {
  readonly id: string;
  readonly availableSlots: readonly DraftSlot[];
  readonly label?: string;
};

type FixtureChampionDefinition = {
  readonly id: string;
  readonly randomWeight?: number;
  readonly variants: readonly FixtureVariantDefinition[];
};

const ALL_SLOTS = [...DRAFT_SLOT_ORDER];

/** Small, fully portable champions used to exercise ordinary generation. */
export const NORMAL_DRAFT_FIXTURE = makeFixtureSnapshot([
  ...['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'].map((id) => ({
    id,
    variants: [{ id: `${id}-default`, availableSlots: ALL_SLOTS }],
  })),
]);

/**
 * A compact roster where every variant omits several components. It keeps
 * enough overlap to make each safe displayed choice continue to six locks.
 */
export const RESTRICTED_DRAFT_FIXTURE = makeFixtureSnapshot([
  { id: 'body-q-w', variants: [{ id: 'body-q-w-default', availableSlots: ['body', 'q', 'w'] }] },
  { id: 'body-e-r', variants: [{ id: 'body-e-r-default', availableSlots: ['body', 'e', 'r'] }] },
  {
    id: 'q-e-passive',
    variants: [{ id: 'q-e-passive-default', availableSlots: ['q', 'e', 'passive'] }],
  },
  {
    id: 'w-r-passive',
    variants: [{ id: 'w-r-passive-default', availableSlots: ['w', 'r', 'passive'] }],
  },
  {
    id: 'body-w-passive',
    variants: [{ id: 'body-w-passive-default', availableSlots: ['body', 'w', 'passive'] }],
  },
  { id: 'q-e-r', variants: [{ id: 'q-e-r-default', availableSlots: ['q', 'e', 'r'] }] },
  {
    id: 'body-q-passive',
    variants: [{ id: 'body-q-passive-default', availableSlots: ['body', 'q', 'passive'] }],
  },
  { id: 'w-e-r', variants: [{ id: 'w-e-r-default', availableSlots: ['w', 'e', 'r'] }] },
]);

/** One weighted base champion with two variants sharing its no-repeat identity. */
export const VARIANT_DRAFT_FIXTURE = makeFixtureSnapshot([
  {
    id: 'form-champ',
    randomWeight: 4,
    variants: [
      { id: 'form-champ-light', label: 'Light form', availableSlots: ['body', 'q', 'w'] },
      { id: 'form-champ-heavy', label: 'Heavy form', availableSlots: ['body', 'e', 'r'] },
    ],
  },
  ...['plain-a', 'plain-b', 'plain-c', 'plain-d', 'plain-e', 'plain-f', 'plain-g'].map((id) => ({
    id,
    randomWeight: 1,
    variants: [{ id: `${id}-default`, availableSlots: ALL_SLOTS }],
  })),
]);

/**
 * The trap has several visible components, but two choices dead-end a later
 * slot assignment. The adaptive solver must never show this offer at round
 * one even though it has enough selectable components.
 */
export const ADVERSARIAL_DRAFT_FIXTURE = makeFixtureSnapshot([
  { id: 'trap', variants: [{ id: 'trap-default', availableSlots: ['q', 'e', 'r', 'passive'] }] },
  {
    id: 'safe-a',
    variants: [{ id: 'safe-a-default', availableSlots: ['body', 'w', 'e', 'passive'] }],
  },
  {
    id: 'safe-b',
    variants: [{ id: 'safe-b-default', availableSlots: ['w', 'e', 'r', 'passive'] }],
  },
  {
    id: 'safe-c',
    variants: [{ id: 'safe-c-default', availableSlots: ['body', 'q', 'w', 'r', 'passive'] }],
  },
  { id: 'safe-d', variants: [{ id: 'safe-d-default', availableSlots: ['body', 'q', 'e'] }] },
  { id: 'safe-e', variants: [{ id: 'safe-e-default', availableSlots: ['body', 'r', 'passive'] }] },
  { id: 'safe-f', variants: [{ id: 'safe-f-default', availableSlots: ['body', 'w'] }] },
  { id: 'safe-g', variants: [{ id: 'safe-g-default', availableSlots: ['body', 'passive'] }] },
]);

export const DRAFT_ENGINE_FIXTURES = {
  normal: NORMAL_DRAFT_FIXTURE,
  restricted: RESTRICTED_DRAFT_FIXTURE,
  variant: VARIANT_DRAFT_FIXTURE,
  adversarial: ADVERSARIAL_DRAFT_FIXTURE,
} as const;

function makeFixtureSnapshot(definitions: readonly FixtureChampionDefinition[]): ChampionSnapshot {
  const champions = definitions.map((definition) => makeFixtureChampion(definition));
  const sortedChampions = [...champions].sort((left, right) => left.id.localeCompare(right.id));
  const variantIdsByChampionId = Object.fromEntries(
    sortedChampions.map((champion) => [
      champion.id,
      [...champion.variants].map((variant) => variant.id).sort(),
    ]),
  );
  const selectableComponentIdsBySlot = Object.fromEntries(
    DRAFT_SLOT_ORDER.map((slot) => [
      slot,
      sortedChampions
        .flatMap((champion) => champion.variants.map((variant) => variant.components[slot]))
        .filter((component) => component.availability.status !== 'unavailable')
        .map((component) => component.id)
        .sort(),
    ]),
  );

  return ChampionSnapshotSchema.parse({
    schemaVersion: 1,
    dataDragonVersion: 'fixture-1.0.0',
    locale: 'en_US',
    generatedAt: '2026-09-05T00:00:00.000Z',
    source: {
      provider: 'riot-data-dragon',
      versionUrl: 'https://ddragon.leagueoflegends.com/cdn/fixture-1.0.0/data/en_US/champion.json',
    },
    generation: {
      importerVersion: 'fixture',
      sourceHash: 'c'.repeat(64),
      sourceChampionCount: champions.length,
    },
    indexes: {
      eligibleChampionIds: sortedChampions.map((champion) => champion.id),
      excludedChampionIds: [],
      variantIdsByChampionId,
      selectableComponentIdsBySlot,
    },
    champions: sortedChampions,
  });
}

function makeFixtureChampion(
  definition: FixtureChampionDefinition,
): ChampionSnapshot['champions'][number] {
  return {
    id: definition.id,
    riotKey: definition.id,
    name: definition.id,
    title: 'a fixture champion',
    excluded: false,
    randomWeight: definition.randomWeight ?? 1,
    assetRefs: {
      icon: `fixture://${definition.id}/icon.png`,
      defaultSplash: `fixture://${definition.id}/splash.jpg`,
      defaultLoading: `fixture://${definition.id}/loading.jpg`,
    },
    variants: definition.variants.map((variantDefinition) =>
      makeFixtureVariant(definition.id, variantDefinition),
    ),
  };
}

function makeFixtureVariant(
  championId: string,
  definition: FixtureVariantDefinition,
): ChampionSnapshot['champions'][number]['variants'][number] {
  const components = {} as Record<DraftSlot, Component>;
  for (const slot of DRAFT_SLOT_ORDER) {
    const isAvailable = definition.availableSlots.includes(slot);
    const component: Component = {
      id: `${championId}-${definition.id}-${slot}`,
      slot,
      name: `${championId} ${slot}`,
      iconRef: `fixture://${championId}/${slot}.png`,
      shortDescription: isAvailable ? `Fixture ${slot} component.` : 'Requires original kit.',
      fullDescription: isAvailable
        ? `Fixture data for the ${slot} component.`
        : 'This fixture component is unavailable without its original kit.',
      values: [],
      availability: isAvailable
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reasonCode: 'requires-original-kit',
            summary: 'Requires original kit.',
          },
      dependencies: [],
      carriedMechanics: [],
      sourceRefs: [`fixture://${championId}/${definition.id}/${slot}`],
      ...(slot === 'body' ? { bodyStats: makeFixtureBodyStats() } : {}),
    };
    components[slot] = component;
  }

  return {
    id: definition.id,
    championId,
    ...(definition.label ? { label: definition.label } : {}),
    components,
  };
}

function makeFixtureBodyStats(): NonNullable<Component['bodyStats']> {
  return {
    base: {
      health: 600,
      healthRegen: 6,
      mana: 300,
      manaRegen: 7,
      armor: 30,
      magicResist: 32,
      attackDamage: 60,
      attackSpeed: 0.65,
    },
    growth: {
      health: 100,
      healthRegen: 0.6,
      mana: 40,
      manaRegen: 0.8,
      armor: 4,
      magicResist: 1.3,
      attackDamage: 3,
      attackSpeed: 2.5,
    },
    attackRange: 175,
    attackType: 'melee',
    movementSpeed: 340,
  };
}
