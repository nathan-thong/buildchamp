# BuildChamp

BuildChamp is an unofficial, non-commercial League of Legends party game about building a champion from random parts.

Each run gives you six champion reveals. For each one, permanently claim one remaining component—**Body, Q, W, E, R, or Passive**. There are no skips or rerolls. The result is intentionally subjective: BuildChamp is meant to start arguments, theorycrafting, and laughter between matches, not calculate an objective winner.

## Project Status

Slice 3, Pure Draft Engine, is implemented. The repository now contains a validated English Data
Dragon 16.17.1 snapshot, deterministic source/cache/normalize/emit stages, reviewed champion
compatibility entries covering shared systems and transformed states, a generated patch report, and
a pure deterministic engine with adaptive legal-path checking. The playable solo route is
intentionally not implemented yet; the existing board still labels its interface-only fixture data
clearly. See
[CURRENT_STATE.md](./CURRENT_STATE.md) for the concise, maintained implementation handoff.

The plan is:

1. Untimed solo randomizer
2. Shareable solo results
3. Private link-based friend lobbies
4. Shared reveal and lobby voting
5. Accounts, public voting, and leaderboards only if the earlier game proves worthwhile

## Stack

- TypeScript, React, and Vite
- Tailwind CSS with accessible Radix UI primitives where needed
- Zod for runtime validation
- Vitest, React Testing Library, and Playwright
- Cloudflare Workers Static Assets for the solo release
- Cloudflare Worker, native WebSockets, and one SQLite-backed Durable Object per multiplayer lobby
- Controlled, versioned Riot Data Dragon snapshots for champion data and default artwork

Solo play is designed to work entirely in the browser. The multiplayer backend is deliberately deferred until the solo experience is complete.

## Development Documentation

The Markdown files are intentionally separated by responsibility:

| Document | Purpose |
| --- | --- |
| [CURRENT_STATE.md](./CURRENT_STATE.md) | The compact handoff: present milestone, verified capabilities, next action, and active release blockers |
| [DESIGN.md](./DESIGN.md) | The visual design system: palette, typography, layout, component treatment, and interface guardrails |
| [PRODUCT.md](./PRODUCT.md) | The product contract: audience, game modes, draft rules, lobby behaviour, sharing, brand, accessibility, and deferred scope |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | The system design: frontend boundaries, Cloudflare topology, WebSocket protocol, persistence, security, performance, testing, and hosting portability |
| [CHAMPION_DATA.md](./CHAMPION_DATA.md) | The gameplay-data contract: slot meanings, resource policy, portability tests, normalized schemas, patch sync, variants, and champion exceptions |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | The build order: twelve vertical slices with acceptance criteria for the Solo MVP and Private Lobby MVP |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | The snapshot, Riot policy, registration, notice, and asset-eligibility release gates |
| [AGENTS.md](./AGENTS.md) | Operating instructions for coding agents working in this repository, including required reading and non-negotiable invariants |
| [REPOSITORY_WORKFLOW.md](./REPOSITORY_WORKFLOW.md) | On-demand branch, staging, commit, push, handoff, and README-maintenance policy |

When documents overlap, `PRODUCT.md` owns player-facing intent, `CHAMPION_DATA.md` owns kit compatibility, and `ARCHITECTURE.md` owns system boundaries. `IMPLEMENTATION_PLAN.md` sequences the work, while `CURRENT_STATE.md` reports progress; neither overrides the contracts.

The `.impeccable/` directory contains design-direction artifacts produced while exploring the interface. Meaningful artifacts such as the direction record and sketches are retained in version control, while transient tooling output such as logs follows the default ignore rules. These artifacts are not product specifications. Some sketches predate settled terminology such as the rename from “Model” to “Body”; the Markdown contracts take precedence.

## A note on AI assistance

I use agentic AI tools to help plan and build BuildChamp. I review and test their output, and I’m responsible for what ships.

## Local Development

Use pnpm from the repository root:

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm build
pnpm preview
```

The browser suite uses Playwright. Install its Chromium binary once on a new machine, then run:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The current solo and result screens use explicitly labelled interface fixtures. No Data Dragon
request or Riot asset is made at runtime, and no gameplay claims should be inferred from the
fixture board. To refresh the pinned snapshot deliberately, provide an explicit version and stable
generation timestamp:

```sh
pnpm sync:champion-data -- --version 16.17.1 --generated-at 2026-09-05T00:00:00.000Z
```

The importer writes versioned JSON under `src/data/snapshots/` and a review report under
`data/champion-reports/`. Use [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) before any public
release containing Riot data or assets.

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

BuildChamp is an unofficial fan project and is not endorsed, sponsored, or operated by Riot Games. It is intended to be non-commercial in its initial releases. The planned product may use Riot-provided champion data, icons, and default artwork, but no Riot assets are included in the repository at this foundation stage.

Before any public release using Riot data or assets, the maintainer must confirm that the product is eligible under Riot's then-current policies and register it through the Riot Developer Portal as required. Riot's current policies contain specific restrictions for games and apps using Riot intellectual property, so this documentation does not claim approval or guarantee eligibility.

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
