import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPATIBILITY_MANIFEST } from './compatibility-manifest';
import {
  makeExceptionSource,
  makeAlternateSpellSources,
  makeRawChampion,
  makeRawSource,
  TEST_DATA_DRAGON_VERSION,
} from './test-fixtures';
import {
  createPatchChangeReport,
  normalizeChampionSnapshot,
  serializeSnapshot,
  SnapshotPipelineError,
  stableJsonStringify,
} from './snapshot-pipeline';

const TEST_COMPATIBILITY_MANIFEST = JSON.parse(
  JSON.stringify(DEFAULT_COMPATIBILITY_MANIFEST),
) as typeof DEFAULT_COMPATIBILITY_MANIFEST;
for (const entry of TEST_COMPATIBILITY_MANIFEST.entries) {
  entry.reviewedForDataDragonVersion = TEST_DATA_DRAGON_VERSION;
  entry.sourceRefs = entry.sourceRefs.map((sourceRef) =>
    sourceRef.replace(/\/cdn\/[^/]+\//, `/cdn/${TEST_DATA_DRAGON_VERSION}/`),
  );
}

const TEST_FIXTURE_MANIFEST = {
  ...TEST_COMPATIBILITY_MANIFEST,
  entries: TEST_COMPATIBILITY_MANIFEST.entries.filter(
    (entry) =>
      ![
        'azir',
        'aurelion-sol',
        'fiddlesticks',
        'heimerdinger',
        'illaoi',
        'kalista',
        'karma',
        'leblanc',
        'mel',
        'pantheon',
        'renekton',
        'riven',
        'rumble',
        'sejuani',
        'smolder',
        'syndra',
        'twitch',
        'viktor',
        'xayah',
        'yorick',
        'yunara',
        'zilean',
        'zyra',
      ].includes(entry.championId),
  ),
};

const GENERATION_OPTIONS = {
  dataDragonVersion: TEST_DATA_DRAGON_VERSION,
  generatedAt: '2026-09-05T00:00:00.000Z',
  sourceHash: 'a'.repeat(64),
  manifest: TEST_FIXTURE_MANIFEST,
  alternateSpellSources: makeAlternateSpellSources(),
};

describe('normalizeChampionSnapshot', () => {
  it('normalizes source stats, abilities, assets, provenance, and deterministic indexes', () => {
    const source = makeExceptionSource();
    const first = normalizeChampionSnapshot(source, GENERATION_OPTIONS);
    const second = normalizeChampionSnapshot(source, GENERATION_OPTIONS);

    expect(stableJsonStringify(first)).toBe(stableJsonStringify(second));
    expect(first.schemaVersion).toBe(1);
    expect(first.dataDragonVersion).toBe(TEST_DATA_DRAGON_VERSION);
    expect(first.generation).toEqual({
      importerVersion: '1.2.0',
      sourceHash: 'a'.repeat(64),
      sourceChampionCount: 12,
    });
    expect(first.indexes.eligibleChampionIds).toEqual([
      'elise',
      'gnar',
      'hwei',
      'jayce',
      'kayn',
      'kled',
      'nidalee',
      'normal-champ',
      'rek-sai',
      'shyvana',
      'viego',
    ]);
    expect(first.indexes.excludedChampionIds).toEqual(['aphelios']);

    const normalChampion = first.champions.find((champion) => champion.id === 'normal-champ');
    expect(normalChampion?.variants).toHaveLength(1);
    expect(normalChampion?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 550,
      attackType: 'ranged',
      movementSpeed: 340,
      base: { health: 600, attackDamage: 60 },
      growth: { health: 100, attackDamage: 3 },
    });
    expect(normalChampion?.variants[0]?.components.q.healthCost?.values).toEqual([
      20, 20, 20, 20, 20,
    ]);
    expect(
      normalChampion?.variants[0]?.components.q.values.map((value) => value.label),
    ).not.toContain('Mana Cost');
    expect(normalChampion?.assetRefs.defaultSplash).toBe(
      'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/NormalChamp_0.jpg',
    );
    expect(normalChampion?.assetRefs.defaultLoading).toBe(
      'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/NormalChamp_0.jpg',
    );
    expect(normalChampion?.variants[0]?.components.q.sourceRefs[0]).toContain(
      '/champion/NormalChamp.json#/spells/0',
    );
  });

  it('keeps summaries concise and omits unresolved formula templates', () => {
    const source = makeExceptionSource();
    const normalChampion = source.details.NormalChamp;
    if (!normalChampion) {
      throw new Error('NormalChamp fixture is missing.');
    }

    normalChampion.spells[0].description =
      'The first sentence stays in the card. The second sentence belongs in the full details panel.';
    normalChampion.spells[0].leveltip = {
      label: ['Damage'],
      effect: ['{{ basedamage }} -> {{ basedamageNL }}'],
    };

    const snapshot = normalizeChampionSnapshot(source, GENERATION_OPTIONS);
    const component = snapshot.champions.find((champion) => champion.id === 'normal-champ')
      ?.variants[0]?.components.q;

    expect(component?.shortDescription).toBe('The first sentence stays in the card.');
    expect(component?.fullDescription).toBe(normalChampion.spells[0].description);
    expect(component?.values).toEqual([]);
  });

  it('applies the reviewed compatibility rulings', () => {
    const snapshot = normalizeChampionSnapshot(makeExceptionSource(), GENERATION_OPTIONS);
    const aphelios = snapshot.champions.find((champion) => champion.id === 'aphelios');
    const jayce = snapshot.champions.find((champion) => champion.id === 'jayce');
    const hwei = snapshot.champions.find((champion) => champion.id === 'hwei');
    const elise = snapshot.champions.find((champion) => champion.id === 'elise');
    const nidalee = snapshot.champions.find((champion) => champion.id === 'nidalee');
    const gnar = snapshot.champions.find((champion) => champion.id === 'gnar');
    const shyvana = snapshot.champions.find((champion) => champion.id === 'shyvana');
    const reksai = snapshot.champions.find((champion) => champion.id === 'rek-sai');
    const kled = snapshot.champions.find((champion) => champion.id === 'kled');
    const kayn = snapshot.champions.find((champion) => champion.id === 'kayn');
    const viego = snapshot.champions.find((champion) => champion.id === 'viego');

    expect(aphelios).toMatchObject({ excluded: true, randomWeight: 0, variants: [] });
    expect(aphelios?.exclusionReason).toMatch(/shared system/i);

    expect(jayce?.variants.map((variant) => variant.id)).toEqual(['jayce-hammer', 'jayce-cannon']);
    expect(jayce?.variants.map((variant) => variant.championId)).toEqual(['jayce', 'jayce']);
    expect(jayce?.randomWeight).toBe(1);
    expect(jayce?.variants[0]?.components.body.name).toBe('Jayce — Hammer Body');
    expect(jayce?.variants[1]?.components.body.name).toBe('Jayce — Cannon Body');
    expect(jayce?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
    });
    expect(jayce?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 500,
      attackType: 'ranged',
    });
    expect(jayce?.variants[0]?.components.q.cooldown?.values).toEqual([16, 14, 12, 10, 8, 6]);
    expect(jayce?.variants[1]?.components.q.cooldown?.values).toEqual([8, 8, 8, 8, 8, 8]);
    expect(jayce?.variants[0]?.components.q.range?.values).toEqual([600, 600, 600, 600, 600, 600]);
    expect(jayce?.variants[1]?.components.q.range?.values).toEqual([
      1050, 1050, 1050, 1050, 1050, 1050,
    ]);
    expect(jayce?.variants[1]?.components.q.sourceRefs).toContain(
      'https://raw.communitydragon.org/15.17/game/data/characters/jayce/jayce.bin.json',
    );
    expect(jayce?.variants[1]?.components.body.sourceRefs).toContain(
      'https://raw.communitydragon.org/16.17/game/data/characters/jayce/jayce.bin.json',
    );
    expect(jayce?.variants[0]?.components.q.sourceRefs).toEqual(
      expect.arrayContaining([expect.stringContaining('#/spells/0')]),
    );
    expect(jayce?.variants[1]?.components.q.sourceRefs).toEqual(
      expect.arrayContaining([expect.stringContaining('#/spells/0')]),
    );
    expect(
      jayce?.variants.every(
        (variant) => variant.components.r.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(
      jayce?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);

    const hweiVariant = hwei?.variants[0];
    expect(hwei?.variants).toHaveLength(1);
    expect(hweiVariant?.components.q.name).toBe('Disaster spellbook');
    expect(hweiVariant?.components.q.sourceRefs).toHaveLength(1);
    expect(hweiVariant?.components.q.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'hwei-disaster-spellbook' }),
    );
    expect(hweiVariant?.components.w.sourceRefs).toHaveLength(1);
    expect(hweiVariant?.components.e.sourceRefs).toHaveLength(1);
    expect(hweiVariant?.components.r.sourceRefs).toHaveLength(1);

    expect(elise?.variants.map((variant) => variant.id)).toEqual(['elise-human', 'elise-spider']);
    expect(elise?.randomWeight).toBe(1);
    expect(elise?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 550,
      attackType: 'ranged',
      movementSpeed: 330,
    });
    expect(elise?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
      movementSpeed: 355,
    });
    expect(elise?.variants[0]?.components.q.values).toEqual([
      { label: 'Base Damage', values: [40, 70, 100, 130, 160, 190] },
      { label: 'Target HP Damage', values: [4, 4, 4, 4, 4, 4] },
      { label: 'Monster Cap Damage', values: [65, 85, 105, 125, 145, 165] },
    ]);
    expect(elise?.variants[1]?.components.q.values).toEqual([
      { label: 'Base Damage', values: [50, 80, 110, 140, 170, 200] },
      { label: 'Target Missing HP Damage', values: [8, 8, 8, 8, 8, 8] },
      { label: 'Monster Cap Damage', values: [65, 85, 105, 125, 145, 165] },
    ]);
    expect(elise?.variants[0]?.components.w.values).toEqual([
      { label: 'Base Damage', values: [60, 100, 140, 180, 220, 260] },
    ]);
    expect(elise?.variants[1]?.components.w.values).toEqual([
      { label: 'Passive Attack Speed', values: [5, 10, 15, 20, 25, 30] },
      { label: 'Active Attack Speed', values: [60, 75, 90, 105, 120, 135] },
    ]);
    expect(elise?.variants[0]?.components.e.values).toEqual([
      { label: 'Base Stun Duration', values: [1.6, 1.8, 2, 2.2, 2.4, 2.6] },
    ]);
    expect(elise?.variants[1]?.components.e.values).toEqual([
      { label: 'P Bonus Increase', values: [40, 55, 70, 85, 100, 115] },
    ]);
    expect(elise?.variants[1]?.components.q.range?.values).toEqual([475, 475, 475, 475, 475, 475]);
    expect(elise?.variants[1]?.components.q.sourceRefs).toContain(
      'https://raw.communitydragon.org/15.17/game/data/characters/elise/elise.bin.json',
    );
    expect(
      elise?.variants.every(
        (variant) => variant.components.r.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(
      elise?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);

    expect(nidalee?.variants.map((variant) => variant.id)).toEqual([
      'nidalee-human',
      'nidalee-cougar',
    ]);
    expect(nidalee?.randomWeight).toBe(1);
    expect(nidalee?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 525,
      attackType: 'ranged',
      movementSpeed: 335,
    });
    expect(nidalee?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 125,
      attackType: 'melee',
      movementSpeed: 335,
    });
    expect(nidalee?.variants[0]?.components.q.values).toEqual([
      { label: 'Spear Minimum Damage', values: [70, 90, 110, 130, 150, 170] },
      {
        label: 'Spear Maximum Damage',
        values: [227.5, 292.5, 357.5, 422.5, 487.5, 552.5],
      },
    ]);
    expect(nidalee?.variants[1]?.components.q.values).toEqual([
      { label: 'Takedown Base Damage', values: [5, 30, 55, 80, 105, 130] },
      {
        label: 'Takedown Damage Amp',
        values: [100, 125, 150, 175, 200, 225],
      },
    ]);
    expect(nidalee?.variants[1]?.components.w.values).toEqual([
      { label: 'Pounce Damage', values: [55, 100, 145, 190, 235, 280] },
      { label: 'Pounce Cooldown', values: [3, 2.5, 2, 1.5, 1.5, 1.5] },
    ]);
    expect(nidalee?.variants[1]?.components.e.values).toEqual([
      { label: 'Swipe Damage', values: [70, 130, 190, 250, 310, 370] },
    ]);
    expect(nidalee?.variants[1]?.components.q.cooldown?.values).toEqual([6, 6, 6, 6, 6, 6]);
    expect(nidalee?.variants[1]?.components.q.range?.values).toEqual([
      500, 500, 500, 500, 500, 500,
    ]);
    expect(nidalee?.variants[1]?.components.q.sourceRefs).toContain(
      'https://raw.communitydragon.org/15.17/game/data/characters/nidalee/nidalee.bin.json',
    );
    expect(
      nidalee?.variants.every(
        (variant) => variant.components.r.availability.status === 'unavailable',
      ),
    ).toBe(true);
    expect(
      nidalee?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);

    expect(gnar?.variants.map((variant) => variant.id)).toEqual(['gnar-mini', 'gnar-mega']);
    expect(gnar?.randomWeight).toBe(1);
    expect(gnar?.variants[0]?.components.body.bodyStats).toMatchObject({
      attackRange: 387.5,
      attackType: 'ranged',
      movementSpeed: 335,
    });
    expect(gnar?.variants[1]?.components.body.bodyStats).toMatchObject({
      attackRange: 175,
      attackType: 'melee',
      movementSpeed: 335,
    });
    expect(gnar?.variants[0]?.components.q.values).toEqual([
      { label: 'Mini Base Damage', values: [5, 45, 85, 125, 165, 205] },
      { label: 'Slow Amount', values: [15, 20, 25, 30, 35, 40] },
    ]);
    expect(gnar?.variants[0]?.components.w.values).toEqual([
      { label: 'Mini Base Damage', values: [0, 10, 20, 30, 40, 50] },
      { label: 'Mini Percent HP Damage', values: [6, 8, 10, 12, 14, 16] },
    ]);
    expect(gnar?.variants[0]?.components.e.values).toEqual([
      { label: 'Mini Damage', values: [50, 85, 120, 155, 190, 225] },
      { label: 'Mini Attack Speed', values: [40, 45, 50, 55, 60, 65] },
    ]);
    expect(gnar?.variants[1]?.components.q.values).toEqual([
      { label: 'Mega Base Damage', values: [45, 90, 135, 180, 225, 270] },
      { label: 'Mega Slow Amount', values: [30, 35, 40, 45, 50, 55] },
    ]);
    expect(gnar?.variants[1]?.components.w.values).toEqual([
      { label: 'Mega Base Damage', values: [45, 75, 105, 135, 165, 195] },
      { label: 'Mega Stun Duration', values: [1.25, 1.25, 1.25, 1.25, 1.25, 1.25] },
    ]);
    expect(gnar?.variants[1]?.components.e.values).toEqual([
      { label: 'Mega Damage', values: [80, 115, 150, 185, 220, 255] },
    ]);
    expect(gnar?.variants[0]?.components.q.iconRef).toBe(
      'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnar_q.png',
    );
    expect(gnar?.variants[1]?.components.q.iconRef).toBe(
      'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnarbig_q.png',
    );
    expect(gnar?.variants[0]?.components.r.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/gnar/hud/icons2d/gnar_r_grey.png',
    );
    expect(gnar?.variants[1]?.components.r.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/gnar/hud/icons2d/gnarbig_r.png',
    );
    expect(gnar?.variants[1]?.components.q.range?.values).toEqual([
      1100, 1100, 1100, 1100, 1100, 1100,
    ]);
    expect(gnar?.variants[1]?.components.w.range?.values).toEqual([525, 525, 525, 525, 525, 525]);
    expect(gnar?.variants[1]?.components.e.range?.values).toEqual([675, 675, 675, 675, 675, 675]);
    expect(gnar?.variants[0]?.components.r.availability.status).toBe('unavailable');
    expect(gnar?.variants[1]?.components.r.availability.status).toBe('available');
    expect(gnar?.variants[1]?.components.r.name).toBe('GNAR!');
    expect(
      gnar?.variants.every(
        (variant) => variant.components.passive.availability.status === 'unavailable',
      ),
    ).toBe(true);

    expect(shyvana?.variants.map((variant) => variant.id)).toEqual(['shyvana-default']);
    expect(shyvana?.variants[0]?.components.r.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'shyvana-dragon-form' }),
    );
    expect(shyvana?.variants[0]?.components.passive.availability.status).toBe('available');
    expect(shyvana?.variants[0]?.components.passive.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'shyvana-scalemail' }),
    );

    expect(reksai?.variants.map((variant) => variant.id)).toEqual(['rek-sai-default']);
    expect(reksai?.variants[0]?.components.w.carriedMechanics).toContainEqual(
      expect.objectContaining({ id: 'reksai-burrow-state' }),
    );
    expect(reksai?.variants[0]?.components.passive.availability.status).toBe('available');

    expect(kled?.variants.map((variant) => variant.id)).toEqual(['kled-mounted']);
    expect(kled?.variants[0]?.components.q.fullDescription).not.toContain('Pocket Pistol');
    expect(kled?.variants[0]?.components.passive.availability).toMatchObject({
      status: 'unavailable',
      reasonCode: 'overwrites-other-slots',
    });

    expect(kayn?.variants.map((variant) => variant.id)).toEqual([
      'kayn-rhaast',
      'kayn-shadow-assassin',
    ]);
    expect(kayn?.variants[0]?.components.q.values).toContainEqual(
      expect.objectContaining({ label: 'Slayer Base Max HP Damage' }),
    );
    expect(kayn?.variants[1]?.components.w.name).toBe("Blade's Reach — Shadow Assassin");
    expect(kayn?.variants[0]?.components.q.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_q_slay.png',
    );
    expect(kayn?.variants[1]?.components.q.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_q_ass.png',
    );
    expect(kayn?.variants[0]?.components.passive.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_passive_slay.png',
    );
    expect(kayn?.variants[1]?.components.passive.iconRef).toBe(
      'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_passive_ass.png',
    );
    expect(
      kayn?.variants.every((variant) => variant.components.r.availability.status === 'available'),
    ).toBe(true);

    expect(viego?.variants.map((variant) => variant.id)).toEqual(['viego-default']);
    expect(viego?.variants[0]?.components.passive.availability).toMatchObject({
      status: 'unavailable',
      reasonCode: 'overwrites-other-slots',
    });
  });

  it('marks standalone components with no meaningful source state as unavailable', () => {
    const snapshot = normalizeChampionSnapshot(
      makeRawSource([
        makeRawChampion('Xayah', '498', ['XayahQ', 'XayahW', 'XayahE', 'XayahR']),
        makeRawChampion('Yorick', '83', ['YorickQ', 'YorickW', 'YorickE', 'YorickR']),
      ]),
      {
        ...GENERATION_OPTIONS,
        manifest: {
          ...TEST_COMPATIBILITY_MANIFEST,
          entries: TEST_COMPATIBILITY_MANIFEST.entries.filter((entry) =>
            ['xayah', 'yorick'].includes(entry.championId),
          ),
        },
      },
    );
    const xayah = snapshot.champions.find((champion) => champion.id === 'xayah');
    const yorick = snapshot.champions.find((champion) => champion.id === 'yorick');

    expect(xayah?.variants[0]?.components.e.availability).toEqual({
      status: 'unavailable',
      reasonCode: 'requires-original-kit',
      summary: 'Feather Recall requires Feathers supplied by Xayah’s original kit.',
    });
    expect(yorick?.variants[0]?.components.passive.availability).toEqual({
      status: 'unavailable',
      reasonCode: 'requires-original-kit',
      summary: 'Shepherd of Souls requires Yorick’s original grave and Mist Walker system.',
    });
  });

  it('marks the second-pass standalone portability exceptions as unavailable', () => {
    const expected = [
      ['azir', 'q', 'Conquering Sands requires Sand Soldiers supplied by Azir’s original kit.'],
      ['azir', 'e', 'Shifting Sands requires a Sand Soldier supplied by Azir’s original kit.'],
      ['aurelion-sol', 'passive', 'Cosmic Creator only upgrades Aurelion Sol’s other abilities.'],
      ['heimerdinger', 'r', 'UPGRADE!!! only modifies Heimerdinger’s Q, W, or E abilities.'],
      [
        'illaoi',
        'passive',
        'Prophet of an Elder God requires Tentacle targets supplied by Illaoi’s original kit.',
      ],
      ['kalista', 'r', 'Fate’s Call requires Kalista’s Oathsworn ally from her original kit.'],
      ['karma', 'passive', 'Gathering Fire only reduces the cooldown of Karma’s Mantra (R).'],
      ['karma', 'r', 'Mantra only empowers Karma’s Q, W, or E abilities.'],
      ['leblanc', 'r', 'Mimic requires one of LeBlanc’s original Q, W, or E spells.'],
      ['mel', 'r', 'Golden Eclipse requires Overwhelm marks supplied by Mel’s original Passive.'],
      ['pantheon', 'passive', 'Mortal Will only empowers Pantheon’s other spells.'],
      ['renekton', 'passive', 'Reign of Anger only empowers Renekton’s other abilities with Fury.'],
      ['riven', 'passive', 'Runic Blade requires charges from Riven’s original abilities.'],
      ['rumble', 'passive', 'Junkyard Titan requires Rumble’s original spells to generate Heat.'],
      [
        'sejuani',
        'e',
        'Permafrost requires maximum Frost stacks supplied by Sejuani’s original kit.',
      ],
      [
        'smolder',
        'passive',
        'Dragon Practice only increases damage for Smolder’s other basic abilities.',
      ],
      ['syndra', 'passive', 'Transcendent only upgrades Syndra’s other abilities.'],
      [
        'twitch',
        'e',
        'Contaminate requires Deadly Venom stacks supplied by Twitch’s original kit.',
      ],
      ['viktor', 'passive', 'Glorious Evolution only augments Viktor’s other abilities.'],
      ['yunara', 'r', 'Transcend One’s Self only upgrades Yunara’s basic abilities.'],
      ['zyra', 'passive', 'Garden of Thorns requires Zyra’s Q or E to grow its seeds into plants.'],
    ] as const;
    const championIds = new Set(expected.map(([championId]) => championId));
    const source = makeRawSource(
      [...championIds].map((championId, index) =>
        makeRawChampion(
          championId === 'aurelion-sol'
            ? 'AurelionSol'
            : championId === 'leblanc'
              ? 'Leblanc'
              : championId[0].toUpperCase() + championId.slice(1),
          String(index + 1),
          [`${championId}Q`, `${championId}W`, `${championId}E`, `${championId}R`],
        ),
      ),
    );
    const snapshot = normalizeChampionSnapshot(source, {
      ...GENERATION_OPTIONS,
      manifest: {
        ...TEST_COMPATIBILITY_MANIFEST,
        entries: TEST_COMPATIBILITY_MANIFEST.entries.filter((entry) =>
          championIds.has(entry.championId),
        ),
      },
    });

    for (const [championId, slot, summary] of expected) {
      const component = snapshot.champions.find((champion) => champion.id === championId)
        ?.variants[0]?.components[slot];

      expect(component?.availability).toEqual({
        status: 'unavailable',
        reasonCode: 'requires-original-kit',
        summary,
      });
      expect(component?.dependencies).toEqual([]);
    }
  });

  it('applies the reviewed Zilean Rewind portability exception', () => {
    const snapshot = normalizeChampionSnapshot(
      makeRawSource([
        makeRawChampion('Zilean', '26', ['ZileanQ', 'ZileanW', 'ZileanE', 'ZileanR']),
      ]),
      {
        ...GENERATION_OPTIONS,
        manifest: {
          ...TEST_COMPATIBILITY_MANIFEST,
          entries: TEST_COMPATIBILITY_MANIFEST.entries.filter(
            (entry) => entry.championId === 'zilean',
          ),
        },
      },
    );
    const rewind = snapshot.champions.find((champion) => champion.id === 'zilean')?.variants[0]
      ?.components.w;

    expect(rewind?.availability).toEqual({
      status: 'conditional',
      ruleId: 'zilean-rewind-composite-basic-abilities',
      summary: 'Reduces the cooldowns of the composite champion’s other basic abilities.',
    });
    expect(rewind?.dependencies).toEqual([]);
  });

  it('fails with an actionable error when a source detail is missing or malformed', () => {
    const missingDetail = JSON.parse(JSON.stringify(makeExceptionSource())) as {
      details: Record<string, unknown>;
    };
    delete missingDetail.details.Hwei;

    expect(() => normalizeChampionSnapshot(missingDetail, GENERATION_OPTIONS)).toThrow(
      /Missing champion detail for Hwei/i,
    );

    const malformedSource = JSON.parse(JSON.stringify(makeExceptionSource())) as {
      details: Record<string, { stats: Record<string, unknown> }>;
    };
    malformedSource.details.Hwei.stats = {};
    expect(() => normalizeChampionSnapshot(malformedSource, GENERATION_OPTIONS)).toThrow(
      /Raw Data Dragon source is invalid.*details\.Hwei\.stats/i,
    );
  });

  it('requires compatibility exceptions to be reviewed for the requested version', () => {
    const staleManifest = JSON.parse(
      JSON.stringify(TEST_COMPATIBILITY_MANIFEST),
    ) as typeof DEFAULT_COMPATIBILITY_MANIFEST;
    staleManifest.entries[0].reviewedForDataDragonVersion = '15.18.1';

    expect(() =>
      normalizeChampionSnapshot(makeExceptionSource(), {
        ...GENERATION_OPTIONS,
        manifest: staleManifest,
      }),
    ).toThrow(/reviewed for 15\.18\.1, not 15\.17\.1/);
  });
});

