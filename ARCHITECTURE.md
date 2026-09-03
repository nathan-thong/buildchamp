# BuildChamp Architecture

## Status

This document records the implementation architecture for the solo-first release and the private-lobby release that follows it. It is intentionally narrower than a full production platform design.

## Technology Choices

| Concern | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript | Shared domain types across build tooling, client, and Worker |
| Client | React + Vite | Fast local iteration and a small static deployment |
| Styling | Tailwind CSS with explicit design tokens | Rapid implementation without coupling product state to a component framework |
| Accessible primitives | Radix UI where a native element is insufficient | Keyboard and screen-reader behaviour for dialogs, tooltips, and menus |
| Runtime validation | Zod | Validate imported data, decoded share links, local storage, and network messages |
| Hosting | Cloudflare Workers Static Assets | Free initial hosting with a direct path to the multiplayer backend |
| Multiplayer API | Cloudflare Worker | Room routing, creation, joining, and asset/API boundary |
| Lobby runtime | One Durable Object per lobby | Single authoritative, ordered state owner for each room |
| Lobby persistence | Durable Object SQLite storage | Small recoverable snapshots, alarms, and one-hour expiry |
| Realtime transport | Native WebSockets using Durable Object hibernation | Low-overhead lobby events without per-second polling |
| Unit/component tests | Vitest + React Testing Library | Fast tests using the Vite toolchain |
| Browser tests | Playwright | Complete solo and multiplayer journey verification |
| Workspace | pnpm | Reproducible scripts and room for shared packages without premature complexity |

Versions are locked when the project is scaffolded and updated deliberately.

## System Shape

```text
                    build-time only
  Data Dragon ──> snapshot importer ──> validated versioned JSON
                                            │
                                            v
┌──────────────── browser ────────────────────────────────┐
│ React UI                                                │
│   ├── pure draft engine                                 │
│   ├── local solo recovery and preferences               │
│   ├── versioned share-result codec                      │
│   └── optional multiplayer WebSocket client             │
└──────────────┬───────────────────────────────┬───────────┘
               │ static assets / room API      │ WebSocket
               v                              v
        Cloudflare Worker ─────────> Durable Object per lobby
                                      ├── authoritative state
                                      ├── deadline alarms
                                      ├── reconnect tokens
                                      └── one-hour expiry
```

The draft engine and champion-data package are runtime-independent. They cannot import React, browser APIs, Cloudflare APIs, or storage implementations. This is the primary portability boundary.

## Suggested Repository Layout

```text
apps/
  web/                    React application and static routes
  worker/                 Cloudflare Worker and Durable Object
packages/
  domain/                 draft rules, types, codecs, and deterministic selectors
  champion-data/          generated snapshots and compatibility manifest
scripts/
  sync-champion-data/     fetch, normalize, validate, and emit a snapshot
tests/
  e2e/                    Playwright journeys
```

The solo milestone may begin with one Vite application, but domain and data code must retain these dependency boundaries. Moving files into packages should happen only when the Worker needs to consume them.

## Solo Runtime

Solo play is fully client-side:

1. Load the newest bundled champion snapshot.
2. Start or recover a run from local storage.
3. Use the pure draft engine to select the next eligible base champion and variant.
4. Validate and lock one component.
5. Persist the compact run after every lock.
6. Encode the completed build into a versioned result URL.

No API, account, database, or runtime fetch from Data Dragon is required. If JavaScript is reloaded mid-run, recovery uses a versioned and Zod-validated local payload. Invalid or obsolete recovery data is discarded safely.

## Share Results

The initial result route uses a compact, URL-safe payload containing:

- Codec version
- Champion-data snapshot version
- Six selected component references
- Body variant where applicable

The payload contains identifiers, never copied descriptions or asset URLs. The result page loads the referenced historical snapshot, validates every reference, and renders the build. A malformed or unavailable snapshot produces a friendly invalid/expired result state.

This client-only design keeps sharing free and avoids permanent result storage. URLs should use a route such as `/build/:payload`. A build encoded by the user is not proof that it was legitimately drafted, which is acceptable for the non-competitive solo release. Future public rankings must use server-issued immutable result IDs instead.

The initial Open Graph image and metadata are generic BuildChamp branding. Per-build server-rendered previews are deferred.

## Multiplayer Topology

The Worker creates a short, human-readable room code using cryptographically secure randomness and resolves it to one Durable Object ID. The room URL and code are equivalent join paths.

Each Durable Object owns exactly one lobby. All commands for that lobby are serialized through it, avoiding cross-server locks and conflict resolution. The object stores compact snapshots only at meaningful transitions rather than after every visual update.

### Connections

Participant roles are `host`, `player`, `spectator`, and `display`. A private reconnect token is generated when a participant joins and stored only in that browser. Public player IDs and private reconnect credentials are distinct.

The WebSocket hibernation API must be used. The server sends absolute `deadlineAt` timestamps; clients animate countdowns locally. The server does not broadcast per-second ticks.

### Command and Event Protocol

All messages use a versioned envelope:

```ts
type ClientCommand = {
  protocolVersion: 1;
  commandId: string;
  roomRevision: number;
  type: string;
  payload: unknown;
};

type ServerEvent = {
  protocolVersion: 1;
  revision: number;
  type: string;
  payload: unknown;
};
```

Commands are parsed with Zod, authorized against the connection's role, and applied to a lobby state machine. Every accepted transition increments the room revision. Duplicate command IDs are idempotent within a bounded recent-command window. A reconnect receives a complete sanitized snapshot followed by later events.

