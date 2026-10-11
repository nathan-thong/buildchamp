import {
  createRun,
  generateSharedOffers,
  lockSelection,
  chooseRandomSelection,
  selectionForSlot,
  restoreDraftingRun,
  serializeDraftingRun,
  type Completion,
  type DraftingRunState,
  type Offer,
  type RandomSource,
} from '../../src/domain/draft-engine.ts';
import { DRAFT_SLOT_ORDER } from '../../src/domain/draft-engine.ts';
import type { ChampionSnapshot } from '../../src/data/snapshot-schema.ts';
import { PersistedDraftingRunSchema } from '../../src/lib/solo-run-storage.ts';

import {
  LOBBY_EXPIRY_MS,
  LOBBY_PROTOCOL_VERSION,
  LOBBY_STATE_VERSION,
  MAX_RECENT_COMMANDS,
  REVEAL_STEP_MS,
  LobbyProjectionSchema,
  LobbyStateSchema,
  OfferProjectionSchema,
  ParticipantSchema,
  PublicOfferIdentitySchema,
  type ClientCommand,
  type JoinLobbyRequest,
  type LobbyParticipant,
  type LobbyProjection,
  type LobbyRole,
  type LobbySettings,
  type LobbyState,
  type OfferProjection,
  type PublicOfferIdentity,
} from './schemas.ts';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLOCKED_NICKNAME_WORDS = new Set([
  'asshole',
  'bastard',
  'bitch',
  'bullshit',
  'cunt',
  'dick',
  'fuck',
  'fucking',
  'shit',
  'slut',
  'whore',
]);

const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const WORDS = /[\p{L}\p{N}]+/gu;

export type DraftMode = LobbySettings['mode'];

export const LOBBY_SPEED_DURATIONS_MS: Readonly<Record<LobbySettings['speed'], number>> = {
  quick: 15_000,
  standard: 30_000,
  relaxed: 45_000,
};

export const LOBBY_VOTE_DURATIONS_MS: Readonly<Record<LobbySettings['speed'], number>> = {
  quick: 20_000,
  standard: 30_000,
  relaxed: 45_000,
};

export type LobbyCommandActor = Readonly<{
  participantId: string;
  connectionId: string;
}>;

export type LobbyCommandContext = Readonly<{
  now: number;
  snapshot: ChampionSnapshot;
  random: RandomSource;
}>;

export type LobbyCommandFailure = Readonly<{
  ok: false;
  state: LobbyState;
  commandId?: string;
  code:
    | 'stale_revision'
    | 'unauthorized'
    | 'wrong_phase'
    | 'not_enough_ready_players'
    | 'participant_not_found'
    | 'offer_generation_failed'
    | 'already_locked'
    | 'offer_mismatch';
  message: string;
}>;

export type LobbyCommandSuccess = Readonly<{
  ok: true;
  state: LobbyState;
  commandId: string;
  appliedRevision: number;
  duplicate: boolean;
  changed: boolean;
  removedParticipantId?: string;
}>;

export type LobbyCommandResult = LobbyCommandFailure | LobbyCommandSuccess;

export class LobbyStateError extends Error {
  readonly code:
    | 'invalid_nickname'
    | 'nickname_prohibited'
    | 'display_full'
    | 'player_capacity_full'
    | 'spectator_capacity_full'
    | 'participant_exists'
    | 'offer_generation_failed'
    | 'invalid_state';

  constructor(code: LobbyStateError['code'], message: string) {
    super(message);
    this.name = 'LobbyStateError';
    this.code = code;
  }
}

export function generateRoomCode(random: RandomSource): string {
  return Array.from({ length: 6 }, () => {
    const value = nextRandom(random);
    const index = Math.floor(value * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index] as string;
  }).join('');
}

/** Normalize visible text and reject control characters and common profanity. */
export function validateNickname(input: string): string {
  if (hasControlCharacters(input) || BIDI_CONTROLS.test(input)) {
    throw new LobbyStateError(
      'invalid_nickname',
      'Use 2–16 visible characters without control characters.',
    );
  }

  const nickname = input.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = visibleCharacterLength(nickname);
  if (length < 2 || length > 16) {
    throw new LobbyStateError('invalid_nickname', 'Nicknames must be 2–16 visible characters.');
  }

  const normalizedWords = nickname.normalize('NFKC').toLocaleLowerCase('en-US').match(WORDS);
  if (normalizedWords?.some((word) => BLOCKED_NICKNAME_WORDS.has(word))) {
    throw new LobbyStateError('nickname_prohibited', 'Choose a nickname without profanity.');
  }

  return nickname;
}

export function createLobbyState(
  input: Readonly<{
    roomCode: string;
    snapshotVersion: string;
    hostParticipantId: string;
    hostNickname: string;
    reconnectTokenHash: string;
    identityKeyHash?: string | null;
    now: number;
  }>,
): LobbyState {
  const host = ParticipantSchema.parse({
    id: input.hostParticipantId,
    nickname: validateNickname(input.hostNickname),
    role: 'host',
    ready: false,
    isConnected: false,
    connectionId: null,
    connectedAt: null,
    joinedAt: input.now,
    reconnectTokenHash: input.reconnectTokenHash,
    identityKeyHash: input.identityKeyHash ?? null,
    hasLeft: false,
  });

  return LobbyStateSchema.parse({
    schemaVersion: LOBBY_STATE_VERSION,
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    snapshotVersion: input.snapshotVersion,
    roomCode: input.roomCode,
    revision: 1,
    phase: 'waiting',
    hostParticipantId: host.id,
    participants: [host],
    settings: {
      mode: 'same',
      speed: 'standard',
      revealOrder: 'staged',
    },
    draftsByParticipantId: {},
    roundLocksByParticipantId: {},
    completedRunsByParticipantId: {},
    revealOrderParticipantIds: [],
    revealedCount: 0,
    votesByIdentityHash: {},
    deadlineAt: null,
    recentCommands: [],
    createdAt: input.now,
    lastActivityAt: input.now,
    expiresAt: input.now + LOBBY_EXPIRY_MS,
  });
}

