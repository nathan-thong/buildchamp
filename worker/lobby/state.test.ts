import { describe, expect, it } from 'vitest';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../../src/data/runtime-snapshot.ts';
import {
  createSeededRandom,
  generateSharedOffers,
  lockSelection,
  restoreDraftingRun,
  selectionForSlot,
  serializeDraftingRun,
} from '../../src/domain/draft-engine.ts';
import {
  addLobbyParticipant,
  connectLobbyParticipant,
  createLobbyState,
  disconnectLobbyParticipant,
  handleLobbyCommand,
  isLobbyExpired,
  projectLobby,
  validateNickname,
  type LobbyCommandResult,
} from './state.ts';
import {
  ClientCommandSchema,
  LobbyStateSchema,
  type ClientCommand,
  type LobbyState,
} from './schemas.ts';

const SNAPSHOT = BUNDLED_CHAMPION_SNAPSHOT;
const TOKEN_HASH = 'a'.repeat(64);

describe('lobby state', () => {
  it('requires two ready players, then starts every joined player seat', () => {
    let state = createRoom(3);
    state = markReady(state, 1, 'host-ready', 100);
    state = markReady(state, 2, 'player-ready', 101);

    const result = startLobby(state, 1, 'start', 102);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.phase).toBe('drafting');
    expect(Object.keys(result.state.draftsByParticipantId)).toEqual([id(1), id(2), id(3)]);
    expect(result.state.participants.find((participant) => participant.id === id(3))?.role).toBe(
      'player',
    );
    expect(result.state.participants.find((participant) => participant.id === id(3))?.ready).toBe(
      false,
    );
  });

  it('rejects start until at least two drafting players are ready', () => {
    const result = startLobby(createRoom(2), 1, 'early-start', 100);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('not_enough_ready_players');
    expect(result.state.phase).toBe('waiting');
  });

  it('keeps late arrivals as spectators after drafting starts', () => {
    let state = createRoom(2);
    state = markReady(state, 1, 'host-ready', 100);
    state = markReady(state, 2, 'player-ready', 101);
    const started = startLobby(state, 1, 'start', 102);
    if (!started.ok) throw new Error('Expected the draft to start.');

    const joined = addLobbyParticipant(started.state, {
      protocolVersion: 1,
      participantId: id(3),
      nickname: 'Late arrival',
      requestedRole: 'player',
      reconnectTokenHash: TOKEN_HASH,
      now: 103,
    });
    expect(joined.participant.role).toBe('spectator');
    expect(joined.state.draftsByParticipantId[id(3)]).toBeUndefined();
  });

  it('enforces the player, spectator and shared-display limits', () => {
    let state = createRoom(8);
    const fullPlayerRequest = addLobbyParticipant(state, {
      protocolVersion: 1,
      participantId: id(20),
      nickname: 'Overflow player',
      requestedRole: 'player',
      reconnectTokenHash: 'd'.repeat(64),
      now: 100,
    });
    expect(fullPlayerRequest.participant.role).toBe('spectator');
    state = fullPlayerRequest.state;

    const display = addLobbyParticipant(state, {
      protocolVersion: 1,
      participantId: id(21),
      requestedRole: 'display',
      reconnectTokenHash: 'e'.repeat(64),
      now: 101,
    });
    expect(() =>
      addLobbyParticipant(display.state, {
        protocolVersion: 1,
        participantId: id(22),
        requestedRole: 'display',
        reconnectTokenHash: 'f'.repeat(64),
        now: 102,
      }),
    ).toThrow(/shared display/i);
    state = display.state;

    for (let index = 0; index < 19; index += 1) {
      state = addLobbyParticipant(state, {
        protocolVersion: 1,
        participantId: id(30 + index),
        nickname: `Watcher ${index}`,
        requestedRole: 'spectator',
        reconnectTokenHash: 'e'.repeat(64),
        now: 110 + index,
      }).state;
    }
    expect(() =>
      addLobbyParticipant(state, {
        protocolVersion: 1,
        participantId: id(60),
        nickname: 'Last watcher',
        requestedRole: 'spectator',
        reconnectTokenHash: 'f'.repeat(64),
        now: 140,
      }),
    ).toThrow(/spectator limit/i);
    expect(LobbyStateSchema.safeParse(state).success).toBe(true);
    expect(LobbyStateSchema.safeParse({ ...state, schemaVersion: 99 }).success).toBe(false);
  });

  it('suffixes colliding nicknames and lets only the host remove participants', () => {
    const state = createRoom(2);
    const joined = addLobbyParticipant(state, {
      protocolVersion: 1,
      participantId: id(3),
      nickname: 'Player 2',
      requestedRole: 'spectator',
      reconnectTokenHash: 'b'.repeat(64),
      now: 300,
    });
    expect(joined.participant.nickname).toBe('Player 2 (2)');

    const command = ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: 'remove-player',
      roomRevision: joined.state.revision,
      type: 'host.remove',
      payload: { participantId: id(2) },
    });
    const removed = handleLobbyCommand(
      joined.state,
      { participantId: id(1), connectionId: id(101) },
      command,
      { now: 301, snapshot: SNAPSHOT, random: createSeededRandom(1) },
    );
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.removedParticipantId).toBe(id(2));
      expect(removed.state.participants.some((participant) => participant.id === id(2))).toBe(
        false,
      );
    }

    const nonHostCommand = ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: 'non-host-remove',
      roomRevision: joined.state.revision,
      type: 'host.remove',
      payload: { participantId: id(3) },
    });
    const denied = handleLobbyCommand(
      joined.state,
      { participantId: id(2), connectionId: id(102) },
      nonHostCommand,
      { now: 302, snapshot: SNAPSHOT, random: createSeededRandom(1) },
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('unauthorized');
  });

  it('records successful command IDs and acknowledges duplicate delivery idempotently', () => {
    const state = createRoom(2);
    const command = readyCommand('same-command', state.revision, true);
    const actor = { participantId: id(1), connectionId: id(101) };
    const context = { now: 200, snapshot: SNAPSHOT, random: createSeededRandom(3) };
    const first = handleLobbyCommand(state, actor, command, context);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = handleLobbyCommand(first.state, actor, command, context);
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) return;
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.state.revision).toBe(first.state.revision);
    expect(duplicate.appliedRevision).toBe(first.appliedRevision);
  });

  it('rejects stale revisions and prevents non-host settings changes', () => {
    const state = createRoom(2);
    const stale = handleLobbyCommand(
      state,
      { participantId: id(2), connectionId: id(102) },
      readyCommand('stale', state.revision - 1, true),
      { now: 200, snapshot: SNAPSHOT, random: createSeededRandom(1) },
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe('stale_revision');

    const settings = handleLobbyCommand(
      state,
      { participantId: id(2), connectionId: id(102) },
      settingsCommand('settings', state.revision, 'random'),
      { now: 201, snapshot: SNAPSHOT, random: createSeededRandom(1) },
    );
    expect(settings.ok).toBe(false);
    if (!settings.ok) expect(settings.code).toBe('unauthorized');
  });

  it('migrates the host to the longest-connected player when the host disconnects', () => {
    const state = createRoom(3);
    const disconnected = disconnectLobbyParticipant(state, id(1), id(101), 300);
    expect(disconnected.hostParticipantId).toBe(id(2));
    expect(disconnected.participants.find((participant) => participant.id === id(1))?.role).toBe(
      'player',
    );
    expect(disconnected.participants.find((participant) => participant.id === id(2))?.role).toBe(
      'host',
    );
  });

  it('projects only each random-mode player offer and keeps credentials and picks private', () => {
    let state = createRoom(2);
    const settings = handleLobbyCommand(
      state,
      { participantId: id(1), connectionId: id(101) },
      settingsCommand('random-mode', state.revision, 'random'),
      { now: 300, snapshot: SNAPSHOT, random: createSeededRandom(4) },
    );
    if (!settings.ok) throw new Error('Expected host settings to apply.');
    state = settings.state;
    state = markReady(state, 1, 'host-ready', 301);
    state = markReady(state, 2, 'player-ready', 302);
    const started = startLobby(state, 1, 'start', 303);
    if (!started.ok) throw new Error('Expected the draft to start.');
    state = started.state;

    const hostProjection = projectLobby(state, { role: 'host', participantId: id(1) }, SNAPSHOT);
    const playerProjection = projectLobby(
      state,
      { role: 'player', participantId: id(2) },
      SNAPSHOT,
    );
    const hostOfferId =
      hostProjection.offer && 'id' in hostProjection.offer ? hostProjection.offer.id : undefined;
    const playerOfferId =
      playerProjection.offer && 'id' in playerProjection.offer
        ? playerProjection.offer.id
        : undefined;
    expect(hostOfferId).toBeTruthy();
    expect(playerOfferId).toBeTruthy();
    expect(hostOfferId).not.toBe(playerOfferId);
    expect(JSON.stringify(hostProjection)).not.toContain(TOKEN_HASH);
    expect(JSON.stringify(hostProjection)).not.toContain('draftsByParticipantId');
    expect(JSON.stringify(hostProjection)).not.toContain('reconnectTokenHash');
    expect(JSON.stringify(playerProjection)).not.toContain(hostOfferId as string);

    const spectator = addLobbyParticipant(state, {
      protocolVersion: 1,
      participantId: id(3),
      nickname: 'Watcher',
      requestedRole: 'spectator',
      reconnectTokenHash: 'b'.repeat(64),
      now: 304,
    });
    const spectatorProjection = projectLobby(
      spectator.state,
      { role: 'spectator', participantId: id(3) },
      SNAPSHOT,
    );
    expect(spectatorProjection.offer).toBeUndefined();
    expect(JSON.stringify(spectatorProjection)).not.toContain(hostOfferId as string);
    expect(JSON.stringify(spectatorProjection)).not.toContain('b'.repeat(64));
  });

  it('shows the shared display only the current shared champion identity', () => {
    let state = createRoom(2);
    state = markReady(state, 1, 'host-ready', 400);
    state = markReady(state, 2, 'player-ready', 401);
    const started = startLobby(state, 1, 'start', 402);
    if (!started.ok) throw new Error('Expected the draft to start.');
    const display = addLobbyParticipant(started.state, {
      protocolVersion: 1,
      participantId: id(3),
      requestedRole: 'display',
      reconnectTokenHash: 'c'.repeat(64),
      now: 403,
    });
    const projection = projectLobby(
      display.state,
      { role: 'display', participantId: id(3) },
      SNAPSHOT,
    );
    expect(projection.offersByPlayer).toBeUndefined();
    expect(projection.offer).toHaveProperty('champion.id');
    expect(projection.offer).not.toHaveProperty('variant');
    expect(projection.offer).not.toHaveProperty('components');
    expect(projection.offer).not.toHaveProperty('selectableSlots');
    for (const playerOffer of projection.offersByPlayer ?? []) {
      expect(Object.keys(playerOffer.offer)).toEqual(['champion']);
    }
    expect(JSON.stringify(projection)).not.toContain('c'.repeat(64));
  });

  it.each(['same', 'random'] as const)(
    'keeps different prior lock histories private from the %s shared display',
    (mode) => {
      let state = createRoom(2);
      if (mode === 'random') {
        const settings = handleLobbyCommand(
          state,
          { participantId: id(1), connectionId: id(101) },
          settingsCommand('privacy-mode', state.revision, 'random'),
          { now: 500, snapshot: SNAPSHOT, random: createSeededRandom(50) },
        );
        if (!settings.ok) throw new Error('Expected Random Champs settings to apply.');
        state = settings.state;
      }

      state = markReady(state, 1, 'privacy-host-ready', 501);
      state = markReady(state, 2, 'privacy-player-ready', 502);
      const started = startLobby(state, 1, 'privacy-start', 503);
      if (!started.ok) throw new Error('Expected the draft to start.');
      state = started.state;

      let drafts = [id(1), id(2)].map((participantId) =>
        restoreDraftingRun(SNAPSHOT, state.draftsByParticipantId[participantId]!),
      );
      const lockedSlotsByPlayer: string[][] = [[], []];

      for (let roundIndex = 0; roundIndex < 2; roundIndex += 1) {
        const firstDraft = drafts[0];
        const secondDraft = drafts[1];
        if (!firstDraft || !secondDraft) throw new Error('Expected both player drafts.');

        if (mode === 'same') {
          const sharedOffers = generateSharedOffers(
            SNAPSHOT,
            drafts,
            createSeededRandom(510 + roundIndex),
          );
          drafts = drafts.map((draft, index) => {
            const offer = sharedOffers[index];
            if (!offer) throw new Error('Expected a shared offer for each player.');
            return { ...draft, offer };
          });
        }

        const currentFirst = drafts[0];
        const currentSecond = drafts[1];
        if (!currentFirst || !currentSecond) throw new Error('Expected both current drafts.');

        const firstSlot = currentFirst.offer.selectableSlots.find(
          (slot) => !lockedSlotsByPlayer[0]?.includes(slot),
        );
        if (!firstSlot) throw new Error('Expected an open slot for the host.');
        const secondSlot = currentSecond.offer.selectableSlots.find(
          (slot) =>
            !lockedSlotsByPlayer[1]?.includes(slot) &&
            (roundIndex === 0 || ![...(lockedSlotsByPlayer[0] ?? []), firstSlot].includes(slot)),
        );
        if (!secondSlot) throw new Error('Expected a distinct open slot for the player.');

        const selectedSlots = [firstSlot, secondSlot];
        drafts = drafts.map((draft, index) => {
          const selectedSlot = selectedSlots[index];
          if (!selectedSlot) throw new Error('Expected a selected slot for each player.');
          lockedSlotsByPlayer[index]?.push(selectedSlot);
          const updated = lockSelection(
            SNAPSHOT,
            draft,
            selectionForSlot(draft.offer, selectedSlot),
            createSeededRandom(520 + roundIndex * 10 + index),
          );
          if (updated.status !== 'drafting') throw new Error('Expected a drafting run.');
          return updated;
        });
      }

      if (mode === 'same') {
        const sharedOffers = generateSharedOffers(SNAPSHOT, drafts, createSeededRandom(540));
        drafts = drafts.map((draft, index) => {
          const offer = sharedOffers[index];
          if (!offer) throw new Error('Expected a shared offer for each player.');
          return { ...draft, offer };
        });
      }

      expect(lockedSlotsByPlayer[0]).not.toEqual(lockedSlotsByPlayer[1]);
      state = LobbyStateSchema.parse({
        ...state,
        revision: state.revision + 1,
        draftsByParticipantId: Object.fromEntries(
          [id(1), id(2)].map((participantId, index) => {
            const draft = drafts[index];
            if (!draft) throw new Error('Expected a persisted player draft.');
            return [participantId, serializeDraftingRun(draft)];
          }),
        ),
      });

      const display = addLobbyParticipant(state, {
        protocolVersion: 1,
        participantId: id(3),
        requestedRole: 'display',
        reconnectTokenHash: 'c'.repeat(64),
        now: 550,
      });
      const projection = projectLobby(
        display.state,
        { role: 'display', participantId: id(3) },
        SNAPSHOT,
      );

      expect(projection.currentRound).toBe(3);
      if (mode === 'same') {
        expect(projection.offer).toHaveProperty('champion.id');
        expect(projection.offer).not.toHaveProperty('variant');
        expect(projection.offer).not.toHaveProperty('components');
        expect(projection.offer).not.toHaveProperty('selectableSlots');
        expect(projection.offersByPlayer).toBeUndefined();
      } else {
        expect(projection.offer).toBeUndefined();
        expect(projection.offersByPlayer).toHaveLength(2);
      }
      for (const playerOffer of projection.offersByPlayer ?? []) {
        expect(Object.keys(playerOffer.offer)).toEqual(['champion']);
      }
      expect(projection).not.toHaveProperty('picks');
      expect(projection).not.toHaveProperty('lockedBuild');
      expect(projection).not.toHaveProperty('selectedSlots');
      expect(JSON.stringify(projection)).not.toContain('draftsByParticipantId');
    },
  );

  it('normalizes nicknames, rejects control characters and blocks plain profanity', () => {
    expect(validateNickname('  Jay  ')).toBe('Jay');
    expect(() => validateNickname('A\nB')).toThrow(/control characters/i);
    expect(() => validateNickname('Fuck You')).toThrow(/profanity/i);
    expect(() => validateNickname('x')).toThrow(/2–16/i);
  });

  it('expires rooms after one hour of inactivity', () => {
    const state = createRoom(2);
    expect(isLobbyExpired(state, state.expiresAt - 1)).toBe(false);
    expect(isLobbyExpired(state, state.expiresAt)).toBe(true);
  });
});

