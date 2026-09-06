# Champion Data and Compatibility

## Purpose

BuildChamp deliberately rearranges parts of League of Legends kits. This document defines what those parts mean, which mechanics may travel with them, how exceptional champions are represented, and how a live-patch snapshot becomes safe draft data.

The guiding rule is: broken combinations are welcome; paradoxical or non-operational combinations are not.

## Canonical Terms

| Term | Meaning |
| --- | --- |
| Base champion | Riot's champion identity, used for randomness and no-repeat rules |
| Draft variant | A curated presentation of one mechanically coherent form of a base champion |
| Offer | The champion or variant shown to a player in one round |
| Component | One selectable Body, Q, W, E, R, or Passive belonging to an offer |
| Open slot | A build slot that has not been locked |
| Portable | Able to operate independently under BuildChamp's rules |
| Dependency | A mechanic or state a component requires to function |
| Snapshot | An immutable, validated set of champion data for one Data Dragon version |

UI and code should use these terms consistently. “Body” replaces “character model.”

## Slot Contract

### Body

Body grants:

- Default champion appearance and model
- Base statistics and per-level growth
- Base attack range and melee/ranged attack type
- Base movement speed
- Basic attack and movement animations
- Other presentation required to render the body coherently

Body does not grant the champion's Passive, Q, W, E, R, primary resource system, form-changing kit, or weapon-management system unless explicitly included by a reviewed draft variant.

During drafting, Body shows a compact summary. Full level 1 and level 18 values are expandable.

### Q, W, E, and R

An ability grants:

- Its cast behaviour and targeting rules
- Damage, healing, shielding, crowd control, movement, cooldown, and scaling data
- Self-contained recasts, charges, ammunition, marks, or temporary state owned solely by that ability
- Subspells contained within the selected category when a reviewed exception says they form one ability package

It does not grant or overwrite another build slot.

### Passive

Passive grants the passive effect and self-contained state it owns. A passive is unavailable if its only meaningful function is to operate omitted parts of the original kit.

## Resource Policy

Normal mana and energy costs are ignored. This prevents the chosen Body from determining whether unrelated abilities can be cast and avoids inventing a composite primary-resource system.

Health costs remain because paying health is part of an ability's power and risk. The cast must still leave the user in a legal game state according to the source ability's behaviour.

Self-contained secondary resources may travel with their component when all of the following are true:

1. The selected component creates or receives the resource itself.
2. The resource is used only by that component.
3. Carrying it does not add, replace, or mutate another selected slot.
4. The mechanic can be explained without reconstructing the original champion's kit.

Fury, Ferocity, Heat, Flow, weapon ammunition, and similar named systems are therefore not handled by one blanket rule. Each is classified by ownership and dependencies. A resource shared across several original abilities generally makes those dependent components unavailable unless a reviewed variant packages the inseparable system without consuming other slots.

## Portability Test

Every component must pass these checks:

1. **Ownership:** Is the behaviour clearly owned by this slot?
2. **Inputs:** Can it receive every required input without another original-kit slot?
3. **Outputs:** Does it avoid creating, replacing, or rewriting another BuildChamp slot?
4. **Lifecycle:** Can its state initialize, update, reset, and display independently?
5. **Meaning:** Does it still perform a meaningful action rather than becoming inert?
6. **Explanation:** Can a player understand what they received from concise UI copy?

If all checks pass, the component is `available`. If it operates after a small, explicit normalization allowed by global rules, it is `conditional`. If it requires reconstructing or overwriting the original kit, it is `unavailable`.

Conditional never means “we will decide at runtime.” Its normalization and player-facing disclosure must be recorded in the snapshot.

## Availability Model

```ts
type Slot = "body" | "q" | "w" | "e" | "r" | "passive";

type Availability =
  | { status: "available" }
  | {
      status: "conditional";
      ruleId: string;
      summary: string;
    }
  | {
      status: "unavailable";
      reasonCode:
        | "requires-original-kit"
        | "overwrites-other-slots"
        | "nonfunctional-without-shared-system"
        | "excluded-champion"
        | "unsupported-data";
      summary: string;
    };
```

Unavailable components remain visible in the offer so players understand the omission. The default label is “Requires original kit,” with an expandable explanation. They cannot be selected or used to satisfy the two-choice rule.

## Snapshot Schema

The following describes the normalized contract rather than Data Dragon's source shape:

