# BuildChamp Implementation Plan

## Delivery Strategy

BuildChamp ships as complete vertical slices. The first release is a polished, untimed solo game that needs no backend. Private multiplayer is the second release. Public rankings, accounts, and monetization are outside this plan.

Each slice must leave the application runnable, tested in proportion to its risk, and usable with real or clearly marked fixture data. A slice is complete only when its acceptance criteria pass.

Execution status belongs in `CURRENT_STATE.md`. Keep this file as the stable plan rather than adding session notes or mutable progress markers.

## Release Map

| Release | Outcome |
| --- | --- |
| Solo Alpha | Complete locally playable six-round draft with real champion snapshot |
| Solo MVP | Polished, recoverable, accessible, shareable solo game deployed on Cloudflare |
| Private Lobby Alpha | Friends can join, draft, reconnect, reveal, and vote locally/staging |
| Private Lobby MVP | Stable link-based rooms, shared display, sound, expiry, and production deployment |

## Slice 1 — Project and UI Foundation

Create the Vite application and the minimum product design system needed to build real screens.

### Work

- Initialize pnpm, React, TypeScript, Vite, linting, formatting, Vitest, React Testing Library, and Playwright.
- Establish domain/data boundaries that can later become workspace packages.
- Add routes for home, solo draft, and shared result.
- Define semantic color, typography, spacing, radius, elevation, motion, and audio tokens.
- Build the responsive application shell, BuildChamp wordmark treatment, error boundary, loading state, and mute control.
- Add Riot attribution and non-endorsement placement.
- Establish reduced-motion, focus, and keyboard conventions.

### Acceptance criteria

- A clean install can run development, typecheck, unit tests, production build, and browser tests from documented commands.
- Home, solo, result, not-found, loading, and fatal-error states render at mobile and desktop widths.
- All interactive controls are keyboard reachable with visible focus.
- The UI resembles a polished, lightweight gaming companion—not the League client or a build calculator.
- No Riot or League logo is used as BuildChamp branding.

## Slice 2 — Champion Snapshot Pipeline

Produce the first immutable, validated English champion-data snapshot.

### Work

- Implement source fetch, cache, normalize, and emit stages.
- Add Zod schemas for raw inputs, the normalized snapshot, and compatibility manifest.
- Import base stats, growth, attack range/type, movement speed, abilities, descriptions, values, icons, and default artwork references.
- Apply Aphelios, Jayce, Hwei, and the reviewed transformed-state compatibility rulings.
- Generate eligibility indexes and a human-readable patch change report.
- Add provenance, snapshot version, and generation metadata.
- Add the Riot notice and asset-policy checks to the release checklist.

### Acceptance criteria

- The pipeline takes an explicit Data Dragon version and produces deterministic output.
- Runtime gameplay performs no Data Dragon network request.
- Invalid or incomplete source data fails the build with an actionable error.
- Every champion has exactly one base identity and at least one variant unless excluded.
- Every component has an explicit availability classification.
- Jayce variants share one random identity; Hwei packages are represented correctly; Aphelios cannot enter the pool.
- Re-running against identical inputs produces no diff.
- The change report identifies additions, removals, value changes, and affected exception entries.

## Slice 3 — Pure Draft Engine

Implement the rules independently of React, browser state, and Cloudflare.

### Work

- Define run state, offer, selection, locked build, and completion types.
- Implement base-champion weighting, variant selection, no-repeat identity, and adaptive offer generation.
- Add bounded continuation checking so every displayed selectable choice remains completable.
- Implement lock validation, final forced choice, fresh rematch, and random compatible autopick.
- Make random input injectable so tests are deterministic.
- Add fixtures for normal, restricted, variant, and adversarial data sets.

### Acceptance criteria

- A valid run always ends after six locks with Body, Q, W, E, R, and Passive filled exactly once.
- A base champion never repeats, including through another variant.
- Rounds one through five present at least two selectable choices.
- Every selectable choice shown in those rounds retains a legal completion path.
- The sixth round may expose one choice and cannot be impossible.
- Unavailable components are never selectable or autopicked.
- Thousands of seeded/property-generated runs complete without invariant failure.
- The engine has no React, DOM, storage, network, or Cloudflare dependency.

## Slice 4 — Solo Gameplay

Join the snapshot, engine, and interface into the first complete game.

### Work

- Build the landing call to action and concise rules explanation.
- Build the champion reveal, artwork, compact Body/ability summaries, and expandable details.
- Show six build slots with clear open, selectable, and locked states.
- Show unavailable components with an explanation.
- Add deliberate irreversible lock interaction and feedback.
- Build final reveal and “Play Again” with a fresh run.
- Ensure the entire run works on narrow mobile screens and desktop.

