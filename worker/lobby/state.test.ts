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
  advanceExpiredDraftRound,
  connectLobbyParticipant,
  createLobbyState,
  disconnectLobbyParticipant,
  handleLobbyCommand,
  isLobbyExpired,
  LOBBY_SPEED_DURATIONS_MS,
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

  it.each([
    { speed: 'quick', durationMs: 15_000 },
    { speed: 'standard', durationMs: 30_000 },
    { speed: 'relaxed', durationMs: 45_000 },
  ] as const)('$speed speed sets the shared absolute draft deadline', ({ speed, durationMs }) => {
    let state = createRoom(2);
    const host = state.participants.find((participant) => participant.id === id(1));
    if (!host?.connectionId) throw new Error('Expected the host connection.');
    const settings = handleLobbyCommand(
      state,
      { participantId: host.id, connectionId: host.connectionId },
      ClientCommandSchema.parse({
        protocolVersion: 2,
        commandId: `speed-${speed}`,
        roomRevision: state.revision,
        type: 'host.settings',
        payload: { mode: 'same', speed, revealOrder: 'staged' },
      }),
      { now: 500, snapshot: SNAPSHOT, random: createSeededRandom(500) },
    );
    if (!settings.ok) throw new Error(`Expected ${speed} speed settings to apply.`);
    state = settings.state;
    state = markReady(state, 1, `${speed}-host-ready`, 600);
    state = markReady(state, 2, `${speed}-player-ready`, 601);

    const started = startLobby(state, 1, `${speed}-start`, 1_000);
    if (!started.ok) throw new Error(`Expected ${speed} speed draft to start.`);
    expect(started.state.deadlineAt).toBe(1_000 + durationMs);
  });

  it('keeps late arrivals as spectators after drafting starts', () => {
    let state = createRoom(2);
    state = markReady(state, 1, 'host-ready', 100);
    state = markReady(state, 2, 'player-ready', 101);
    const started = startLobby(state, 1, 'start', 102);
    if (!started.ok) throw new Error('Expected the draft to start.');

    const joined = addLobbyParticipant(started.state, {
      protocolVersion: 2,
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
      protocolVersion: 2,
      participantId: id(20),
      nickname: 'Overflow player',
      requestedRole: 'player',
      reconnectTokenHash: 'd'.repeat(64),
      now: 100,
    });
    expect(fullPlayerRequest.participant.role).toBe('spectator');
    state = fullPlayerRequest.state;

    const display = addLobbyParticipant(state, {
      protocolVersion: 2,
      participantId: id(21),
      requestedRole: 'display',
      reconnectTokenHash: 'e'.repeat(64),
      now: 101,
    });
    expect(() =>
      addLobbyParticipant(display.state, {
        protocolVersion: 2,
        participantId: id(22),
        requestedRole: 'display',
        reconnectTokenHash: 'f'.repeat(64),
        now: 102,
      }),
    ).toThrow(/shared display/i);
    state = display.state;

    for (let index = 0; index < 19; index += 1) {
      state = addLobbyParticipant(state, {
        protocolVersion: 2,
        participantId: id(30 + index),
        nickname: `Watcher ${index}`,
        requestedRole: 'spectator',
        reconnectTokenHash: 'e'.repeat(64),
        now: 110 + index,
      }).state;
    }
    expect(() =>
      addLobbyParticipant(state, {
        protocolVersion: 2,
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
      protocolVersion: 2,
      participantId: id(3),
      nickname: 'Player 2',
      requestedRole: 'spectator',
      reconnectTokenHash: 'b'.repeat(64),
      now: 300,
    });
    expect(joined.participant.nickname).toBe('Player 2 (2)');

    const command = ClientCommandSchema.parse({
      protocolVersion: 2,
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
      protocolVersion: 2,
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

  it('uses one absolute deadline and resolves a round once despite stale concurrent locks', () => {
    let state = createRoom(3);
    state = markReady(state, 1, 'deadline-host-ready', 600);
    state = markReady(state, 2, 'deadline-player-ready', 601);
    const started = startLobby(state, 1, 'deadline-start', 1_000);
    if (!started.ok) throw new Error('Expected the draft to start.');
    state = started.state;
    expect(state.deadlineAt).toBe(31_000);
    expect(state.draftsByParticipantId[id(3)]).toBeTruthy();
    expect(state.participants.find((participant) => participant.id === id(3))?.ready).toBe(false);

    expect(state.settings.speed).toBe('standard');
    expect(LOBBY_SPEED_DURATIONS_MS).toEqual({ quick: 15_000, standard: 30_000, relaxed: 45_000 });
    const firstOfferDraft = restoreDraftingRun(SNAPSHOT, state.draftsByParticipantId[id(1)]!);
    const firstRoundHostSlot = firstOfferDraft.offer.selectableSlots[0];
    const firstRoundPlayerSlot = firstOfferDraft.offer.selectableSlots.find(
      (slot) => slot !== firstRoundHostSlot,
    );
    if (!firstRoundHostSlot || !firstRoundPlayerSlot)
      throw new Error('Expected two first-round choices.');
    const initialRevision = state.revision;
    state = lockPlayer(state, 1, 'host-round-one', 1_100, undefined, firstRoundHostSlot);
    expect(state.revision).toBe(initialRevision + 1);
    expect(Object.keys(state.roundLocksByParticipantId)).toEqual([id(1)]);
    const hostProjection = projectLobby(state, { role: 'host', participantId: id(1) }, SNAPSHOT);
    expect(hostProjection.lockedCount).toBe(1);
    expect(
      hostProjection.participants.find(({ id: participantId }) => participantId === id(1))
        ?.lockedThisRound,
    ).toBe(true);
    expect(hostProjection.offer).toBeUndefined();
    expect(JSON.stringify(hostProjection)).not.toContain(
      state.roundLocksByParticipantId[id(1)]?.componentId ?? 'hidden-component',
    );

    // Player Two uses the revision from before the host locked; the offer and round are unchanged.
    const staleRevision = state.revision - 1;
    state = lockPlayer(state, 2, 'player-round-one', 1_101, staleRevision, firstRoundPlayerSlot);
    expect(state.phase).toBe('drafting');
    expect(Object.keys(state.roundLocksByParticipantId)).toHaveLength(2);
    // The unready third seat still participates in this started draft.
    state = lockPlayer(state, 3, 'unready-round-one', 1_102, staleRevision);
    expect(state.roundLocksByParticipantId).toEqual({});
    expect(Object.values(state.draftsByParticipantId).every((draft) => draft.round === 1)).toBe(
      true,
    );
    const currentDrafts = Object.values(state.draftsByParticipantId).map((draft) =>
      restoreDraftingRun(SNAPSHOT, draft),
    );
    expect(new Set(currentDrafts.map((draft) => draft.offer.id)).size).toBe(1);
    expect(state.deadlineAt).toBe(31_102);

    let differentSlotHistory = false;
    const firstTwoDrafts = currentDrafts.slice(0, 2);
    const firstSlot = firstTwoDrafts[0]?.offer.selectableSlots[0];
    const secondSlot = firstTwoDrafts[1]?.offer.selectableSlots.find((slot) => slot !== firstSlot);
    if (firstSlot && secondSlot) differentSlotHistory = true;
    state = lockPlayer(state, 1, 'host-round-two', 1_200, undefined, firstSlot);
    state = lockPlayer(state, 2, 'player-round-two', 1_201, state.revision - 1, secondSlot);
    state = lockPlayer(state, 3, 'unready-round-two', 1_202, state.revision - 1);
    expect(differentSlotHistory).toBe(true);

    const nextDrafts = Object.values(state.draftsByParticipantId).map((draft) =>
      restoreDraftingRun(SNAPSHOT, draft),
    );
    expect(new Set(nextDrafts.map((draft) => draft.offer.id)).size).toBe(1);
    expect(nextDrafts.every((draft) => draft.offer.selectableSlots.length >= 2)).toBe(true);
    expect(state.deadlineAt).toBe(31_202);
  });

  it('keeps a disconnected player pending, then the deadline autopicks unresolved seats once', () => {
    let state = createRoom(2);
    state = markReady(state, 1, 'disconnect-host-ready', 700);
    state = markReady(state, 2, 'disconnect-player-ready', 701);
    const started = startLobby(state, 1, 'disconnect-start', 1_000);
    if (!started.ok) throw new Error('Expected the draft to start.');
    state = started.state;

    const disconnectedState = disconnectLobbyParticipant(state, id(2), id(102), 1_100);
    expect(disconnectedState.roundLocksByParticipantId[id(2)]).toBeUndefined();
    const reconnected = connectLobbyParticipant(disconnectedState, id(2), id(202), 1_200);
    expect(reconnected.roundLocksByParticipantId[id(2)]).toBeUndefined();
    expect(
      reconnected.participants.find(({ id: participantId }) => participantId === id(2))
        ?.isConnected,
    ).toBe(true);
    const reconnectLock = lockPlayer(reconnected, 2, 'reconnect-before-deadline', 1_250);
    expect(reconnectLock.roundLocksByParticipantId[id(2)]).toBeTruthy();
    state = disconnectLobbyParticipant(disconnectedState, id(2), id(102), 1_300);
    expect(state.roundLocksByParticipantId[id(2)]).toBeUndefined();
    expect(state.deadlineAt).toBe(31_000);

    const timeoutState = advanceExpiredDraftRound(state, {
      now: state.deadlineAt as number,
      snapshot: SNAPSHOT,
      random: createSeededRandom(13),
    });
    expect(timeoutState).not.toBe(state);
    expect(timeoutState.phase).toBe('drafting');
    expect(timeoutState.roundLocksByParticipantId).toEqual({});
    expect(
      Object.values(timeoutState.draftsByParticipantId).every(
        (draft) => draft.round === 1 && draft.picks.length === 1,
      ),
    ).toBe(true);
    expect(timeoutState.deadlineAt).toBe(
      (state.deadlineAt ?? 0) + LOBBY_SPEED_DURATIONS_MS.standard,
    );
    expect(
      advanceExpiredDraftRound(timeoutState, {
        now: state.deadlineAt as number,
        snapshot: SNAPSHOT,
        random: createSeededRandom(14),
      }),
    ).toBe(timeoutState);
  });

  it('keeps final builds private after six synchronized rounds', () => {
    let state = createRoom(2);
    state = markReady(state, 1, 'complete-host-ready', 800);
    state = markReady(state, 2, 'complete-player-ready', 801);
    const started = startLobby(state, 1, 'complete-start', 1_000);
    if (!started.ok) throw new Error('Expected the draft to start.');
    state = started.state;

    for (let round = 1; round <= 6; round += 1) {
      state = lockPlayer(state, 1, `complete-host-${round}`, 1_000 + round * 2);
      state = lockPlayer(
        state,
        2,
        `complete-player-${round}`,
        1_001 + round * 2,
        state.revision - 1,
      );
    }

    expect(state.phase).toBe('draft-complete');
    expect(Object.keys(state.completedRunsByParticipantId)).toEqual([id(1), id(2)]);
    const projection = projectLobby(state, { role: 'display', participantId: null }, SNAPSHOT);
    expect(projection.currentRound).toBe(6);
    expect(projection.lockedCount).toBe(2);
    expect(projection.offer).toBeUndefined();
    expect(JSON.stringify(projection)).not.toContain('completedRunsByParticipantId');
    expect(JSON.stringify(projection)).not.toContain('lockedBuild');
    expect(JSON.stringify(projection)).not.toContain('componentId');
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
      protocolVersion: 2,
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
      protocolVersion: 2,
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
        protocolVersion: 2,
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
      protocolVersion: 2,
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

function lockPlayer(
  state: LobbyState,
  participant: number,
  commandId: string,
  now: number,
  roomRevision = state.revision,
  slot?: ReturnType<typeof restoreDraftingRun>['offer']['selectableSlots'][number],
): LobbyState {
  const actor = state.participants.find((candidate) => candidate.id === id(participant));
  if (!actor?.connectionId) throw new Error(`Participant ${participant} is not connected.`);
  const persisted = state.draftsByParticipantId[actor.id];
  if (!persisted) throw new Error(`Participant ${participant} has no active draft.`);
  const draft = restoreDraftingRun(SNAPSHOT, persisted);
  const selectedSlot = slot ?? draft.offer.selectableSlots[0];
  if (!selectedSlot) throw new Error('The current offer has no selectable slot.');
  const command = ClientCommandSchema.parse({
    protocolVersion: 2,
    commandId,
    roomRevision,
    type: 'player.lock',
    payload: {
      round: draft.round + 1,
      selection: selectionForSlot(draft.offer, selectedSlot),
    },
  });
  const result = handleLobbyCommand(
    state,
    { participantId: actor.id, connectionId: actor.connectionId },
    command,
    { now, snapshot: SNAPSHOT, random: createSeededRandom(now + participant) },
  );
  if (!result.ok) throw new Error(`Lock failed: ${result.code} ${result.message}`);
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
      protocolVersion: 2,
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
    protocolVersion: 2,
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
    protocolVersion: 2,
    commandId,
    roomRevision,
    type: 'host.settings',
    payload: { mode, speed: 'standard', revealOrder: 'staged' },
  });
}

function id(value: number): string {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
}