export function addLobbyParticipant(
  state: LobbyState,
  input: JoinLobbyRequest,
): Readonly<{ state: LobbyState; participant: LobbyParticipant }> {
  if (state.participants.some((participant) => participant.id === input.participantId)) {
    throw new LobbyStateError(
      'participant_exists',
      'This participant has already joined the room.',
    );
  }

  if (
    input.identityKeyHash &&
    input.requestedRole !== 'display' &&
    state.participants.some(
      (participant) =>
        !participant.hasLeft &&
        participant.role !== 'display' &&
        participant.identityKeyHash === input.identityKeyHash,
    )
  ) {
    throw new LobbyStateError('participant_exists', 'This browser already has a seat in the room.');
  }

  const requestedRole = input.requestedRole;
  let role: LobbyRole;
  let nickname: string;

  if (requestedRole === 'display') {
    if (state.participants.some((participant) => participant.role === 'display')) {
      throw new LobbyStateError('display_full', 'This room already has a shared display.');
    }
    role = 'display';
    nickname = uniqueNickname('Shared display', state.participants);
  } else {
    const baseNickname = validateNickname(input.nickname ?? '');
    nickname = uniqueNickname(baseNickname, state.participants);
    const playerCount = state.participants.filter(isDraftingPlayer).length;
    role =
      requestedRole === 'player' && state.phase === 'waiting' && playerCount < 8
        ? 'player'
        : 'spectator';

    if (role === 'spectator' && spectatorCount(state) >= 20) {
      throw new LobbyStateError(
        'spectator_capacity_full',
        'This room has reached its spectator limit.',
      );
    }
    if (requestedRole === 'player' && state.phase === 'waiting' && playerCount >= 8) {
      role = 'spectator';
      if (spectatorCount(state) >= 20) {
        throw new LobbyStateError(
          'spectator_capacity_full',
          'This room has reached its spectator limit.',
        );
      }
    }
  }

  const participant = ParticipantSchema.parse({
    id: input.participantId,
    nickname,
    role,
    ready: false,
    isConnected: false,
    connectionId: null,
    connectedAt: null,
    joinedAt: input.now,
    reconnectTokenHash: input.reconnectTokenHash,
    identityKeyHash: requestedRole === 'display' ? null : input.identityKeyHash,
    hasLeft: false,
  });
  const nextState = touchState(
    {
      ...state,
      participants: [...state.participants, participant],
    },
    input.now,
  );

  return { state: nextState, participant };
}

export function connectLobbyParticipant(
  state: LobbyState,
  participantId: string,
  connectionId: string,
  now: number,
): LobbyState {
  const index = state.participants.findIndex((participant) => participant.id === participantId);
  const participant = state.participants[index];
  if (!participant || participant.hasLeft) {
    throw new LobbyStateError('invalid_state', 'Participant is no longer in this room.');
  }

  const participants = [...state.participants];
  participants[index] = {
    ...participant,
    isConnected: true,
    connectionId,
    connectedAt: now,
  };

  return touchState({ ...state, participants }, now);
}

export function disconnectLobbyParticipant(
  state: LobbyState,
  participantId: string,
  connectionId: string,
  now: number,
): LobbyState {
  const index = state.participants.findIndex((participant) => participant.id === participantId);
  const participant = state.participants[index];
  if (
    !participant ||
    participant.hasLeft ||
    !participant.isConnected ||
    participant.connectionId !== connectionId
  ) {
    return state;
  }

  const participants = [...state.participants];
  participants[index] = {
    ...participant,
    isConnected: false,
    connectionId: null,
    connectedAt: null,
    ...(state.phase === 'waiting' ? { ready: false } : {}),
  };

  let hostParticipantId = state.hostParticipantId;
  if (participant.role === 'host') {
    const nextHost = participants
      .filter(
        (candidate) => !candidate.hasLeft && candidate.role === 'player' && candidate.isConnected,
      )
      .sort(
        (left, right) =>
          (left.connectedAt ?? Number.MAX_SAFE_INTEGER) -
            (right.connectedAt ?? Number.MAX_SAFE_INTEGER) ||
          left.joinedAt - right.joinedAt ||
          left.id.localeCompare(right.id),
      )[0];

    if (nextHost) {
      const formerHostIndex = participants.findIndex(
        (candidate) => candidate.id === participant.id,
      );
      const nextHostIndex = participants.findIndex((candidate) => candidate.id === nextHost.id);
      const formerHost = participants[formerHostIndex];
      const promotedPlayer = participants[nextHostIndex];
      if (formerHost && promotedPlayer) {
        participants[formerHostIndex] = { ...formerHost, role: 'player' };
        participants[nextHostIndex] = { ...promotedPlayer, role: 'host' };
        hostParticipantId = nextHost.id;
      }
    }
  }

  const disconnectedState = touchState({ ...state, participants, hostParticipantId }, now);
  return completeVoteIfConnectedVotersActed(disconnectedState, now);
}

/** Resolve the current server-timed phase once; retries observe its replacement deadline. */
export function advanceExpiredLobbyPhase(
  state: LobbyState,
  context: LobbyCommandContext,
): LobbyState {
  if (state.deadlineAt === null || context.now < state.deadlineAt) {
    return state;
  }
  if (state.phase === 'drafting') return resolveDraftRound(state, context);
  if (state.phase === 'revealing') return advanceReveal(state, context.now);
  if (state.phase === 'voting') return finishVoting(state, context.now);
  return state;
}

/** Backwards-compatible name for existing draft tests and local adapters. */
export const advanceExpiredDraftRound = advanceExpiredLobbyPhase;