```ts
type ChampionSnapshot = {
  schemaVersion: 1;
  dataDragonVersion: string;
  locale: "en_US";
  generatedAt: string;
  source: {
    provider: "riot-data-dragon";
    versionUrl: string;
  };
  generation: {
    importerVersion: string;
    sourceHash: string;
    sourceChampionCount: number;
  };
  indexes: {
    eligibleChampionIds: string[];
    excludedChampionIds: string[];
    variantIdsByChampionId: Record<string, string[]>;
    selectableComponentIdsBySlot: Record<Slot, string[]>;
  };
  champions: Champion[];
};

type Champion = {
  id: string;              // Stable BuildChamp identifier
  riotKey: string;         // Riot numeric/string key as supplied by source data
  name: string;
  title: string;
  excluded: boolean;
  exclusionReason?: string;
  randomWeight: number;    // Applied once to the base champion
  assetRefs: {
    icon: string;
    defaultSplash: string;
    defaultLoading: string;
  };
  variants: DraftVariant[];
};

type DraftVariant = {
  id: string;
  championId: string;
  label?: string;
  components: Record<Slot, Component>;
};

type Component = {
  id: string;
  slot: Slot;
  name: string;
  iconRef: string;
  shortDescription: string;
  fullDescription: string;
  cooldown?: DisplayValue;
  cooldowns?: DisplayValue[]; // One entry per source spell in a package
  range?: DisplayValue;
  ranges?: DisplayValue[];    // One entry per source spell in a package
  healthCost?: DisplayValue;
  healthCosts?: DisplayValue[];
  values: DisplayValue[];
  availability: Availability;
  dependencies: Dependency[];
  carriedMechanics: CarriedMechanic[];
  sourceRefs: string[];
  bodyStats?: BodyStats;      // Required when slot is Body
};

type BodyStats = {
  base: Record<string, number>;
  growth: Record<string, number>;
  attackRange: number;
  attackType: "melee" | "ranged";
  movementSpeed: number;
};

type ComponentOverride = {
  availability?: Availability;
  bodyStats?: {
    base?: Partial<Record<string, number>>;
    growth?: Partial<Record<string, number>>;
    attackRange?: number;
    attackType?: "melee" | "ranged";
    movementSpeed?: number;
    sourceRefs: string[];
  };
  sourceSpellIds?: string[];
  fallbackSourceSpellIds?: string[]; // One Data Dragon text/icon fallback per alternate source spell
  iconRef?: string; // Reviewed alternate icon when the source record has multiple form states
  sourceDataValueNames?: string[]; // Select named values when an alternate source contains multiple forms
  sourceDataValueSourceSpellIds?: string[]; // Alternate records that own the selected named values
  sourceDataValueMultipliers?: Record<string, number>; // Reviewed display normalization for selected values
  name?: string;
  shortDescription?: string;
  fullDescription?: string;
  dependencies?: Dependency[];
  carriedMechanics?: CarriedMechanic[];
};

type DisplayValue = {
  label: string;
  values: Array<number | string>;
  units?: string;
};

type Dependency = {
  kind: "self-state" | "resource" | "form" | "weapon" | "other-slot";
  description: string;
};

type CarriedMechanic = {
  id: string;
  description: string;
};
```

Descriptions and values must be traceable to the source snapshot or a reviewed normalization. BuildChamp must not invent gameplay values.

## Compatibility Manifest

Data Dragon cannot express BuildChamp portability, so reviewed exceptions live in a hand-authored manifest separate from generated source data.

```ts
type CompatibilityManifest = {
  schemaVersion: 1;
  entries: Array<{
    championId: string;
    excludeChampion?: { reason: string };
    assetOverrides?: {
      defaultSplash?: string;
      defaultLoading?: string;
    };
    variants?: Array<{
      id: string;
      label: string;
      componentOverrides: Partial<Record<Slot, ComponentOverride>>;
    }>;
    notes: string[];
    sourceRefs: string[];
    reviewedForDataDragonVersion: string;
  }>;
};
```

