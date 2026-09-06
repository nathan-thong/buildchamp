# Current State

Last updated: 2026-09-06

## Now

- **Phase:** Slice 4, Solo Gameplay, implemented and verified locally.
- **Active milestone:** Snapshot-backed, untimed solo drafting is playable from the real `/solo` route, including final reveal and rematch.
- **Next action:** Start Slice 5, Recovery, Sound, and Accessibility hardening.
- **Runtime status:** The app bundles and validates the 16.17.1 English snapshot, renders a compact choice-first solo draft with working default and form-specific artwork references, including the reviewed current Fiddlesticks splash/loading assets, rank-aware cooldown/range summaries, and expandable details, persists an active run locally, and restores legal in-progress state. The final reveal keeps the existing splash treatment, identifies the body separately, and places the five selected ability icons inline with it. The snapshot keeps Xayah E and Yorick Passive plus the second-pass standalone portability exceptions visible but unavailable, with a reviewed conditional exception for Zilean W. The home board remains an explicitly labelled preview fixture with a reduced-motion-aware, load-safe carousel of synchronized snapshot-backed slot icons and Body splash artwork; `/build/demo` remains a foundation/demo fixture for later slices.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The initial repository foundation, Slice 2 implementation, and Slice 3 implementation are committed on `main`; Slice 4 changes are currently uncommitted in the `main` checkout.
- Slice 4 checks pass: `pnpm typecheck`, `pnpm test` (53 tests), `pnpm lint`, `pnpm format`, `pnpm build`, and `pnpm test:e2e` (7 browser journeys).
- The browser runtime validates the bundled snapshot at startup; the solo route uses its immutable champion and component data plus versioned local active-run recovery. No gameplay-time champion-data request is made.
- The snapshot importer records working default splash/loading artwork paths, applies version-pinned champion artwork overrides for stale default assets, resolves form-specific CommunityDragon ability icons with safe fallbacks, records concise card summaries, and omits unresolved formula placeholders from generated values; the draft keeps splash artwork for the final reveal.
- A render comparison of all 173 pinned champions against their pinned CommunityDragon base splash/loading assets found Fiddlesticks as the sole artwork mismatch; its corrected snapshot references now match both source assets.
- The validated 16.17.1 snapshot contains 173 champions (172 eligible; Aphelios excluded), with reviewed variants and targeted unavailable components for the documented champion cases, including the current Fiddlesticks artwork correction, Xayah E, Yorick Passive, the second-pass portability audit, and the conditional Zilean W exception.
- Frozen offline install, desktop/mobile visual checks, and local Chromium Playwright verification pass; no deployment exists. Public use of the Riot-backed snapshot remains blocked by the policy and registration gate below.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and the mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