### Acceptance criteria

- A first-time player can understand and begin without an account or tutorial wall.
- The player can select any currently open compatible slot in any order.
- A locked choice cannot be changed through UI, refresh, or navigation.
- Body clearly communicates base stats, attack range/type, movement speed, and appearance.
- Ability summaries show name, icon, cooldown, range, and concise description with expandable full values.
- The run is untimed and contains no skips or rerolls.
- Completion produces an understandable six-part composite champion.
- The next run cannot accidentally reuse the prior run state.

## Slice 5 — Recovery, Sound, and Accessibility

Make solo play resilient and satisfying enough for repeated casual use.

### Work

- Persist and validate the active run after every lock.
- Resume an interrupted compatible run and safely discard corrupt or obsolete data.
- Add subtle reveal, lock, completion, and share sounds.
- Unlock audio after first interaction and add persistent mute.
- Respect reduced motion and ensure visual equivalents for all sound feedback.
- Test keyboard, screen-reader naming, contrast, focus order, and touch targets.

### Acceptance criteria

- Refreshing or reopening the page restores the exact valid draft state.
- Corrupt local storage cannot crash or create an illegal build.
- The browser never attempts blocked autoplay.
- Mute persists and prevents all nonessential game audio.
- No state is communicated by color, motion, or sound alone.
- Core solo play is completable with keyboard only.
- Reduced-motion mode removes nonessential reveal motion without obscuring state changes.

## Slice 6 — Shareable Results

Make a solo result social without requiring server persistence.

### Work

- Implement the versioned compact result codec and `/build/:payload` route.
- Pin shared builds to their champion-data snapshot.
- Add copy-link feedback and native share where supported.
- Render a standalone result view with BuildChamp logo, site link, replay call to action, and Riot notice.
- Add a generic branded Open Graph image and metadata.
- Add invalid, malformed, and unavailable-snapshot states.

### Acceptance criteria

- A completed build round-trips through its URL without loss.
- Opening a link on a clean browser requires no local state or account.
- Result components render from the pinned historical snapshot, not the newest one.
- Malformed or unknown payloads never crash and explain what the player can do next.
- Copy/share success and failure are both communicated accessibly.
- The shared page is visually compelling at mobile and desktop widths.
- The URL payload contains identifiers only and is validated before use.

## Slice 7 — Solo QA and Content Pass

Prove the solo product before adding backend complexity.

### Work

- Run automated unit, component, accessibility, build, and browser suites.
- Test real champion data across many seeded runs.
- Manually review all unavailable and conditional component copy.
- Test current Chrome, Firefox, Safari, and representative mobile layouts.
- Test slow asset loading, offline refresh after caching, stale recovery, and missing images.
- Review Riot attribution, non-commercial positioning, and asset use.
- Confirm product eligibility under Riot's current policies and complete required Developer Portal registration before public release.
- Tune pacing, sound levels, responsive image delivery, and first-load performance.

### Acceptance criteria

- No known path produces an impossible or incomplete run.
- No broken asset or uncaught error appears in the primary journey.
- The initial route reaches a usable decision quickly on a typical mobile connection.
- All exceptional champion rulings have source notes and regression coverage.
- Critical accessibility failures are resolved.
- A manual release checklist is signed off before deployment.
- Local testing may proceed without implying approval, but public deployment using Riot data or assets is blocked until the Riot policy and registration gate is satisfied.

## Slice 8 — Cloudflare Solo Deployment

Deploy the static solo MVP with operational visibility but no product tracking.

### Work

- Configure Cloudflare Workers Static Assets and preview/production environments.
- Configure SPA route fallback, immutable snapshot caching, security headers, and custom error handling.
- Add a deployment check for retained historical snapshots.
- Enable minimal error and request diagnostics without behavioural analytics.
- Document deployment, rollback, and free-tier monitoring.
- Keep production publication disabled until the Riot policy and registration release gate is satisfied.

### Acceptance criteria

- The production URL supports direct navigation to every application and result route.
- Static versioned assets are cached immutably; HTML can update safely.
- A prior known share link still works after deploying a newer snapshot.
- No secrets or source-only files ship to the browser.
- Operational failures can be diagnosed without tracking player behaviour.
- The deployment remains within the intended free Cloudflare services under normal MVP use.

## Slice 9 — Multiplayer Lobby Foundation

Add the server-authoritative room state machine and realtime connection layer.

### Work

- Add Worker routes for room creation and joining.
- Implement one SQLite-backed Durable Object per lobby.
- Define and validate versioned commands, events, role-specific projections, and revisions.
- Add nickname rules, player/spectator/display roles, readiness, host settings, removal, and start validation.
- Implement reconnect tokens, idempotent commands, host migration, and one-hour expiry.
- Use hibernatable WebSockets and deadline alarms without interval ticks.
- Implement Same Champs and Random Champs offer generation.