export function leaveLobbyParticipant(
  state: LobbyState,
  participantId: string,
  reconnectTokenHash: string,
  now: number,
): Readonly<{ state: LobbyState | null; removed: boolean }> {
  const participant = state.participants.find((candidate) => candidate.id === participantId);
  if (
    !participant ||
    participant.hasLeft ||
    !constantTimeStringEqual(participant.reconnectTokenHash, reconnectTokenHash)
  ) {
    return { state, removed: false };
  }
  return { state: removeParticipant(state, participant, now), removed: true };
}

export function handleLobbyCommand(
  state: LobbyState,
  actor: LobbyCommandActor,
  command: ClientCommand,
  context: LobbyCommandContext,
): LobbyCommandResult {
  const participant = state.participants.find((candidate) => candidate.id === actor.participantId);
  if (
    !participant ||
    participant.hasLeft ||
    !participant.isConnected ||
    participant.connectionId !== actor.connectionId
  ) {
    return commandFailure(
      state,
      'unauthorized',
      'This connection no longer controls a participant.',
      command,
    );
  }

  const recentCommand = state.recentCommands.find(
    (item) => item.participantId === actor.participantId && item.commandId === command.commandId,
  );
  if (recentCommand) {
    return {
      ok: true,
      state,
      commandId: command.commandId,
      appliedRevision: recentCommand.appliedRevision,
      duplicate: true,
      changed: false,
    };
  }

  const isLockCommand = command.type === 'player.lock';
  const isCurrentVotePhaseCommand =
    command.type === 'player.vote' &&
    state.phase === 'voting' &&
    state.deadlineAt !== null &&
    command.payload.phaseDeadlineAt === state.deadlineAt;
  if (
    command.roomRevision !== state.revision &&
    (!(isLockCommand || isCurrentVotePhaseCommand) || command.roomRevision > state.revision)
  ) {
    return commandFailure(
      state,
      'stale_revision',
      'The room changed. Use the latest room state.',
      command,
    );
  }

  if (command.type === 'player.ready') {
    if (!isDraftingPlayer(participant)) {
      return commandFailure(
        state,
        'unauthorized',
        'Only drafting players can change readiness.',
        command,
      );
    }
    if (state.phase !== 'waiting') {
      return commandFailure(
        state,
        'wrong_phase',
        'Readiness can only change in the waiting room.',
        command,
      );
    }
    if (participant.ready === command.payload.ready) {
      return commandSuccess(state, actor.participantId, command, false);
    }
    const participants = state.participants.map((candidate) =>
      candidate.id === participant.id ? { ...candidate, ready: command.payload.ready } : candidate,
    );
    return commandSuccess(
      touchState({ ...state, participants }, context.now),
      actor.participantId,
      command,
      true,
    );
  }

  if (command.type === 'host.settings') {
    if (participant.role !== 'host') {
      return commandFailure(
        state,
        'unauthorized',
        'Only the host can change room settings.',
        command,
      );
    }
    if (state.phase !== 'waiting') {
      return commandFailure(
        state,
        'wrong_phase',
        'Room settings are locked after drafting starts.',
        command,
      );
    }
    if (settingsEqual(state.settings, command.payload)) {
      return commandSuccess(state, actor.participantId, command, false);
    }
    return commandSuccess(
      touchState({ ...state, settings: command.payload }, context.now),
      actor.participantId,
      command,
      true,
    );
  }

  if (command.type === 'host.remove') {
    if (participant.role !== 'host') {
      return commandFailure(
        state,
        'unauthorized',
        'Only the host can remove participants.',
        command,
      );
    }
    const target = state.participants.find(
      (candidate) => candidate.id === command.payload.participantId,
    );
    if (!target || target.role === 'host' || target.hasLeft) {
      return commandFailure(
        state,
        'participant_not_found',
        'That participant cannot be removed.',
        command,
      );
    }
    const next = removeParticipant(state, target, context.now);
    if (!next) {
      return commandFailure(state, 'wrong_phase', 'The room cannot remove its last host.', command);
    }
    return {
      ...commandSuccess(next, actor.participantId, command, true),
      removedParticipantId: target.id,
    };
  }

  if (command.type === 'host.start') {
    if (participant.role !== 'host') {
      return commandFailure(state, 'unauthorized', 'Only the host can start the draft.', command);
    }
    if (state.phase !== 'waiting') {
      return commandFailure(state, 'wrong_phase', 'This room has already started.', command);
    }
    const readyPlayers = state.participants.filter(
      (candidate) => isDraftingPlayer(candidate) && candidate.ready && candidate.isConnected,
    );
    if (readyPlayers.length < 2) {
      return commandFailure(
        state,
        'not_enough_ready_players',
        'At least two players must be ready before the host can start.',
        command,
      );
    }

    try {
      const playerIds = state.participants
        .filter(isDraftingPlayer)
        .map((candidate) => candidate.id);
      const draftsByParticipantId = createInitialDrafts(
        context.snapshot,
        playerIds,
        state.settings.mode,
        context.random,
      );
      const duration = LOBBY_SPEED_DURATIONS_MS[state.settings.speed];
      return commandSuccess(
        touchState(
          {
            ...state,
            phase: 'drafting',
            draftsByParticipantId,
            roundLocksByParticipantId: {},
            completedRunsByParticipantId: {},
            deadlineAt: Math.floor(context.now) + duration,
          },
          context.now,
        ),
        actor.participantId,
        command,
        true,
      );
    } catch {
      return commandFailure(
        state,
        'offer_generation_failed',
        'The current champion snapshot could not generate a legal offer.',
        command,
      );
    }
  }

  if (command.type === 'player.lock') {
    if (!isDraftingPlayer(participant)) {
      return commandFailure(
        state,
        'unauthorized',
        'Only drafting players can lock a choice.',
        command,
      );
    }
    if (state.phase !== 'drafting' || state.deadlineAt === null) {
      return commandFailure(
        state,
        'wrong_phase',
        'This round is no longer accepting locks.',
        command,
      );
    }
    if (context.now >= state.deadlineAt) {
      return commandFailure(state, 'wrong_phase', 'The round deadline has passed.', command);
    }
    if (command.payload.round !== getCurrentRound(state)) {
      return commandFailure(state, 'wrong_phase', 'That choice belongs to another round.', command);
    }
    if (participant.id in state.roundLocksByParticipantId) {
      return commandFailure(
        state,
        'already_locked',
        'Your choice is already locked this round.',
        command,
      );
    }
    const persisted = state.draftsByParticipantId[participant.id];
    if (!persisted) {
      return commandFailure(
        state,
        'participant_not_found',
        'Your draft is no longer active.',
        command,
      );
    }
    const draft = restoreDraftingRun(context.snapshot, persisted);
    if (command.payload.selection.offerId !== draft.offer.id) {
      return commandFailure(
        state,
        'offer_mismatch',
        'That champion offer is no longer current.',
        command,
      );
    }
    let selection: ReturnType<typeof selectionForSlot>;
    try {
      selection = selectionForSlot(draft.offer, command.payload.selection.slot);
    } catch {
      return commandFailure(state, 'offer_mismatch', 'That component is not selectable.', command);
    }
    if (selection.componentId !== command.payload.selection.componentId) {
      return commandFailure(state, 'offer_mismatch', 'That component is not selectable.', command);
    }

    const lockedState = {
      ...state,
      roundLocksByParticipantId: {
        ...state.roundLocksByParticipantId,
        [participant.id]: selection,
      },
    };
    const nextState = allPlayersLocked(lockedState)
      ? resolveDraftRound(lockedState, context)
      : touchState(lockedState, context.now);
    return commandSuccess(nextState, actor.participantId, command, true);
  }

  if (command.type === 'host.reveal.advance') {
    if (participant.role !== 'host') {
      return commandFailure(
        state,
        'unauthorized',
        'Only the host can advance the reveal.',
        command,
      );
    }
    if (state.phase !== 'revealing') {
      return commandFailure(state, 'wrong_phase', 'The reveal is not active.', command);
    }
    return commandSuccess(advanceReveal(state, context.now), actor.participantId, command, true);
  }

  if (command.type === 'player.vote') {
    if (!isVoter(participant)) {
      return commandFailure(state, 'unauthorized', 'This role cannot vote in the room.', command);
    }
    if (state.phase !== 'voting') {
      return commandFailure(state, 'wrong_phase', 'Voting is not active.', command);
    }
    if (
      state.deadlineAt === null ||
      context.now >= state.deadlineAt ||
      command.payload.phaseDeadlineAt !== state.deadlineAt
    ) {
      return commandFailure(
        state,
        'wrong_phase',
        'This voting phase is no longer active.',
        command,
      );
    }
    const voterKey = identityForParticipant(participant);
    if (voterKey in state.votesByIdentityHash) {
      return commandFailure(
        state,
        'already_locked',
        'Your ballot has already been counted.',
        command,
      );
    }
    const target = state.participants.find(
      (candidate) => candidate.id === command.payload.participantId,
    );
    if (!target || !(target.id in state.completedRunsByParticipantId)) {
      return commandFailure(
        state,
        'participant_not_found',
        'That completed build is unavailable.',
        command,
      );
    }
    if (sameIdentity(participant, target)) {
      return commandFailure(state, 'unauthorized', 'You cannot vote for your own build.', command);
    }
    const voted = touchState(
      {
        ...state,
        votesByIdentityHash: { ...state.votesByIdentityHash, [voterKey]: target.id },
      },
      context.now,
    );
    return commandSuccess(
      completeVoteIfConnectedVotersActed(voted, context.now),
      actor.participantId,
      command,
      true,
    );
  }

  if (command.type === 'host.rematch') {
    if (participant.role !== 'host') {
      return commandFailure(state, 'unauthorized', 'Only the host can start a rematch.', command);
    }
    if (state.phase !== 'results') {
      return commandFailure(state, 'wrong_phase', 'A rematch is available after results.', command);
    }
    const activePlayers = state.participants.filter(isDraftingPlayer);
    const participants = state.participants.filter((candidate) => !candidate.hasLeft);
    if (activePlayers.length < 2) {
      return commandSuccess(
        touchState(
          {
            ...state,
            phase: 'waiting',
            participants: participants.map((candidate) => ({ ...candidate, ready: false })),
            draftsByParticipantId: {},
            roundLocksByParticipantId: {},
            completedRunsByParticipantId: {},
            revealOrderParticipantIds: [],
            revealedCount: 0,
            votesByIdentityHash: {},
            deadlineAt: null,
          },
          context.now,
        ),
        actor.participantId,
        command,
        true,
      );
    }
    try {
      const playerIds = activePlayers.map(({ id }) => id);
      const draftsByParticipantId = createInitialDrafts(
        context.snapshot,
        playerIds,
        state.settings.mode,
        context.random,
      );
      return commandSuccess(
        touchState(
          {
            ...state,
            phase: 'drafting',
            participants,
            draftsByParticipantId,
            roundLocksByParticipantId: {},
            completedRunsByParticipantId: {},
            revealOrderParticipantIds: [],
            revealedCount: 0,
            votesByIdentityHash: {},
            deadlineAt: Math.floor(context.now) + LOBBY_SPEED_DURATIONS_MS[state.settings.speed],
          },
          context.now,
        ),
        actor.participantId,
        command,
        true,
      );
    } catch {
      return commandFailure(
        state,
        'offer_generation_failed',
        'The current champion snapshot could not generate a legal rematch.',
        command,
      );
    }
  }

  return commandFailure(
    state,
    'unauthorized',
    'This command is not available to this role.',
    command,
  );
}

