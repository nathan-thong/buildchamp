import type {
  RawChampion,
  RawChampionSummary,
  RawDataDragonSource,
  RawSpell,
} from './snapshot-schema';
import type {
  AlternateSpellCatalog,
  AlternateSpellRecord,
  AlternateSpellValue,
} from './alternate-spell-source';

export const TEST_DATA_DRAGON_VERSION = '15.17.1';

const TEST_ALTERNATE_SPELL_SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/jayce/jayce.bin.json';
const TEST_ELISE_ALTERNATE_SPELL_SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/elise/elise.bin.json';
const TEST_NIDALEE_ALTERNATE_SPELL_SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/nidalee/nidalee.bin.json';
const TEST_GNAR_ALTERNATE_SPELL_SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/gnar/gnar.bin.json';
const TEST_KAYN_ALTERNATE_SPELL_SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/kayn/kayn.bin.json';

export function makeRawSpell(id: string, name = id, resource = '{{ cost }} Mana'): RawSpell {
  return {
    id,
    name,
    description: `${name} description.`,
    tooltip: `${name} tooltip.`,
    leveltip: {
      label: ['Damage'],
      effect: ['10/20/30/40/50'],
    },
    cooldown: [12, 10, 8, 6, 4],
    range: [550, 550, 550, 550, 550],
    effect: [10, null],
    effectBurn: ['10/20/30/40/50', null],
    cost: [20, 20, 20, 20, 20],
    resource,
    image: { full: `${id}.png` },
  };
}

export function makeRawChampion(
  id: string,
  key: string,
  spellIds: readonly string[],
  options: { attackRange?: number; resource?: string } = {},
): RawChampion {
  return {
    id,
    key,
    name: id,
    title: `the ${id} champion`,
    image: { full: `${id}.png` },
    stats: {
      hp: 600,
      hpperlevel: 100,
      mp: 300,
      mpperlevel: 40,
      movespeed: 340,
      armor: 30,
      armorperlevel: 4,
      spellblock: 32,
      spellblockperlevel: 1.3,
      attackrange: options.attackRange ?? 175,
      hpregen: 6,
      hpregenperlevel: 0.6,
      mpregen: 7,
      mpregenperlevel: 0.8,
      crit: 0,
      critperlevel: 0,
      attackdamage: 60,
      attackdamageperlevel: 3,
      attackspeedperlevel: 2.5,
      attackspeed: 0.65,
    },
    spells: spellIds.map((spellId) => makeRawSpell(spellId, spellId, options.resource)),
    passive: {
      name: `${id} passive`,
      description: `${id} passive description.`,
      image: { full: `${id}Passive.png` },
    },
  };
}

export function makeRawSource(champions: readonly RawChampion[]): RawDataDragonSource {
  const summaries = Object.fromEntries(
    champions.map((champion) => [champion.id, makeRawSummary(champion)]),
  );
  return {
    version: TEST_DATA_DRAGON_VERSION,
    locale: 'en_US',
    summary: {
      type: 'champion',
      format: 'standAloneComplex',
      version: TEST_DATA_DRAGON_VERSION,
      data: summaries,
    },
    details: Object.fromEntries(champions.map((champion) => [champion.id, champion])),
  };
}

export function makeRawSummary(champion: RawChampion): RawChampionSummary {
  return {
    id: champion.id,
    key: champion.key,
    name: champion.name,
    title: champion.title,
    image: champion.image,
  };
}

