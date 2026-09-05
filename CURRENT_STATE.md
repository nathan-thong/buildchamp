# Current State

Last updated: 2026-09-05

## Now

- **Phase:** Slice 2, Champion Snapshot Pipeline, implemented and verified locally; the transformation/state audit is settled.
- **Active milestone:** Start the deterministic draft engine after the completed snapshot and compatibility pass.
- **Next action:** Start Slice 3, the deterministic draft engine, using the reviewed snapshot and base-champion variant identity rules.
- **Runtime status:** Root Vite/React/TypeScript app, typed slot boundary, fixture routes, build-only Data Dragon importer, and a validated 16.17.1 English snapshot exist. The solo board remains an interface preview; no playable draft engine exists.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially, with one Durable Object per multiplayer lobby.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The user-pinned Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The initial repository foundation and Slice 2 implementation are committed on `main`; remote status is reported at handoff.
- Slice 2 checks pass: `pnpm typecheck`, `pnpm test` (27 tests), `pnpm lint`, `pnpm format`, `pnpm build`, and `pnpm test:e2e` (5 browser journeys).
- The importer fetched and validated 173 champions from explicit Data Dragon version 16.17.1 (172 eligible, Aphelios excluded), retaining the prior 15.17.1 snapshot and reviewed exception data for Aphelios, Jayce, Hwei, Elise, Nidalee, Gnar, Shyvana, Rek'Sai, Kled, Kayn, and Viego.
- Jayce Hammer/Cannon carry reviewed form-specific Body stats and Q/W/E values, cooldowns, and ranges: Hammer is melee at 125 range; Cannon is ranged at 500. Alternate values use versioned CommunityDragon data with Data Dragon fallback text/icons and regression coverage.
- Elise Human/Spider and Nidalee Human/Cougar use the same base-champion identity and no-repeat behavior as Jayce. Their form-specific Body and Q/W/E data are source-backed; transformation and cross-form system slots remain unavailable.
- Gnar Mini/Mega use the same base-champion identity and no-repeat behavior. Mini carries form-specific Body/Q/W/E; Mega carries Body/Q/W/E/R; Rage Gene is unavailable and GNAR! is unavailable on Mini but available on Mega.
- The transformation audit distinguishes fixed-form variants (Jayce, Elise, Nidalee, Gnar, Kayn), Kled's mounted-only normalization, Viego's unavailable possession Passive, and normal R/W-owned temporary cycles (Shyvana, Rek'Sai, Rell, Bel'Veth, K'Sante, and others). Shyvana's Passive is Scalemail defense stacking, not Fury.
- Frozen offline install, desktop/mobile visual checks, and local Chromium Playwright verification pass; no deployment exists. Public use of the Riot-backed snapshot remains blocked by the policy and registration gate below.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and the mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
