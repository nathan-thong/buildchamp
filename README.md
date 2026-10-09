# BuildChamp

BuildChamp is an unofficial, non-commercial party game for League of Legends players. Draft a hypothetical champion from parts of six random champions, then share the result. Planned private lobbies will let friends draft, reveal their builds, and vote to rank them; a local server-authoritative lobby foundation is implemented, while room screens and synchronized drafting remain planned.

A solo run has six rounds. In each round, permanently lock one remaining component—**Body, Q, W, E, R, or Passive**—from the offered champion. There are no skips or rerolls. Build strength stays subjective; players decide which combination wins.

## Project Status

Slice 7 technical QA and Slice 8 deployment preparation are complete. Slice 9's server-authoritative
room foundation is implemented and verified locally; Slice 10's participant room screens,
synchronized draft rounds, and shared display remain planned, as do the later reveal and voting work.
The local Worker API exposes `POST /api/rooms`,
`GET /api/rooms/:code`, `POST /api/rooms/:code/join`, and the authenticated
`GET /api/rooms/:code/socket` WebSocket route. These backend changes have not been deployed; the
currently live Workers.dev site remains the solo-only release at
[buildchamp.nathan-thong.workers.dev](https://buildchamp.nathan-thong.workers.dev). The maintainer
reports Riot Developer Portal approval dated 2026-09-28, but the approval record is not in this
repository. The source inventory for 38 CommunityDragon image references is complete; their Riot
eligibility remains unconfirmed, so release sign-off is pending. The repository contains a validated English Data Dragon
16.17.1 snapshot, retained 15.17.1 snapshot, deterministic source/cache/normalize/emit stages,
reviewed champion compatibility entries covering shared systems and transformed states, a generated
patch report, and a pure deterministic engine with adaptive legal-path checking. The `/solo` route
runs a complete, untimed six-round draft with irreversible locks,
snapshot-backed artwork and ability details, validated active-run recovery with storage-failure
feedback, restrained interaction audio after first interaction, persistent mute, a final reveal,
fresh rematches, and a versioned result link containing identifiers only. `/build/:payload`
validates the link, renders the pinned snapshot, and gives
accessible link/native-share feedback plus a branded PNG share card when image clipboard support is
available; malformed and unavailable links have recovery states. The home board
and `/build/demo` remain clearly labelled foundation/demo fixtures, while completed shared results
use retained champion snapshots. See
[CURRENT_STATE.md](./CURRENT_STATE.md) for the concise, maintained implementation handoff.

The plan is:

1. Untimed solo draft
2. Shareable build results
3. Private friend lobbies (local backend foundation implemented; room UI and synchronized draft planned)
4. Shared reveal and voting
5. Public build rankings only if group play proves useful; accounts remain deferred

## Stack

- TypeScript, React, and Vite
- Tailwind CSS for styling
- Zod for runtime validation
- Vitest, React Testing Library, and Playwright
- Cloudflare Workers Static Assets for the solo release
- Pinned Wrangler CLI for preview and production deployment
- Cloudflare Worker, native WebSockets, and one SQLite-backed Durable Object per multiplayer lobby
- Controlled, versioned Riot Data Dragon snapshots for champion data and default artwork

Solo play runs in the browser without a gameplay backend. After its first online visit, the app shell and versioned code can reload offline; remote champion artwork may fall back when no network is available. The local lobby foundation uses a Cloudflare Worker and one SQLite-backed Durable Object per room, but the public deployment has not received that backend change.

## Development Documentation

The Markdown files are intentionally separated by responsibility:

| Document                                           | Purpose                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CURRENT_STATE.md](./CURRENT_STATE.md)             | The compact handoff: present milestone, verified capabilities, next action, and active release blockers                                               |
| [DESIGN.md](./DESIGN.md)                           | The visual design system: palette, typography, layout, component treatment, and interface guardrails                                                  |
| [PRODUCT.md](./PRODUCT.md)                         | The product contract: audience, game modes, draft rules, voting, sharing, brand, accessibility, and deferred scope                                    |
| [ARCHITECTURE.md](./ARCHITECTURE.md)               | The system design: frontend boundaries, Cloudflare topology, WebSocket protocol, persistence, security, performance, testing, and hosting portability |
| [CHAMPION_DATA.md](./CHAMPION_DATA.md)             | The champion-data contract: slot meanings, resource policy, portability tests, normalized schemas, patch sync, variants, and champion exceptions      |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | The build order: twelve vertical slices with acceptance criteria for the Solo MVP and Private Lobby MVP                                               |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)     | The snapshot, Riot policy, registration, notice, and asset-eligibility release gates                                                                  |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                   | Cloudflare preview/production commands, rollback, headers, diagnostics, and cost guardrails                                                           |
| [AGENTS.md](./AGENTS.md)                           | Operating instructions for coding agents working in this repository, including required reading and non-negotiable invariants                         |
| [REPOSITORY_WORKFLOW.md](./REPOSITORY_WORKFLOW.md) | On-demand branch, staging, commit, push, handoff, and README-maintenance policy                                                                       |

When documents overlap, `PRODUCT.md` owns player-facing intent, `CHAMPION_DATA.md` owns kit compatibility, and `ARCHITECTURE.md` owns system boundaries. `IMPLEMENTATION_PLAN.md` sequences the work, while `CURRENT_STATE.md` reports progress; neither overrides the contracts.

