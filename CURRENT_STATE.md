# Current State

Last updated: 2026-09-05

## Now

- **Phase:** Slice 1, Project and UI Foundation, implemented and verified.
- **Active milestone:** Solo release foundation; the next work is the validated champion snapshot pipeline.
- **Next implementation:** Slice 2, Champion Snapshot Pipeline, in `IMPLEMENTATION_PLAN.md`.
- **Runtime status:** Root Vite/React/TypeScript app, typed slot boundary, fixture routes, tests, and a pnpm lockfile exist. The solo board is an interface preview only; no champion snapshot or playable draft engine exists.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow.
- TypeScript, React, and Vite; Cloudflare Workers Static Assets initially, with a Worker and one Durable Object per lobby for multiplayer.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch.
- Split Champion Board is user-pinned: the earlier split hero is retained with a clean angled champion board, League-inspired navy/gold/teal palette, Helvetica Neue display, plain copy, and no ticket motifs; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`. The active slice supplies acceptance criteria.
- Meaningful Impeccable direction artifacts are retained; tool-local logs, sessions, caches, and configuration are ignored.

## Verified Repository State

- Planning documents, README, agent instructions, ignore rules, editor defaults, and Git attributes have been reviewed for the initial commit.
- Markdown links resolve, Impeccable JSON parses, sketches decode, and no recognizable secrets were found.
- The initial repository foundation commit is pushed to the configured GitHub remote on `main`; this Slice 1 implementation is local on `main` until explicitly pushed.
- Slice 1 checks pass: `pnpm typecheck`, `pnpm test` (11 tests), `pnpm lint`, `pnpm format`, `pnpm build`, and `pnpm test:e2e` (5 browser journeys).
- A frozen offline `pnpm install` passes against the repository lockfile; the implemented visual system is documented in `DESIGN.md` and `.impeccable/design.json`.
- Canonical home, solo draft, and result boards were visually checked at 1600px desktop width; home and solo were also checked at 390px mobile width, including responsive flow and header bounds.
- Chromium was installed locally for Playwright verification; no deployment or Riot data snapshot exists.
- Git branch, staging, and commit status are intentionally not duplicated here; inspect them directly before work.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and the mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
