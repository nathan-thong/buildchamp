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
- [x] Confirm the current app makes no Data Dragon network request at runtime; gameplay wiring is
      deferred to Slice 3/4 and the importer is build-only.
- [x] Retain the existing 15.17.1 snapshot alongside the new 16.17.1 snapshot.

Local verification recorded 2026-09-05: 173 champions imported from Data Dragon 16.17.1, 172
eligible and Aphelios excluded; 27 automated tests and 5 browser journeys passed.

## Riot policy and asset gate

- [ ] Confirm BuildChamp is eligible under Riot Games' then-current policies.
- [ ] Complete Riot Developer Portal registration and any required application registration before
      public release.
- [ ] Confirm the release uses only approved default champion data, icons, and artwork; no skins,
      community-uploaded imagery, or unreviewed assets are included.
- [ ] Confirm every player-visible surface includes the required Riot non-endorsement notice.
- [ ] If Riot assets are shipped, include the applicable Legal Jibber Jabber notice and verify its
      placement is conspicuous and readable.
- [ ] Confirm the product does not imply Riot sponsorship, endorsement, operation, or affiliation.
- [ ] Record the policy review and registration evidence with the release decision.

## Public-release stop condition

Do not publish a release containing Riot data or assets while any Riot policy, registration, notice,
or asset-eligibility checkbox above remains unchecked. Local development and offline verification may
continue without implying approval.
