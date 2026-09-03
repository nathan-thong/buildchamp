# Current State

Last updated: 2026-09-04

## Now

- **Phase:** Planning complete; repository and tooling scaffold present, application not yet implemented.
- **Active milestone:** Repository foundation and Slice 1 scaffold; the next work is the first implementation slice.
- **Next implementation:** Slice 1, Project and UI Foundation, in `IMPLEMENTATION_PLAN.md`.
- **Runtime status:** `package.json` and root Vite/TypeScript tooling configs exist, but there is no lockfile, application source, test suite, build, deployment, or champion snapshot yet. Commands have not been verified.

## Settled Direction

- Solo-first, untimed six-round draft; private friend lobbies follow.
- TypeScript, React, and Vite; Cloudflare Workers Static Assets initially, with a Worker and one Durable Object per lobby for multiplayer.
- Controlled, immutable Data Dragon snapshots; no gameplay-time data fetch.
- Product contracts are `PRODUCT.md`, `CHAMPION_DATA.md`, and `ARCHITECTURE.md`. The active slice supplies acceptance criteria.
- Meaningful Impeccable direction artifacts are retained; tool-local logs, sessions, caches, and configuration are ignored.

## Verified Repository State

- Planning documents, README, agent instructions, ignore rules, editor defaults, and Git attributes have been reviewed for the initial commit.
- Markdown links resolve, Impeccable JSON parses, sketches decode, and no recognizable secrets were found.
- The rebuilt root commit is pushed to the configured GitHub remote on `main`; no other remote branches or tags were found.
- Git branch, staging, and commit status are intentionally not duplicated here; inspect them directly before work.

## Active Gates

- Public release using Riot data or assets requires confirmation of eligibility under Riot's then-current policies, required Developer Portal registration, and the mandated player-visible notices.
- No software license has been selected. Do not accept outside contributions or imply reuse rights until the maintainer chooses one.

## Update Rule

Replace stale facts here whenever the milestone, runnable capability, next action, verification status, deployment, data snapshot, or blocker changes. Keep this file factual and under 500 words; detailed decisions belong in their owning documents.
