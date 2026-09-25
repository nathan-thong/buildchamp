# Current State

Last updated: 2026-09-26

## Now

- **Phase:** Slice 8 Cloudflare Solo Deployment preparation is complete; Slice 7 QA and content review remains before public promotion. Slice 5 recovery, accessibility, sound, and reduced-motion gates are covered by the verified solo experience.
- **Active milestone:** Snapshot-backed, untimed drafting is playable from `/solo` with inspectable offers/build state, provisional selection plus permanent locks, completion inspection, rematch, and local recovery.
- **Next action:** Complete Slice 7 QA/content review and the Riot policy/registration gates, then authenticate Cloudflare and run the guarded preview smoke check; no public deployment is permitted before that review.
- **Runtime status:** `/solo` uses the immutable 16.17.1 snapshot, adaptive legal drafting, recovery, irreversible locks, responsive details, a six-part reveal, and restrained audio after interaction. Completed drafts create identifier-only `/build/:payload` links; the shared route pins 15.17.1 or 16.17.1 and explains malformed/unavailable links. Variant labels appear only for champions with multiple draft variants; single-kit compatibility metadata stays hidden. Completed solo and shared results can copy a branded PNG share card when image clipboard support is available, with a link-copy fallback. The home board and `/build/demo` remain labelled fixtures. Cloudflare deployment uses a Worker-first SPA adapter with immutable caching, security headers, custom 404 handling, and failure-only diagnostics.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow. TypeScript, React, and Vite; Cloudflare Workers Static Assets initially.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch. The Split Champion Board uses the documented navy/gold/teal visual system; see `DESIGN.md`.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`.

## Verified Repository State

- The validated 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed exceptions are covered by regression tests.
- Slice 4, the dependency refresh, the UI/UX refinement, Slice 5 recovery/audio work, Slice 6 shareable results, the PNG share-card refinement (`d61fca1`), and Slice 8 deployment preparation are committed on `main`, which tracks `origin/main`; no deployment exists.
- Wrangler 4.131.2 is pinned with `wrangler.jsonc` preview/production targets, a frozen-install-safe pnpm layout, a retained-snapshot bundle check, and guarded deployment scripts. The preview dry run validates the Worker and `ASSETS` binding without publishing.
- Verified with `pnpm install --frozen-lockfile`, typecheck, 82 unit tests, lint, format, build, bundle check, Wrangler dry run, and 15 Playwright journeys. A local Worker smoke test confirmed direct routes, immutable JS caching, security headers, and a 404 for missing file-like assets. Historical 15.17.1 and current 16.17.1 payloads render from pinned snapshots; the browser makes no mutable champion-data request. No deployment exists.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
