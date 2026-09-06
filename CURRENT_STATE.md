# Current State

Last updated: 2026-09-06

## Now

- **Phase:** Slice 4, Solo Gameplay, implemented, committed, and verified locally.
- **Active milestone:** Snapshot-backed, untimed solo drafting is playable from the real `/solo` route, including final reveal and rematch.
- **Next action:** Start Slice 5, Recovery, Sound, and Accessibility hardening.
- **Runtime status:** `/solo` uses the immutable 16.17.1 English snapshot, reviewed champion artwork and ability icons, adaptive legal drafting, rank-aware summaries, local active-run recovery, irreversible locks, and a six-part final reveal. The home board and `/build/demo` remain explicitly labelled foundation/demo fixtures.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The validated 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed data coverage includes variants, Fiddlesticks artwork, Xayah E, Yorick Passive, the portability audit, and conditional Zilean W.
- All current Slice 4 work, the dependency refresh, and the maintained documentation are committed and pushed on `main`; `main` matches `origin/main`.
- Checks pass: `pnpm install --frozen-lockfile --offline`, `pnpm typecheck`, `pnpm test` (53 tests), `pnpm lint`, `pnpm format`, `pnpm build`, and `pnpm test:e2e` (7 browser journeys).
- The browser validates the bundled snapshot at startup and requests no mutable champion data at gameplay runtime. No deployment exists.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
