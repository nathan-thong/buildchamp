# Current State

Last updated: 2026-10-11

## Now

- **Phase:** Slices 9–11 are implemented and locally verified. Slice 12 reliability and release gates are next.
- **Product:** `/solo` remains client-side and untimed. Local `/lobby`, `/room/:code`, and `/display/:code` support six-round Same/Random Champs drafts, staged or all-at-once reveal, secret voting, tied results, rematches, and explicit Leave. The active Rooms session persists while navigating to Solo. When same-origin storage is available, one browser profile holds one active non-display seat until Leave or expiry; this is not person or IP identity.
- **Live deployment:** The connected production Workers Build for `dd9413a` succeeded on 2026-10-11 (build `e450a1c9-b212-4c83-b2c8-75ae80dfd25b`, version `0a24ddf2-39c5-4c07-adc6-f1f3941bc0ce`). The live root references the local protocol-v3 JavaScript bundle; read-only `GET /api/rooms` and `GET /api/rooms/recover` return protocol-v3 method responses. A one-shot recovery request returned `active_room_not_found` without creating a room or claim. This confirms publication and identity-handler reachability, not a complete live room journey or production lobby-state migration. See `DEPLOYMENT.md`.
- **Next action:** Slice 12 release reliability review. Riot asset eligibility remains unresolved; the maintainer reports Developer Portal approval, but the scope and conditions are not retained. See `RELEASE_CHECKLIST.md`.

## Verified Repository State

- The 16.17.1 snapshot has 173 champions (172 eligible); Aphelios is excluded. Snapshot 15.17.1 remains for old share links.
- `BuildChampLobby` owns room gameplay, hibernatable WebSockets, and phase alarms. `BuildChampBrowserIdentity` serializes one active browser-profile room claim. Voting accepts same-phase concurrent ballots via the unchanged absolute vote deadline while rejecting stale-phase or expired votes. Hidden picks, ballots, and credentials remain private by role.
- Checks on 2026-10-11: 118 unit tests, 40 Chromium/WebKit solo tests, and 11 local Wrangler multiplayer tests passed. Coverage includes both champion modes, both reveal styles, concurrent ballots, identity admission/recovery/Leave, reconnect and alarms, and SQLite restart. Typecheck, lint, format, build, Cloudflare artifact check, and Wrangler dry-run passed. The one-hour room-expiry alarm was not waited out end-to-end.
- A clean detached checkout passed the build after fixing `.wrangler` directory creation. The earlier Workers Build failure for `62618b5` remains historical; the connected production build for `dd9413a` succeeded. No end-to-end live multiplayer journey or production lobby migration was verified.
- The client JavaScript bundle is about 2.99 MB (434 KB gzip), above Vite's advisory threshold.

## Release Review

- Riot General Policies allow free fan celebrations based on unique, original ideas; Legal Jibber Jabber separately restricts unauthorized games/apps using Riot IP. Applicability to BuildChamp is unresolved.
- The completed inventory found 38 CommunityDragon image URLs among 16.17.1 assets; HTTP availability does not establish eligibility. Eight sampled versioned 15.17.1 art URLs returned 403; snapshots remain unchanged. See `RELEASE_CHECKLIST.md` for evidence and alternatives.
- Full notices appear on app pages, the shared display, fatal error, and 404 surfaces. The share PNG has a shortened non-endorsement footer; reviewed policies do not expressly require full page boilerplate on exported cards.
- Do not deploy Riot data or assets until policy eligibility and required Riot Developer Portal registration are confirmed. No software license has been chosen.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