An override may change availability, explain dependencies, package approved subspells, point to a
form-specific source spell, provide reviewed player-facing text for a source record that contains
several forms, or provide a partial form-specific Body-stat override. A Body-stat override must carry
its own source references and may not silently alter official numerical values. A source spell ID with
the `communitydragon:` prefix is resolved from the versioned alternate-spell source; its matching
`fallbackSourceSpellIds` entry supplies Data Dragon text, icon, cost, and any field not exposed by the
alternate source. `sourceDataValueNames` selects only the named values needed for the reviewed form
when one alternate record contains values for several forms. `sourceDataValueMultipliers` is limited to
explicit, reviewed display conversions such as a source ratio that the tooltip presents as a percentage.
When a form’s cast record and its named values live in different CommunityDragon records,
`sourceDataValueSourceSpellIds` identifies the value record one-for-one with `sourceSpellIds`.
The importer preserves package cooldowns and ranges as plural display values, resolves form-specific
CommunityDragon spell icons when the alternate source exposes them, and strips source markup to plain
text. An explicit `iconRef` override is available when a source record contains multiple icon states or
the component has no alternate spell record to carry the form-specific asset. A champion-level
`assetOverrides` entry is available when a versioned source asset corrects a stale or legacy default
splash/loading reference without changing gameplay data.

Data Dragon sometimes exposes Hwei's three subject spellbooks and Jayce's paired forms inside one
source spell record rather than as separate IDs. The manifest selects those records and narrows only
the reviewed presentation; source values remain traceable through `sourceRefs`.

Every manifest change must include:

- The dependency that required the exception
- The portability-test result
- Player-facing explanation
- Source references
- The last Data Dragon version reviewed

## Initial Exception Rulings

### Aphelios

Aphelios is excluded entirely from the initial pool.

His attack range, weapons, ammunition, Q behaviour, weapon swap, off-hand interactions, and Passive progression form one shared system. Treating his Body as a normal body is misleading, while packaging the weapon system would overwrite or implicitly supply multiple selected slots. Individual choices would therefore be either nonfunctional or paradoxical.

### Jayce

Jayce has two draft variants under one base-champion identity:

- **Jayce — Hammer:** form-specific Body, Q, W, and E
- **Jayce — Cannon:** form-specific Body, Q, W, and E

R owns the stance switch. Passive only triggers when Jayce swaps weapons, so both are unavailable in a fixed-form variant because the paired stance-switch system is omitted. A run first weights Jayce once, then selects one eligible variant; variants do not give Jayce extra probability. Jayce cannot appear again in the same run in another form.

Jayce's form-specific Q/W/E values, cooldowns, ranges, and icons are sourced from the versioned CommunityDragon game-data record. Data Dragon remains the fallback for shared text or any alternate asset not exposed by the source, while the manifest supplies each form's reviewed presentation.

### Elise

Elise has two draft variants under one base-champion identity:

- **Elise — Human:** form-specific Body, Q, W, and E
- **Elise — Spider:** form-specific Body, Q, W, and E

R owns Spider Form transformation, while Passive owns Spiderling generation and form-linked effects. Both depend on the paired original kit, so they are unavailable in a fixed-form variant. A run first weights Elise once, then selects one eligible variant; the variants do not give Elise extra probability or bypass the no-repeat rule.

Human and Spider Body stats use separate reviewed form values. Human Q selects only the human values from a CommunityDragon record that also contains Spider values. Spider Q uses the source-backed QCast hit subspell, and Spider E uses the initial Rappel cast. CommunityDragon supplies the form-specific cooldowns, ranges, named values, and icons; Data Dragon remains the text and fallback source.

### Nidalee

Nidalee has two draft variants under one base-champion identity:

- **Nidalee — Human:** form-specific Body, Q, W, and E
- **Nidalee — Cougar:** form-specific Body, Q, W, and E

R owns the Human/Cougar transformation, while Passive owns Prowl/Hunt marks and their cross-form bonuses. Both depend on the paired original kit, so they are unavailable in a fixed-form variant. A run weights Nidalee once, then selects one eligible variant; the variants do not give Nidalee extra probability or bypass the no-repeat rule.

Human and Cougar Body stats use separate reviewed form values. Cougar Q, W, and E use their own CommunityDragon cast records for cooldowns, ranges, and icons while selecting their named damage values from AspectOfTheCougar, the source record that stores those three Cougar tooltip packages. Data Dragon remains the text and fallback source.

### Gnar

Gnar has two draft variants under one base-champion identity:

- **Gnar — Mini:** form-specific Body, Q, W, and E
- **Gnar — Mega:** form-specific Body, Q, W, E, and R

