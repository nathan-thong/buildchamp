# Current State

Last updated: 2026-10-11

## Now

- **Phase:** Slices 9–11 are implemented and locally verified. Slice 12 reliability and release gates are next.
- **Product:** `/solo` remains client-side and untimed. Local `/lobby`, `/room/:code`, and `/display/:code` support six-round Same/Random Champs drafts, staged or all-at-once reveal, secret voting, tied results, rematches, and explicit Leave. The active Rooms session persists while navigating to Solo. When same-origin storage is available, one browser profile holds one active non-display seat until Leave or expiry; this is not person or IP identity.
- **Live deployment:** Local protocol v3 has not been deployed. On 2026-10-11, `GET /api/rooms` returned the protocol-v2 method response and `/api/rooms/recover` returned 404; no live room was created or joined. See `DEPLOYMENT.md` for the limits of this check.
- **Next action:** Slice 12 release reliability review. Riot asset eligibility remains unresolved; the maintainer reports Developer Portal approval, but the scope and conditions are not retained. See `RELEASE_CHECKLIST.md`.

## Verified Repository State

- The 16.17.1 snapshot has 173 champions (172 eligible); Aphelios is excluded. Snapshot 15.17.1 remains for old share links.
- `BuildChampLobby` owns room gameplay, hibernatable WebSockets, and phase alarms. `BuildChampBrowserIdentity` serializes one active browser-profile room claim. Voting accepts same-phase concurrent ballots via the unchanged absolute vote deadline while rejecting stale-phase or expired votes. Hidden picks, ballots, and credentials remain private by role.
- Checks on 2026-10-11: 118 unit tests, 40 Chromium/WebKit solo tests, and 11 local Wrangler multiplayer tests passed. Coverage includes both champion modes, both reveal styles, concurrent ballots, identity admission/recovery/Leave, reconnect and alarms, and SQLite restart. Typecheck, lint, format, build, Cloudflare artifact check, and Wrangler dry-run passed. The one-hour room-expiry alarm was not waited out end-to-end.
- A clean detached checkout passed the build after fixing `.wrangler` directory creation. The previous Workers Build failure for commit `62618b5` was not confirmed green remotely; no deployment was performed.
- The client JavaScript bundle is about 2.99 MB (434 KB gzip), above Vite's advisory threshold.

## Release Review

- Riot General Policies allow free fan celebrations based on unique, original ideas; Legal Jibber Jabber separately restricts unauthorized games/apps using Riot IP. Applicability to BuildChamp is unresolved.
- The completed inventory found 38 CommunityDragon image URLs among 16.17.1 assets; HTTP availability does not establish eligibility. Eight sampled versioned 15.17.1 art URLs returned 403; snapshots remain unchanged. See `RELEASE_CHECKLIST.md` for evidence and alternatives.
- Full notices appear on app pages, the shared display, fatal error, and 404 surfaces. The share PNG has a shortened non-endorsement footer; reviewed policies do not expressly require full page boilerplate on exported cards.
- Do not deploy Riot data or assets until policy eligibility and required Riot Developer Portal registration are confirmed. No software license has been chosen.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
