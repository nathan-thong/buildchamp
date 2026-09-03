# AGENTS.md

## Scope

These instructions apply to the entire BuildChamp repository. They are written for coding agents and other automated contributors. Follow direct user instructions first; otherwise treat this file and the project documents below as the repository contract.

## Context Loading

Always read `CURRENT_STATE.md` first. It is the compact handoff: current milestone, verified capabilities, next action, and active blockers. Then load only the contract routed by the task below; do not read every project document by default.

| Task | Required context |
| --- | --- |
| Product scope, game rules, UX, copy, accessibility | `PRODUCT.md` + relevant implementation-plan slice |
| Champion mechanics, resources, variants, generation | `CHAMPION_DATA.md` + relevant implementation-plan slice |
| Frontend/module boundaries, sharing, storage, security | `ARCHITECTURE.md` + relevant implementation-plan slice |
| Multiplayer or Cloudflare | `PRODUCT.md` multiplayer sections + `ARCHITECTURE.md` + relevant slice; add `CHAMPION_DATA.md` only for offer generation |
| Patch/data import | `CHAMPION_DATA.md` + Slices 2–3 |
| Deployment/release | `CURRENT_STATE.md` + `ARCHITECTURE.md` + release slice + public sections of `README.md` |
| README, repository policy, branch, commit, push, or Git-only work | `CURRENT_STATE.md` + `REPOSITORY_WORKFLOW.md` + files being changed |

`IMPLEMENTATION_PLAN.md` is a stable sequence, not a progress log. Read the active slice first and adjacent slices only when their boundary matters. Read an entire authoritative contract when changing its domain, not scattered search excerpts.

Document ownership resolves overlap: `PRODUCT.md` owns player intent; `CHAMPION_DATA.md` owns kit compatibility; `ARCHITECTURE.md` owns system boundaries; `IMPLEMENTATION_PLAN.md` owns sequence and acceptance criteria; `CURRENT_STATE.md` reports facts but cannot change a contract. If sources conflict, identify and resolve the durable documents rather than silently choosing.

## Current-State Maintenance

Update `CURRENT_STATE.md` in the same change whenever any of these changes:

- Current milestone, active slice, or immediate next action
- What actually runs, ships, or has been verified
- Supported commands, environments, deployment URL, or champion snapshot
- A material product/architecture decision or a new blocker
- Test status that affects the next agent's work

Keep it under 500 words. Replace stale facts instead of appending a diary. Record only verified state, link to the owning document for detail, and update its date. Before handoff, explicitly ask: **Would a new agent start the wrong work from `CURRENT_STATE.md`?** If yes, update it.

## Product Invariants

These are non-negotiable unless the user explicitly revises the product:

- The six slots are `Body`, `Q`, `W`, `E`, `R`, and `Passive`.
- A run has six offers and locks one remaining slot from each.
- Locks are irreversible; there are no skips or rerolls.
- A base champion cannot repeat in a run, including through another draft variant.
- Rounds one through five must offer at least two selectable components.
- Every selectable choice shown before the final round must retain a legal path to completion.
- The final round may be forced but cannot be impossible.
- Build strength has no automated score.
- Solo play is untimed.
- Multiplayer uses one global synchronized deadline per phase and server-authoritative state.
- Same Champs is the default multiplayer mode; Random Champs is the alternative.
- Initial releases require no account and collect no behavioural product analytics.

## Champion-Data Rules

- Never fetch mutable champion data at gameplay runtime. Use an immutable validated snapshot.
- Never invent ability values, patch status, dependencies, or Riot policy claims.
- Data Dragon is source material, not the BuildChamp domain model. Normalize and validate it at the import boundary.
- Never edit generated snapshots by hand. Change the importer or compatibility manifest and regenerate.
- Ordinary mana and energy costs are ignored. Health costs remain.
- A component may carry mechanics required for itself but cannot create, replace, or overwrite another selected slot.
- Unavailable components stay visible with a concise reason and are never selectable.
- Apply the documented Aphelios, Jayce, and Hwei rulings exactly.
- Variants share their base champion's probability and no-repeat identity.
- Add source notes and a regression test with every new compatibility exception.
- Prefer disabling a specific component over excluding an entire champion when the remaining choices stay meaningful.

Unknown exceptions are expected. Follow the review process in `CHAMPION_DATA.md`; do not improvise a broad rule from one unusual champion.

## Architecture Boundaries

