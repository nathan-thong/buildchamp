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
  range?: DisplayValue;
  values: DisplayValue[];
  availability: Availability;
  dependencies: Dependency[];
  carriedMechanics: CarriedMechanic[];
  sourceRefs: string[];
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
    variants?: Array<{
      id: string;
      label: string;
      componentOverrides: Partial<Record<Slot, ComponentOverride>>;
    }>;
    notes: string[];
    reviewedForDataDragonVersion: string;
  }>;
};
```

An override may change availability, explain dependencies, package approved subspells, or point to a form-specific source spell. It may not silently alter official numerical values.

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

R and Passive are unavailable for both variants because transformation and stance ownership depend on the paired kit. A run first weights Jayce once, then selects one eligible variant; variants do not give Jayce extra probability. Jayce cannot appear again in the same run in another form.

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
