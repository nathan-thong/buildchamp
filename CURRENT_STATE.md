# Current State

Last updated: 2026-10-12

## Now

- **Phase:** Slices 9–11 are implemented and locally verified. Slice 12 reliability, privacy, cost, and friend-group validation are next.
- **Product:** `/solo` is client-side and untimed. Local `/lobby`, `/room/:code`, and `/display/:code` support six-round Same/Random Champs drafts, staged or all-at-once reveal, secret voting, tied results, rematches, and explicit Leave. The Rooms session persists across routes. Same-origin browser storage can hold one active non-display seat until Leave or expiry; this is not person or IP identity.
- **Production:** The `dd9413a` production Workers Build succeeded on 2026-10-11; the follow-up docs-only `b762025` build also succeeded. The last direct live checks after `dd9413a` found the protocol-v3 bundle and API. Recovery returned `active_room_not_found` without creating a room or claim. No full live room journey or production v2-to-v3 lobby-state migration was verified. See `DEPLOYMENT.md`.
- **Next action:** Complete Slice 12 multi-browser/device journeys, room load/limit and hibernation/alarm checks, security/privacy review, and a real friend-group playtest. Riot asset eligibility and retained Developer Portal approval scope remain unresolved; the public release gate stays open. See `RELEASE_CHECKLIST.md`.

## Verified Repository State

- The 16.17.1 snapshot has 173 champions (172 eligible); Aphelios is excluded. Snapshot 15.17.1 remains for old share links.
- `BuildChampLobby` owns gameplay and phase alarms. `BuildChampBrowserIdentity` serializes one active browser-profile room claim. Same-phase concurrent ballots are accepted; hidden picks, ballots, and credentials remain private by role.
- Checks on 2026-10-11: 118 unit tests, 40 Chromium/WebKit solo tests, and 11 local Wrangler multiplayer tests passed. Typecheck, lint, format, build, Cloudflare artifact check, and Wrangler dry-run passed. The one-hour expiry alarm was not waited out end-to-end.
- A clean detached checkout passed after fixing `.wrangler` directory creation. The earlier `62618b5` Workers Build failure is historical; production builds for `dd9413a` and `b762025` succeeded.
- The client JavaScript bundle is about 2.99 MB (434 KB gzip), above Vite's advisory threshold.

## Release Review

- Riot General Policies allow free fan celebrations based on unique, original ideas; Legal Jibber Jabber separately restricts unauthorized games/apps using Riot IP. Applicability to BuildChamp is unresolved.
- The inventory found 38 CommunityDragon image URLs among 16.17.1 assets. Eight sampled versioned 15.17.1 art URLs returned 403; snapshots remain unchanged. See `RELEASE_CHECKLIST.md`.
- Full notices appear on app pages, shared display, fatal error, and 404 surfaces. The share PNG has a shortened non-endorsement footer; reviewed policies do not expressly require full page boilerplate on exported cards.
- Do not initiate another public release until policy eligibility and required Developer Portal registration are confirmed. No software license has been chosen.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