Mini R is unavailable because GNAR! can only be cast while Gnar is in Mega Form. Mega R is available because it is Mega's active attack, not the transformation itself. Passive is unavailable for both variants because Rage Gene owns the shared Rage resource and the Mini/Mega transformation lifecycle. A run weights Gnar once, then selects one eligible variant; the variants do not give Gnar extra probability or bypass the no-repeat rule.

Mini and Mega Body carry their form-local attack types and ranges. The source-defined level-scaling Mini movement, attack-speed, and attack-range bonuses and Mega health, armor, magic-resistance, and attack-damage bonuses remain attached to the selected Body variant rather than reintroducing Rage or transformation state. Mega Q/W/E use the separate GnarBig cast records where available and select named values from the shared Gnar Q/W/E records when CommunityDragon stores those values there. The form-specific Q/W/E and R icons use the corresponding CommunityDragon assets; Mini R uses the source's grey unavailable-state icon.

### Xayah

Xayah remains one default-kit variant. Body, Q, W, R, and Passive retain meaningful standalone actions, but E (Bladecaller) is unavailable. Feather Recall has no input when separated from Xayah’s original kit, so the component fails the portability test for its meaningful damage and root. It follows the existing unavailable-component path; Xayah is not excluded.

### Yorick

Yorick remains one default-kit variant. Body, Q, W, E, and R retain meaningful standalone actions, but Passive (Shepherd of Souls) is unavailable. Its grave and Mist Walker behaviour has no portable lifecycle when separated from Yorick’s original kit, so it follows the existing unavailable-component path. Yorick is not excluded.

### Standalone portability audit

A second pass over the pinned 16.17.1 roster found these additional components whose only
meaningful action requires a named state, target, or ability from the same champion’s omitted kit.
The audit also records one reviewed conditional exception where a narrow normalization preserves a
meaningful standalone action:

| Champion | Component treatment | Missing original-kit input or normalization |
| --- | --- | --- |
| Azir | Q, E | Sand Soldiers from W |
| Aurelion Sol | Passive | Stardust only upgrades Aurelion Sol’s other abilities |
| Heimerdinger | R | An omitted Q, W, or E to upgrade |
| Illaoi | Passive | Tentacle targets and interactions from the original kit |
| Kalista | R | The Oathsworn ally relationship |
| Karma | Passive, R | Mantra’s cooldown target and Q/W/E bonus effects |
| LeBlanc | R | An omitted Q, W, or E spell to mimic |
| Mel | R | Overwhelm marks from Passive |
| Pantheon | Passive | An omitted Pantheon spell to empower |
| Renekton | Passive | An omitted ability to consume Fury |
| Riven | Passive | Charges supplied by Riven’s abilities |
| Rumble | Passive | Heat supplied by Rumble’s spells |
| Sejuani | E | Maximum Frost stacks from the original kit |
| Smolder | Passive | An omitted basic ability to receive Dragon Practice upgrades |
| Syndra | Passive | The ability-specific Splinters of Wrath upgrades |
| Twitch | E | Deadly Venom stacks from Passive or W |
| Viktor | Passive | An omitted active ability to augment |
| Yunara | R | An omitted basic ability to upgrade |
| Zilean | W (conditional exception) | Rewind reduces the composite champion’s other basic ability cooldowns |
| Zyra | Passive | Q or E to turn seeds into plants |

This audit does not disable ordinary synergies that still have an independent effect, such as a
passive that reacts to a generic attack or spell, an ability with a direct base action plus an
optional combo bonus, or a temporary state owned and consumed within the same component. It also
does not treat ordinary ally, terrain, monster, or item interactions as missing same-champion kit
slots.

Zilean W is the sole reviewed conditional exception in this audit: the player-facing effect remains
cooldown reduction, normalized to the composite champion’s other basic abilities when Zilean’s own
Q and E are omitted.

### Transformation and state audit

The 16.17.1 roster audit uses one consistent boundary: create fixed draft variants when a
champion's alternate state changes Body or replaces another selectable slot outside the state
owner. Keep a state-changing ability in the normal variant when it is an active, temporary package
that does not require a second permanently selectable kit. A passive that selects or creates an
arbitrary other kit is unavailable unless a finite, source-backed form variant resolves that choice.

The reviewed outcomes are:

