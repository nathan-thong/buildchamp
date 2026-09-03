# Repository Workflow

Read this document only for branch, staging, commit, push, release, README, or repository-policy work. General implementation tasks use the short safety minimum in `AGENTS.md`.

## Authorization

Editing files does not authorize creating a branch, committing, pushing, opening a pull request, tagging, deleting branches, or rewriting history. Perform those actions only when the user explicitly requests them or an active repository workflow explicitly requires them.

## Before Changes

1. Run `git status --short --branch`.
2. Treat existing modifications and untracked files as user-owned unless established otherwise.
3. Read relevant diffs before editing modified files.
4. Never automatically stash, discard, restore, or relocate user changes.
5. If required work overlaps changes of unknown intent, stop and ask.

## Branches

- Preserve the branch/worktree selected by the environment; do not switch merely for tidiness.
- When asked for a branch without a name, use `codex/<short-kebab-case-scope>`.
- Use the user-specified base. Otherwise verify the current branch and repository default; do not guess.
- Keep one coherent objective per branch. Do not mix unrelated refactors, upgrades, data refreshes, and features.
- Never reuse a branch for unrelated work or delete a branch without authorization.
- Do not merge, rebase, cherry-pick, reset, or rewrite shared history unless explicitly requested.
- Never force-push. Exceptional recovery requires explaining the exact remote/commits at risk and receiving explicit approval.

## Staging

- Inspect `git status --short` and `git diff`; stage explicit task paths.
- Avoid `git add -A` and `git add .` in a dirty worktree.
- Keep behaviour, its tests, and directly coupled documentation together.
- Keep importer, manifest, generated snapshot, and regression tests together for champion-data changes.
- Exclude secrets, environment files, caches, runtime/debug logs, coverage, build output, and debug-only screenshots. Retained `.impeccable/` provenance is allowed only after sensitive-data review.
- Inspect `git diff --cached`, run `git diff --cached --check`, and confirm the staged file list before committing.

## Commits

- Commit only after relevant checks pass or the user accepts a documented limitation.
- Make each commit independently understandable and limited to one coherent change; avoid known-broken checkpoints on review branches.
- Use concise Conventional Commit-style imperative subjects until another convention is established, for example `feat(solo): add irreversible component locking` or `fix(data): preserve Jayce variant weighting`.
- Prefer subjects under 72 characters. Use the body for motivation, trade-offs, migrations, or non-obvious verification.
- Avoid mixing formatting churn with behaviour changes.
- Never amend, squash, or alter user commits without authorization.
- Do not change Git identity or fabricate `Co-authored-by` trailers.

## Pushes

- Push only on explicit request.
- Verify remotes, current branch, upstream, outgoing commits, and worktree state first.
- Push the named feature branch, never accidental detached `HEAD` or an unintended default branch. Set an explicit upstream for a new branch after verifying the remote.
- Never use force options, mirror pushes, or tag pushes without exact authorization.
- If rejected because the remote moved, fetch and inspect; do not automatically merge or rebase unknown work.
- Report remote, branch, commit hash, checks, and remaining local changes. Never claim a pull request exists unless created.

## Handoff

1. Run applicable tests, formatting, lint, and type checks.
2. Review the final diff for scope, secrets, generated noise, and accidental deletion.
3. Update `CURRENT_STATE.md` if its facts changed.
4. Run `git status --short --branch`.
5. Report whether work is uncommitted, committed, or pushed.
6. For commits, provide hash and subject; for pushes, provide remote branch and any actual pull-request link.
7. List skipped or failing checks exactly.

## README Maintenance

`README.md` is the human entry point, not a duplicate specification. Update it in the same change when any of these change:

- Project status or milestone
- Install, development, testing, build, or deployment commands
- Required runtimes, package manager, environment variables, external services, or Cloudflare setup
- Public routes, major capabilities, release phase, or repository layout
- Documentation names/responsibilities, contribution policy, licensing, Riot attribution, non-commercial status, or AI disclosure

README updates must describe verified current behaviour, label future work as planned, copy commands from working scripts, and link to detailed contracts rather than repeat them. Do not add unverified badges, metrics, compatibility claims, deployment links, or “live patch” claims. Preserve the direct agentic-AI disclosure. Remove stale statements as soon as corresponding functionality ships.

Internal refactors need no README change unless they alter setup, commands, navigation, contributor expectations, or public behaviour.