Private picks are never included in public snapshots before reveal. The shared display receives a role-specific projection rather than the complete internal state.

### Authoritative Lobby Phases

```text
waiting -> drafting -> revealing -> voting -> results
   ^                                             │
   └──────────────── rematch ────────────────────┘
```

The Durable Object validates every transition:

- Only the host may change settings or start.
- Starting requires 2–8 ready players.
- Draft locks must reference the current offer and an open, compatible slot.
- A deadline alarm assigns a random compatible choice to unlocked players.
- A phase advances early when all required connected participants have acted.
- Votes are secret, single-use, and cannot target the voter.
- Tied highest totals produce shared winners.
- Staged reveal advances on its deadline or host command; All at Once advances immediately.

Quick, Standard, and Relaxed settings use draft timers of 15, 30, and 45 seconds and voting timers of 20, 30, and 45 seconds respectively.

Random selection is performed server-side in multiplayer. Same Champs computes an offer compatible with every active player's remaining state. Random Champs computes one offer per player. Variant weighting is applied by base champion rather than by variant.

### Disconnects, Host Migration, and Expiry

Disconnecting does not remove a drafting player. Their unresolved rounds are completed by the same deadline autopick rule. Reconnecting with the token restores control.

If the host disconnects, authority transfers to the longest-connected active player. The migration is included in the next state projection. A late joiner becomes a spectator.

Every meaningful room command refreshes `expiresAt`. A single Durable Object alarm handles the nearest gameplay deadline or room expiry. On one hour of inactivity, lobby state and credentials are deleted. No interval timer is used.

## Champion Data Pipeline

Champion data is never treated as mutable runtime infrastructure. A controlled script:

1. Reads the chosen Data Dragon version.
2. Downloads champion metadata and approved default assets.
3. Normalizes data into BuildChamp's schema.
4. Applies the reviewed compatibility and variant manifest.
5. Validates referential integrity and draft solvability.
6. Emits an immutable snapshot keyed by Data Dragon version.
7. Produces a human-reviewable change report.

A patch snapshot is committed and deployed only after validation and review. Existing snapshots referenced by shared builds remain available unless legal or security requirements require removal.

## State and Storage Boundaries

| Data | Location | Lifetime |
| --- | --- | --- |
| Champion snapshots | Versioned static assets | Retained while referenced builds are supported |
| Solo run recovery | Browser local storage | Until completion, restart, or schema invalidation |
| Sound and accessibility preferences | Browser local storage | Persistent |
| Share result | URL payload | Controlled by the person sharing it |
| Lobby state | Durable Object SQLite | One hour after last activity |
| Reconnect token | Browser plus lobby state | Lobby lifetime |
| Operational logs | Cloudflare observability | Minimum useful retention |

No account identifiers, behavioural analytics, chat messages, or freeform build text exist in the initial system.

## Security and Abuse Boundaries

- Treat nicknames, URL payloads, local storage, WebSocket messages, and imported data as untrusted.
- Render nicknames as text, enforce visible-character length, and apply the basic profanity filter server-side.
- Apply command size limits, message-rate limits, connection limits, and room creation throttles at the Worker boundary.
- Store reconnect tokens as secrets and never broadcast them.
- Prevent spectators and displays from sending player commands.
- Do not expose hidden picks through errors, logs, state snapshots, or accessibility labels before reveal.
- Include Riot's required non-endorsement notice and do not imply affiliation.
- Treat confirmation of Riot policy eligibility and required Developer Portal registration as a public-release gate, not an inferred consequence of using Data Dragon.

## Performance and Cost Guardrails

- Static assets are immutable and aggressively cached by version.
- Champion images are responsive, lazy-loaded beyond the current offer, and given explicit dimensions.
- The server never emits countdown ticks.
- Lobby writes occur at semantic transitions and may be batched.
- Durable Object hibernation is mandatory for idle WebSockets.
- Champion eligibility indexes are generated at build time where practical.
- Free-tier consumption and failed requests are monitored before public promotion.

## Testing Strategy

### Domain tests

- Every legal draft reaches six distinct filled slots.
- No base champion repeats within a run.
- Before the last round, generated offers expose at least two compatible choices.
- Adaptive generation cannot leave an impossible final state.
- Variant probability is equal to its base champion's probability.
- Same Champs offers are legal for every player.
- Timeout selection always chooses a legal component.

Property-based tests are preferred for generation invariants because the state space is combinatorial.

### Client tests

- Keyboard and screen-reader operation of the draft.
- Irreversible lock confirmation and feedback.
- Local recovery and corrupt-payload handling.
- Muted, autoplay-blocked, and reduced-motion behaviour.
- Share-code round trips across retained snapshots.

### Worker tests

- Role authorization and invalid-transition rejection.
- Reconnect and host migration.
- Deadline alarms and idempotent commands.
- Hidden-information projections.
- Lobby expiry and cleanup.

### End-to-end tests

- Complete a solo run and reopen its shared result.
- Create, join, draft, reveal, vote, and rematch in both multiplayer modes.
- Disconnect and reconnect during a draft.
- Join late as a spectator and vote.

## Portability

Cloudflare-specific code is confined to `apps/worker` and a small transport adapter. The domain state machine accepts commands and produces events without Cloudflare types. Champion snapshots are ordinary JSON. If hosting changes later, the replacement backend needs to provide only ordered per-room command execution, WebSockets, scheduled deadlines, and ephemeral persistence.

## External References

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Riot Data Dragon documentation](https://developer.riotgames.com/docs/lol)
- [Riot Legal Jibber Jabber](https://www.riotgames.com/en/legal)