describe('createPatchChangeReport', () => {
  it('reports additions, removals, value changes, and affected exceptions', () => {
    const current = normalizeChampionSnapshot(makeExceptionSource(), GENERATION_OPTIONS);
    const previousSource = makeRawSource([
      makeRawChampion('Aphelios', '523', ['ApheliosQ1', 'ApheliosQ2', 'ApheliosQ3', 'ApheliosQ4']),
      makeRawChampion('Jayce', '13', [
        'JayceToTheSkies',
        'JayceStaticField',
        'JayceThunderingBlow',
        'JayceStanceHtG',
      ]),
      makeRawChampion('OldChamp', '999', ['OldQ', 'OldW', 'OldE', 'OldR']),
      makeRawChampion('Hwei', '910', ['HweiQ', 'HweiW', 'HweiE', 'HweiR']),
      makeRawChampion('Elise', '60', ['EliseHumanQ', 'EliseHumanW', 'EliseHumanE', 'EliseR']),
      makeRawChampion('Nidalee', '76', [
        'JavelinToss',
        'Bushwhack',
        'PrimalSurge',
        'AspectOfTheCougar',
      ]),
      makeRawChampion('Gnar', '150', ['GnarQ', 'GnarW', 'GnarE', 'GnarR']),
      makeRawChampion('Shyvana', '102', ['ShyvanaQ', 'ShyvanaW', 'ShyvanaE', 'ShyvanaR']),
      makeRawChampion('RekSai', '421', ['RekSaiQ', 'RekSaiW', 'RekSaiE', 'RekSaiR']),
      makeRawChampion('Kled', '240', ['KledQ', 'KledW', 'KledE', 'KledR']),
      makeRawChampion('Kayn', '141', ['KaynQ', 'KaynW', 'KaynE', 'KaynR']),
      makeRawChampion('Viego', '234', ['ViegoQ', 'ViegoW', 'ViegoE', 'ViegoR']),
    ]);
    const previous = normalizeChampionSnapshot(previousSource, GENERATION_OPTIONS);
    const currentJayceQ = current.champions.find((champion) => champion.id === 'jayce')?.variants[0]
      ?.components.q;
    if (!currentJayceQ) {
      throw new Error('Test fixture did not produce Jayce Q.');
    }
    currentJayceQ.values = [{ label: 'Damage', values: [999] }];

    const report = createPatchChangeReport(previous, current, TEST_COMPATIBILITY_MANIFEST);

    expect(report).toContain('## Champion additions');
    expect(report).toContain('- normal-champ');
    expect(report).toContain('## Champion removals');
    expect(report).toContain('- old-champ');
    expect(report).toContain('## Value changes');
    expect(report).toContain('Jayce / Hammer / q: values changed');
    expect(report).toContain('## Affected compatibility exceptions');
    expect(report).toContain('jayce:');
  });

  it('can describe an initial snapshot without a previous file', () => {
    const snapshot = normalizeChampionSnapshot(makeExceptionSource(), GENERATION_OPTIONS);
    const report = createPatchChangeReport(undefined, snapshot, TEST_COMPATIBILITY_MANIFEST);

    expect(report).toContain('- Previous snapshot: none');
    expect(report).toContain('- normal-champ');
    expect(report).toContain('aphelios:');
    expect(report.endsWith('\n')).toBe(true);
  });
});

describe('serializeSnapshot', () => {
  it('emits stable pretty JSON with a trailing newline', () => {
    const snapshot = normalizeChampionSnapshot(makeExceptionSource(), GENERATION_OPTIONS);
    const serialized = serializeSnapshot(snapshot);

    expect(serialized.endsWith('\n')).toBe(true);
    expect(JSON.parse(serialized)).toEqual(snapshot);
  });

  it('exposes pipeline errors as ordinary Error instances', () => {
    expect(new SnapshotPipelineError('failure')).toBeInstanceOf(Error);
  });
});