- Keep the draft engine deterministic and independent of React, DOM APIs, storage, networking, and Cloudflare types.
- Inject randomness so domain tests can reproduce any run.
- Validate all external boundaries with Zod: imported data, URL payloads, local storage, HTTP input, and WebSocket messages.
- Solo gameplay must remain client-side and usable without a backend.
- Confine Cloudflare-specific code to the Worker/transport layer.
- Multiplayer uses one Durable Object as the sole authoritative owner for each lobby.
- Send absolute deadlines; never implement per-second server countdown broadcasts.
- Use Durable Object WebSocket hibernation and persist only semantic state transitions.
- Send role-specific state projections. Never expose hidden picks, reconnect tokens, or complete internal lobby state to public clients.
- Version persisted state, share payloads, champion snapshots, and network protocol envelopes.
- Treat nicknames, links, local storage, network messages, and imported content as untrusted.

## UI and Content Rules

- Use BuildChamp's original identity. Do not reproduce the League client or use Riot/League logos as project branding.
- Aim for U.GG-level clarity and polish with Jackbox-like room entry, pacing, reveal, and voting.
- Prioritize champion artwork and the next meaningful choice over dense statistics.
- Render user-controlled strings as text, never raw HTML.
- Do not rely on color, motion, or sound alone to communicate state.
- Support keyboard operation, visible focus, accessible names, reduced motion, and practical mobile touch targets.
- Sound starts only after interaction and respects the persistent mute preference.
- Initial product copy is English-only. Do not add a partial localization framework without a demonstrated need.
- Use default champion artwork only in the initial release.
- Preserve Riot attribution and non-endorsement copy in user-visible surfaces where required.

## Implementation Workflow

For each requested slice:

1. Read `CURRENT_STATE.md`, confirm the worktree state, and preserve unrelated user changes.
2. Read the active slice and only the contracts routed above.
3. State assumptions only when documentation does not already settle them.
4. Implement the smallest complete vertical behaviour that satisfies the acceptance criteria.
5. Add or update tests in the same change.
6. Run the narrowest relevant checks first, then the full available verification suite.
7. Review the diff for generated artifacts, hidden-information leaks, copied branding, and undocumented rule changes.
8. Update `CURRENT_STATE.md` when required and update durable contracts only when their decisions change.

Do not mark placeholder data or a mocked multiplayer path as complete. Clearly label fixtures and temporary UI.

## Expected Commands

No commands are authoritative until Slice 1 creates `package.json` and the lockfile. After scaffolding, expose and keep these conventional root scripts working:

- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

Agents must inspect `package.json` rather than assume a script or tool exists. Use the repository's pinned package manager and lockfile. Do not introduce a second package manager.

## Testing Expectations

- Test domain invariants with seeded and property-based generation.
- Add regression coverage for every champion compatibility exception.
- Test share payload round trips against their pinned snapshots.
- Test corrupt local storage and malformed external input.
- Test keyboard and reduced-motion behaviour for core solo play.
- For multiplayer, test authorization, idempotency, deadlines, reconnect, host migration, hidden projections, expiry, and both champion modes.
- Do not weaken or delete a failing test merely to make a change pass.

If a required test cannot run, report the exact command and reason rather than describing the work as verified.

## Git and README Minimum

Editing does not authorize creating branches, committing, pushing, opening pull requests, tagging, or rewriting history. Those actions require explicit user authorization. Always inspect `git status --short --branch`, preserve user changes, stage explicit task paths, verify the staged diff and checks, never force-push, and report exact repository status at handoff.

For any branch, stage, commit, push, release, or README task, read and follow `REPOSITORY_WORKFLOW.md`. Update `README.md` only when verified public behaviour, setup, commands, repository navigation, policy, or release status changes.

## Repository Hygiene

- Do not broadly ignore `.impeccable/`, `.agents/`, `.codex/`, or other agent-development directories. Retain meaningful design and provenance artifacts, but respect the tools' default exclusions for transient logs, caches, sessions, and machine-local state unless the user explicitly asks otherwise.
- Do not commit secrets, Cloudflare credentials, local environment values, coverage output, build artifacts, or dependency directories.
- Do not choose or add a license without the maintainer's explicit decision.
- Do not add accounts, analytics, advertising, monetization, chat, skins, public rankings, or user-generated content while they remain deferred.
- Preserve historical champion snapshots referenced by share links unless legal or security requirements demand removal.
- Do not claim Riot endorsement or describe a Data Dragon snapshot as live without verifying its actual version.
- Do not publicly deploy Riot data or assets until the maintainer has confirmed policy eligibility and completed required Riot Developer Portal registration. Local implementation does not imply approval.

## Agentic AI Transparency

This project openly uses agentic AI. Do not remove or dilute the disclosure in `README.md`. AI-generated code, research, gameplay facts, and documentation require the same review and verification as any other untrusted contribution. When an agent materially changes a rule or architecture decision, make that change easy for the maintainer to identify.