| Champion or system | Reviewed BuildChamp treatment |
| --- | --- |
| Jayce | Hammer and Cannon variants; R owns the switch and Passive is unavailable in both. |
| Elise | Human and Spider variants; R owns the switch and Passive is unavailable in both. |
| Nidalee | Human and Cougar variants; R owns the switch and Passive is unavailable in both. |
| Gnar | Mini and Mega variants; Passive is unavailable in both; R is unavailable on Mini and available on Mega. |
| Xayah | One default-kit variant; E is unavailable because Feather Recall requires state from Xayah’s original kit. |
| Kayn | Rhaast and Shadow Assassin variants; the permanent Passive choice is resolved by the variant, form-local Q/W/E/R values and icons are carried, and temporary Umbral Trespass remains available. |
| Kled | One coherent Mounted variant; Passive is unavailable and Q is narrowed to Bear Trap on a Rope. Dismounted Kled is not offered until its complete Body and kit can be represented without guessed values. |
| Shyvana | One normal Dragon-cycle variant; R owns Fury and temporary Dragon Form, while Passive remains available because Scalemail only stacks armor and magic resistance. No permanently weaker Human or permanently locked Dragon roll is created. |
| Rek'Sai | One normal Burrow-cycle variant; W owns Burrow/Un-burrow, Q and E own their alternate casts, Passive owns Fury and its Burrowed healing consumer, and R remains independent. |
| Rell | One normal variant; W owns the temporary mounted/dismounted package and Passive remains independent. |
| Bel'Veth, K'Sante, Aatrox, Renekton, Swain | One normal variant; each R owns a temporary active transformation or steroid without creating a second selectable kit. |
| Viego | One default-kit variant; Passive is unavailable because possession can replace Body, basic abilities, items, and Ultimate with arbitrary champion content. |
| Yorick | One default-kit variant; Passive is unavailable because its grave and Mist Walker system requires Yorick’s original kit. |
| Azir | One default-kit variant; Q and E are unavailable because both require Sand Soldiers from the original kit. |
| Aurelion Sol | One default-kit variant; Passive is unavailable because Stardust only upgrades the omitted Aurelion Sol abilities. |
| Heimerdinger | One default-kit variant; R is unavailable because it only upgrades an omitted basic ability. |
| Illaoi | One default-kit variant; Passive is unavailable because its Tentacles have no portable targets without the original kit. |
| Kalista | One default-kit variant; R is unavailable because Fate’s Call requires the original-kit Oathsworn relationship. |
| Karma | One default-kit variant; Passive and R are unavailable because they only operate the omitted Mantra/Q/W/E loop. |
| LeBlanc | One default-kit variant; R is unavailable because Mimic only repeats an omitted basic spell. |
| Mel | One default-kit variant; R is unavailable because Golden Eclipse requires Overwhelm marks from Passive. |
| Pantheon | One default-kit variant; Passive is unavailable because Mortal Will only empowers the omitted Pantheon spell kit. |
| Renekton | One default-kit variant; Passive is unavailable because Fury has no consumer without the omitted abilities. |
| Riven | One default-kit variant; Passive is unavailable because Runic Blade needs charges from omitted Riven abilities. |
| Rumble | One default-kit variant; Passive is unavailable because Heat has no portable source without Rumble’s spells. |
| Sejuani | One default-kit variant; E is unavailable because Permafrost requires maximum Frost stacks from the original kit. |
| Smolder | One default-kit variant; Passive is unavailable because Dragon Practice only upgrades omitted basic abilities. |
| Syndra | One default-kit variant; Passive is unavailable because Transcendent only upgrades omitted named abilities. |
| Twitch | One default-kit variant; E is unavailable because Contaminate requires Deadly Venom stacks from the original kit. |
| Viktor | One default-kit variant; Passive is unavailable because Glorious Evolution only augments omitted abilities. |
| Yunara | One default-kit variant; R is unavailable because Transcend One’s Self only upgrades omitted basic abilities. |
| Zilean | One default-kit variant; W remains selectable under a reviewed normalization that applies Rewind to the composite champion’s other basic abilities. |
| Zyra | One default-kit variant; Passive is unavailable because Garden of Thorns needs omitted Q or E consumers. |
| Udyr | One normal variant; Passive owns stance recasts and awakenings inside the four ability slots, not a separate Body form. |
| Kayle | One normal variant; Passive owns level-based ascension and attack progression, not a separately rolled form. |
| Aphelios | Excluded; weapons, ammunition, range, Q, and Passive progression remain one inseparable system. |

