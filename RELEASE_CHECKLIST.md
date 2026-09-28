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
The current local notice and offline-shell changes have not been deployed.

Policy review recorded 2026-09-28: Riot's [Developer Relations explanation](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies)
describes prohibited games as simulators, recreations, or products difficult to distinguish from
official Riot games, and says completely free, original fan celebrations can be acceptable.
BuildChamp's original, non-commercial six-round drafting game does not simulate League play or
resemble the client. On that published explanation, a small-scale fan-project fit looks plausible;
this is an assessment, not Riot approval. [Champdle](https://www.champdle.com/about) and
[LoLdle](https://apps.apple.com/us/app/loldle-official/id6449491946) publicly offer champion quiz
games with non-endorsement notices, but their registration or licence status is not public evidence
for BuildChamp. Riot's [League policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends)
still requires registration for player-facing products even without Riot API use. The current
snapshot has 38 image references to CommunityDragon for default Fiddlesticks art and transformed
ability icons; CommunityDragon is not named in Riot's listed asset sources. The maintainer reports
that BuildChamp is listed as approved in the Developer Portal (2026-09-28); this status has not
been independently checked here. Registration is therefore treated as complete, while the
asset-source review remains open. No gameplay redesign is indicated by this review.

## Riot policy and asset gate

- [x] Assess BuildChamp against Riot Games' then-current game/IP policy and record the rationale
      for its free, original drafting game.
- [x] Complete Riot Developer Portal product registration; the maintainer reports the product is
      listed as approved (2026-09-28).
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
