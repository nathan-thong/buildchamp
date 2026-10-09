# Current State

Last updated: 2026-10-10

## Now

- **Phase:** Slice 9's server-authoritative lobby foundation is implemented and verified locally. Slice 10 is next for participant screens, synchronized draft locks and deadlines, and the shared display experience; reveal, voting, and rematch remain later work.
- **Product:** The untimed snapshot-backed `/solo` route remains client-side, with irreversible locks, recovery, completion, rematch, and versioned result links. The local Worker adds room creation/join, readiness and host settings, role-scoped projections, reconnect authentication, host migration, idempotent commands, and one-hour lobby expiry.
- **Live deployment:** The public Workers.dev release remains solo-only. `/service-worker.js` returned 200 and its JavaScript matched the current local build on 2026-10-09. The multiplayer Worker and Durable Object changes have not been deployed.
- **Next action:** Continue Slice 10 locally. Separately, the public-release gate remains open pending retained Developer Portal approval evidence and confirmation of eligibility for the 38 CommunityDragon image references; see `RELEASE_CHECKLIST.md`.

## Verified Repository State

- The 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed exceptions have source notes and regression coverage. Snapshot 15.17.1 remains for existing share links.
- `worker/index.ts` provides versioned room create/info/join/WebSocket routes. `BuildChampLobby` owns each room in SQLite-backed Durable Object storage, uses hibernatable WebSockets, validates versioned envelopes and persisted state, and projects only champion identity/progress to shared displays. Private player projections retain only that player's offer.
- Lobby rules cover 2–8 player seats, 20 spectators, one display, readiness, Same/Random offer generation, host-only controls, late spectator joins, reconnect tokens, host migration, idempotency, bounded input/rates, and one-hour expiry. Round locking and gameplay deadlines are Slice 10 work; the expiry alarm is implemented here.
- Local verification on 2026-10-10: 99 unit tests; typecheck, lint, format, Cloudflare artifact check, Vite build, and preview Worker `wrangler deploy --dry-run` passed. Three local Wrangler/SQLite tests passed for HTTP and WebSocket auth, role projections, idle-socket commands, malformed/oversized input, rate limits, host migration/reconnect, and versioned SQLite restore across a Worker restart. All 40 Chromium/WebKit solo browser tests passed. The expiry boundary is unit-tested. Alarm scheduling is not directly asserted, and one-hour alarm cleanup was not run end-to-end; no hour-long wait was performed.
- The production build still reports a 2.9 MB JavaScript chunk (about 415 KB gzip), above Vite's advisory threshold.

## Release Review

- Riot's published policy materials contain both restrictions on games using Riot IP and an allowance for completely free, original fan celebrations. How those statements apply to BuildChamp remains unresolved; this review makes no legal conclusion.
- The maintainer reports Riot Developer Portal approval dated 2026-09-28, but the record is not in this repository. The asset provenance inventory is complete: 36 transformed ability icons and two Fiddlesticks default-art URLs reference version-scoped CommunityDragon assets. Their Riot eligibility remains unconfirmed. Release and deployment gates stay closed until the maintainer records the evidence and decision.
- No software license has been chosen. Do not imply reuse rights or accept outside contributions.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