Other stateful descriptions found in the roster—such as Ashe's Q flurry, Jinx's Q weapon swap,
Kha'Zix's R evolutions, Kai'Sa's Passive upgrades, Qiyana's W elements, Riven's R empowerment,
Nasus's R steroid, and similar temporary recasts, deaths, camouflage, or stacking progressions—stay
in their ordinary champion variant. They alter an ability's own state or provide a temporary effect,
but do not create a second Body or replace a different selectable slot. This is an audit boundary,
not an assumption that every source description containing the word “form” needs a new roll.

The audited exception champions have explicit compatibility-manifest entries and regression
coverage. The remaining normal-variant outcomes are recorded here because the portability test
passes without a data override.

### Hwei

Hwei is not split into form variants. Each basic ability category is treated as an inseparable spellbook package:

- Selecting Q grants all three Q-subject spells.
- Selecting W grants all three W-subject spells.
- Selecting E grants all three E-subject spells.
- R is a normal R component.
- Passive is portable.

Each package occupies only its corresponding slot. This exception is acceptable because the subspells are alternatives within one category and do not populate Q, W, and E simultaneously.

## Offer Generation Rules

Generation operates on base champions, not a flat list of variants.

For a player state, a selectable component is one whose slot is open and whose availability is `available` or satisfied `conditional`. An unavailable component never counts as a choice.

For rounds one through five, an eligible offer must:

1. Belong to a base champion not already used in that run.
2. Expose at least two selectable components for the current player.
3. Preserve at least one complete legal continuation after every selectable choice shown to the player.

The third rule prevents the game from presenting an apparently valid choice that creates an impossible later round. Because a run has only six slots, bounded look-ahead or memoized backtracking is acceptable and should be covered by property tests.

On round six, the offer may expose exactly one selectable component. Timeout autopick chooses uniformly from the compatible selectable components in the current offer.

In Same Champs multiplayer, the chosen base champion and variant must be an eligible offer for every drafting player based on their individual states. Each player may see a different set of selectable slots on that shared offer. In Random Champs, eligibility is calculated per player. The server is authoritative in both modes.

If no eligible offer exists, the generator reports a data-validation failure; it must not relax the rules silently. Snapshot validation should exercise representative and generated multiplayer states before release.

## Patch Synchronization

Patch data is updated through an explicit command, never at application startup:

1. Resolve the intended Data Dragon version and record its version URL.
2. Fetch all English champion records and required default artwork references.
3. Compare champion, spell, passive, statistic, and asset changes with the previous snapshot.
4. Fail on missing fields, duplicate IDs, broken references, invalid values, or unreviewed structural changes.
5. Apply the compatibility manifest.
6. Run schema, invariant, and draft-solvability tests.
7. Generate a review report highlighting changed exceptional champions.
8. Commit the immutable snapshot only after human review.

Data Dragon may lag the live client. The UI must identify the actual snapshot version rather than claim “live” solely from the current date. If the latest live patch is unavailable, BuildChamp uses the newest verified snapshot and labels it accurately.

Historical snapshots referenced by public solo links remain deployed. A schema migration may decode an older link into its original snapshot, but it must never reinterpret old component IDs using new gameplay data.

## Artwork and Attribution

Initial releases use Riot-provided default champion icons and artwork only. No skin selection or community-uploaded imagery is supported.

Any public BuildChamp release using Riot data or assets must include Riot's required player-visible notices. Before that release, the maintainer must confirm eligibility under Riot's then-current policies and complete required Riot Developer Portal registration. Data Dragon availability alone must not be treated as product approval. Assets are references to the pinned snapshot version and must not imply that BuildChamp is endorsed, sponsored, or operated by Riot Games.

## Adding an Exception

When a champion fails validation or produces a questionable combination:

1. Describe the dependency before proposing a fix.
2. Apply the portability test.
3. Prefer disabling only the affected component.
4. Use a draft variant when one coherent form can stand alone.
5. Exclude the champion only when meaningful independent choices cannot be preserved.
6. Add the manifest entry, source references, and player-facing explanation.
7. Add a regression test for the ruling.

This keeps the exception system conservative without requiring the entire roster to be solved before development begins.

## Source References

- [Riot Data Dragon documentation](https://developer.riotgames.com/docs/lol)
- [Riot Legal Jibber Jabber](https://www.riotgames.com/en/legal)
