# Solo UI/UX Improvement Plan

Date: 2026-09-07
Status: Implemented and verified locally on 2026-09-07.
Intended implementer: GPT-5.6 Luna with Max reasoning.

## Objective

Improve the existing solo experience so players can identify the offered champion, compare components, inspect their growing build, and make a deliberate permanent choice comfortably on desktop and mobile. Preserve BuildChamp's navy/gold/teal identity and Split Champion Board direction.

This is a focused refinement of Slice 4 with relevant Slice 5 accessibility work. It supplements `IMPLEMENTATION_PLAN.md`; it does not replace its release sequence or mark Slice 5 complete. Sound and share URLs remain in their existing slices.

## Start Here

1. Read `CURRENT_STATE.md` first and inspect `git status --short --branch`. Preserve unrelated changes.
2. Read `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, and Slices 4–6 of `IMPLEMENTATION_PLAN.md`. Follow `AGENTS.md`.
3. Use the impeccable skill for implementation. Run its context loader once, follow the refinement workflow, and read its craft floor before editing UI.
4. Inspect the actual code and scripts; the audit used commit `763942c` as its final baseline, but the checkout may have moved.
5. Implement the steps below sequentially. Resolve routine layout choices without repeatedly requesting design approval. Do not silently expand scope.

Editing authorization does not include branches, commits, pushes, PRs, or deployment. Use the pinned pnpm version and existing lockfile. Do not refresh dependencies or champion data as part of this work.

## Fixed Decisions

- Preserve all six slots, their order, generation rules, permanent locks, no skips/rerolls, and untimed solo play.
- Preserve immutable snapshot data and the pure domain engine. Changes belong primarily in UI components and CSS.
- Use a compact offer header, a useful build reference, readable choices, and a persistent selection/lock area.
- Use click-activated component details dialogs rather than inline expansion. The fixed top-layer dialog keeps long Body stats out of card and grid flow, works on touch and keyboard, and closes through its Close control, backdrop, or Escape; do not make hover the only trigger.
- Selection is reversible until one explicit lock action. Remove the redundant intermediate lock-confirmation state; selecting a card must never commit it.
- Do not add scores, recommendations about strongest picks, tags implying unverified mechanics, accounts, analytics, custom build names, or multiplayer work.
- Do not add dead share buttons. Sharing remains Slice 6. Keep sound work in Slice 5; this plan must not claim to complete it.
- Keep fixtures explicitly labelled. Do not convert `/build/demo` into a supposed working share route.

## Audit Evidence and Limits

The audit inspected source and live home/draft screens, including a 390 × 844 viewport. In the inspected round, the mobile offer panel started around 2,346 CSS pixels down the document. Ability summaries were 11.52px and some stat labels were 7.52px. Source showed details below the entire choice grid, three actions per permanent pick, and unavailable cards labelled Portable. The final completion UI and lock progression were reviewed in source, not through a complete manual browser run. Treat these as starting evidence and verify the implemented behavior in disposable automated browser contexts.

## Step 1 — Readable Components and Correct Copy

Primary files: `src/components/ComponentCard.tsx`, `src/styles.css`, `DESIGN.md`.

### Work

- Define a small semantic type scale in the existing token system: body/description 14–16px, meaningful labels at least 12px, card titles roughly 16–20px. Use relative units and comfortable line heights. Preserve larger display type on the home page.
- Apply the scale to draft and completion content. Replace competing later CSS overrides for touched selectors instead of appending another override layer.
- Keep slot labels, ability names, summary text, and cooldown/range readable. Do not truncate essential names or rely on hover titles for essential values. Preserve rank-aware values.
- Remove repeated Portable badges for ordinary components. Keep explicit Selected, Locked, and Unavailable wording. For conditional components, show the existing snapshot condition rather than an unexplained badge. Never label unavailable components Portable.
- Replace developer-oriented offer copy with a short player instruction. Render the snapshot's actual version as `Patch <version>`; do not hardcode or call it live.

### Acceptance

- No unavailable component displays Portable or becomes selectable.
- Long names and descriptions wrap without overlapping or hiding controls.
- Body still exposes attack type/range, movement speed, and full base statistics through details.
- Token changes are documented in `DESIGN.md`; generated design sidecars are kept consistent using the skill's supported workflow where required.

### Tests

Update `ComponentCard.test.tsx` for unavailable/conditional states and full metric text. Add behavior coverage, not assertions for every CSS value.

## Step 2 — Local Details and an Inspectable Build

Primary files: `ComponentCard.tsx`, `SoloDraftPage.tsx`, `ChampionArtwork.tsx`, and focused UI components extracted as needed.

### Work

- Open full details from the component card in a fixed top-layer dialog. Use unique IDs and accurate `aria-expanded`/`aria-controls` relationships while keeping the dialog out of card and grid flow.
- Give triggers contextual names, such as `Details for Jaws of the Beast`. Opening details must neither select nor lock a component.
- Keep one offer disclosure open at a time. The dialog must not change card or grid geometry. Support Close, backdrop click, and Escape dismissal, and restore focus to the disclosure trigger after closing.
- Replace the passive build-status list with six consistently labelled positions: slot, source champion, ability name, and icon. Open slots remain visible. Locked slots are inspectable but cannot be edited.
- Use a compact build strip on narrow screens, with a labelled expand control for the full build reference. Keep all six slot labels visible without horizontal page scrolling; a two-row arrangement is acceptable.
- Highlight the latest addition briefly, accompanied by persistent Locked text. Reduced-motion mode uses a static state cue.
- Reuse the read-only component detail presentation in the completed build. Keep view state separate from persisted/domain run state.

### Acceptance

- Opening the first card's details presents the content immediately in a fixed, scrollable dialog without changing the surrounding card layout.
- A player can inspect any prior lock and return to the offer without losing an uncommitted selection.
- Slot and source champion remain identifiable after locking.
- No duplicate disclosure IDs exist when offer, build, and completion components reuse the same renderer.

### Tests

Cover disclosure isolation, accessible names/relationships, locked inspection, and preservation of selected state. Keep all legal-generation and compatibility tests intact.

## Step 3 — Draft Composition for Desktop and Mobile

Primary files: `SoloDraftPage.tsx`, `src/styles.css`, `RoundRail.tsx` as needed.

### Work

- Replace the tall standalone offer panel with a compact header containing portrait, champion name, form/variant where relevant, patch metadata, and round `n of 6`.
- Remove duplicated Choose a slot / Your decision / The next lock / Choose one component headings. Use one instruction: `Choose one part to keep.` Keep a short explanation of permanent locks near the action.
- Desktop: give the choice area most of the width, with a narrower build reference. Prefer two comfortable card columns over three cramped ones at intermediate widths. Let content width determine breakpoints.
- Mobile: order content as offer header, compact build reference, choices, and selection/lock area. Match DOM and visual reading order; do not move the champion behind the choices using CSS order.
- Reduce empty space in cards and allow natural heights. Do not solve page length by shrinking text or hiding meaningful summaries.
- Add a bottom action area that remains available while browsing choices. Account for safe-area insets and reserve sufficient content space so the bar cannot obscure the last card, footer, or focused control.
- Before selection, show a concise disabled-action instruction. Once selected, show slot, source champion, ability name, and permanence warning in the action area.

### Acceptance

- At 390 × 844, the offered champion, round, and start of the first choice are visible without scrolling.
- At 320px wide, all content remains readable and the page has no horizontal overflow.
- The action area remains reachable while reviewing the last choice and full details.
- At 200% zoom, content reflows without clipping or trapping the user behind sticky content.
- Keep the current palette, original branding, visible focus treatment, and Riot notice.

## Step 4 — Explicit Lock and Accessible Round Transitions

Primary files: `SoloDraftPage.tsx`, `SoloDraftPage.test.tsx`, `tests/e2e/foundation.spec.ts`.

### Work

- Remove `isConfirming`, the first-click arming state, and Keep deciding. Selecting a different available card changes only the provisional selection.
- The explicit action reads `Lock Q permanently` (substitute the actual slot). The adjacent summary identifies what will be locked. Activating it commits exactly one selection through the existing engine.
- Avoid double submission and accidental carryover into the next round: clear selection and details after a successful lock, disable the action until a fresh selection exists, and ensure repeated activation cannot commit another round.
- After a lock, announce the locked slot and ability, new champion, and round. Move focus to a programmatically focusable offer heading. On completion, move focus to the completion heading. On replay, focus the first offer heading.
- On failure, show a visible recoverable message and retain a usable decision path. Do not silently mutate the run.
- Preserve local recovery and the meaning of a permanent lock across refresh/navigation.

### Acceptance and Tests

- Selecting a card alone never changes a locked slot or advances a round.
- One explicit lock commits once; rapid repeated activation cannot advance multiple rounds.
- The new round has no stale selected card, details, or enabled lock action.
- Keyboard users can select, inspect, lock, finish six rounds, inspect the result, and replay.
- Update tests that depended on two lock-button activations to assert the new deliberate selection-plus-lock behavior. Preserve irreversible-lock and storage coverage; do not merely delete failing tests.
- The forced sixth round still requires an explicit lock and explains that only one slot remains.

## Step 5 — Clear Home Premise and Reliable Preview

Primary files: `HomePage.tsx`, `HomeSlotCarousel.tsx`, `HomeSlotCarousel.test.tsx`, `src/styles.css`.

### Work

- Use headline `Build your own champion.` and supporting copy `Six random champions. Take one part from each. Every pick is permanent.` Keep Start solo draft prominent.
- Simplify redundant round/lock statistics. Keep untimed and account-free entry clear without adding a tutorial wall.
- Retain the angled preview board and explicit example/preview label. Show source champion and component names alongside slot icons so the composite is understandable without recognising every icon.
- Provide an intentional initial/loading fallback and a durable artwork-failure fallback with readable labels. Do not leave the large board visually empty if external assets fail.
- Preserve reduced-motion, offscreen, and hidden-document behavior. Ensure any rotating labelled example can be paused; do not announce each decorative frame change to screen readers.
- Describe the board as an illustrative example rather than claiming randomly combined preview parts constitute a legal played run.

### Acceptance and Tests

- A first-time player can explain the premise from the headline, supporting copy, and example.
- Slow/failed artwork does not remove the premise or hide the start action.
- Labels and icons stay synchronized through changes; reduced-motion users receive a stable example.
- Cover initial loading and complete asset failure with deterministic tests.

## Step 6 — Completion Worth Inspecting

Primary files: `SoloDraftPage.tsx` completed view, `ChampionArtwork.tsx`, `ComponentCard.tsx`, `src/styles.css`.

### Work

- Lead with one finished-build composition: Body artwork and five visibly labelled ability slots, with names and source champions available without hover.
- Reuse the inspectable read-only components from Step 2 for details. Preserve all six selections and the correct variant identity.
- Remove the empty No score pseudo-stat and repeated explanatory statements about no automated score. Do not introduce an alternate rating.
- Place Play again and Back to home beside/below the hero, before the long details section. Preserve fresh-rematch behavior.
- Leave actual sharing to Slice 6. Document the future action placement without rendering an inert control.
- Use restrained completion feedback with a static reduced-motion alternative. Sound is outside this change.

### Acceptance and Tests

- Players can identify Body and all five abilities, including their sources, and inspect every selection.
- Completion remains understandable when artwork fails.
- Replay starts a fresh legal run. A result is never presented as a functional share link until Slice 6 implements it.

## Final Verification and Handoff

Run narrow component/flow tests after relevant steps. At completion, run the existing full commands: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm build`, and `pnpm test:e2e`. Inspect `package.json` first if scripts have changed. Fix only task-related formatting and report exact commands/reasons for any blocked checks.

