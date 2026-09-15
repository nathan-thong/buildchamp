# Cloudflare deployment

BuildChamp is prepared for Cloudflare Workers Static Assets, but no preview or production
deployment has been published yet.

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
```

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

Production is intentionally blocked until every unchecked item in the Riot policy and registration
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

The initial deployment uses Workers Static Assets and `workers.dev` only. It adds no database,
Durable Object, queue, analytics, or account requirement, so normal solo MVP traffic stays within
the intended low-cost static hosting shape. Review current Cloudflare limits and billing before
public promotion.