The `.impeccable/` directory contains design-direction artifacts produced while exploring the interface. Meaningful artifacts such as the direction record and sketches are retained in version control, while transient tooling output such as logs follows the default ignore rules. These artifacts are not product specifications. Some sketches predate settled terminology such as the rename from “Model” to “Body”; the Markdown contracts take precedence.

## A note on AI assistance

I use agentic AI tools to help plan and build BuildChamp. I review and test their output, and I’m responsible for what ships.

## Local Development

Requires Node.js 20.19 or newer. The repository pins pnpm 11.19.0 in `package.json`; run its
commands from the repository root:

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm build:cloudflare
pnpm preview
pnpm test:e2e:multiplayer
```

The solo browser suite uses Playwright across Chromium and WebKit, including offline refresh and axe WCAG A/AA checks. The separate `pnpm test:e2e:multiplayer` command builds the app, starts local Wrangler Workers with isolated Durable Object stores, and verifies room creation/join, WebSocket authorization, role projections, malformed and oversized requests, rate limits, reconnect, and versioned SQLite state restoration after a Worker restart. Neither command deploys anything. Install the browser
binaries once on a new machine, then run:

```sh
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

The `/solo` route consumes the bundled, validated snapshot and may request the default artwork URLs
recorded in that snapshot. It does not fetch mutable champion data at gameplay runtime.
The home board and `/build/demo` use explicitly labelled interface fixtures; completed shared results
use the validated champion snapshots and their pinned data version. To refresh the pinned snapshot deliberately, provide
an explicit version and stable generation timestamp:

```sh
pnpm sync:champion-data -- --version 16.17.1 --generated-at 2026-09-05T00:00:00.000Z
```

The importer writes versioned JSON under `src/data/snapshots/` and a review report under
`data/champion-reports/`. Use [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before any public
release containing Riot data or assets.

Cloudflare deployment preparation is included in the repository. Run `pnpm build:cloudflare` to
build and verify the deployable assets, or `pnpm run cloudflare:dev` for a local Worker smoke test.
The Slice 9 API routes listed above are available in local Worker runs; the currently deployed
Workers.dev site still serves the solo-only release. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the
release gate, deployment, rollback, and monitoring guidance.

## Core Rules

- A run has six rounds and fills Body, Q, W, E, R, and Passive exactly once.
- Locked choices cannot be undone.
- A base champion cannot repeat in one run.
- Offers are selected adaptively so the build remains completable.
- Before the final round, every displayed offer provides at least two valid choices.
- Ordinary mana and energy costs are ignored; health costs remain.
- Components may carry self-contained mechanics but cannot create or overwrite another chosen slot.
- Aphelios is excluded initially; Jayce, Elise, Nidalee, Gnar, and Kayn use reviewed fixed-form variants; Hwei's basic spellbooks are packaged by slot. Other temporary transformation cycles follow the ownership rulings in [CHAMPION_DATA.md](./CHAMPION_DATA.md).
- BuildChamp never assigns an automated power score. Players decide which build is strongest.

See [PRODUCT.md](./PRODUCT.md) and [CHAMPION_DATA.md](./CHAMPION_DATA.md) for the complete rules.

## Riot Games and Asset Notice

BuildChamp is an unofficial, non-commercial fan game and is not endorsed, sponsored, or operated by Riot Games. The repository contains a validated snapshot of Riot-provided champion data and references to default artwork. The maintainer reports Riot Developer Portal approval dated 2026-09-28, but that record is not in this repository; eligibility of the 38 CommunityDragon image references remains unconfirmed.

Riot's [General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies) and [Legal Jibber Jabber](https://www.riotgames.com/en/legal) include restrictions on games using Riot IP and an allowance for completely free, original fan celebrations. How that allowance applies to BuildChamp remains unresolved; this summary makes no legal conclusion and does not represent Riot approval.

Public champion quiz games such as [Champdle](https://www.champdle.com/about) and [LoLdle](https://apps.apple.com/us/app/loldle-official/id6449491946) provide comparisons, but their existence does not establish BuildChamp's permission or reveal their registration status. Riot's [League policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends) requires registration for products serving players, with or without documented API use. Riot eligibility for the 38 CommunityDragon image references remains unconfirmed; see the [release checklist](./RELEASE_CHECKLIST.md) for the source inventory and policy review.

Any player-visible release must conspicuously include Riot's required notices, including:

> BuildChamp is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

If Riot assets are used, the applicable Legal Jibber Jabber notice is:

> BuildChamp was created under Riot Games' “Legal Jibber Jabber” policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

- [Riot Developer Portal and Data Dragon documentation](https://developer.riotgames.com/docs/lol)
- [Riot Legal Jibber Jabber](https://www.riotgames.com/en/legal)

League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

## Contributing and Licensing

The repository is not yet open for general contributions and does not currently declare a software license. Until a license is added, the presence of source code in a public repository does not grant permission to copy, redistribute, or commercially use it.

A contribution workflow and explicit license should be chosen before accepting outside code. The desired “non-commercial” status needs a deliberate license decision rather than being approximated with an ordinary open-source license.
