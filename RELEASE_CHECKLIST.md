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
returns 200 and the live JavaScript matched the then-current local build, including the corrected
notices and offline shell. Local verification on 2026-10-11 passed typecheck, lint, format, 109 unit
tests, production build, Cloudflare artifact checks, Wrangler dry-run, all 40 Chromium/WebKit browser
tests, and all 5 local Wrangler/SQLite multiplayer tests. The multiplayer suite covers both six-round
modes, concurrent locks, reconnect and deadline handling, alarm autopick, role privacy, and SQLite
restoration after Worker restart. The one-hour inactivity cleanup is unit-tested but was not run
end-to-end. The connected production Workers Build for commit `dd9413a` later succeeded on 2026-10-11;
the live bundle and API report protocol v3. No live room journey or production lobby-state migration
was verified, and the Riot release gate remains open.

Policy and asset review refreshed 2026-10-11. Riot's [General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies)
(updated 2025-05-29) says not to develop games utilizing Riot IP, describes that as including
simulators, recreations, and games difficult to distinguish from official Riot games, and expressly
allows completely free fan celebrations built around unique, original ideas. The page also requires
product registration and audit, and says new features or product changes must be audited through the
product page. Riot's [Legal Jibber Jabber](https://www.riotgames.com/en/legal) (last updated 2018-08)
describes a limited non-commercial fan-project license but separately prohibits unauthorized games
and apps using Riot IP such as character appearances, abilities, or icons. Riot's [League policy](https://support-developer.riotgames.com/hc/en-us/articles/22698698001939-League-of-Legends)
says player-facing products must be registered regardless of API use and describes Data Dragon game
data and assets as available to third-party developers. The published texts do not define how the
free/original fan-celebration allowance applies to this browser party game; this review makes no
eligibility conclusion. The maintainer reports Developer Portal approval on 2026-09-28. No portal
record is available in this workspace to verify the approved scope, conditions, or whether later
Slice 9–10 features and the CommunityDragon sources were included in an audit. No new registration
is being requested; the retained product audit record is needed to resolve that scope question.

The complete image-reference inventory across both retained snapshots is:

- `15.17.1`: 171 champions, 1,539 image references and 1,363 unique URLs; all are Data Dragon.
- `16.17.1`: 173 champions, 1,581 image references and 1,397 unique URLs; 1,359 are Data Dragon
  and 38 are hosted by [CommunityDragon](https://communitydragon.org/documentation/assets).
- The 38 CommunityDragon image references are 36 form-specific ability icons (Elise 6, Gnar 8,
  Jayce 6, Kayn 10, Nidalee 6) and two Fiddlesticks base-skin splash/loading images. The current
  snapshot contains default champion art only; no skins or community-uploaded images are used.
  These image URLs are scoped to CommunityDragon's `16.17` asset export. All 38 returned HTTP 200
  in a HEAD check on 2026-10-11 (36 PNG, 2 JPEG). The ten version-scoped CommunityDragon champion
  game-data JSON sources referenced by the compatibility manifest also returned HTTP 200; these are
  build-time inputs for reviewed form data, not additional runtime image URLs.

CommunityDragon's [asset documentation](https://communitydragon.org/documentation/assets) and
[export tool repository](https://github.com/CommunityDragon/CDTB) describe Riot game/client files
being extracted and exported to its host. They establish provenance and availability, not reuse
authorization. The Riot policy pages reviewed name Data Dragon, Press Kit, and game-specific asset
sets, but do not name CommunityDragon or explicitly authorize its mirrors/extraction. Riot's
[Data Dragon documentation](https://developer.riotgames.com/docs/lol) documents the standard
champion spell/passive image fields. The importer has Data Dragon fallback icons for the 36 custom
form icons: 18 distinct standard icons, shared across variants, would be available but would lose
the current form-specific distinctions. All 25 standard spell/passive image URLs for those five
champions returned HTTP 200 in a bounded check on 2026-10-11. Data Dragon's Fiddlesticks default
splash and loading URLs also returned HTTP 200, but the checked-in source review records those as
legacy pre-rework art; replacing the current base-skin art with them would change the presentation.
These technically reachable alternatives do not establish an asset license for CommunityDragon.

The current 16.17.1 Data Dragon splash/loading references use Riot's unversioned `/cdn/img/...`
paths. Riot's documentation shows those unversioned paths for champion art. The retained 15.17.1
snapshot instead contains versioned splash/loading URLs; eight sampled 15.17.1 URLs returned HTTP
403 on GET, while current unversioned examples returned HTTP 200. This is a historical image-path
availability limitation, not a policy finding; no generated snapshot was rewritten during this
review. Runtime notices are present on the app shell, shared-display route, fatal-error state, SPA
404, and standalone `public/404.html`. The generated PNG card uses a shortened “Unofficial fan
project · Not endorsed by Riot Games” footer; the full notices remain on the linked product page.
The reviewed Riot materials require conspicuous product/project notices but do not say that each
exported card must repeat the full boilerplate. Public examples such as
[Champdle](https://www.champdle.com/about) and
[LoLdle](https://apps.apple.com/us/app/loldle-official/id6449491946) do not establish BuildChamp's
registration or asset eligibility. No gameplay redesign is indicated by this source review.

## Riot policy and asset gate

- [x] Assess BuildChamp against Riot Games' then-current game/IP policy and record the rationale
      for its free, original drafting game.
- [ ] Retain the Riot Developer Portal product approval/audit record and its scope or conditions;
      the maintainer reports approval dated 2026-09-28, but the record is not in this repository.
      Confirm the audited product scope includes the current Slice 9–10 features and whether the
      CommunityDragon image/data sources were disclosed. No new registration is requested.
- [ ] Confirm the release uses only approved default champion data, icons, and artwork; no skins,
      community-uploaded imagery, or unreviewed assets are included.
- [x] Confirm every player-facing application page and error surface includes the required Riot
      non-endorsement notice. The generated PNG card has a shortened non-endorsement footer; the
      reviewed policy does not specify that each exported card repeat the full notice.
- [x] If Riot assets are shipped, include the applicable Legal Jibber Jabber notice and verify its
      placement is conspicuous and readable.
- [x] Confirm the product does not imply Riot sponsorship, endorsement, operation, or affiliation.
- [ ] Record the policy review and registration evidence with the release decision.

## Public-release stop condition

Do not publish a release containing Riot data or assets while any Riot policy, registration, notice,
or asset-eligibility checkbox above remains unchecked. Local development and offline verification may
continue without implying approval.
