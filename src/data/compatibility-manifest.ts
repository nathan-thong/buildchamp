import { CompatibilityManifestSchema, type CompatibilityManifest } from './snapshot-schema.ts';

/**
 * Reviewed exceptions for the current pinned Data Dragon snapshot. Numerical
 * values normally stay in Data Dragon; explicit form-stat overrides are
 * versioned, sourced, and carried through the generated snapshot.
 */
export const DEFAULT_COMPATIBILITY_MANIFEST: CompatibilityManifest =
  CompatibilityManifestSchema.parse({
    schemaVersion: 1,
    entries: [
      {
        championId: 'aphelios',
        excludeChampion: {
          reason:
            'Aphelios attack range, weapons, ammunition, Q behavior, and passive progression form one shared system.',
        },
        notes: [
          'Exclude Aphelios from the initial pool because individual slots would be nonfunctional or would implicitly supply several other slots.',
          'Portability test failed for ownership, inputs, lifecycle, and meaning when the weapon system is split apart.',
          'The exclusion is player-facing and does not alter any official numerical value.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Aphelios.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'jayce',
        variants: [
          {
            id: 'jayce-hammer',
            label: 'Hammer',
            componentOverrides: {
              body: {
                name: 'Jayce — Hammer Body',
                bodyStats: {
                  attackRange: 125,
                  attackType: 'melee',
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/jayce/jayce.bin.json',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'jayce-hammer-form',
                    description: 'Carries Jayce’s hammer form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:JayceToTheSkies'],
                fallbackSourceSpellIds: ['JayceToTheSkies'],
                name: 'To the Skies!',
                shortDescription: 'Leaps to an enemy, dealing physical damage and slowing enemies.',
                fullDescription:
                  'Hammer Stance: Leaps to an enemy dealing physical damage and slowing enemies.',
              },
              w: {
                sourceSpellIds: ['communitydragon:JayceStaticField'],
                fallbackSourceSpellIds: ['JayceStaticField'],
                name: 'Lightning Field',
                shortDescription:
                  'Creates a field of lightning that damages nearby enemies for several seconds.',
                fullDescription:
                  'Hammer Stance: Passive: Restores Mana per strike. Active: Creates a field of lightning damaging nearby enemies for several seconds.',
              },
              e: {
                sourceSpellIds: ['communitydragon:JayceThunderingBlow'],
                fallbackSourceSpellIds: ['JayceThunderingBlow'],
                name: 'Thundering Blow',
                shortDescription: 'Deals magic damage and knocks an enemy back.',
                fullDescription:
                  'Hammer Stance: Deals magic damage to an enemy and knocks them back a short distance.',
              },
              r: {
                sourceSpellIds: ['JayceStanceHtG'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary: 'Owns Jayce’s stance switch and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Triggers when Jayce swaps weapons; the omitted stance-switch system is required.',
                },
              },
            },
          },
          {
            id: 'jayce-cannon',
            label: 'Cannon',
            componentOverrides: {
              body: {
                name: 'Jayce — Cannon Body',
                bodyStats: {
                  attackRange: 500,
                  attackType: 'ranged',
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/jayce/jayce.bin.json',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'jayce-cannon-form',
                    description: 'Carries Jayce’s cannon form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:JayceShockBlast'],
                fallbackSourceSpellIds: ['JayceToTheSkies'],
                name: 'Shock Blast',
                shortDescription:
                  'Fires an orb of electricity that detonates on impact and damages nearby enemies.',
                fullDescription:
                  'Cannon Stance: Fires an orb of electricity that detonates upon hitting an enemy (or reaching the end of its path) dealing physical damage to all enemies hit.',
              },
              w: {
                sourceSpellIds: ['communitydragon:JayceHyperCharge'],
                fallbackSourceSpellIds: ['JayceStaticField'],
                name: 'Hyper Charge',
                shortDescription:
                  'Gains a burst of energy that increases attack speed for several attacks.',
                fullDescription:
                  'Cannon Stance: Gains a burst of energy, increasing Attack Speed to maximum for several attacks.',
              },
              e: {
                sourceSpellIds: ['communitydragon:JayceAccelerationGate'],
                fallbackSourceSpellIds: ['JayceThunderingBlow'],
                name: 'Acceleration Gate',
                shortDescription:
                  'Deploys an Acceleration Gate that increases allied movement speed.',
                fullDescription:
                  'Cannon Stance: Deploys an Acceleration Gate increasing the Move Speed of all allied champions who pass through it. If Shock Blast is fired through the gate the missile speed, range, and damage will increase.',
              },
              r: {
                sourceSpellIds: ['JayceStanceHtG'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary: 'Owns Jayce’s stance switch and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Triggers when Jayce swaps weapons; the omitted stance-switch system is required.',
                },
              },
            },
          },
        ],
        notes: [
          'Jayce is one base champion with two draft variants, so weighting and no-repeat identity are shared.',
          'Hammer and Cannon each carry their form-specific Body, Q, W, and E components.',
          'R owns the stance switch; Passive only triggers when that omitted stance-switch system fires, so both are unavailable in a fixed-form variant.',
          'Portability test passes for each form-specific component only when its form is packaged by the selected variant.',
          'Hammer Body is melee at 125 attack range; Cannon Body is ranged at 500 attack range. These reviewed form stats are sourced from the versioned game-data record because Data Dragon exposes only Jayce’s default Body stats.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Jayce.json',
          'https://www.leagueoflegends.com/en-us/champions/jayce/',
          'https://raw.communitydragon.org/16.17/game/data/characters/jayce/jayce.bin.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'hwei',
        variants: [
          {
            id: 'hwei-default',
            label: 'Spellbook',
            componentOverrides: {
              q: {
                name: 'Disaster spellbook',
                sourceSpellIds: ['HweiQ'],
                carriedMechanics: [
                  {
                    id: 'hwei-disaster-spellbook',
                    description: 'Includes all three Q-subject spells as one Q component.',
                  },
                ],
              },
              w: {
                name: 'Serenity spellbook',
                sourceSpellIds: ['HweiW'],
                carriedMechanics: [
                  {
                    id: 'hwei-serenity-spellbook',
                    description: 'Includes all three W-subject spells as one W component.',
                  },
                ],
              },
              e: {
                name: 'Torment spellbook',
                sourceSpellIds: ['HweiE'],
                carriedMechanics: [
                  {
                    id: 'hwei-torment-spellbook',
                    description: 'Includes all three E-subject spells as one E component.',
                  },
                ],
              },
              r: { sourceSpellIds: ['HweiR'] },
            },
          },
        ],
        notes: [
          'Hwei remains one champion and is not split into form variants.',
          'The three Q-subject, W-subject, and E-subject spells are each packaged inside their matching slot.',
          'Each package occupies one slot and does not populate or overwrite another slot.',
          'Portability test passes because the subspells are alternatives within one category and share no omitted slot.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Hwei.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'elise',
        variants: [
          {
            id: 'elise-human',
            label: 'Human',
            componentOverrides: {
              body: {
                name: 'Elise — Human Body',
                bodyStats: {
                  attackRange: 550,
                  attackType: 'ranged',
                  movementSpeed: 330,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/elise/elise.bin.json',
                    'https://www.leagueoflegends.com/en-us/champions/elise/',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'elise-human-form',
                    description: 'Carries Elise’s human form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:EliseHumanQ'],
                fallbackSourceSpellIds: ['EliseHumanQ'],
                sourceDataValueNames: ['BaseDamage', 'TargetHPDamage', 'MonsterCapDamage'],
                name: 'Neurotoxin',
                shortDescription: 'Deals damage based on how high the target’s Health is.',
                fullDescription:
                  'Human Form: Deals damage based upon how high the target’s Health is.',
              },
              w: {
                sourceSpellIds: ['communitydragon:EliseHumanW'],
                fallbackSourceSpellIds: ['EliseHumanW'],
                sourceDataValueNames: ['BaseDamage'],
                name: 'Volatile Spiderling',
                shortDescription: 'Releases a venom-gorged Spiderling that explodes near a target.',
                fullDescription:
                  'Human Form: Releases a venom-gorged Spiderling that explodes when it nears a target.',
              },
              e: {
                sourceSpellIds: ['communitydragon:EliseHumanE'],
                fallbackSourceSpellIds: ['EliseHumanE'],
                sourceDataValueNames: ['BaseStunDuration'],
                name: 'Cocoon',
                shortDescription:
                  'Stuns the first enemy unit hit and reveals them if they are not stealthed.',
                fullDescription:
                  'Human Form: Stuns the first enemy unit hit and reveals them if they are not stealthed.',
              },
              r: {
                sourceSpellIds: ['EliseR'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Owns Elise’s Human/Spider transformation and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Owns Spiderling generation and form-linked effects that require the original kit.',
                },
              },
            },
          },
          {
            id: 'elise-spider',
            label: 'Spider',
            componentOverrides: {
              body: {
                name: 'Elise — Spider Body',
                bodyStats: {
                  attackRange: 125,
                  attackType: 'melee',
                  movementSpeed: 355,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/elise/elise.bin.json',
                    'https://wiki.leagueoflegends.com/en-us/Elise',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'elise-spider-form',
                    description: 'Carries Elise’s spider form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:EliseSpiderQCast'],
                fallbackSourceSpellIds: ['EliseHumanQ'],
                sourceDataValueNames: ['BaseDamage', 'TargetMissingHPDamage', 'MonsterCapDamage'],
                name: 'Venomous Bite',
                shortDescription:
                  'Lunges at an enemy and deals damage based on how low their Health is.',
                fullDescription:
                  'Spider Form: Lunges at an enemy and deals damage based upon how low their Health is.',
              },
              w: {
                sourceSpellIds: ['communitydragon:EliseSpiderW'],
                fallbackSourceSpellIds: ['EliseHumanW'],
                sourceDataValueNames: ['PassiveAttackSpeed', 'ActiveAttackSpeed'],
                name: 'Skittering Frenzy',
                shortDescription: 'Elise and her Spiderlings gain Attack Speed.',
                fullDescription: 'Spider Form: Elise and her Spiderlings gain Attack Speed.',
              },
              e: {
                sourceSpellIds: ['communitydragon:EliseSpiderEInitial'],
                fallbackSourceSpellIds: ['EliseHumanE'],
                sourceDataValueNames: ['PBonusIncrease'],
                sourceDataValueMultipliers: { PBonusIncrease: 100 },
                name: 'Rappel',
                shortDescription: 'Elise and her Spiderlings ascend, then descend upon a target.',
                fullDescription:
                  'Spider Form: Elise and her Spiderlings ascend into the air and then descend upon a target enemy. After descending, Elise’s bonus damage and healing from Spider Queen is increased.',
              },
              r: {
                sourceSpellIds: ['EliseR'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Owns Elise’s Human/Spider transformation and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Owns Spiderling generation and form-linked effects that require the original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Elise is one base champion with two draft variants, so weighting and no-repeat identity are shared.',
          'Human and Spider each carry their form-specific Body, Q, W, and E components.',
          'R owns the Human/Spider transformation; Passive owns Spiderling generation and form-linked effects. Both depend on the paired original kit and remain unavailable in a fixed-form variant.',
          'The Human Q source selects only human damage values from a record that also contains Spider values; the Spider Q source uses the source-backed QCast hit subspell.',
          'The Spider E source uses the initial Rappel cast and converts its reviewed ratio values to percentage display values.',
          'Spider Body is melee at 125 attack range and 355 movement speed; these form stats are separately sourced because Data Dragon exposes Elise’s Human Body stats.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Elise.json',
          'https://www.leagueoflegends.com/en-us/champions/elise/',
          'https://raw.communitydragon.org/16.17/game/data/characters/elise/elise.bin.json',
          'https://wiki.leagueoflegends.com/en-us/Elise',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'nidalee',
        variants: [
          {
            id: 'nidalee-human',
            label: 'Human',
            componentOverrides: {
              body: {
                name: 'Nidalee — Human Body',
                bodyStats: {
                  attackRange: 525,
                  attackType: 'ranged',
                  movementSpeed: 335,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/nidalee/nidalee.bin.json',
                    'https://www.leagueoflegends.com/en-us/champions/nidalee/',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'nidalee-human-form',
                    description: 'Carries Nidalee’s human form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:JavelinToss'],
                fallbackSourceSpellIds: ['JavelinToss'],
                sourceDataValueNames: ['SpearMinimumDamage', 'SpearMaximumDamage'],
                name: 'Javelin Toss',
                shortDescription: 'Throws a javelin that deals more damage the farther it travels.',
                fullDescription:
                  'Human Form: Nidalee throws a spiked javelin at her target that gains damage as it flies.',
              },
              w: {
                sourceSpellIds: ['communitydragon:Bushwhack'],
                fallbackSourceSpellIds: ['Bushwhack'],
                sourceDataValueNames: ['TotalFlatDamage'],
                name: 'Bushwhack',
                shortDescription: 'Places a trap that damages and reveals enemies who trigger it.',
                fullDescription:
                  'Human Form: Nidalee lays a trap for unwary opponents that damages and reveals its target when sprung.',
              },
              e: {
                sourceSpellIds: ['communitydragon:PrimalSurge'],
                fallbackSourceSpellIds: ['PrimalSurge'],
                sourceDataValueNames: ['BaseHeal', 'BonusAS'],
                name: 'Primal Surge',
                shortDescription: 'Heals an ally and grants them Attack Speed.',
                fullDescription:
                  'Human Form: Nidalee channels the spirit of the cougar to heal an ally and grant them Attack Speed.',
              },
              r: {
                sourceSpellIds: ['AspectOfTheCougar'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Owns Nidalee’s Human/Cougar transformation and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Owns Prowl/Hunt marks and cross-form bonuses that require the original kit.',
                },
              },
            },
          },
          {
            id: 'nidalee-cougar',
            label: 'Cougar',
            componentOverrides: {
              body: {
                name: 'Nidalee — Cougar Body',
                bodyStats: {
                  attackRange: 125,
                  attackType: 'melee',
                  movementSpeed: 335,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/nidalee/nidalee.bin.json',
                    'https://www.leagueoflegends.com/en-us/champions/nidalee/',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'nidalee-cougar-form',
                    description: 'Carries Nidalee’s cougar form as part of this Body variant.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:Takedown'],
                fallbackSourceSpellIds: ['JavelinToss'],
                sourceDataValueNames: ['TakedownBaseDamage', 'TakedownDamageAmp'],
                sourceDataValueSourceSpellIds: ['communitydragon:AspectOfTheCougar'],
                name: 'Takedown',
                shortDescription:
                  'Empowers Nidalee’s next attack to deal more damage to low-health targets.',
                fullDescription:
                  'Cougar Form: Nidalee’s next attack attempts to fatally wound her target, dealing more damage the less Health they have.',
              },
              w: {
                sourceSpellIds: ['communitydragon:Pounce'],
                fallbackSourceSpellIds: ['Bushwhack'],
                sourceDataValueNames: ['PounceDamage', 'PounceCooldown'],
                sourceDataValueSourceSpellIds: ['communitydragon:AspectOfTheCougar'],
                name: 'Pounce',
                shortDescription: 'Leaps in a direction and deals damage where Nidalee lands.',
                fullDescription:
                  'Cougar Form: Nidalee leaps in a direction, dealing damage in an area where she lands.',
              },
              e: {
                sourceSpellIds: ['communitydragon:Swipe'],
                fallbackSourceSpellIds: ['PrimalSurge'],
                sourceDataValueNames: ['SwipeDamage'],
                sourceDataValueSourceSpellIds: ['communitydragon:AspectOfTheCougar'],
                name: 'Swipe',
                shortDescription:
                  'Claws in a direction, dealing damage to enemies in front of her.',
                fullDescription:
                  'Cougar Form: Nidalee claws in a direction, dealing damage to enemies in front of her.',
              },
              r: {
                sourceSpellIds: ['AspectOfTheCougar'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Owns Nidalee’s Human/Cougar transformation and requires the paired form kit.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Owns Prowl/Hunt marks and cross-form bonuses that require the original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Nidalee is one base champion with Human and Cougar draft variants, so weighting and no-repeat identity are shared.',
          'Human and Cougar each carry their form-specific Body, Q, W, and E components.',
          'R owns the Human/Cougar transformation; Passive owns Prowl/Hunt marks and their cross-form bonuses. Both depend on the paired original kit and remain unavailable in a fixed-form variant.',
          'Cougar Q/W/E use their own CommunityDragon cast records for cooldowns and ranges while selecting named damage values from AspectOfTheCougar, which is the source record that stores the three Cougar tooltip packages.',
          'Cougar Body is melee at 125 attack range and retains Nidalee’s 335 base movement speed; the Cougar attack record and official champion page support the form presentation.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Nidalee.json',
          'https://www.leagueoflegends.com/en-us/champions/nidalee/',
          'https://raw.communitydragon.org/16.17/game/data/characters/nidalee/nidalee.bin.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'fiddlesticks',
        assetOverrides: {
          defaultSplash:
            'https://raw.communitydragon.org/16.17/plugins/rcp-be-lol-game-data/global/default/assets/characters/fiddlesticks/skins/base/images/fiddlesticks_splash_uncentered_0.jpg',
          defaultLoading:
            'https://raw.communitydragon.org/16.17/plugins/rcp-be-lol-game-data/global/default/assets/characters/fiddlesticks/skins/base/fiddlesticksloadscreen.jpg',
        },
        notes: [
          'The Data Dragon Fiddlesticks_0.jpg asset still resolves to the legacy pre-VGU splash for this snapshot.',
          'Use the version-pinned CommunityDragon base-skin splash and loading-screen assets for Fiddlesticks’ current reworked artwork; this is a presentation-only correction.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Fiddlesticks.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/fiddlesticks/fiddlesticks.bin.json',
          'https://raw.communitydragon.org/16.17/plugins/rcp-be-lol-game-data/global/default/assets/characters/fiddlesticks/skins/base/images/fiddlesticks_splash_uncentered_0.jpg',
          'https://raw.communitydragon.org/16.17/plugins/rcp-be-lol-game-data/global/default/assets/characters/fiddlesticks/skins/base/fiddlesticksloadscreen.jpg',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'gnar',
        variants: [
          {
            id: 'gnar-mini',
            label: 'Mini',
            componentOverrides: {
              body: {
                name: 'Gnar — Mini Body',
                bodyStats: {
                  attackRange: 387.5,
                  attackType: 'ranged',
                  movementSpeed: 335,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/gnar/gnar.bin.json',
                    'https://www.leagueoflegends.com/en-us/champions/gnar/',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'gnar-mini-form',
                    description:
                      'Carries Gnar’s Mini form, including its form-local ranged attacks and level-scaling movement, attack-speed, and attack-range bonuses.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:GnarQ'],
                fallbackSourceSpellIds: ['GnarQ'],
                sourceDataValueNames: ['MiniBaseDamage', 'SlowAmount'],
                name: 'Boomerang Throw',
                shortDescription: 'Throws a boomerang that damages and slows enemies it hits.',
                fullDescription:
                  'Mini Form: Throws a boomerang that damages and slows enemies it hits before returning to Gnar. Catching it reduces the cooldown.',
              },
              w: {
                sourceSpellIds: ['communitydragon:GnarW'],
                fallbackSourceSpellIds: ['GnarW'],
                sourceDataValueNames: ['MiniBaseDamage', 'MiniPercentHPDamage'],
                name: 'Hyper',
                shortDescription:
                  'Gnar’s attacks and spells build Hyper, dealing bonus damage and granting Move Speed.',
                fullDescription:
                  'Mini Form: Gnar’s attacks and spells build Hyper, dealing bonus damage and granting Move Speed.',
              },
              e: {
                sourceSpellIds: ['communitydragon:GnarE'],
                fallbackSourceSpellIds: ['GnarE'],
                sourceDataValueNames: ['MiniDamage', 'MinibAS'],
                name: 'Hop',
                shortDescription:
                  'Leaps to a location and bounces off the head of any unit Gnar lands on.',
                fullDescription:
                  'Mini Form: Leaps to a location and bounces off the head of any unit Gnar lands on, traveling farther.',
              },
              r: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/gnar/hud/icons2d/gnar_r_grey.png',
                sourceSpellIds: ['GnarR'],
                availability: {
                  status: 'unavailable',
                  reasonCode: 'nonfunctional-without-shared-system',
                  summary: 'GNAR! can only be cast while Gnar is in Mega Form.',
                },
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Rage Gene owns Gnar’s shared Rage resource and Mini/Mega transformation lifecycle.',
                },
              },
            },
          },
          {
            id: 'gnar-mega',
            label: 'Mega',
            componentOverrides: {
              body: {
                name: 'Gnar — Mega Body',
                bodyStats: {
                  attackRange: 175,
                  attackType: 'melee',
                  movementSpeed: 335,
                  sourceRefs: [
                    'https://raw.communitydragon.org/16.17/game/data/characters/gnar/gnar.bin.json',
                    'https://www.leagueoflegends.com/en-us/champions/gnar/',
                  ],
                },
                carriedMechanics: [
                  {
                    id: 'gnar-mega-form',
                    description:
                      'Carries Gnar’s Mega form, including its form-local melee attacks and level-scaling health, armor, magic-resistance, and attack-damage bonuses.',
                  },
                ],
              },
              q: {
                sourceSpellIds: ['communitydragon:GnarBigQ'],
                fallbackSourceSpellIds: ['GnarQ'],
                sourceDataValueNames: ['MegaBaseDamage', 'MegaSlowAmount'],
                sourceDataValueMultipliers: { MegaSlowAmount: 100 },
                name: 'Boulder Toss',
                shortDescription:
                  'Throws a boulder that stops on the first unit hit, damaging and slowing nearby enemies.',
                fullDescription:
                  'Mega Form: Throws a boulder that stops on the first unit hit, damaging and slowing nearby enemies. Picking it up reduces the cooldown.',
              },
              w: {
                sourceSpellIds: ['communitydragon:GnarBigW'],
                fallbackSourceSpellIds: ['GnarW'],
                sourceDataValueNames: ['MegaBaseDamage', 'MegaStunDuration'],
                sourceDataValueSourceSpellIds: ['communitydragon:GnarW'],
                name: 'Wallop',
                shortDescription: 'Smashes the area in front of Gnar, stunning enemies.',
                fullDescription:
                  'Mega Form: Rears up and smashes the area in front of Gnar, damaging and stunning enemies.',
              },
              e: {
                sourceSpellIds: ['communitydragon:GnarBigE'],
                fallbackSourceSpellIds: ['GnarE'],
                sourceDataValueNames: ['MegaDamage'],
                sourceDataValueSourceSpellIds: ['communitydragon:GnarE'],
                name: 'Crunch',
                shortDescription:
                  'Leaps to a location and lands with earth-shattering force, damaging nearby enemies.',
                fullDescription:
                  'Mega Form: Leaps to a location and lands with earth-shattering force, damaging nearby enemies.',
              },
              r: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/gnar/hud/icons2d/gnarbig_r.png',
                sourceSpellIds: ['GnarR'],
                name: 'GNAR!',
                shortDescription:
                  'Throws everything around Gnar in a chosen direction, slowing or stunning enemies against a wall.',
                fullDescription:
                  'Mega Form: Throws everything around Gnar in a chosen direction, dealing damage and slowing enemies. Enemies that hit a wall are stunned and take bonus damage.',
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Rage Gene owns Gnar’s shared Rage resource and Mini/Mega transformation lifecycle.',
                },
              },
            },
          },
        ],
        notes: [
          'Gnar is one base champion with Mini and Mega draft variants, so weighting and no-repeat identity are shared.',
          'Mini and Mega each carry their form-specific Body, Q, W, and E components.',
          'Passive is unavailable because Rage Gene owns the shared Rage resource and transformation lifecycle rather than a portable form-only effect.',
          'R is unavailable on Mini because GNAR! requires Mega Form, but available on Mega because it is Mega’s active attack rather than the transformation itself.',
          'Mega Q/W/E use the separate GnarBig cast records where available while selecting named values from the shared Gnar Q/W/E records when the source stores those values there.',
          'Form-local stat modifiers remain attached to the selected Body variant; the omitted Passive does not reintroduce the transformation lifecycle.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Gnar.json',
          'https://www.leagueoflegends.com/en-us/champions/gnar/',
          'https://raw.communitydragon.org/16.17/game/data/characters/gnar/gnar.bin.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'shyvana',
        variants: [
          {
            id: 'shyvana-default',
            label: 'Dragon cycle',
            componentOverrides: {
              body: {
                carriedMechanics: [
                  {
                    id: 'shyvana-base-body',
                    description:
                      'Carries Shyvana’s ordinary body; Dragon Form is a temporary state created by R rather than a separate Body variant.',
                  },
                ],
              },
              r: {
                carriedMechanics: [
                  {
                    id: 'shyvana-dragon-form',
                    description:
                      'Owns Fury gain, Dragon Form entry, the temporary Dragon body modifiers, and the return to ordinary form.',
                  },
                ],
              },
              passive: {
                carriedMechanics: [
                  {
                    id: 'shyvana-scalemail',
                    description:
                      'Scalemail is Shyvana’s independent armor and magic-resistance stacking passive; it does not own Fury or Dragon Form.',
                  },
                ],
              },
            },
          },
        ],
        notes: [
          'Shyvana remains one normal draft variant because R is an active, self-contained Dragon transformation rather than a permanent alternate kit.',
          'R owns Fury gain, Dragon Form entry, the temporary body modifiers, and the empowered Q/W/E behavior; it remains selectable.',
          'Passive remains selectable because Scalemail only grants armor and magic-resistance stacks. It does not own Fury or the transformation lifecycle.',
          'This avoids offering a permanently weaker Human variant or falsely treating Dragon Form as a second base-champion identity.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Shyvana.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/shyvana/shyvana.bin.json',
          'https://www.leagueoflegends.com/en-us/champions/shyvana/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'rek-sai',
        variants: [
          {
            id: 'rek-sai-default',
            label: 'Burrow cycle',
            componentOverrides: {
              q: {
                carriedMechanics: [
                  {
                    id: 'reksai-q-burrow-branch',
                    description:
                      'Prey Seeker is the Q-owned alternate cast available only while W has placed Rek’Sai in Burrowed state.',
                  },
                ],
                dependencies: [
                  {
                    kind: 'self-state',
                    description:
                      'Q has a normal attack branch and a Burrowed Prey Seeker branch; W owns the state switch.',
                  },
                ],
              },
              w: {
                carriedMechanics: [
                  {
                    id: 'reksai-burrow-state',
                    description:
                      'Owns Burrow/Un-burrow, the temporary movement and vision changes, and the Unburrow crowd-control cast.',
                  },
                ],
              },
              e: {
                carriedMechanics: [
                  {
                    id: 'reksai-e-burrow-branch',
                    description:
                      'Tunnel is the E-owned alternate cast available only while W has placed Rek’Sai in Burrowed state.',
                  },
                ],
                dependencies: [
                  {
                    kind: 'self-state',
                    description:
                      'E has a normal Furious Bite branch and a Burrowed Tunnel branch; W owns the state switch.',
                  },
                ],
              },
              passive: {
                carriedMechanics: [
                  {
                    id: 'reksai-fury-healing',
                    description:
                      'Fury of the Xer’Sai generates Fury from attacks and abilities and consumes it for healing while W-owned Burrowed state is active.',
                  },
                ],
                dependencies: [
                  {
                    kind: 'self-state',
                    description:
                      'The healing consumer is Burrowed state owned by W; Fury generation remains meaningful in either state.',
                  },
                ],
              },
            },
          },
        ],
        notes: [
          'Rek’Sai remains one normal draft variant because W is an active state switch and Q/E contain their alternate casts inside their own slots; no slot is permanently replaced.',
          'W owns Burrow/Un-burrow. Q owns Queen’s Wrath/Prey Seeker, E owns Furious Bite/Tunnel, and Passive owns Fury generation plus its Burrowed healing consumer.',
          'R is independent Void Rush and remains selectable. The normal variant preserves both states without inventing a permanently Burrowed or Unburrowed Body.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/RekSai.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/reksai/reksai.bin.json',
          'https://www.leagueoflegends.com/en-us/champions/reksai/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'kled',
        variants: [
          {
            id: 'kled-mounted',
            label: 'Mounted',
            componentOverrides: {
              body: {
                name: 'Kled — Mounted Body',
                carriedMechanics: [
                  {
                    id: 'kled-mounted-state',
                    description:
                      'Carries Kled mounted on Skaarl; the dismount/remount lifecycle is intentionally omitted from this fixed-state variant.',
                  },
                ],
              },
              q: {
                name: 'Bear Trap on a Rope',
                shortDescription: 'Throws a bear trap that damages and hooks an enemy champion.',
                fullDescription:
                  'Kled throws a bear trap that damages and hooks an enemy champion. If the target remains shackled for a short duration, it takes additional physical damage and is yanked toward Kled.',
              },
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Skaarl’s dismount/remount lifecycle changes Kled’s Body state and replaces Q with Pocket Pistol.',
                },
              },
            },
          },
        ],
        notes: [
          'Kled is represented by one coherent Mounted variant rather than exposing a weaker, incomplete Dismounted roll.',
          'Passive is unavailable because it owns dismount/remount, changes Kled’s Body state, and replaces Q with Pocket Pistol.',
          'Mounted Q is narrowed to Bear Trap on a Rope. The dismounted Q, Body state, and remount resource are not silently reintroduced by another selected slot.',
          'A separate Dismounted variant is deferred until its source-backed Body and complete ability presentation can be represented without guessing.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Kled.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/kled/kled.bin.json',
          'https://www.leagueoflegends.com/en-us/champions/kled/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'kayn',
        variants: [
          {
            id: 'kayn-rhaast',
            label: 'Rhaast',
            componentOverrides: {
              body: {
                carriedMechanics: [
                  {
                    id: 'kayn-rhaast-form',
                    description:
                      'Carries Kayn’s fixed Rhaast form; the Passive’s transformation choice is resolved by this variant.',
                  },
                ],
              },
              q: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_q_slay.png',
                sourceSpellIds: ['communitydragon:KaynQ'],
                fallbackSourceSpellIds: ['KaynQ'],
                sourceDataValueNames: [
                  'SlayerBaseMaxHPDamage',
                  'SlayerMaxHPPer100BAD',
                  'SlayerMaxHPPer100BADTOOLTIPONLY',
                  'BonusADRatio',
                  'BaseDamage',
                  'SlayTADRatio',
                  'MaxDmgToMonsters',
                  'FlatBonusDmgToMonsters',
                  'AoERadius',
                ],
                sourceDataValueMultipliers: {
                  BonusADRatio: 100,
                  SlayTADRatio: 100,
                },
                name: 'Reaping Slash — Rhaast',
                fullDescription:
                  'Rhaast dashes, then slashes, dealing physical damage and additional damage based on the target’s maximum Health.',
              },
              w: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_w_slay.png',
                sourceSpellIds: ['communitydragon:KaynW'],
                fallbackSourceSpellIds: ['KaynW'],
                sourceDataValueNames: ['BaseDamage', 'KnockupDuration', 'BoxWidth'],
                name: "Blade's Reach — Rhaast",
                fullDescription: 'Rhaast damages targets in a line and knocks them up.',
              },
              e: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_e_slay.png',
                sourceSpellIds: ['communitydragon:KaynE'],
                fallbackSourceSpellIds: ['KaynE'],
                sourceDataValueNames: [
                  'MS',
                  'WallWalkDuration',
                  'LingerTime',
                  'WarningParticleRange',
                  'MaxInCombatTime',
                  'HealAmount',
                  'HealBADRatio',
                ],
                sourceDataValueMultipliers: { HealBADRatio: 100 },
                name: 'Shadow Step — Rhaast',
                fullDescription:
                  'Rhaast can walk through terrain, gaining Move Speed and healing when he enters terrain.',
              },
              r: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_r1_slay.png',
                sourceSpellIds: ['communitydragon:KaynR'],
                fallbackSourceSpellIds: ['KaynR'],
                sourceDataValueNames: [
                  'BaseDamage',
                  'MinimumInfestTime',
                  'InfestDuration',
                  'JumpOutDistance',
                  'SlayerMaxHPBaseDamage',
                  'SlayerMaxHPDamagerPer100AD',
                  'SlayerHealPercent',
                ],
                sourceDataValueMultipliers: {
                  SlayerMaxHPBaseDamage: 100,
                  SlayerMaxHPDamagerPer100AD: 100,
                  SlayerHealPercent: 100,
                },
                name: 'Umbral Trespass — Rhaast',
                fullDescription:
                  'Rhaast hides inside an enemy and bursts out, dealing damage based on the target’s maximum Health and healing Rhaast.',
              },
              passive: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_passive_slay.png',
                name: 'The Darkin Scythe — Rhaast',
                shortDescription:
                  'Rhaast heals for a percentage of spell damage dealt to champions.',
                fullDescription:
                  'Darkin: Heal for a percentage of spell damage dealt to champions.',
                carriedMechanics: [
                  {
                    id: 'kayn-rhaast-passive',
                    description:
                      'Carries only Rhaast’s fixed Darkin healing effect; the omitted transformation choice cannot replace Q/W/E/R.',
                  },
                ],
              },
            },
          },
          {
            id: 'kayn-shadow-assassin',
            label: 'Shadow Assassin',
            componentOverrides: {
              body: {
                carriedMechanics: [
                  {
                    id: 'kayn-shadow-assassin-form',
                    description:
                      'Carries Kayn’s fixed Shadow Assassin form; the Passive’s transformation choice is resolved by this variant.',
                  },
                ],
              },
              q: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_q_ass.png',
                sourceSpellIds: ['communitydragon:KaynQ'],
                fallbackSourceSpellIds: ['KaynQ'],
                sourceDataValueNames: [
                  'BonusADRatio',
                  'BaseDamage',
                  'MaxDmgToMonsters',
                  'FlatBonusDmgToMonsters',
                  'AoERadius',
                ],
                sourceDataValueMultipliers: { BonusADRatio: 100 },
                name: 'Reaping Slash — Shadow Assassin',
                fullDescription: 'Kayn dashes, then slashes, dealing physical damage.',
              },
              w: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_w_ass.png',
                sourceSpellIds: ['communitydragon:KaynAssW'],
                fallbackSourceSpellIds: ['KaynW'],
                sourceDataValueNames: ['BaseDamage', 'KnockupDuration', 'SlowAmount'],
                sourceDataValueMultipliers: { SlowAmount: -100 },
                name: "Blade's Reach — Shadow Assassin",
                fullDescription:
                  'The Shadow Assassin damages and slows targets in a long line while his shadow performs the cast.',
              },
              e: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_e_ass.png',
                sourceSpellIds: ['communitydragon:KaynE'],
                fallbackSourceSpellIds: ['KaynE'],
                sourceDataValueNames: [
                  'AssassinCDReduction',
                  'AssMS',
                  'MS',
                  'WallWalkDuration',
                  'LingerTime',
                  'WarningParticleRange',
                  'MaxInCombatTime',
                  'HealAmount',
                  'HealBADRatio',
                ],
                sourceDataValueMultipliers: { HealBADRatio: 100 },
                name: 'Shadow Step — Shadow Assassin',
                fullDescription:
                  'The Shadow Assassin can walk through terrain, gaining increased Move Speed and reduced cooldown when entering terrain.',
              },
              r: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_r1_primary.png',
                sourceSpellIds: ['communitydragon:KaynR'],
                fallbackSourceSpellIds: ['KaynR'],
                sourceDataValueNames: [
                  'BaseDamage',
                  'MinimumInfestTime',
                  'InfestDuration',
                  'AssassinCastRange',
                  'BaseCastRange',
                  'AssassinJumpOutDistance',
                  'AssCastRange',
                ],
                name: 'Umbral Trespass — Shadow Assassin',
                fullDescription:
                  'The Shadow Assassin hides inside an enemy and bursts out, dealing damage and emerging farther away.',
              },
              passive: {
                iconRef:
                  'https://raw.communitydragon.org/16.17/game/assets/characters/kayn/hud/icons2d/kayn_passive_ass.png',
                name: 'The Darkin Scythe — Shadow Assassin',
                shortDescription:
                  'For the first few seconds in combat with enemy champions, the Shadow Assassin deals bonus damage.',
                fullDescription:
                  'Shadow Assassin: For the first few seconds in combat with enemy champions, deal bonus damage.',
                carriedMechanics: [
                  {
                    id: 'kayn-shadow-assassin-passive',
                    description:
                      'Carries only the Shadow Assassin’s fixed damage-amplification effect; the omitted transformation choice cannot replace Q/W/E/R.',
                  },
                ],
              },
            },
          },
        ],
        notes: [
          'Kayn has two fixed draft variants under one base-champion identity: Rhaast and Shadow Assassin.',
          'The Passive’s permanent transformation choice is resolved by the selected variant rather than being allowed to replace Q/W/E/R after the draft.',
          'Each variant carries its form-specific Q/W/E/R values and a form-local Passive effect. R remains available because Umbral Trespass is a temporary host state inside the chosen form, not the permanent form choice.',
          'Q/W/E/R alternate values use the versioned CommunityDragon records with Data Dragon text and icon fallbacks.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Kayn.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/kayn/kayn.bin.json',
          'https://www.leagueoflegends.com/en-us/champions/kayn/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'viego',
        variants: [
          {
            id: 'viego-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'overwrites-other-slots',
                  summary:
                    'Sovereign’s Domination grants an arbitrary defeated champion’s Body, basic abilities, items, and a replacement Ultimate.',
                },
              },
            },
          },
        ],
        notes: [
          'Viego keeps one default-kit variant and R remains selectable as Heartbreaker.',
          'Passive is unavailable because possession can replace Body, Q/W/E, items, and the selected R with arbitrary champion content; no finite fixed-form variant can represent that system.',
          'This is a targeted Passive restriction, not champion exclusion, because Viego’s own Body, Q, W, E, and R remain meaningful and portable.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Viego.json',
          'https://raw.communitydragon.org/16.17/game/data/characters/viego/viego.bin.json',
          'https://www.leagueoflegends.com/en-us/champions/viego/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'xayah',
        variants: [
          {
            id: 'xayah-default',
            label: 'Default kit',
            componentOverrides: {
              e: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Feather Recall requires Feathers supplied by Xayah’s original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Xayah remains one default-kit variant because her Body, Q, W, R, and Passive remain meaningful as independent components.',
          'Bladecaller (E) is unavailable because Feather Recall has no input when separated from Xayah’s original kit.',
          'The component fails the portability test because its meaningful damage and root require omitted original-kit state; this is a targeted component restriction rather than a champion exclusion.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Xayah.json',
          'https://www.leagueoflegends.com/en-us/champions/xayah/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'yorick',
        variants: [
          {
            id: 'yorick-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Shepherd of Souls requires Yorick’s original grave and Mist Walker system.',
                },
              },
            },
          },
        ],
        notes: [
          'Yorick remains one default-kit variant because Body, Q, W, E, and R retain meaningful standalone actions.',
          'Shepherd of Souls (Passive) is unavailable because its grave and Mist Walker behaviour has no portable lifecycle when separated from Yorick’s original kit.',
          'The component fails the portability test because its meaningful behaviour requires omitted original-kit state; this is a targeted Passive restriction rather than a champion exclusion.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Yorick.json',
          'https://www.leagueoflegends.com/en-us/champions/yorick/',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'azir',
        variants: [
          {
            id: 'azir-default',
            label: 'Default kit',
            componentOverrides: {
              q: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Conquering Sands requires Sand Soldiers supplied by Azir’s original kit.',
                },
              },
              e: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Shifting Sands requires a Sand Soldier supplied by Azir’s original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Azir remains one default-kit variant because Body, W, and R retain meaningful standalone actions.',
          'Q (Conquering Sands) and E (Shifting Sands) are unavailable because both require Sand Soldiers supplied by W or the original kit.',
          'The targeted restrictions preserve Azir’s meaningful independent choices without excluding the champion.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Azir.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'aurelion-sol',
        variants: [
          {
            id: 'aurelion-sol-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Cosmic Creator only upgrades Aurelion Sol’s other abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Aurelion Sol remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Cosmic Creator) is unavailable because Stardust only permanently improves Aurelion Sol’s other abilities, which cannot be selected from the same champion.',
          'This is a targeted Passive restriction rather than a champion exclusion.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/AurelionSol.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'heimerdinger',
        variants: [
          {
            id: 'heimerdinger-default',
            label: 'Default kit',
            componentOverrides: {
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'UPGRADE!!! only modifies Heimerdinger’s Q, W, or E abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Heimerdinger remains one default-kit variant because Body and Q/W/E retain meaningful standalone actions.',
          'R (UPGRADE!!!) is unavailable because it only modifies one of Heimerdinger’s omitted basic abilities.',
          'The component is restricted instead of carrying an implicit second spell slot.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Heimerdinger.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'illaoi',
        variants: [
          {
            id: 'illaoi-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Prophet of an Elder God requires Tentacle targets supplied by Illaoi’s original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Illaoi remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Prophet of an Elder God) is unavailable because its spawned Tentacles only have meaningful targets through Illaoi’s original Q, W, E, and R interactions.',
          'The restriction keeps the passive from presenting a spawn-only system with no portable action.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Illaoi.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'kalista',
        variants: [
          {
            id: 'kalista-default',
            label: 'Default kit',
            componentOverrides: {
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Fate’s Call requires Kalista’s Oathsworn ally from her original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Kalista remains one default-kit variant because Body and Q/W/E retain meaningful standalone actions.',
          'R (Fate’s Call) is unavailable because it only acts on Kalista’s Oathsworn ally, a relationship supplied by the original kit rather than a portable slot.',
          'Kalista is not excluded because the remaining components are still meaningful.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Kalista.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'karma',
        variants: [
          {
            id: 'karma-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Gathering Fire only reduces the cooldown of Karma’s Mantra (R).',
                },
              },
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Mantra only empowers Karma’s Q, W, or E abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Karma remains one default-kit variant because Body and Q/W/E retain meaningful standalone actions.',
          'Passive only reduces the cooldown of R, while R only adds reviewed effects to Karma’s Q/W/E; the pair cannot be split across a no-repeat draft.',
          'Both restrictions are targeted component restrictions rather than a champion exclusion.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Karma.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'leblanc',
        variants: [
          {
            id: 'leblanc-default',
            label: 'Default kit',
            componentOverrides: {
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Mimic requires one of LeBlanc’s original Q, W, or E spells.',
                },
              },
            },
          },
        ],
        notes: [
          'LeBlanc remains one default-kit variant because Body and Q/W/E retain meaningful standalone actions.',
          'R (Mimic) is unavailable because its only action is to repeat an omitted LeBlanc basic spell.',
          'The restriction avoids allowing R to implicitly supply a second ability slot.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Leblanc.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'mel',
        variants: [
          {
            id: 'mel-default',
            label: 'Default kit',
            componentOverrides: {
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Golden Eclipse requires Overwhelm marks supplied by Mel’s original Passive.',
                },
              },
            },
          },
        ],
        notes: [
          'Mel remains one default-kit variant because Body, Passive, and Q/W/E retain meaningful standalone actions.',
          'R (Golden Eclipse) is unavailable because it can only be cast on enemies marked with Overwhelm, which is supplied by Mel’s Passive.',
          'The restriction keeps the ultimate from presenting a cast with no legal target in a no-repeat build.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Mel.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'pantheon',
        variants: [
          {
            id: 'pantheon-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Mortal Will only empowers Pantheon’s other spells.',
                },
              },
            },
          },
        ],
        notes: [
          'Pantheon remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Mortal Will) is unavailable because its only output is an unspecified empowerment of Pantheon’s omitted spell kit.',
          'The component is restricted rather than inventing a portable effect for an omitted spell.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Pantheon.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'renekton',
        variants: [
          {
            id: 'renekton-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Reign of Anger only empowers Renekton’s other abilities with Fury.',
                },
              },
            },
          },
        ],
        notes: [
          'Renekton remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Reign of Anger) is unavailable because Fury has no meaningful consumer after Renekton’s other abilities are omitted.',
          'Renekton’s temporary R transformation remains available under the existing normal-variant ruling.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Renekton.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'riven',
        variants: [
          {
            id: 'riven-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Runic Blade requires charges from Riven’s original abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Riven remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Runic Blade) is unavailable because its bonus basic-attack damage requires charges generated by Riven’s omitted abilities.',
          'Riven’s R empowerment remains contained within R and follows the existing normal-variant ruling.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Riven.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'rumble',
        variants: [
          {
            id: 'rumble-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Junkyard Titan requires Rumble’s original spells to generate Heat.',
                },
              },
            },
          },
        ],
        notes: [
          'Rumble remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Junkyard Titan) is unavailable because Heat is generated by Rumble’s omitted spells and otherwise has no portable lifecycle.',
          'The restriction avoids carrying Danger Zone and Overheating as an implicit second ability system.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Rumble.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'sejuani',
        variants: [
          {
            id: 'sejuani-default',
            label: 'Default kit',
            componentOverrides: {
              e: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Permafrost requires maximum Frost stacks supplied by Sejuani’s original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Sejuani remains one default-kit variant because Body and Q/W/R retain meaningful standalone actions.',
          'E (Permafrost) is unavailable because it only damages and stuns targets carrying maximum Frost stacks supplied by Sejuani’s omitted kit.',
          'The restriction preserves the meaningful direct actions without inventing a Frost source.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Sejuani.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'smolder',
        variants: [
          {
            id: 'smolder-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Dragon Practice only increases damage for Smolder’s other basic abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Smolder remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Dragon Practice) is unavailable because its stacks only improve Smolder’s omitted basic abilities.',
          'Smolder’s direct Q action remains available without the upgrade progression.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Smolder.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'syndra',
        variants: [
          {
            id: 'syndra-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Transcendent only upgrades Syndra’s other abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Syndra remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Transcendent) is unavailable because each listed Splinters of Wrath upgrade targets an omitted Syndra ability.',
          'The restriction avoids carrying an ability-specific upgrade tree without its target abilities.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Syndra.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'twitch',
        variants: [
          {
            id: 'twitch-default',
            label: 'Default kit',
            componentOverrides: {
              e: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary:
                    'Contaminate requires Deadly Venom stacks supplied by Twitch’s original kit.',
                },
              },
            },
          },
        ],
        notes: [
          'Twitch remains one default-kit variant because Body and Q/W/R retain meaningful standalone actions.',
          'E (Contaminate) is unavailable because it only damages enemies carrying Deadly Venom stacks supplied by Twitch’s Passive or W.',
          'The restriction prevents a damage cast with no legal poisoned target in a no-repeat build.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Twitch.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'viktor',
        variants: [
          {
            id: 'viktor-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Glorious Evolution only augments Viktor’s other abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Viktor remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Glorious Evolution) is unavailable because Hex Fragments only augment Viktor’s omitted active abilities.',
          'The restriction avoids carrying an upgrade progression that has no selected target.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Viktor.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'yunara',
        variants: [
          {
            id: 'yunara-default',
            label: 'Default kit',
            componentOverrides: {
              r: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Transcend One’s Self only upgrades Yunara’s basic abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Yunara remains one default-kit variant because Body, Passive, and Q/W/E retain meaningful standalone actions.',
          'R (Transcend One’s Self) is unavailable because its only effect upgrades Yunara’s omitted basic abilities.',
          'The restriction avoids carrying a temporary state with no selected target abilities.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Yunara.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'zilean',
        variants: [
          {
            id: 'zilean-default',
            label: 'Default kit',
            componentOverrides: {
              w: {
                availability: {
                  status: 'conditional',
                  ruleId: 'zilean-rewind-composite-basic-abilities',
                  summary:
                    'Reduces the cooldowns of the composite champion’s other basic abilities.',
                },
              },
            },
          },
        ],
        notes: [
          'Zilean remains one default-kit variant because Body and Q/E/R retain meaningful standalone actions.',
          'W (Rewind) is a reviewed exception: its source effect is normalized to reduce the cooldowns of the composite champion’s other basic abilities when Zilean’s own Q/E are omitted.',
          'The exception keeps W selectable without supplying or rewriting another build slot, and it does not affect the ultimate.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Zilean.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
      {
        championId: 'zyra',
        variants: [
          {
            id: 'zyra-default',
            label: 'Default kit',
            componentOverrides: {
              passive: {
                availability: {
                  status: 'unavailable',
                  reasonCode: 'requires-original-kit',
                  summary: 'Garden of Thorns requires Zyra’s Q or E to grow its seeds into plants.',
                },
              },
            },
          },
        ],
        notes: [
          'Zyra remains one default-kit variant because Body and Q/W/E/R retain meaningful standalone actions.',
          'Passive (Garden of Thorns) is unavailable because its seeds only become meaningful plants through Zyra’s omitted Q or E.',
          'The restriction keeps a seed generator without a portable consumer out of the selectable pool.',
        ],
        sourceRefs: [
          'https://ddragon.leagueoflegends.com/cdn/16.17.1/data/en_US/champion/Zyra.json',
        ],
        reviewedForDataDragonVersion: '16.17.1',
      },
    ],
  });

export const COMPATIBILITY_MANIFEST = DEFAULT_COMPATIBILITY_MANIFEST;