export function makeExceptionSource(): RawDataDragonSource {
  return makeRawSource([
    makeRawChampion('Aphelios', '523', ['ApheliosQ1', 'ApheliosQ2', 'ApheliosQ3', 'ApheliosQ4']),
    makeRawChampion('Hwei', '910', ['HweiQ', 'HweiW', 'HweiE', 'HweiR']),
    makeRawChampion('Jayce', '13', [
      'JayceToTheSkies',
      'JayceStaticField',
      'JayceThunderingBlow',
      'JayceStanceHtG',
    ]),
    makeRawChampion('Elise', '60', ['EliseHumanQ', 'EliseHumanW', 'EliseHumanE', 'EliseR'], {
      attackRange: 550,
    }),
    makeRawChampion(
      'Nidalee',
      '76',
      ['JavelinToss', 'Bushwhack', 'PrimalSurge', 'AspectOfTheCougar'],
      { attackRange: 525 },
    ),
    makeRawChampion('Gnar', '150', ['GnarQ', 'GnarW', 'GnarE', 'GnarR'], {
      attackRange: 175,
    }),
    makeRawChampion('Shyvana', '102', ['ShyvanaQ', 'ShyvanaW', 'ShyvanaE', 'ShyvanaR'], {
      attackRange: 150,
    }),
    makeRawChampion('RekSai', '421', ['RekSaiQ', 'RekSaiW', 'RekSaiE', 'RekSaiR']),
    makeRawChampion('Kled', '240', ['KledQ', 'KledW', 'KledE', 'KledR'], {
      attackRange: 125,
    }),
    makeRawChampion('Kayn', '141', ['KaynQ', 'KaynW', 'KaynE', 'KaynR']),
    makeRawChampion('Viego', '234', ['ViegoQ', 'ViegoW', 'ViegoE', 'ViegoR'], {
      attackRange: 200,
    }),
    makeRawChampion('NormalChamp', '1', ['NormalQ', 'NormalW', 'NormalE', 'NormalR'], {
      attackRange: 550,
      resource: '{{ cost }} Health',
    }),
  ]);
}

