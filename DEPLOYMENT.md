# Cloudflare deployment

The production Workers.dev site is live at
[buildchamp.nathan-thong.workers.dev](https://buildchamp.nathan-thong.workers.dev). A browser
smoke check on 2026-09-28 confirmed direct navigation to `/`, `/solo`, `/build/demo`, and a valid
versioned `/build/:payload` result. HTTP verification on 2026-10-09 confirmed `/service-worker.js`
returned 200 and the live JavaScript matched the then-current local build. On 2026-10-11, a read-only
`GET /api/rooms` returned 405 with the protocol-v2 method response, while `POST /api/rooms/recover`
returned 404. No live room was created or joined. These checks show a protocol-v2 API surface but do
not establish a working public room journey or the deployed reveal/vote/rematch behavior. Local
Slice 11 uses protocol v3 and has not been deployed.

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

The multiplayer tests start separate local Wrangler processes with isolated Durable Object stores.
They cover both six-round champion modes and reveal styles, participant and QR display screens,
authenticated WebSocket transport, hidden offers and ballots, voting, ties, results, rematch,
persistent navigation, second-tab takeover, one-seat admission, Leave, recovery, identity
reservation races, stale-claim cleanup, reconnect, idempotent retries, and local SQLite restoration
after a Worker restart. The Random Champs journey exercises the 15-second Durable Object deadline
alarm and legal timeout autopicks. `pnpm test` verifies the 15-, 30-, and 45-second draft and voting
presets. These commands use local Wrangler and do not publish or require Cloudflare credentials.
The one-hour expiry boundary has unit coverage; the alarm's hour-long wall-clock cleanup is not
waited out by this command.

The `worker:types` build step creates the ignored `.wrangler/` directory before calling Wrangler,
so a clean checkout does not depend on a generated directory from an earlier local run. A detached
checkout with the entire directory absent passed `pnpm build` and `pnpm run build:cloudflare` using
Node 24.19.0 and the pinned pnpm 11.19.0. Cloudflare's next Workers Build is still needed to verify
the fix in its remote build environment.

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

The current local Wrangler configuration has the `BuildChampLobby` SQLite Durable Object under the
`LOBBIES` binding in migration `v1`. It adds an admission-only `BuildChampBrowserIdentity` SQLite
Durable Object under `IDENTITIES` in migration `v2`; the room object remains the sole gameplay-state
owner. Local type generation, build, Worker tests, and Wrangler dry-run cover this configuration.
The v2 migration has not been applied to the live service, and no production deploy was performed.
Before a future deploy, confirm the target's current migration history and review the migration plan
against its live bindings. Solo play continues to require no backend, account, or behavioural
analytics. Review current Cloudflare limits and billing before public promotion.