export function projectLobby(
  state: LobbyState,
  audience: Readonly<{ role: LobbyRole | 'observer'; participantId: string | null }>,
  snapshot: ChampionSnapshot,
): LobbyProjection {
  const viewer = state.participants.find((candidate) => candidate.id === audience.participantId);
  const visibleBuildIds =
    state.phase === 'revealing'
      ? state.revealOrderParticipantIds.slice(0, state.revealedCount)
      : state.phase === 'voting' || state.phase === 'results'
        ? state.revealOrderParticipantIds
        : [];
  const projection: LobbyProjection = {
    protocolVersion: state.protocolVersion,
    snapshotVersion: state.snapshotVersion,
    roomCode: state.roomCode,
    revision: state.revision,
    phase: state.phase,
    role: audience.role,
    selfParticipantId: audience.participantId,
    hostParticipantId: state.hostParticipantId,
    settings: { ...state.settings },
    participants: state.participants.map(({ id, nickname, role, ready, isConnected, hasLeft }) => ({
      id,
      nickname,
      role,
      ready,
      isConnected,
      hasLeft,
      lockedThisRound:
        (state.phase === 'draft-complete' && isDraftingPlayer({ role, hasLeft })) ||
        id in state.roundLocksByParticipantId,
    })),
    builds: visibleBuildIds.map((participantId) => {
      const participant = state.participants.find((candidate) => candidate.id === participantId);
      const run = state.completedRunsByParticipantId[participantId];
      if (!participant || !run) {
        throw new LobbyStateError(
          'invalid_state',
          'A revealed build is missing its owner or data.',
        );
      }
      return projectCompletedBuild(participant, run, snapshot);
    }),
    expiresAt: state.expiresAt,
    deadlineAt: state.deadlineAt,
    lockedCount: Object.keys(state.roundLocksByParticipantId).length,
    playerCount: state.participants.filter(isDraftingPlayer).length,
    candidateCount: state.revealOrderParticipantIds.length,
    revealedCount:
      state.phase === 'revealing' || state.phase === 'voting' || state.phase === 'results'
        ? state.revealedCount
        : 0,
    selfHasVoted: Boolean(viewer && identityForParticipant(viewer) in state.votesByIdentityHash),
    votesCastCount: Object.keys(state.votesByIdentityHash).length,
    ...(state.phase === 'voting' && viewer && isVoter(viewer)
      ? {
          votableParticipantIds: state.revealOrderParticipantIds.filter((candidateId) => {
            const candidate = state.participants.find(({ id }) => id === candidateId);
            return Boolean(candidate && !sameIdentity(viewer, candidate));
          }),
        }
      : {}),
  };

  if (state.phase === 'results') {
    const totals = countVotes(state);
    const highest = Math.max(0, ...totals.map(({ votes }) => votes));
    projection.voteTotals = totals;
    projection.winnerIds =
      highest === 0
        ? []
        : totals.filter(({ votes }) => votes === highest).map(({ participantId }) => participantId);
    return LobbyProjectionSchema.parse(projection);
  }

  if (
    state.phase === 'waiting' ||
    state.phase === 'draft-complete' ||
    state.phase === 'revealing' ||
    state.phase === 'voting'
  ) {
    return LobbyProjectionSchema.parse(projection);
  }

  const playerParticipants = state.participants.filter(isDraftingPlayer);
  const draftStates = new Map(
    Object.entries(state.draftsByParticipantId).map(([participantId, persisted]) => [
      participantId,
      restoreDraftingRun(snapshot, persisted),
    ]),
  );
  if (draftStates.size === 0) {
    throw new LobbyStateError('invalid_state', 'An active draft has no private player state.');
  }

  projection.currentRound = getCurrentRound(state);

  if (state.settings.mode === 'same') {
    const offers = [...draftStates.values()].map((draft) => draft.offer);
    if (new Set(offers.map((offer) => offer.id)).size !== 1) {
      throw new LobbyStateError(
        'invalid_state',
        'Same Champs players must share one current offer.',
      );
    }
    const sharedOffer = offers[0] as Offer;
    if (audience.role === 'display') {
      projection.offer = projectPublicOfferIdentity(sharedOffer);
      return LobbyProjectionSchema.parse(projection);
    }
    if (audience.role === 'host' || audience.role === 'player') {
      const ownDraft = audience.participantId ? draftStates.get(audience.participantId) : undefined;
      if (
        ownDraft &&
        audience.participantId !== null &&
        !(audience.participantId in state.roundLocksByParticipantId)
      ) {
        projection.offer = projectOffer(ownDraft.offer);
      }
    } else {
      projection.offer = projectPublicOfferIdentity(sharedOffer);
    }
    return LobbyProjectionSchema.parse(projection);
  }

  if (audience.role === 'display') {
    projection.offersByPlayer = playerParticipants.flatMap((candidate) => {
      const draft = draftStates.get(candidate.id);
      return draft
        ? [
            {
              participantId: candidate.id,
              nickname: candidate.nickname,
              offer: projectPublicOfferIdentity(draft.offer),
            },
          ]
        : [];
    });
    return LobbyProjectionSchema.parse(projection);
  }

  if (audience.role === 'host' || audience.role === 'player') {
    const ownDraft = audience.participantId ? draftStates.get(audience.participantId) : undefined;
    if (
      ownDraft &&
      audience.participantId !== null &&
      !(audience.participantId in state.roundLocksByParticipantId)
    ) {
      projection.offer = projectOffer(ownDraft.offer);
    }
  }

  return LobbyProjectionSchema.parse(projection);
}