export function makeAlternateSpellSources(): AlternateSpellCatalog {
  const record = (
    id: string,
    cooldown: number[],
    range: number[],
    effect: string,
  ): AlternateSpellRecord => ({
    id,
    cooldown,
    range,
    leveltip: {
      label: ['Damage'],
      effect: [effect],
    },
    sourceRef: ['Takedown', 'Pounce', 'Swipe'].includes(id)
      ? TEST_NIDALEE_ALTERNATE_SPELL_SOURCE_REF
      : id.startsWith('Gnar')
        ? TEST_GNAR_ALTERNATE_SPELL_SOURCE_REF
        : TEST_ALTERNATE_SPELL_SOURCE_REF,
  });
  const recordWithValues = (
    id: string,
    cooldown: number[],
    range: number[],
    sourceValues: AlternateSpellValue[],
  ): AlternateSpellRecord => ({
    id,
    cooldown,
    range,
    leveltip: {
      label: sourceValues.map((sourceValue) => sourceValue.label),
      effect: sourceValues.map((sourceValue) => sourceValue.values.join('/')),
    },
    sourceValues,
    sourceRef: id.startsWith('Elise')
      ? TEST_ELISE_ALTERNATE_SPELL_SOURCE_REF
      : ['JavelinToss', 'Bushwhack', 'PrimalSurge', 'Takedown', 'Pounce', 'Swipe'].includes(id)
        ? TEST_NIDALEE_ALTERNATE_SPELL_SOURCE_REF
        : id.startsWith('Gnar')
          ? TEST_GNAR_ALTERNATE_SPELL_SOURCE_REF
          : id.startsWith('Kayn')
            ? TEST_KAYN_ALTERNATE_SPELL_SOURCE_REF
            : TEST_ALTERNATE_SPELL_SOURCE_REF,
  });

  const values = (entries: Array<[string, string, number[]]>): AlternateSpellValue[] =>
    entries.map(([name, label, sourceValues]) => ({ name, label, values: sourceValues }));

  return {
    jayce: {
      JayceToTheSkies: record(
        'JayceToTheSkies',
        [16, 14, 12, 10, 8, 6],
        [600, 600, 600, 600, 600, 600],
        '60/110/160/210/260/310',
      ),
      JayceStaticField: record(
        'JayceStaticField',
        [10, 10, 10, 10, 10, 10],
        [285, 285, 285, 285, 285, 285],
        '80/140/200/260/320/380',
      ),
      JayceThunderingBlow: record(
        'JayceThunderingBlow',
        [20, 18, 16, 14, 12, 10],
        [240, 240, 240, 240, 240, 240],
        '8/12/16/20/24/28',
      ),
      JayceShockBlast: record(
        'JayceShockBlast',
        [8, 8, 8, 8, 8, 8],
        [1050, 1050, 1050, 1050, 1050, 1050],
        '80/121/162/203/244/285',
      ),
      JayceHyperCharge: record(
        'JayceHyperCharge',
        [13, 11.4, 9.8, 8.2, 6.6, 5],
        [285, 285, 285, 285, 285, 285],
        '62/70/78/86/94/102',
      ),
      JayceAccelerationGate: record(
        'JayceAccelerationGate',
        [16, 16, 16, 16, 16, 16],
        [685, 685, 685, 685, 685, 685],
        '30/35/40/45/50/55',
      ),
    },
    elise: {
      EliseHumanQ: recordWithValues(
        'EliseHumanQ',
        [6, 6, 6, 6, 6, 6],
        [615, 615, 615, 615, 615, 615],
        values([
          ['BaseDamage', 'Base Damage', [40, 70, 100, 130, 160, 190]],
          ['TargetHPDamage', 'Target HP Damage', [4, 4, 4, 4, 4, 4]],
          ['MonsterCapDamage', 'Monster Cap Damage', [65, 85, 105, 125, 145, 165]],
        ]),
      ),
      EliseHumanW: recordWithValues(
        'EliseHumanW',
        [12, 12, 12, 12, 12, 12],
        [950, 950, 950, 950, 950, 950],
        values([['BaseDamage', 'Base Damage', [60, 100, 140, 180, 220, 260]]]),
      ),
      EliseHumanE: recordWithValues(
        'EliseHumanE',
        [12, 11.5, 11, 10.5, 10, 10],
        [1075, 1075, 1075, 1075, 1075, 1075],
        values([['BaseStunDuration', 'Base Stun Duration', [1.6, 1.8, 2, 2.2, 2.4, 2.6]]]),
      ),
      EliseSpiderQCast: recordWithValues(
        'EliseSpiderQCast',
        [6, 6, 6, 6, 6, 6],
        [475, 475, 475, 475, 475, 475],
        values([
          ['BaseDamage', 'Base Damage', [50, 80, 110, 140, 170, 200]],
          ['TargetMissingHPDamage', 'Target Missing HP Damage', [8, 8, 8, 8, 8, 8]],
          ['MonsterCapDamage', 'Monster Cap Damage', [65, 85, 105, 125, 145, 165]],
        ]),
      ),
      EliseSpiderW: recordWithValues(
        'EliseSpiderW',
        [6, 6, 6, 6, 6, 6],
        [700, 700, 700, 700, 700, 700],
        values([
          ['PassiveAttackSpeed', 'Passive Attack Speed', [5, 10, 15, 20, 25, 30]],
          ['ActiveAttackSpeed', 'Active Attack Speed', [60, 75, 90, 105, 120, 135]],
        ]),
      ),
      EliseSpiderEInitial: recordWithValues(
        'EliseSpiderEInitial',
        [22, 21, 20, 19, 18, 17],
        [750, 750, 750, 750, 750, 750],
        values([['PBonusIncrease', 'P Bonus Increase', [0.4, 0.55, 0.7, 0.85, 1, 1.15]]]),
      ),
    },
    nidalee: {
      JavelinToss: recordWithValues(
        'JavelinToss',
        [6, 6, 6, 6, 6, 6],
        [1500, 1500, 1500, 1500, 1500, 1500],
        values([
          ['SpearMinimumDamage', 'Spear Minimum Damage', [70, 90, 110, 130, 150, 170]],
          [
            'SpearMaximumDamage',
            'Spear Maximum Damage',
            [227.5, 292.5, 357.5, 422.5, 487.5, 552.5],
          ],
        ]),
      ),
      Bushwhack: recordWithValues(
        'Bushwhack',
        [13, 12, 11, 10, 9, 9],
        [900, 900, 900, 900, 900, 900],
        values([['TotalFlatDamage', 'Total Flat Damage', [40, 80, 120, 160, 200, 240]]]),
      ),
      PrimalSurge: recordWithValues(
        'PrimalSurge',
        [12, 12, 12, 12, 12, 12],
        [900, 900, 900, 900, 900, 900],
        values([
          ['BaseHeal', 'Base Heal', [50, 75, 100, 125, 150, 175]],
          ['BonusAS', 'Bonus AS', [30, 40, 50, 60, 70, 80]],
        ]),
      ),
      Takedown: record('Takedown', [6, 6, 6, 6, 6, 6], [500, 500, 500, 500, 500, 500], '5'),
      Pounce: record('Pounce', [6, 6, 6, 6, 6, 6], [400, 400, 400, 400, 400, 400], '55'),
      Swipe: record('Swipe', [6, 6, 6, 6, 6, 6], [350, 350, 350, 350, 350, 350], '70'),
      AspectOfTheCougar: recordWithValues(
        'AspectOfTheCougar',
        [3, 3, 3, 3, 3, 3],
        [20, 20, 20, 20, 20, 20],
        values([
          ['TakedownBaseDamage', 'Takedown Base Damage', [5, 30, 55, 80, 105, 130]],
          ['TakedownDamageAmp', 'Takedown Damage Amp', [100, 125, 150, 175, 200, 225]],
          ['PounceDamage', 'Pounce Damage', [55, 100, 145, 190, 235, 280]],
          ['PounceCooldown', 'Pounce Cooldown', [3, 2.5, 2, 1.5, 1.5, 1.5]],
          ['SwipeDamage', 'Swipe Damage', [70, 130, 190, 250, 310, 370]],
        ]),
      ),
    },
    gnar: {
      GnarQ: {
        ...recordWithValues(
          'GnarQ',
          [16, 14.5, 13, 11.5, 10, 10],
          [1100, 1100, 1100, 1100, 1100, 1100],
          values([
            ['MiniBaseDamage', 'Mini Base Damage', [5, 45, 85, 125, 165, 205]],
            ['SlowAmount', 'Slow Amount', [15, 20, 25, 30, 35, 40]],
            ['MegaBaseDamage', 'Mega Base Damage', [45, 90, 135, 180, 225, 270]],
            ['MegaSlowAmount', 'Mega Slow Amount', [30, 35, 40, 45, 50, 55]],
          ]),
        ),
        iconRef:
          'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnar_q.png',
      },
      GnarW: recordWithValues(
        'GnarW',
        [7, 7, 7, 7, 7, 7],
        [0, 0, 0, 0, 0, 0],
        values([
          ['MiniBaseDamage', 'Mini Base Damage', [0, 10, 20, 30, 40, 50]],
          ['MiniPercentHPDamage', 'Mini Percent HP Damage', [6, 8, 10, 12, 14, 16]],
          ['MegaBaseDamage', 'Mega Base Damage', [45, 75, 105, 135, 165, 195]],
          ['MegaStunDuration', 'Mega Stun Duration', [1.25, 1.25, 1.25, 1.25, 1.25, 1.25]],
        ]),
      ),
      GnarE: recordWithValues(
        'GnarE',
        [22, 19.5, 17, 14.5, 12, 12],
        [475, 475, 475, 475, 475, 475],
        values([
          ['MinibAS', 'Mini Attack Speed', [40, 45, 50, 55, 60, 65]],
          ['MiniDamage', 'Mini Damage', [50, 85, 120, 155, 190, 225]],
          ['MegaDamage', 'Mega Damage', [80, 115, 150, 185, 220, 255]],
        ]),
      ),
      GnarBigQ: {
        ...recordWithValues(
          'GnarBigQ',
          [16, 14.5, 13, 11.5, 10, 10],
          [1100, 1100, 1100, 1100, 1100, 1100],
          values([
            ['MegaBaseDamage', 'Mega Base Damage', [45, 90, 135, 180, 225, 270]],
            ['MegaSlowAmount', 'Mega Slow Amount', [0.3, 0.35, 0.4, 0.45, 0.5, 0.55]],
          ]),
        ),
        iconRef:
          'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnarbig_q.png',
      },
      GnarBigW: {
        ...record('GnarBigW', [7, 7, 7, 7, 7, 7], [525, 525, 525, 525, 525, 525], '45'),
        iconRef:
          'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnarbig_w.png',
      },
      GnarBigE: {
        ...record('GnarBigE', [22, 19.5, 17, 14.5, 12, 12], [675, 675, 675, 675, 675, 675], '80'),
        iconRef:
          'https://raw.communitydragon.org/15.17/game/assets/characters/gnar/hud/icons2d/gnarbig_e.png',
      },
    },
    kayn: {
      KaynQ: recordWithValues(
        'KaynQ',
        [7.5, 7, 6.5, 6, 5.5, 5],
        [350, 350, 350, 350, 350, 350],
        values([
          ['SlayerBaseMaxHPDamage', 'Slayer Base Max HP Damage', [6, 6, 6, 6, 6, 6]],
          ['SlayerMaxHPPer100BAD', 'Slayer Max HP Per 100 BAD', [3.5, 3.5, 3.5, 3.5, 3.5, 3.5]],
          [
            'SlayerMaxHPPer100BADTOOLTIPONLY',
            'Slayer Max HP Per 100 BAD Tooltip Only',
            [0.035, 0.035, 0.035, 0.035, 0.035, 0.035],
          ],
          ['BonusADRatio', 'Bonus AD Ratio', [0.85, 0.85, 0.85, 0.85, 0.85, 0.85]],
          ['BaseDamage', 'Base Damage', [75, 105, 135, 165, 195, 195]],
          ['SlayTADRatio', 'Slay T AD Ratio', [0.65, 0.65, 0.65, 0.65, 0.65, 0.65]],
          ['MaxDmgToMonsters', 'Max Damage To Monsters', [200, 250, 300, 350, 400, 0]],
          ['FlatBonusDmgToMonsters', 'Flat Bonus Damage To Monsters', [40, 40, 40, 40, 40, 40]],
          ['AoERadius', 'AOE Radius', [300, 300, 300, 300, 300, 300]],
        ]),
      ),
      KaynW: recordWithValues(
        'KaynW',
        [13, 13, 12, 11, 10, 9],
        [700, 700, 700, 700, 700, 700],
        values([
          ['BaseDamage', 'Base Damage', [85, 130, 175, 220, 265, 265]],
          ['KnockupDuration', 'Knockup Duration', [1, 1, 1, 1, 1, 1]],
          ['BoxWidth', 'Box Width', [160, 160, 160, 160, 160, 160]],
        ]),
      ),
      KaynAssW: recordWithValues(
        'KaynAssW',
        [13, 13, 12, 11, 10, 9],
        [900, 900, 900, 900, 900, 900],
        values([
          ['BaseDamage', 'Base Damage', [90, 135, 180, 225, 270, 315]],
          ['KnockupDuration', 'Knockup Duration', [1, 1, 1, 1, 1, 1]],
          ['SlowAmount', 'Slow Amount', [-0.6, -0.6, -0.6, -0.6, -0.6, -0.6]],
        ]),
      ),
      KaynE: recordWithValues(
        'KaynE',
        [21, 21, 19, 17, 15, 13],
        [400, 400, 400, 400, 400, 400],
        values([
          ['AssassinCDReduction', 'Assassin CD Reduction', [10, 10, 10, 10, 10, 10]],
          ['AssMS', 'Ass MS', [70, 70, 70, 70, 70, 70]],
          ['MS', 'MS', [40, 40, 40, 40, 40, 40]],
          ['WallWalkDuration', 'Wall Walk Duration', [7, 7.5, 8, 8.5, 9, 9.5]],
          ['LingerTime', 'Linger Time', [1.5, 1.5, 1.5, 1.5, 1.5, 1.5]],
          ['WarningParticleRange', 'Warning Particle Range', [1250, 1250, 1250, 1250, 1250, 1250]],
          ['MaxInCombatTime', 'Max In Combat Time', [1.5, 1.5, 1.5, 1.5, 1.5, 1.5]],
          ['HealAmount', 'Heal Amount', [90, 100, 110, 120, 130, 140]],
          ['HealBADRatio', 'Heal BAD Ratio', [0.45, 0.45, 0.45, 0.45, 0.45, 0.45]],
        ]),
      ),
      KaynR: recordWithValues(
        'KaynR',
        [120, 120, 100, 80, 80, 80],
        [550, 550, 550, 550, 550, 550],
        values([
          ['BaseDamage', 'Base Damage', [150, 250, 350, 450, 550, 650]],
          ['MinimumInfestTime', 'Minimum Infest Time', [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]],
          ['InfestDuration', 'Infest Duration', [2.5, 2.5, 2.5, 2.5, 2.5, 2.5]],
          ['JumpOutDistance', 'Jump Out Distance', [300, 300, 300, 300, 300, 300]],
          [
            'SlayerMaxHPBaseDamage',
            'Slayer Max HP Base Damage',
            [0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
          ],
          [
            'SlayerMaxHPDamagerPer100AD',
            'Slayer Max HP Damage Per 100 AD',
            [0.001, 0.001, 0.001, 0.001, 0.001, 0.001],
          ],
          ['SlayerHealPercent', 'Slayer Heal Percent', [0.75, 0.75, 0.75, 0.75, 0.75, 0.75]],
          ['AssassinCastRange', 'Assassin Cast Range', [750, 750, 750, 750, 750, 750]],
          ['BaseCastRange', 'Base Cast Range', [550, 550, 550, 550, 550, 550]],
          ['AssassinJumpOutDistance', 'Assassin Jump Out Distance', [500, 500, 500, 500, 500, 500]],
          ['AssCastRange', 'Ass Cast Range', [750, 750, 750, 750, 750, 750]],
        ]),
      ),
    },
  };
}