function createRoom(playerCount: number): LobbyState {
  let state = createLobbyState({
    roomCode: 'ABC234',
    snapshotVersion: SNAPSHOT.dataDragonVersion,
    hostParticipantId: id(1),
    hostNickname: 'Host one',
    reconnectTokenHash: TOKEN_HASH,
    now: 10,
  });
  state = connectLobbyParticipant(state, id(1), id(101), 20);
  for (let participant = 2; participant <= playerCount; participant += 1) {
    const added = addLobbyParticipant(state, {
      protocolVersion: 1,
      participantId: id(participant),
      nickname: `Player ${participant}`,
      requestedRole: 'player',
      reconnectTokenHash: participant.toString(16).repeat(64),
      now: 20 + participant,
    });
    state = connectLobbyParticipant(
      added.state,
      id(participant),
      id(100 + participant),
      20 + participant,
    );
  }
  return state;
}

function markReady(
  state: LobbyState,
  participant: number,
  commandId: string,
  now: number,
): LobbyState {
  const actor = state.participants.find((candidate) => candidate.id === id(participant));
  if (!actor?.connectionId) throw new Error(`Participant ${participant} is not connected.`);
  const result = handleLobbyCommand(
    state,
    { participantId: actor.id, connectionId: actor.connectionId },
    readyCommand(commandId, state.revision, true),
    { now, snapshot: SNAPSHOT, random: createSeededRandom(now) },
  );
  if (!result.ok) throw new Error(`Readiness failed: ${result.code}`);
  return result.state;
}

function startLobby(
  state: LobbyState,
  participant: number,
  commandId: string,
  now: number,
): LobbyCommandResult {
  const actor = state.participants.find((candidate) => candidate.id === id(participant));
  if (!actor?.connectionId) throw new Error(`Participant ${participant} is not connected.`);
  return handleLobbyCommand(
    state,
    { participantId: actor.id, connectionId: actor.connectionId },
    ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId,
      roomRevision: state.revision,
      type: 'host.start',
      payload: {},
    }),
    { now, snapshot: SNAPSHOT, random: createSeededRandom(now) },
  );
}

function readyCommand(commandId: string, roomRevision: number, ready: boolean): ClientCommand {
  return ClientCommandSchema.parse({
    protocolVersion: 1,
    commandId,
    roomRevision,
    type: 'player.ready',
    payload: { ready },
  });
}

function settingsCommand(
  commandId: string,
  roomRevision: number,
  mode: 'same' | 'random',
): ClientCommand {
  return ClientCommandSchema.parse({
    protocolVersion: 1,
    commandId,
    roomRevision,
    type: 'host.settings',
    payload: { mode, speed: 'standard', revealOrder: 'staged' },
  });
}

function id(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}
