import { describe, expect, it } from 'vitest';

import {
  communityDragonChampionUrl,
  fetchCommunityDragonSpellSource,
  parseCommunityDragonChampionBin,
} from './alternate-spell-source';

class MemoryCache {
  private readonly values = new Map<string, unknown>();

  async read(key: string): Promise<unknown | undefined> {
    return this.values.get(key);
  }

  async write(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

const SOURCE_REF =
  'https://raw.communitydragon.org/15.17/game/data/characters/jayce/jayce.bin.json';

function makeCommunityDragonBin() {
  return {
    'Characters/Jayce/Spells/JayceShockBlastAbility/JayceShockBlast': {
      ObjectName: 'JayceShockBlast',
      mScriptName: 'JayceShockBlast',
      mSpell: {
        DataValues: [
          { name: 'BaseDamage', values: [39, 80, 121, 162, 203, 244, 285] },
          { name: 'ADRatio', values: [1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3] },
        ],
        cooldownTime: [8, 8, 8, 8, 8, 8, 8],
        castRange: [25000, 25000, 25000, 25000, 25000, 25000, 25000],
        castRangeDisplayOverride: [1050, 1050, 1050, 1050, 1050, 1050, 1050],
        mImgIconName: ['ASSETS/Characters/Jayce/HUD/Icons2D/JayceQ_Melee.dds'],
        mClientData: {
          mTooltipData: {
            mLists: {
              LevelUp: {
                Elements: [{ type: 'BaseDamage' }],
              },
            },
          },
        },
      },
    },
  };
}

describe('CommunityDragon alternate spell source', () => {
  it('extracts versioned form spell values and display ranges', () => {
    const spells = parseCommunityDragonChampionBin(makeCommunityDragonBin(), SOURCE_REF);

    expect(spells.JayceShockBlast).toEqual({
      id: 'JayceShockBlast',
      iconRef:
        'https://raw.communitydragon.org/15.17/game/assets/characters/jayce/hud/icons2d/jayceq_melee.png',
      cooldown: [8, 8, 8, 8, 8, 8],
      range: [1050, 1050, 1050, 1050, 1050, 1050],
      leveltip: {
        label: ['Base Damage'],
        effect: ['80/121/162/203/244/285'],
      },
      sourceValues: [
        {
          name: 'BaseDamage',
          label: 'Base Damage',
          values: [80, 121, 162, 203, 244, 285],
        },
        {
          name: 'ADRatio',
          label: 'AD Ratio',
          values: [1.3, 1.3, 1.3, 1.3, 1.3, 1.3],
        },
      ],
      sourceRef: SOURCE_REF,
    });
  });

  it('keeps named values when a source includes an unnamed value without an array', () => {
    const spells = parseCommunityDragonChampionBin(
      {
        'Characters/Elise/Spells/EliseHumanWAbility/EliseHumanW': {
          ObjectName: 'EliseHumanW',
          mSpell: {
            DataValues: [
              { name: 'BaseDamage', values: [20, 60, 100] },
              { name: 'UnnamedEffectAmount2' },
            ],
            cooldownTime: [12, 12, 12],
            mClientData: {
              mTooltipData: {
                mLists: {
                  LevelUp: {
                    Elements: [{ type: 'BaseDamage' }],
                  },
                },
              },
            },
          },
        },
      },
      SOURCE_REF,
    );

    expect(spells.EliseHumanW).toMatchObject({
      leveltip: { label: ['Base Damage'], effect: ['60/100'] },
      sourceValues: [{ name: 'BaseDamage', label: 'Base Damage', values: [60, 100] }],
    });
  });

  it('rounds floating-point source artifacts before exposing display values', () => {
    const spells = parseCommunityDragonChampionBin(
      {
        'Characters/Jayce/Spells/JayceHyperChargeAbility/JayceHyperCharge': {
          ObjectName: 'JayceHyperCharge',
          mSpell: {
            cooldownTime: [13, 11.399999618530273, 9.800000190734863],
            castRange: [500, 500, 500],
            DataValues: [
              {
                name: 'DamagePerc',
                values: [0.62, 0.7, 0.7800000190734863],
              },
            ],
            mClientData: {
              mTooltipData: {
                mLists: {
                  LevelUp: {
                    Elements: [{ type: 'DamagePerc', multiplier: 100 }],
                  },
                },
              },
            },
          },
        },
      },
      SOURCE_REF,
    );

    expect(spells.JayceHyperCharge).toMatchObject({
      cooldown: [11.4, 9.8],
      range: [500, 500],
      leveltip: {
        label: ['Damage %'],
        effect: ['70/78'],
      },
    });
  });

  it('caches a versioned champion source after the first fetch', async () => {
    const cache = new MemoryCache();
    const url = communityDragonChampionUrl('15.17.1', 'jayce');
    const fetchedUrls: string[] = [];
    const fetchJson = async (requestedUrl: string): Promise<unknown> => {
      fetchedUrls.push(requestedUrl);
      if (requestedUrl !== url) {
        throw new Error(`Unexpected source URL ${requestedUrl}`);
      }
      return makeCommunityDragonBin();
    };

    const first = await fetchCommunityDragonSpellSource({
      version: '15.17.1',
      championIds: ['Jayce'],
      fetchJson,
      cache,
    });
    const second = await fetchCommunityDragonSpellSource({
      version: '15.17.1',
      championIds: ['jayce'],
      fetchJson,
      cache,
    });

    expect(fetchedUrls).toEqual([url]);
    expect(second).toEqual(first);
  });
});
