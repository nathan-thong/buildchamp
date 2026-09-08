# Current State

Last updated: 2026-09-09

## Now

- **Phase:** Slice 6 Shareable Results is complete; Slice 7 Solo QA and Content Pass is next. Slice 5 recovery, sound, keyboard, focus, contrast, touch-target, and reduced-motion gates are covered by the verified solo experience and regressions.
- **Active milestone:** Snapshot-backed, untimed drafting is playable from `/solo` with inspectable offers/build state, provisional selection plus permanent locks, completion inspection, rematch, and local recovery.
- **Next action:** Begin Slice 7 QA and content review across unavailable/conditional copy, retained snapshots, browsers, slow assets, offline refresh, and Riot release gates.
- **Runtime status:** `/solo` uses the immutable 16.17.1 snapshot, adaptive legal drafting, recovery, irreversible locks, responsive details, a six-part reveal, and restrained audio after interaction. Completed drafts create validated identifier-only `/build/:payload` links; the shared route pins 15.17.1 or 16.17.1, supports accessible copy/native-share feedback, and explains malformed/unavailable links. The home board and `/build/demo` remain labelled foundation fixtures; the home board is an aligned rectangle at desktop and mobile widths.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The validated 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed variants, portability exceptions, and conditional components are covered by regression tests.
- Slice 4, the dependency refresh, the UI/UX refinement, Slice 5 recovery/audio work, and Slice 6 shareable results are committed on `main`, which tracks `origin/main`; no deployment exists.
- Verified with installed equivalents of typecheck, test (19 files, 76 tests), lint, format, build, and Playwright (15 journeys). Responsive review covers 320–1440px, 200% zoom, dialogs, keyboard completion, shared-result round trip, and aligned rows. Historical 15.17.1 and current 16.17.1 payloads render from their pinned snapshots.
- In this environment, the `pnpm` wrapper currently attempts an install and fails opening its store SQLite database; the direct installed binaries above pass. This is an environment limitation, not an application failure.
- The browser validates the bundled snapshot at startup and requests no mutable champion data at gameplay runtime. No deployment exists.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