Use disposable test browser contexts with deterministic runs, never an existing personal active draft. Verify a six-round run, mid-run recovery, completion, replay, unavailable/conditional choices, long names, and failed images. Retain seeded domain coverage without modifying the engine for UI convenience.

Perform one batched visual/accessibility review at 390 × 844, 768 × 1024, and 1440 × 900, plus a 320px overflow check and 200% zoom. Cover home, first round, a mid-run selection with details, forced final round, and completion. Check keyboard focus, announcement clarity, text contrast, 44px practical touch targets, reduced motion, and sticky-bar occlusion. Fix findings together and perform at most one confirmation pass unless a new functional failure requires investigation.

Before handoff, review the diff for generated snapshot changes, unrelated dependency churn, copied branding, and accidental rule changes. Update `DESIGN.md` to reflect the implemented hierarchy, type scale, disclosures, lock interaction, and responsive composition. Update `CURRENT_STATE.md` with verified outcomes and remaining Slice 5 work; do not claim sound or sharing is complete. Update README only if its verified public behavior or navigation needs correction, following `REPOSITORY_WORKFLOW.md`.

Explicitly ask yourself: **Would a new agent start the wrong work from CURRENT_STATE.md?** Correct it if so. Report the changed behavior, checks, remaining limitations, and exact Git status. Do not commit or deploy without separate authorization.
