# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, React, and Vite. Development and validation are local-first. The initial deployment target is Cloudflare Workers Free: static assets for the solo client, followed by a Worker and one SQLite-backed Durable Object per multiplayer lobby.

## Users

League of Legends players and friend groups looking for a quick, anonymous party-game experience built around champion knowledge, drafting judgment, and debate.

## Product Purpose

The product presents a sequence of randomly selected League of Legends champions. For each champion, the player assigns one available component—Body, Q, W, E, R, or Passive—to a new composite champion. Choices can be made in any order and become permanent once locked. The immediate goal is to assemble the strongest possible champion; the social goal is to share, compare, rank, and argue about builds.

Success means a player can understand the premise immediately, finish a run without an account, and feel compelled to share the resulting build or play again.

## Positioning

Unlike a generic random champion generator or tier-list maker, the game creates irreversible, slot-by-slot drafting tension: every revealed champion forces a judgment about which part is worth claiming and which future possibilities the player is giving up.

## Operating Context

The initial experience is a short browser game suitable for solo play, streams, Discord calls, and in-person friend groups. The first shippable experience is an untimed solo randomizer. Private link-based lobbies follow as the multiplayer layer: a host creates a room, friends join with temporary nicknames, everyone drafts through synchronized rounds, then the lobby reveals and votes on its completed builds together. The core loop is anonymous and requires no account. Account-backed profiles and persistent progression may be added later without becoming prerequisites for the core game.

## Capabilities and Constraints

- Six build slots: Body, Q, W, E, R, and Passive.
- A run contains exactly six champion reveals, one per round. Every reveal must contribute exactly one remaining slot; there are no skips or rerolls.
- Slots may be filled in any order; a locked choice cannot be undone.
- Body provides base statistics, attack range/type, movement, appearance, and animations, but not a primary resource system. Normal mana and energy costs are ignored; health costs remain. Charges and self-contained secondary mechanics travel with their component. Component portability is recorded explicitly.
- The first shippable MVP is an untimed solo randomizer with local session recovery, a copyable result summary, and immediate fresh runs. It needs no nickname, lobby, voting, or server persistence.
- Champion data should track the current live League of Legends patch where practical. Releases use a controlled, validated Data Dragon snapshot rather than fetching mutable live data at runtime.
- Official champion icons and artwork may be used only in accordance with Riot Games' applicable community-content and asset-use policies.
- The launch experience is anonymous; account functionality is deferred.
- Multiplayer follows the solo release and prioritizes shareable private-lobby links, synchronized room state, temporary nicknames, a group reveal, and in-lobby voting.
- Hosts choose Same Champs or Random Champs in the waiting lobby; Same Champs is the default. Champion offers are selected adaptively each round using every player's remaining slots and component eligibility. Rematches always use fresh champions.
- Multiplayer uses synchronized rounds with host-selected 15-, 30-, or 45-second presets; 30 seconds is the default. A round advances when everyone locks or its timer expires. Timeout makes a random compatible pick.
- Lobbies support 2–8 drafting players, up to 20 spectators, and one shared display connection. At least two ready players are required to start; late arrivals become spectators and may vote.
- The lightweight Jackbox-inspired shared display shows room and QR joining, timers, player progress, current champion offers, reveals, voting, and results. In Random Champs it shows each player's current champion. Locked component choices remain private until the reveal.
- Voting is a secret single ballot with no self-voting. Quick, Standard, and Relaxed lobbies use 20-, 30-, and 45-second voting timers respectively; voting ends early when all connected voters lock, non-voters abstain, and ties are shared victories.
- Disconnected players remain in the draft and receive random timeout picks. A private reconnect token restores them; host control migrates to the longest-connected active player. Their completed builds remain eligible for reveal and voting.
- Anonymous lobby state expires after one hour of inactivity.
- Temporary nicknames are 2–16 visible characters, escaped as text, basic profanity-filtered, and automatically suffixed on collision. Hosts may remove participants. The MVP has no chat, custom build names, captions, or manual renaming.
- Solo results receive clean, stable shareable URLs. Each result pins its champion-data version so old links can continue rendering against historical snapshots while that snapshot remains available. Initial social previews use generic BuildChamp branding rather than dynamically generated build cards.
- A later public mode may use anonymous head-to-head community votes—“Which champion wins?”—to produce rankings without pretending there is an objective power formula.
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

- Solo play is untimed. Multiplayer draft and voting timers use the host-selected speed preset.
- Multiplayer reveals are staged by default, approximately six seconds per player with host advance. Hosts may instead select an All at Once reveal.
- Sound is part of the initial experience. Solo uses restrained cues for reveal, lock, completion, and sharing. Multiplayer participant devices remain subtle while the shared display may use stronger timer, reveal, vote, and winner cues.
- Audio begins only after user interaction, includes a persistent mute preference, has no background music, and must never carry information that is unavailable visually.

## Brand Commitments

The product name is **BuildChamp**. Its logo and identity must be original and must not use Riot or League of Legends logos or imply official affiliation. The experience should feel like an online randomiser game made specifically for League of Legends players. Use the familiar conventions of a polished gaming companion interface without copying the League client or becoming a build calculator. U.GG is the craft benchmark for clarity and finish, while Jackbox Games—especially Quiplash—is the benchmark for room joining, social pacing, shared reveals, and voting. BuildChamp should be considerably lighter and faster to enter than a stats tool.

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
