# Cloudflare deployment

The production Workers.dev site is live at
[buildchamp.nathan-thong.workers.dev](https://buildchamp.nathan-thong.workers.dev). A browser
smoke check on 2026-09-28 confirmed direct navigation to `/`, `/solo`, `/build/demo`, and a valid
versioned `/build/:payload` result. HTTP verification on 2026-10-09 confirmed `/service-worker.js`
returns 200 and the live JavaScript matched the then-current local build, including updated notices
and the offline application shell. This was an artifact check, not a new live browser journey. The
Slice 10 local implementation has since changed the client bundle. The live release remains solo-only:
the local Slice 9–10 room API, draft UI, and SQLite-backed Durable Object have not been deployed.

The source inventory and policy review are recorded in [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md),
but the deployed site does not satisfy the open Riot release gate. New public releases remain blocked
while asset eligibility and the retained Developer Portal audit scope are unresolved.

## Targets

- The top-level Wrangler configuration is the production target, named `buildchamp`.
- The named `preview` environment deploys to `buildchamp-preview` on `workers.dev`.
- Vite output is served from `dist/` with SPA navigation fallback.
- Fingerprinted files under `dist/assets/` are immutable; HTML is revalidated on every request.
- The Worker-first adapter applies browser security headers and cache policy, keeps application
  routes on the SPA fallback, and turns missing file-like requests into the custom `404.html`.
  `public/_headers` keeps the static-asset policy explicit for the Workers asset layer.
- Workers Observability is enabled for request and error diagnostics only. BuildChamp does not send
  gameplay events, player identifiers, or behavioural analytics.

## Local Worker smoke test

Before the Riot review is complete, use the local Worker adapter for route, header, cache, and
custom-404 checks without publishing anything:

```sh
pnpm run build:cloudflare
pnpm run cloudflare:dev
pnpm test:e2e:multiplayer
```

The multiplayer tests start Wrangler in local mode with isolated Durable Object stores. They cover
both six-round champion modes, participant and QR display screens, authenticated WebSocket
transport, private offer projections, reconnect, concurrent locks, idempotent retries, and local
SQLite restoration after a Worker restart. The Random Champs journey exercises the 15-second
Durable Object deadline alarm and legal timeout autopicks. `pnpm test` verifies the 15-, 30-, and
45-second deadline presets. These commands use local Wrangler and do not publish or require
Cloudflare credentials. The one-hour expiry boundary has unit coverage; the alarm's wall-clock
cleanup is not exercised by this command.

## Preview deployment

The public `workers.dev` preview is guarded by the Riot checklist because it serves the same
Riot-backed data and artwork as production. After that review is complete, authenticate Wrangler
once, set the explicit preview confirmation, and run:

```sh
pnpm install --frozen-lockfile
pnpm run cloudflare:login
BUILDCHAMP_PREVIEW_APPROVED=1 pnpm deploy:preview
```

`pnpm deploy:preview` builds the site, checks that every retained champion snapshot is present in
the bundles, checks that source-only files are absent, and then deploys the preview environment.
The release gate fails before any build or upload when policy/registration checks are incomplete.

In PowerShell:

```powershell
$env:BUILDCHAMP_PREVIEW_APPROVED = '1'
pnpm deploy:preview
```

## Production deployment

Any new production release is blocked until every unchecked item in the Riot policy and registration
section of [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) is completed and recorded. After that
review, set the explicit operator confirmation and run:

```sh
BUILDCHAMP_PRODUCTION_APPROVED=1 pnpm deploy:production
```

In PowerShell:

```powershell
$env:BUILDCHAMP_PRODUCTION_APPROVED = '1'
pnpm deploy:production
```

The approval variable is not a secret. It is a deliberate second confirmation against accidental
publication of Riot data or artwork.

## Rollback and monitoring

Inspect recent deployments with `pnpm run cloudflare:deployments`, inspect the active deployment
with `pnpm run cloudflare:status`, and roll back a known-good version with
`pnpm run cloudflare:rollback -- <VERSION_ID>`. A rollback immediately makes that version active,
so follow it with a smoke check of `/`, `/solo`, `/build/demo`, and a retained historical share link.

Use Workers Observability for request status, uncaught errors, and deployment diagnosis. Keep the
sampling rate low in production unless an incident requires a temporary increase. Do not add custom
logs containing share payloads, nicknames, build choices, or other player data.

The currently deployed solo release uses Workers Static Assets and `workers.dev`. This repository's
local multiplayer implementation adds a SQLite-backed Durable Object class through the `v1`
migration and uses the `LOBBIES` binding; both remain local until the release gate is cleared. Solo
play continues to require no backend, account, or behavioural analytics. Review current Cloudflare
limits and billing before public promotion.
