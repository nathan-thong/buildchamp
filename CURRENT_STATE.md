# Current State

Last updated: 2026-09-07

## Now

- **Phase:** Slice 4 solo gameplay and the UI/UX refinement are implemented and verified locally. Slice 5 Sound and broader recovery work remain.
- **Active milestone:** Snapshot-backed, untimed solo drafting is playable from the real `/solo` route with a compact offer, inspectable six-slot build reference, click-activated details dialogs, provisional selection plus one permanent lock, completion inspection, and rematch.
- **Next action:** Finish the remaining Slice 5 Recovery, Sound, and Accessibility work, then implement Slice 6 share URLs. Do not treat the UI/UX refinement as completing either sound or sharing.
- **Runtime status:** `/solo` uses the immutable 16.17.1 English snapshot, reviewed champion artwork and ability icons, adaptive legal drafting, rank-aware summaries, local active-run recovery, irreversible locks, readable responsive composition, aligned option and completion-card rows, fixed scrollable details dialogs, and a six-part final reveal. The home board now explains its illustrative example with aligned source/component rows, pause, and fallback behavior. `/build/demo` remains an explicitly labelled foundation fixture.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The validated 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed data coverage includes variants, Fiddlesticks artwork, Xayah E, Yorick Passive, the portability audit, and conditional Zilean W.
- Slice 4, the dependency refresh, and the UI/UX refinement are committed on `main`; the branch tracks `origin/main`, and no deployment exists for this work.
- Verified with `CI=true pnpm install --frozen-lockfile`, `CI=true pnpm typecheck`, `CI=true pnpm test` (13 files, 60 tests), `CI=true pnpm lint`, `CI=true pnpm format`, `CI=true pnpm build`, and `CI=true pnpm test:e2e` (12 browser journeys). Responsive review covered 320, 390, 768, 1280, and 1440px plus 200% zoom behavior, including the fixed details dialog and aligned option, completion-card, and home slot rows.
- The browser validates the bundled snapshot at startup and requests no mutable champion data at gameplay runtime. No deployment exists.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