function getCurrentRound(state: LobbyState): number {
  const rounds = Object.values(state.draftsByParticipantId).map((draft) => draft.round + 1);
  return rounds.length > 0 ? Math.min(...rounds) : state.phase === 'draft-complete' ? 6 : 1;
}

function allPlayersLocked(state: LobbyState): boolean {
  const playerIds = state.participants.filter(isDraftingPlayer).map(({ id }) => id);
  return (
    playerIds.length > 0 &&
    playerIds.every((participantId) => participantId in state.roundLocksByParticipantId)
  );
}

function resolveDraftRound(state: LobbyState, context: LobbyCommandContext): LobbyState {
  if (state.phase !== 'drafting') return state;
  const playerIds = state.participants.filter(isDraftingPlayer).map(({ id }) => id);
  const nextRuns = playerIds.map((participantId) => {
    const persisted = state.draftsByParticipantId[participantId];
    if (!persisted) throw new LobbyStateError('invalid_state', 'A player draft is missing.');
    const draft = restoreDraftingRun(context.snapshot, persisted);
    const selection = state.roundLocksByParticipantId[participantId];
    return selection
      ? lockSelection(context.snapshot, draft, selection, context.random)
      : lockSelection(
          context.snapshot,
          draft,
          chooseRandomSelection(draft, context.random),
          context.random,
        );
  });

  if (nextRuns.every((run) => run.status === 'complete')) {
    const completedRunsByParticipantId = Object.fromEntries(
      playerIds.map((participantId, index) => {
        const run = nextRuns[index];
        if (!run || run.status !== 'complete') {
          throw new LobbyStateError('invalid_state', 'A completed player draft is missing.');
        }
        return [participantId, serializeCompletion(run.completion)];
      }),
    ) as LobbyState['completedRunsByParticipantId'];
    return beginReveal(
      {
        ...state,
        phase: 'draft-complete',
        draftsByParticipantId: {},
        roundLocksByParticipantId: {},
        completedRunsByParticipantId,
        revealOrderParticipantIds: playerIds,
        revealedCount: 0,
        votesByIdentityHash: {},
        deadlineAt: null,
      },
      context.now,
    );
  }

  const draftingRuns = nextRuns.filter((run) => run.status === 'drafting');
  if (draftingRuns.length !== playerIds.length) {
    throw new LobbyStateError('invalid_state', 'Only some player drafts advanced.');
  }
  let nextDrafts = Object.fromEntries(
    playerIds.map((participantId, index) => {
      const run = draftingRuns[index];
      if (!run) throw new LobbyStateError('invalid_state', 'A player draft is missing.');
      return [participantId, PersistedDraftingRunSchema.parse(serializeDraftingRun(run))];
    }),
  ) as LobbyState['draftsByParticipantId'];

  if (state.settings.mode === 'same') {
    const sharedOffers = generateSharedOffers(context.snapshot, draftingRuns, context.random);
    nextDrafts = Object.fromEntries(
      playerIds.map((participantId, index) => {
        const run = draftingRuns[index];
        const offer = sharedOffers[index];
        if (!run || !offer) {
          throw new LobbyStateError('offer_generation_failed', 'The shared offer was incomplete.');
        }
        return [
          participantId,
          PersistedDraftingRunSchema.parse(serializeDraftingRun({ ...run, offer })),
        ];
      }),
    );
  }

  return touchState(
    {
      ...state,
      draftsByParticipantId: nextDrafts,
      roundLocksByParticipantId: {},
      completedRunsByParticipantId: {},
      deadlineAt: Math.floor(context.now) + LOBBY_SPEED_DURATIONS_MS[state.settings.speed],
    },
    context.now,
  );
}

