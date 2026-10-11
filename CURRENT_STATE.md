# Current State

Last updated: 2026-10-11

## Now

- **Phase:** Slice 10 synchronized drafts and shared display are implemented and locally verified. Slice 11 reveal, voting, results, and rematch remain next.
- **Product:** `/solo` remains client-side and untimed. Local `/lobby`, `/room/:code`, and `/display/:code` support private six-round Same/Random Champs drafts, QR joining, shared 15/30/45-second deadlines, early advance, deadline autopicks, reconnect, and hidden completion. Builds stay hidden until Slice 11.
- **Live deployment:** Workers.dev remains solo-only; protocol-v2 multiplayer is local and undeployed. On 2026-10-09, the live service worker returned 200 and its JavaScript matched that local build.
- **Next action:** Continue Slice 11 locally. Public-release gates remain open pending retained Developer Portal audit scope and CommunityDragon eligibility review; see `RELEASE_CHECKLIST.md`.

## Verified Repository State

- The 16.17.1 snapshot has 173 champions (172 eligible); Aphelios is excluded. Reviewed exceptions have source notes and regression tests. Snapshot 15.17.1 remains for old share links.
- `worker/index.ts` serves versioned room routes. `BuildChampLobby` owns versioned SQLite state, hibernatable WebSockets, and absolute alarms. Public displays receive champion identity/progress only; players receive only their own offer. Same Champs offers are common-path compatible; Random Champs offers are private. Deadline settlement precedes late commands, disconnected seats can reconnect until deadline, and retries cannot advance twice. Inactivity expiry is one hour.
- Local checks on 2026-10-11: 109 unit, 40 Chromium/WebKit solo, and 5 Wrangler multiplayer tests passed. Multiplayer coverage includes six rounds in both modes, concurrent locks, reconnect, alarm autopick, role privacy, and SQLite restore after Worker restart. Typecheck, lint, format, Cloudflare artifact checks, build, and Wrangler dry-run passed. One-hour cleanup was unit-tested, not run end-to-end.
- The build emits a 2.97 MB JavaScript chunk (about 430 KB gzip), above Vite's advisory threshold.

## Release Review

- Riot General Policies allow free fan celebrations based on unique, original ideas; Legal Jibber Jabber separately restricts unauthorized games/apps using Riot IP. Applicability to BuildChamp is unresolved. Riot policy requires new features/product changes to be audited through the Developer Portal.
- The maintainer reports Developer Portal approval dated 2026-09-28; its scope/conditions are not retained. Snapshot inventory: 15.17.1 has 1,363 unique Data Dragon image URLs; 16.17.1 has 1,397, including 38 CommunityDragon images (36 form icons, two Fiddlesticks art URLs). Those URLs and ten CommunityDragon game-data sources passed HTTP checks 2026-10-11; eligibility remains unconfirmed. Details and alternatives are in `RELEASE_CHECKLIST.md`.
- Current 16.17.1 Data Dragon default art paths are unversioned. Eight sampled versioned 15.17.1 art URLs returned 403; snapshots were not rewritten. This is an availability finding, not a policy conclusion.
- Full Riot notices are on app pages, shared display, fatal error, and 404 surfaces. The share PNG has a shortened non-endorsement footer; reviewed policies do not expressly require full page boilerplate on exported cards. Release gates remain open pending audit scope and asset eligibility.
- No software license has been chosen. Do not imply reuse rights or accept outside contributions.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
