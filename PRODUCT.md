# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, React, and Vite. Development and validation are local-first. The initial deployment target is Cloudflare Workers Free: static assets for the solo client, followed by a Worker and one SQLite-backed Durable Object per multiplayer lobby.

## Users

League of Legends players and friend groups who want to draft hypothetical champions, compare their builds, and vote on their favourites.

## Product Purpose

BuildChamp is an unofficial, non-commercial party game about building a hypothetical champion from League of Legends parts. A solo run has six rounds. Each round reveals a random champion, and the player permanently locks one remaining component—Body, Q, W, E, R, or Passive—from that champion. The finished build can be shared and argued over with friends. Planned private lobbies will let friends draft together or separately, reveal their builds, and vote to rank them. BuildChamp never assigns an automated power score.

Success means a player can understand the rules immediately and complete and share a build without an account. Planned group play should make it easy to compare and rank builds through votes with friends.

## Positioning

The fun comes from making consequential choices with unexpected champion offers, then defending the resulting build. Every round contributes one part to a six-slot champion. The finished build is easy to inspect and share; planned private lobbies add group reveals and voting.

## Operating Context

The first release is an untimed solo browser game that can be screen-shared with friends. A player drafts through six rounds and shares the result. Planned private link-based lobbies add multiplayer: a host creates a room, friends join with temporary nicknames, participants draft through synchronized rounds, then reveal and vote on completed builds. The core game is anonymous and requires no account. Account-backed profiles and persistent build history may be added later without becoming prerequisites.

## Capabilities and Constraints

- Six build slots: Body, Q, W, E, R, and Passive.
- A run contains exactly six champion reveals, one per round. Every reveal must contribute exactly one remaining slot; there are no skips or rerolls.
- Slots may be filled in any order; a locked choice cannot be undone.
- Body provides base statistics, attack range/type, movement, appearance, and animations, but not a primary resource system. Normal mana and energy costs are ignored; health costs remain. Charges and self-contained secondary mechanics travel with their component. Component portability is recorded explicitly.
- The first shippable MVP is an untimed solo draft with local session recovery, a copyable result summary, and immediate rematches. It needs no nickname, lobby, voting, or server persistence.
- Champion data should track the current live League of Legends patch where practical. Releases use a controlled, validated Data Dragon snapshot rather than fetching mutable live data at runtime.
- Official champion icons and artwork may be used only in accordance with Riot Games' applicable community-content and asset-use policies.
- The launch experience is anonymous; account functionality is deferred.
- Multiplayer follows the solo release and prioritizes shareable private lobby links, synchronized rounds, temporary nicknames, a shared reveal, and in-lobby voting.
- Hosts choose Same Champs or Random Champs in the waiting lobby; Same Champs is the default. Champion offers are selected adaptively each round using every player's remaining slots and component eligibility. Rematches always use fresh champions.
- Multiplayer uses synchronized rounds with host-selected 15-, 30-, or 45-second presets; 30 seconds is the default. A round advances when everyone locks or its timer expires. Timeout makes a random compatible pick.
- Lobbies support 2–8 drafting players, up to 20 spectators, and one shared display connection. At least two ready players are required to start; late arrivals become spectators and may vote.
- The lightweight Jackbox-inspired shared display shows room and QR joining, timers, player progress, current champion offers, reveals, voting, and results. In Random Champs it shows each player's current champion. Locked component choices remain private until the reveal.
- Voting is a secret single ballot with no self-voting. Quick, Standard, and Relaxed lobbies use 20-, 30-, and 45-second voting timers respectively; voting ends early when all connected voters lock, non-voters abstain, and ties are shared victories.
- Disconnected players remain in the draft and receive random timeout picks. A private reconnect token restores them; host control migrates to the longest-connected active player. Their completed builds remain eligible for reveal and voting.
- Anonymous lobby state expires after one hour of inactivity.
- Temporary nicknames are 2–16 visible characters, escaped as text, basic profanity-filtered, and automatically suffixed on collision. Hosts may remove participants. The MVP has no chat, custom build names, captions, or manual renaming.
- Solo results receive clean, stable shareable URLs. Each result pins its champion-data version so old links can continue rendering against historical snapshots while that snapshot remains available. Initial social previews use generic BuildChamp branding rather than dynamically generated build cards.
- A later public mode may use anonymous head-to-head community votes—“Which build do you prefer?”—to rank hypothetical builds without pretending there is an objective power formula.
- Initial releases have no automated power score. Build strength is intentionally decided through player judgment and conversation.
- Solo mode stores only recovery, preferences, and recent run state locally. Multiplayer state is ephemeral and server-authoritative. Initial releases collect no product analytics; operational logs may be retained only as needed to diagnose reliability and abuse.
- Initial releases are English-only and non-commercial.
- Public release using Riot data or assets is gated on confirming eligibility under Riot's then-current policies, completing required Riot Developer Portal registration, and displaying the required player-visible notices. Planning and local prototyping do not imply Riot approval.
- Advanced moderation, anti-abuse controls, later rating algorithm details, account migration, and public discovery remain open product decisions.