### Acceptance criteria

- A host can create a room and friends can join by link or code without accounts.
- Rooms support 2–8 players, 20 spectators, and one display.
- Only the host can change settings or start; at least two players must be ready.
- Same Champs defaults on; Random Champs and all three speed presets are selectable.
- Late arrivals become spectators.
- Reconnect restores the correct private identity without exposing its token.
- Host migration selects the longest-connected active player.
- Inactive rooms and credentials disappear after one hour.
- Server projections never reveal hidden picks to another role.

## Slice 10 — Synchronized Draft and Shared Display

Deliver the conversational Jackbox-inspired multiplayer draft.

### Work

- Build participant join/waiting/drafting screens and the room-code display.
- Add QR joining on the shared display.
- Implement server deadlines for 15-, 30-, and 45-second modes.
- Advance early when all players lock; autopick legal components on timeout or disconnect.
- In Same Champs, show the shared current offer; in Random Champs, show each player's current champion on the display.
- Show public progress without exposing locked component choices.
- Add restrained participant sounds and stronger shared-display timer cues.

### Acceptance criteria

- Every client derives its countdown from the same server deadline.
- A round resolves exactly once under simultaneous locks, timeout, reconnect, or retry.
- Disconnected players continue through legal autopicks.
- Same Champs offers are compatible for every player.
- Random Champs offers are compatible for their assigned player.
- Current champion offers and progress are public, while chosen slots remain secret.
- The shared display can run independently without player controls.
- Normal play emits no per-second server countdown message.

## Slice 11 — Reveal, Voting, Results, and Rematch

Complete the private party-game loop.

### Work

- Implement staged reveal with approximately six seconds per player and host advance.
- Implement the optional All at Once reveal setting.
- Build secret single-ballot voting with no self-vote.
- Allow players, spectators, late joiners, and the display to see the appropriate vote state.
- End voting early when all connected eligible voters act; treat non-voters as abstentions.
- Calculate shared winners on ties.
- Add winner presentation, sound, fresh rematch, and exit paths.

### Acceptance criteria

- Hidden builds become visible only when the authoritative reveal phase permits it.
- Both reveal modes complete correctly with connected and disconnected players.
- Each eligible voter can vote once and cannot vote for themselves.
- Vote choices remain secret until results.
- Voting uses 20-, 30-, or 45-second deadlines matching the host preset.
- Ties are displayed as shared victories.
- A completed disconnected player's build remains eligible.
- Rematch retains the room and participants but generates fresh champion offers.

## Slice 12 — Private Lobby Release Gate

Verify reliability, cost behaviour, security boundaries, and party usability before public release.

### Work

- Run multi-browser and multi-device Playwright journeys for both champion modes and reveal modes.
- Load-test representative 8-player rooms plus spectators and display.
- Verify hibernation, alarm, storage-write, and WebSocket usage.
- Exercise malformed commands, floods, stale revisions, role escalation, duplicate joins, and nickname abuse.
- Test Discord-style link joining, QR joining, background tabs, mobile sleep, reconnect, and host loss.
- Conduct a real friend-group playtest focused on explanation, discussion, silence, and reveal pacing.
- Tune server limits and operational alerts.

### Acceptance criteria

- All critical multiplayer state-machine and privacy tests pass.
- Representative rooms stay within documented free-tier assumptions.
- Rate and size limits reject abusive traffic without breaking a normal room.
- No hidden choice leaks through protocol payloads, UI, logs, or accessibility text.
- A new group can join and complete a game without facilitator explanation.
- Operational documentation covers deploy, rollback, limits, and incident diagnosis.

## Deferred Work

The following are explicitly outside these releases:

- Accounts, profiles, authentication, and progression
- Public result discovery and permanent server-issued build records
- Head-to-head global voting and rating algorithms
- Global leaderboards
- Chat, custom build names, captions, and user-uploaded content
- Skins and alternative artwork
- Localization beyond English
- Product analytics and growth experiments
- Commercialization

They should be reconsidered only after solo and private-lobby usage demonstrates demand.

## Definition of Done for the Planning Phase

Planning is complete when:

- `PRODUCT.md`, `ARCHITECTURE.md`, and `CHAMPION_DATA.md` agree on terminology and rules.
- Every solo slice has objective acceptance criteria.
- Multiplayer has a clear seam and does not burden the solo implementation.
- Unknown champion exceptions have a documented review process rather than guessed behaviour.
- No unresolved decision blocks Slice 1.

At that point implementation should begin with Slice 1 and proceed in order through the Solo MVP release gate.