function serializeCompletion(
  completion: Completion,
): LobbyState['completedRunsByParticipantId'][string] {
  return {
    snapshotVersion: completion.snapshotVersion,
    build: {
      body: { ...completion.build.body },
      q: { ...completion.build.q },
      w: { ...completion.build.w },
      e: { ...completion.build.e },
      r: { ...completion.build.r },
      passive: { ...completion.build.passive },
    },
    picks: completion.picks.map((pick) => ({ ...pick })),
  };
}

export function isLobbyExpired(state: LobbyState, now: number): boolean {
  return now >= state.expiresAt;
}

export function touchState(state: LobbyState, now: number): LobbyState {
  if (!Number.isFinite(now) || now < 0) {
    throw new LobbyStateError('invalid_state', 'Lobby activity time must be a finite timestamp.');
  }
  const activityTime = Math.max(state.lastActivityAt, Math.floor(now));
  return {
    ...state,
    revision: state.revision + 1,
    lastActivityAt: activityTime,
    expiresAt: activityTime + LOBBY_EXPIRY_MS,
  };
}

export function isDraftingPlayer(
  participant: Pick<LobbyParticipant, 'role' | 'hasLeft'>,
): participant is LobbyParticipant {
  return !participant.hasLeft && (participant.role === 'host' || participant.role === 'player');
}

export function spectatorCount(state: LobbyState): number {
  return state.participants.filter(
    (participant) => participant.role === 'spectator' && !participant.hasLeft,
  ).length;
}

function uniqueNickname(baseNickname: string, participants: readonly LobbyParticipant[]): string {
  const taken = new Set(
    participants.map((participant) => participant.nickname.toLocaleLowerCase('en-US')),
  );
  if (!taken.has(baseNickname.toLocaleLowerCase('en-US'))) return baseNickname;

  for (let suffixNumber = 2; suffixNumber < 10_000; suffixNumber += 1) {
    const suffix = ` (${suffixNumber})`;
    const baseCharacters = visibleCharacters(baseNickname);
    const suffixLength = visibleCharacterLength(suffix);
    const shortenedBase = baseCharacters.slice(0, Math.max(2, 16 - suffixLength)).join('');
    const candidate = `${shortenedBase}${suffix}`;
    if (!taken.has(candidate.toLocaleLowerCase('en-US'))) return candidate;
  }

  throw new LobbyStateError('invalid_state', 'A unique nickname could not be assigned.');
}

