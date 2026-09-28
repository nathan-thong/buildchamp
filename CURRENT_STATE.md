# Current State

Last updated: 2026-09-28

## Now

- **Phase:** Slice 7 technical QA and Slice 8 deployment preparation are complete locally. The maintainer reports that BuildChamp is listed as approved in the Riot Developer Portal; asset-source review and the recorded release decision remain open.
- **Product:** The untimed, snapshot-backed `/solo` party game supports six rounds with irreversible locks, local recovery, completion, rematch, versioned result links, and PNG share cards. Private lobbies, voting, and build rankings remain planned.
- **Next action:** Record the Developer Portal approval evidence, complete the CommunityDragon asset-source review and release decision, then publish the Slice 7/8 fixes and begin Slice 9.
- **Live deployment:** Browser smoke checked 2026-09-28: `/`, `/solo`, `/build/demo`, and a valid `/build/:payload` result load directly. The deployed build still has the earlier short Riot footer and `/service-worker.js` returns the custom 404. Corrected notices and the offline shell remain local and uncommitted.

## Verified Repository State

- The 16.17.1 snapshot contains 173 champions, 172 eligible; Aphelios is excluded. Reviewed exceptions have source notes and regression coverage. The prior 15.17.1 snapshot is retained for share links.
- The PNG share-card refinement (`d61fca1`) is committed on `main`, tracking `origin/main`; the current Slice 7/8 QA and offline-shell fixes have not been deployed.
- Wrangler 4.131.2, Worker-first SPA routing, security headers, immutable asset caching, custom 404, retained-snapshot check, and guarded deploy scripts are present.
- On 2026-09-28, typecheck, lint, format, Vite build, Cloudflare artifact check, and 84 unit tests passed. All 40 Playwright tests passed in Chromium and WebKit, including 17 journeys, axe A/AA scans, and offline refresh in each. WebKit's offline test stops the origin after caching, then reloads through its service worker.
- Keyboard, focus, reduced motion, artwork failure, notice width, and mobile checks passed. Maintainer-tested Zen (Firefox-based) works; native Safari completed six locks. First choice appeared in a median 2.98 seconds across three cold runs at 390×844, 150 ms RTT, 200 KiB/s, and 4× CPU. A 320 px viewport passed.
- The production build still reports a 2.9 MB JavaScript chunk (417 KB gzip) above Vite's advisory threshold.

## Release Review

- Riot's Developer Relations explanation allows completely free, original fan celebrations and describes the prohibited games as simulators, recreations, or experiences hard to distinguish from official games. BuildChamp looks plausibly within that allowance at its current scale; this is an inference, not Riot approval. Champdle and LoLdle operate publicly, but their permissions are unknown.
- Riot's League policy requires player-facing product registration even without API use. The maintainer reports the Developer Portal lists BuildChamp as approved (2026-09-28); this status has not been independently checked here. The snapshot also contains 38 CommunityDragon image references not explicitly named in Riot's listed asset sources. The release gate remains closed pending asset review and a recorded decision. No gameplay redesign is indicated by the research.
- No software license has been chosen. Do not imply reuse rights or accept outside contributions.

Contracts: `PRODUCT.md`, `CHAMPION_DATA.md`, `ARCHITECTURE.md`, and `IMPLEMENTATION_PLAN.md`.
