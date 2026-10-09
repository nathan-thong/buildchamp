# BuildChamp Release Checklist

This checklist is a release gate, not evidence that a local snapshot or build is approved for
public distribution.

## Champion snapshot gate

- [x] Import an explicit Data Dragon version with `pnpm sync:champion-data`.
- [x] Use a stable `--generated-at` value and retain the emitted snapshot under its version.
- [x] Review the generated change report for champion additions, removals, value changes, and
      affected compatibility exceptions.
- [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build`, and
      `pnpm test:e2e`.
- [x] Confirm the current app uses only the bundled snapshot at runtime and makes no Data Dragon
      network request; the importer remains build-only.
- [x] Retain the existing 15.17.1 snapshot alongside the new 16.17.1 snapshot.

Local verification rerun 2026-09-28: the 16.17.1 snapshot contains 173 champions, 172 eligible,
with Aphelios excluded. `tsc -b --pretty false`, lint, format, production build, Cloudflare artifact
check, and all 84 unit tests passed. All 40 production Playwright tests passed in Chromium and
WebKit. Seventeen core journeys and two axe WCAG A/AA scans passed in each engine; the axe scans
also cover the fatal-error page. Offline refresh restored a locked build and allowed another lock
in both engines. Chromium used browser-level offline mode. WebKit's Playwright offline mode fails
navigations internally, so its test shuts down the origin after caching and reloads from the
service worker.

Keyboard-only drafting, focus restoration, reduced-motion behavior, slow-image handling, missing-art
fallback, readable desktop notice width, and mobile layouts passed browser checks. The maintainer
reports the app works in Zen Browser; a native Safari run completed six locks on 2026-09-26. In
three isolated cold-load runs, the first choice appeared in a median 2.98 seconds (range 2.96–3.06)
at 390×844 with 150 ms RTT, 200 KiB/s download, and 4× CPU throttling. A 320 px viewport check also
passed. All 34 distinct unavailable/conditional summaries in the 16.17.1 snapshot were manually
reviewed for concise, specific explanations. Mobile shared results select the smaller default
loading portrait; desktop retains the splash. Vite reports a 2.9 MB JavaScript chunk (417.15 KB
gzip) above its 500 kB advisory threshold.

The corrected non-endorsement and Legal Jibber Jabber notices are in the local app shell, fatal
error state, and 404 page. A browser smoke check on 2026-09-28 confirmed the live Workers.dev site
loads `/`, `/solo`, `/build/demo`, and a valid versioned `/build/:payload` result directly, but
still has the earlier short footer wording and returns the custom 404 for `/service-worker.js`.
HTTP verification on 2026-10-09 supersedes that deployment observation: `/service-worker.js`
returns 200 and the live JavaScript exactly matches the current local build, including the corrected
notices and offline shell. Local verification on 2026-10-10 passed typecheck, lint, format, 99 unit
tests, Vite build, Cloudflare artifact check, and all 40 Chromium/WebKit browser tests. Three
additional local Wrangler/SQLite Durable Object tests passed, including reconnect and versioned-state
restoration after restarting the local Worker; a preview Worker deploy dry-run also passed. No public
deployment or release gate change occurred.

Policy and asset review updated 2026-10-09. Riot's [General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies)
(updated 2025-05-29) says not to develop games using Riot IP, while also allowing completely free
fan celebrations built around original ideas. Riot's [Legal Jibber Jabber](https://www.riotgames.com/en/legal)
(last updated 2018-08) describes a limited non-commercial fan-project license but separately says
not to use Riot IP such as character appearances, abilities, or icons in a game or app. Riot's
[League policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends)
(updated 2025-03-11) requires registration for player-facing products regardless of API use and
describes Data Dragon game data and assets as available to third-party developers. These published
rules leave an unresolved question for this particular free, original browser party game; this review
does not conclude that it is eligible or ineligible. The maintainer reports Developer Portal approval
on 2026-09-28, but no approval record or product-specific policy response is available in this
repository, so registration and policy eligibility are not independently evidenced here.

The 16.17.1 snapshot contains 38 unique image URLs hosted by
[CommunityDragon](https://communitydragon.org/documentation/assets): 36 transformed ability icons
(Elise 6, Gnar 8, Jayce 6, Kayn 10, Nidalee 6) and Fiddlesticks default splash and loading art (2).
The references are version-scoped under `/16.17/`. CommunityDragon's asset documentation describes
files exported from game and client paths; its public asset documentation is a source-provenance
reference, not Riot authorization. Riot's reviewed policy pages name Data Dragon, Press Kit, and other
game-specific asset sets, but do not name CommunityDragon. The provenance inventory is complete;
Riot eligibility for these 38 references remains unconfirmed. Public examples such as
[Champdle](https://www.champdle.com/about) and
[LoLdle](https://apps.apple.com/us/app/loldle-official/id6449491946) do not establish BuildChamp's
registration or asset eligibility. No gameplay redesign is indicated by this source review.

## Riot policy and asset gate

- [x] Assess BuildChamp against Riot Games' then-current game/IP policy and record the rationale
      for its free, original drafting game.
- [ ] Verify Riot Developer Portal product registration and retain its approval record; the
      maintainer reports the product is listed as approved (2026-09-28), but no evidence is in this
      repository.
- [ ] Confirm the release uses only approved default champion data, icons, and artwork; no skins,
      community-uploaded imagery, or unreviewed assets are included.
- [x] Confirm every player-visible surface includes the required Riot non-endorsement notice.
- [x] If Riot assets are shipped, include the applicable Legal Jibber Jabber notice and verify its
      placement is conspicuous and readable.
- [x] Confirm the product does not imply Riot sponsorship, endorsement, operation, or affiliation.
- [ ] Record the policy review and registration evidence with the release decision.

## Public-release stop condition

Do not publish a release containing Riot data or assets while any Riot policy, registration, notice,
or asset-eligibility checkbox above remains unchecked. Local development and offline verification may
continue without implying approval.