## Draft Generation and Compatibility

- Champion offers are generated adaptively, one round at a time, from the slots still open and the compatibility of the current build. Before the final round, every offer must present at least two compatible selectable components. The final round may be forced.
- A base champion cannot appear more than once in a six-round run. A rematch creates an entirely fresh run.
- Draft variants share their base champion's random weighting and no-repeat identity. Variants must not make a champion more likely to appear.
- A component may carry self-contained mechanics required for its own operation, but it may not create, replace, or overwrite another selected Body, Q, W, E, R, or Passive slot. Components that fail this portability rule are visibly unavailable and labelled “Requires original kit.”
- Aphelios is excluded from the initial champion pool because his Body, weapons, basic abilities, and resource system cannot produce fair independent choices under the portability rule.
- Jayce is represented by Hammer and Cannon draft variants. Each exposes its form-specific Body, Q, W, and E. Jayce R and Passive are unavailable because transformation is inseparable from the paired kit.
- Hwei's Q, W, and E each include all three subspells within that category. His R is normal, and his Passive is portable.
- The initial release uses default champion artwork only.

## Reveal and Sound

- Solo play is untimed. Multiplayer drafting and voting timers use the host-selected speed preset.
- Multiplayer reveals are staged by default, approximately six seconds per player with host advance. Hosts may instead select an All at Once reveal.
- Sound is part of the initial experience. Solo uses restrained cues for reveal, lock, completion, and sharing. Multiplayer participant devices remain subtle while the shared display may use stronger timer, reveal, vote, and winner cues.
- Audio begins only after user interaction, includes a persistent mute preference, has no background music, and must never carry information that is unavailable visually.

## Brand Commitments

The product name is **BuildChamp**. Its logo and identity must be original and must not use Riot or League of Legends logos or imply official affiliation. The experience should feel like a polished, independent party game for League of Legends players. Make the draft, reveal, sharing, and voting clear and lively without copying the League client.

## Evidence on Hand

No original brand, screenshots, community proof, or product analytics exist yet. Champion facts and artwork must come from verified Riot-approved sources; future work must not fabricate patch status, ability data, player counts, rankings, or endorsements.

## Product Principles

- Reach the first meaningful decision quickly; no account or tutorial wall.
- Make every irreversible pick legible, consequential, and satisfying.
- Turn subjective power judgments into conversation rather than pretending they are objective truth.
- Keep the result easy to understand and compelling to share.
- Treat live game data and Riot attribution as product infrastructure, not decorative content.

## Accessibility & Inclusion

The game must not rely on color alone to communicate open, selected, or locked states. Champion and ability imagery needs accessible text equivalents, controls must support keyboard use, and motion must respect reduced-motion preferences.