function visibleCharacterLength(value: string): number {
  return visibleCharacters(value).length;
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if ((codePoint >= 0 && codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function visibleCharacters(value: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(
      new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value),
      (item) => item.segment,
    );
  }
  return Array.from(value);
}

function createInitialDrafts(
  snapshot: ChampionSnapshot,
  playerIds: readonly string[],
  mode: DraftMode,
  random: RandomSource,
): Record<string, LobbyState['draftsByParticipantId'][string]> {
  if (playerIds.length < 2 || playerIds.length > 8) {
    throw new LobbyStateError(
      'invalid_state',
      'A draft requires between two and eight player seats.',
    );
  }

  if (mode === 'random') {
    return Object.fromEntries(
      playerIds.map((participantId) => [
        participantId,
        PersistedDraftingRunSchema.parse(serializeDraftingRun(createRun(snapshot, random))),
      ]),
    );
  }

  const first = createRun(snapshot, random);
  const independentStates = playerIds.map(() => cloneDraftState(first));
  const sharedOffers = generateSharedOffers(snapshot, independentStates, random);
  return Object.fromEntries(
    playerIds.map((participantId, index) => {
      const draft = independentStates[index];
      const offer = sharedOffers[index];
      if (!draft || !offer) {
        throw new LobbyStateError('invalid_state', 'The first shared offer is incomplete.');
      }
      return [
        participantId,
        PersistedDraftingRunSchema.parse(serializeDraftingRun({ ...draft, offer })),
      ];
    }),
  );
}

function cloneDraftState(state: DraftingRunState): DraftingRunState {
  return {
    ...state,
    usedChampionIds: [...state.usedChampionIds],
    lockedBuild: { ...state.lockedBuild },
    picks: [...state.picks],
  };
}

function projectOffer(offer: Offer): OfferProjection {
  return OfferProjectionSchema.parse({
    id: offer.id,
    champion: projectChampionIdentity(offer).champion,
    variant: {
      id: offer.variant.id,
      ...(offer.variant.label ? { label: offer.variant.label } : {}),
    },
    selectableSlots: [...offer.selectableSlots],
    components: Object.fromEntries(
      DRAFT_SLOT_ORDER.map((slot) => {
        const component = offer.components[slot];
        return [
          slot,
          {
            id: component.id,
            slot: component.slot,
            name: component.name,
            iconRef: component.iconRef,
            shortDescription: component.shortDescription,
            fullDescription: component.fullDescription,
            ...(component.cooldown ? { cooldown: component.cooldown } : {}),
            ...(component.cooldowns ? { cooldowns: component.cooldowns } : {}),
            ...(component.range ? { range: component.range } : {}),
            ...(component.ranges ? { ranges: component.ranges } : {}),
            ...(component.healthCost ? { healthCost: component.healthCost } : {}),
            ...(component.healthCosts ? { healthCosts: component.healthCosts } : {}),
            values: component.values,
            availability: component.availability,
            dependencies: component.dependencies,
            carriedMechanics: component.carriedMechanics,
            ...(component.bodyStats ? { bodyStats: component.bodyStats } : {}),
          },
        ];
      }),
    ) as OfferProjection['components'],
  });
}

function projectPublicOfferIdentity(offer: Offer): PublicOfferIdentity {
  return PublicOfferIdentitySchema.parse(projectChampionIdentity(offer));
}

function projectChampionIdentity(offer: Offer): PublicOfferIdentity {
  return {
    champion: {
      id: offer.champion.id,
      name: offer.champion.name,
      title: offer.champion.title,
      icon: offer.champion.assetRefs.icon,
      defaultSplash: offer.champion.assetRefs.defaultSplash,
      defaultLoading: offer.champion.assetRefs.defaultLoading,
    },
  };
}

function projectCompletedBuild(
  participant: LobbyParticipant,
  run: LobbyState['completedRunsByParticipantId'][string],
  snapshot: ChampionSnapshot,
): LobbyProjection['builds'][number] {
  const build = Object.fromEntries(
    DRAFT_SLOT_ORDER.map((slot) => {
      const selection = run.build[slot];
      const champion = snapshot.champions.find(
        (candidate) => candidate.id === selection.championId,
      );
      const variant = champion?.variants.find((candidate) => candidate.id === selection.variantId);
      const component = variant?.components[slot];
      if (!champion || !variant || !component || component.id !== selection.componentId) {
        throw new LobbyStateError(
          'invalid_state',
          'A completed build references missing snapshot data.',
        );
      }
      return [
        slot,
        {
          slot,
          componentId: component.id,
          name: component.name,
          iconRef: component.iconRef,
          shortDescription: component.shortDescription,
          fullDescription: component.fullDescription,
          champion: {
            id: champion.id,
            name: champion.name,
            title: champion.title,
            icon: champion.assetRefs.icon,
            defaultSplash: champion.assetRefs.defaultSplash,
            defaultLoading: champion.assetRefs.defaultLoading,
          },
          variant: { id: variant.id, ...(variant.label ? { label: variant.label } : {}) },
        },
      ];
    }),
  ) as LobbyProjection['builds'][number]['build'];
  return {
    participantId: participant.id,
    nickname: participant.nickname,
    hasLeft: participant.hasLeft,
    build,
  };
}

function beginReveal(state: LobbyState, now: number): LobbyState {
  const candidateIds = state.revealOrderParticipantIds;
  if (candidateIds.length === 0) {
    throw new LobbyStateError('invalid_state', 'The reveal needs at least one completed build.');
  }
  const revealedCount = state.settings.revealOrder === 'all-at-once' ? candidateIds.length : 1;
  return touchState(
    {
      ...state,
      phase: 'revealing',
      revealedCount,
      deadlineAt: Math.floor(now) + REVEAL_STEP_MS,
    },
    now,
  );
}

function advanceReveal(state: LobbyState, now: number): LobbyState {
  if (state.phase !== 'revealing') return state;
  if (
    state.settings.revealOrder === 'staged' &&
    state.revealedCount < state.revealOrderParticipantIds.length
  ) {
    return touchState(
      {
        ...state,
        revealedCount: state.revealedCount + 1,
        deadlineAt: Math.floor(now) + REVEAL_STEP_MS,
      },
      now,
    );
  }
  return enterVoting(state, now);
}

function enterVoting(state: LobbyState, now: number): LobbyState {
  return touchState(
    {
      ...state,
      phase: 'voting',
      revealedCount: state.revealOrderParticipantIds.length,
      votesByIdentityHash: {},
      deadlineAt: Math.floor(now) + LOBBY_VOTE_DURATIONS_MS[state.settings.speed],
    },
    now,
  );
}

function finishVoting(state: LobbyState, now: number): LobbyState {
  if (state.phase !== 'voting') return state;
  return touchState({ ...state, phase: 'results', deadlineAt: null }, now);
}

function completeVoteIfConnectedVotersActed(state: LobbyState, now: number): LobbyState {
  if (state.phase !== 'voting') return state;
  const connectedVoters = state.participants.filter(
    (candidate) => isVoter(candidate) && candidate.isConnected,
  );
  if (
    connectedVoters.length > 0 &&
    connectedVoters.every(
      (candidate) => identityForParticipant(candidate) in state.votesByIdentityHash,
    )
  ) {
    return finishVoting(state, now);
  }
  return state;
}

function countVotes(state: LobbyState): NonNullable<LobbyProjection['voteTotals']> {
  const totals = new Map(state.revealOrderParticipantIds.map((id) => [id, 0]));
  for (const targetId of Object.values(state.votesByIdentityHash)) {
    if (totals.has(targetId)) totals.set(targetId, (totals.get(targetId) ?? 0) + 1);
  }
  return state.revealOrderParticipantIds.map((participantId) => ({
    participantId,
    votes: totals.get(participantId) ?? 0,
  }));
}

function isVoter(participant: LobbyParticipant): boolean {
  return (
    !participant.hasLeft &&
    (participant.role === 'host' ||
      participant.role === 'player' ||
      participant.role === 'spectator')
  );
}

function identityForParticipant(participant: LobbyParticipant): string {
  return participant.identityKeyHash ?? `legacy:${participant.id}`;
}

function sameIdentity(left: LobbyParticipant, right: LobbyParticipant): boolean {
  return left.identityKeyHash && right.identityKeyHash
    ? left.identityKeyHash === right.identityKeyHash
    : left.id === right.id;
}

function removeParticipant(
  state: LobbyState,
  target: LobbyParticipant,
  now: number,
): LobbyState | null {
  const beforeReveal =
    state.phase === 'waiting' || state.phase === 'drafting' || state.phase === 'draft-complete';
  const participants = state.participants
    .map((candidate) =>
      candidate.id === target.id && !beforeReveal && candidate.role !== 'display'
        ? {
            ...candidate,
            role: candidate.role === 'host' ? ('player' as const) : candidate.role,
            ready: false,
            isConnected: false,
            connectionId: null,
            connectedAt: null,
            hasLeft: true,
          }
        : candidate,
    )
    .filter(
      (candidate) => candidate.id !== target.id || (!beforeReveal && candidate.role !== 'display'),
    );

  const hostLeaving = target.id === state.hostParticipantId;
  const remaining = participants.filter(
    (candidate) => !candidate.hasLeft && candidate.id !== target.id,
  );
  let nextHostId = state.hostParticipantId;
  if (hostLeaving) {
    const nextHost = [...remaining]
      .filter((candidate) =>
        state.phase === 'drafting'
          ? candidate.role === 'player'
          : candidate.role === 'player' || candidate.role === 'spectator',
      )
      .sort(
        (left, right) =>
          Number(right.isConnected) - Number(left.isConnected) ||
          (left.connectedAt ?? Number.MAX_SAFE_INTEGER) -
            (right.connectedAt ?? Number.MAX_SAFE_INTEGER) ||
          left.joinedAt - right.joinedAt ||
          left.id.localeCompare(right.id),
      )[0];
    if (!nextHost) return null;
    nextHostId = nextHost.id;
    const hostIndex = participants.findIndex((candidate) => candidate.id === nextHost.id);
    const promoted = participants[hostIndex];
    if (promoted) participants[hostIndex] = { ...promoted, role: 'host' };
  }

  const draftsByParticipantId = { ...state.draftsByParticipantId };
  const roundLocksByParticipantId = { ...state.roundLocksByParticipantId };
  const completedRunsByParticipantId = { ...state.completedRunsByParticipantId };
  if (beforeReveal || target.role === 'display') {
    delete draftsByParticipantId[target.id];
    delete roundLocksByParticipantId[target.id];
    delete completedRunsByParticipantId[target.id];
  }
  const revealOrderParticipantIds =
    beforeReveal || target.role === 'display'
      ? state.revealOrderParticipantIds.filter((id) => id !== target.id)
      : [...state.revealOrderParticipantIds];

  const next = touchState(
    {
      ...state,
      participants,
      hostParticipantId: nextHostId,
      draftsByParticipantId,
      roundLocksByParticipantId,
      completedRunsByParticipantId,
      revealOrderParticipantIds,
      revealedCount: state.revealedCount,
    },
    now,
  );
  return completeVoteIfConnectedVotersActed(next, now);
}

function constantTimeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function commandSuccess(
  state: LobbyState,
  participantId: string,
  command: ClientCommand,
  changed: boolean,
): LobbyCommandSuccess {
  const appliedRevision = state.revision;
  const resultState = {
    ...state,
    recentCommands: [
      ...state.recentCommands,
      { participantId, commandId: command.commandId, appliedRevision },
    ].slice(-MAX_RECENT_COMMANDS),
  };
  return {
    ok: true,
    state: resultState,
    commandId: command.commandId,
    appliedRevision,
    duplicate: false,
    changed,
  };
}

function commandFailure(
  state: LobbyState,
  code: LobbyCommandFailure['code'],
  message: string,
  command?: ClientCommand,
): LobbyCommandFailure {
  return {
    ok: false,
    state,
    ...(command ? { commandId: command.commandId } : {}),
    code,
    message,
  };
}

function settingsEqual(left: LobbySettings, right: LobbySettings): boolean {
  return (
    left.mode === right.mode && left.speed === right.speed && left.revealOrder === right.revealOrder
  );
}

function nextRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) {
    throw new LobbyStateError('invalid_state', 'Random input must be a finite number.');
  }
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}
