import { z } from 'zod';

import { SlotSchema, AvailabilitySchema, BodyStatsSchema } from '../../src/data/snapshot-schema.ts';
import { PersistedDraftingRunSchema } from '../../src/lib/solo-run-storage.ts';

export const LOBBY_PROTOCOL_VERSION = 3 as const;
export const LOBBY_STATE_VERSION = 3 as const;
export const LOBBY_EXPIRY_MS = 60 * 60 * 1000;
export const REVEAL_STEP_MS = 6_000;
export const MAX_RECENT_COMMANDS = 128;

export const LobbyRoleSchema = z.enum(['host', 'player', 'spectator', 'display']);
export type LobbyRole = z.infer<typeof LobbyRoleSchema>;

export const LobbyPhaseSchema = z.enum([
  'waiting',
  'drafting',
  'draft-complete',
  'revealing',
  'voting',
  'results',
]);
export type LobbyPhase = z.infer<typeof LobbyPhaseSchema>;

export const LobbyModeSchema = z.enum(['same', 'random']);
export type LobbyMode = z.infer<typeof LobbyModeSchema>;

export const LobbySpeedSchema = z.enum(['quick', 'standard', 'relaxed']);
export type LobbySpeed = z.infer<typeof LobbySpeedSchema>;

export const RevealOrderSchema = z.enum(['staged', 'all-at-once']);
export type RevealOrder = z.infer<typeof RevealOrderSchema>;

export const LobbySettingsSchema = z
  .object({
    mode: LobbyModeSchema,
    speed: LobbySpeedSchema,
    revealOrder: RevealOrderSchema,
  })
  .strict();
export type LobbySettings = z.infer<typeof LobbySettingsSchema>;

export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
export const RoomCodeSchema = z.string().regex(ROOM_CODE_PATTERN);

const IdSchema = z.string().uuid();
const TokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const IdentityKeyHashSchema = TokenHashSchema;
export const BrowserIdentityTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const TimestampSchema = z.number().int().nonnegative();
const CommandIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const ParticipantSchema = z
  .object({
    id: IdSchema,
    nickname: z.string().min(2).max(16),
    role: LobbyRoleSchema,
    ready: z.boolean(),
    isConnected: z.boolean(),
    connectionId: IdSchema.nullable(),
    connectedAt: TimestampSchema.nullable(),
    joinedAt: TimestampSchema,
    reconnectTokenHash: TokenHashSchema,
    identityKeyHash: IdentityKeyHashSchema.nullable(),
    hasLeft: z.boolean(),
  })
  .strict()
  .superRefine((participant, context) => {
    if (participant.isConnected !== (participant.connectionId !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['connectionId'],
        message: 'Connection status must match the current connection identifier.',
      });
    }
    if (participant.isConnected !== (participant.connectedAt !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['connectedAt'],
        message: 'Connection status must match the current connection time.',
      });
    }
    if (participant.role === 'spectator' || participant.role === 'display') {
      if (participant.ready) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ready'],
          message: 'Only drafting players can be ready.',
        });
      }
    }
    if (participant.hasLeft && (participant.ready || participant.isConnected)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasLeft'],
        message: 'A participant who left cannot remain ready or connected.',
      });
    }
  });
export type LobbyParticipant = z.infer<typeof ParticipantSchema>;

const RecentCommandSchema = z
  .object({
    participantId: IdSchema,
    commandId: CommandIdSchema,
    appliedRevision: z.number().int().nonnegative(),
  })
  .strict();

export const LobbySelectionSchema = z
  .object({
    offerId: z.string().min(1).max(128),
    championId: z.string().min(1).max(128),
    variantId: z.string().min(1).max(128),
    slot: SlotSchema,
    componentId: z.string().min(1).max(128),
  })
  .strict();

const CompletedBuildSchema = z
  .object({
    body: LobbySelectionSchema,
    q: LobbySelectionSchema,
    w: LobbySelectionSchema,
    e: LobbySelectionSchema,
    r: LobbySelectionSchema,
    passive: LobbySelectionSchema,
  })
  .strict();

const CompletedRunSchema = z
  .object({
    snapshotVersion: z.string().min(1),
    build: CompletedBuildSchema,
    picks: z.array(LobbySelectionSchema).length(6),
  })
  .strict();

export const LobbyStateSchema = z
  .object({
    schemaVersion: z.literal(LOBBY_STATE_VERSION),
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    snapshotVersion: z.string().min(1),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    phase: LobbyPhaseSchema,
    hostParticipantId: IdSchema,
    participants: z.array(ParticipantSchema).max(29),
    settings: LobbySettingsSchema,
    draftsByParticipantId: z.record(PersistedDraftingRunSchema),
    roundLocksByParticipantId: z.record(LobbySelectionSchema),
    completedRunsByParticipantId: z.record(CompletedRunSchema),
    revealOrderParticipantIds: z.array(IdSchema).max(8),
    revealedCount: z.number().int().min(0).max(8),
    votesByIdentityHash: z.record(z.string().min(1).max(64), IdSchema),
    deadlineAt: TimestampSchema.nullable(),
    recentCommands: z.array(RecentCommandSchema).max(MAX_RECENT_COMMANDS),
    createdAt: TimestampSchema,
    lastActivityAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const participantIds = new Set<string>();
    const identityHashes = new Set<string>();
    let hostCount = 0;
    let playerCount = 0;
    let spectatorCount = 0;
    let displayCount = 0;

    for (const [index, participant] of state.participants.entries()) {
      if (participantIds.has(participant.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['participants', index, 'id'],
          message: `Duplicate participant id ${participant.id}.`,
        });
      }
      participantIds.add(participant.id);

      if (participant.role === 'host' && !participant.hasLeft) hostCount += 1;
      if (!participant.hasLeft && (participant.role === 'host' || participant.role === 'player'))
        playerCount += 1;
      if (participant.role === 'spectator' && !participant.hasLeft) spectatorCount += 1;
      if (participant.role === 'display') displayCount += 1;
      if (participant.identityKeyHash && participant.role !== 'display' && !participant.hasLeft) {
        if (identityHashes.has(participant.identityKeyHash)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['participants', index, 'identityKeyHash'],
            message: 'A browser identity may occupy only one active seat in a room.',
          });
        }
        identityHashes.add(participant.identityKeyHash);
      }
    }

    if (
      hostCount !== 1 ||
      !state.participants.some(
        (participant) =>
          participant.id === state.hostParticipantId &&
          participant.role === 'host' &&
          !participant.hasLeft,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hostParticipantId'],
        message: 'The host id must identify the single host participant.',
      });
    }
    if (playerCount < 1 || playerCount > 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participants'],
        message: 'A lobby must contain between one and eight player seats before start.',
      });
    }
    if (spectatorCount > 20 || displayCount > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['participants'],
        message: 'Lobby spectator or display capacity was exceeded.',
      });
    }
    if (state.expiresAt < state.lastActivityAt || state.createdAt > state.lastActivityAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'Lobby activity and expiry timestamps are inconsistent.',
      });
    }

    const draftIds = Object.keys(state.draftsByParticipantId);
    const lockIds = Object.keys(state.roundLocksByParticipantId);
    const completedIds = Object.keys(state.completedRunsByParticipantId);
    const candidateIds = state.revealOrderParticipantIds;
    const hasVotes = Object.keys(state.votesByIdentityHash).length > 0;
    if (
      state.phase === 'waiting' &&
      (draftIds.length > 0 ||
        lockIds.length > 0 ||
        completedIds.length > 0 ||
        state.deadlineAt !== null ||
        candidateIds.length > 0 ||
        state.revealedCount !== 0 ||
        hasVotes)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['draftsByParticipantId'],
        message: 'Waiting lobbies cannot contain generated draft or lock state.',
      });
    }
    for (const participantId of draftIds) {
      const participant = state.participants.find((candidate) => candidate.id === participantId);
      if (
        !participant ||
        participant.hasLeft ||
        (participant.role !== 'host' && participant.role !== 'player')
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['draftsByParticipantId', participantId],
          message: 'Only drafting players may own a private draft state.',
        });
      }
    }
    const playerIds = new Set(
      state.participants
        .filter(
          (participant) =>
            !participant.hasLeft && (participant.role === 'host' || participant.role === 'player'),
        )
        .map(({ id }) => id),
    );
    if (state.phase === 'drafting') {
      if (
        state.deadlineAt === null ||
        draftIds.length !== playerIds.size ||
        completedIds.length > 0 ||
        candidateIds.length > 0 ||
        state.revealedCount !== 0 ||
        hasVotes
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadlineAt'],
          message: 'Drafting rooms need one active draft per player and one round deadline.',
        });
      }
      for (const participantId of lockIds) {
        if (!playerIds.has(participantId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['roundLocksByParticipantId', participantId],
            message: 'Only drafting players may own a current-round lock.',
          });
        }
      }
    } else if (state.phase === 'draft-complete') {
      if (
        state.deadlineAt !== null ||
        draftIds.length > 0 ||
        lockIds.length > 0 ||
        completedIds.length !== playerIds.size ||
        candidateIds.length !== completedIds.length ||
        state.revealedCount !== 0 ||
        hasVotes ||
        [...playerIds].some(
          (participantId) => !(participantId in state.completedRunsByParticipantId),
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedRunsByParticipantId'],
          message: 'Completed drafts must retain one private completion per player.',
        });
      }
    } else if (
      state.phase === 'revealing' ||
      state.phase === 'voting' ||
      state.phase === 'results'
    ) {
      const allCandidatesPresent =
        candidateIds.length > 0 &&
        candidateIds.length === completedIds.length &&
        new Set(candidateIds).size === candidateIds.length &&
        candidateIds.every((participantId) => participantId in state.completedRunsByParticipantId);
      if (draftIds.length > 0 || lockIds.length > 0 || !allCandidatesPresent) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedRunsByParticipantId'],
          message: 'Reveal and vote phases must retain the completed builds in their reveal order.',
        });
      }
      const allRevealed = state.revealedCount === candidateIds.length;
      if (
        (state.phase === 'revealing' &&
          (state.deadlineAt === null ||
            state.revealedCount < 1 ||
            state.revealedCount > candidateIds.length ||
            hasVotes)) ||
        (state.phase === 'voting' && (state.deadlineAt === null || !allRevealed)) ||
        (state.phase === 'results' && (state.deadlineAt !== null || !allRevealed))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deadlineAt'],
          message: 'Reveal, voting, and results must keep a valid phase deadline and build set.',
        });
      }
      for (const [identityHash, targetId] of Object.entries(state.votesByIdentityHash)) {
        if (!candidateIds.includes(targetId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['votesByIdentityHash', identityHash],
            message: 'A ballot must target a completed build in this room.',
          });
        }
      }
      if (state.phase === 'revealing' && hasVotes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['votesByIdentityHash'],
          message: 'Voting cannot begin before the reveal phase ends.',
        });
      }
    } else if (
      state.phase !== 'waiting' &&
      state.phase !== 'drafting' &&
      state.phase !== 'draft-complete'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['draftsByParticipantId'],
        message: 'Lobby phase contains unsupported draft state.',
      });
    }
    if (
      state.phase !== 'drafting' &&
      state.phase !== 'revealing' &&
      state.phase !== 'voting' &&
      state.deadlineAt !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deadlineAt'],
        message: 'Only timed lobby phases may hold a deadline.',
      });
    }
  });
export type LobbyState = z.infer<typeof LobbyStateSchema>;

const LobbyParticipantV2Schema = z
  .object({
    id: IdSchema,
    nickname: z.string().min(2).max(16),
    role: LobbyRoleSchema,
    ready: z.boolean(),
    isConnected: z.boolean(),
    connectionId: IdSchema.nullable(),
    connectedAt: TimestampSchema.nullable(),
    joinedAt: TimestampSchema,
    reconnectTokenHash: TokenHashSchema,
  })
  .strict();

/** Exact reader for the persisted v2 shape; new writes use LobbyStateSchema. */
export const LobbyStateV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    protocolVersion: z.literal(2),
    snapshotVersion: z.string().min(1),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    phase: z.enum(['waiting', 'drafting', 'draft-complete']),
    hostParticipantId: IdSchema,
    participants: z.array(LobbyParticipantV2Schema).max(29),
    settings: LobbySettingsSchema,
    draftsByParticipantId: z.record(PersistedDraftingRunSchema),
    roundLocksByParticipantId: z.record(LobbySelectionSchema),
    completedRunsByParticipantId: z.record(CompletedRunSchema),
    deadlineAt: TimestampSchema.nullable(),
    recentCommands: z.array(RecentCommandSchema).max(MAX_RECENT_COMMANDS),
    createdAt: TimestampSchema,
    lastActivityAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .strict();
export type LobbyStateV2 = z.infer<typeof LobbyStateV2Schema>;

const ClientCommandBase = z.object({
  protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
  commandId: CommandIdSchema,
  roomRevision: z.number().int().nonnegative(),
});

export const ClientCommandSchema = z.discriminatedUnion('type', [
  ClientCommandBase.extend({
    type: z.literal('player.ready'),
    payload: z.object({ ready: z.boolean() }).strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('player.lock'),
    payload: z
      .object({
        round: z.number().int().min(1).max(6),
        selection: LobbySelectionSchema,
      })
      .strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('host.settings'),
    payload: LobbySettingsSchema,
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('host.remove'),
    payload: z.object({ participantId: IdSchema }).strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('host.start'),
    payload: z.object({}).strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('host.reveal.advance'),
    payload: z.object({}).strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('player.vote'),
    payload: z.object({ participantId: IdSchema, phaseDeadlineAt: TimestampSchema }).strict(),
  }).strict(),
  ClientCommandBase.extend({
    type: z.literal('host.rematch'),
    payload: z.object({}).strict(),
  }).strict(),
]);
export type ClientCommand = z.infer<typeof ClientCommandSchema>;

export const CreateLobbyRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    roomCode: RoomCodeSchema,
    host: z
      .object({
        participantId: IdSchema,
        nickname: z.string().max(64),
        reconnectTokenHash: TokenHashSchema,
        identityKeyHash: IdentityKeyHashSchema.nullable(),
      })
      .strict(),
    now: TimestampSchema,
    snapshotVersion: z.string().min(1),
  })
  .strict();
export type CreateLobbyRequest = z.infer<typeof CreateLobbyRequestSchema>;

export const JoinLobbyRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: IdSchema,
    nickname: z.string().max(64).optional(),
    requestedRole: z.enum(['player', 'spectator', 'display']),
    reconnectTokenHash: TokenHashSchema,
    identityKeyHash: IdentityKeyHashSchema.nullable(),
    now: TimestampSchema,
  })
  .strict();
export type JoinLobbyRequest = z.infer<typeof JoinLobbyRequestSchema>;

export const LeaveLobbyRequestSchema = z
  .object({ participantId: IdSchema, reconnectTokenHash: TokenHashSchema, now: TimestampSchema })
  .strict();

export const AttachIdentityRequestSchema = z
  .object({
    participantId: IdSchema,
    reconnectTokenHash: TokenHashSchema,
    identityKeyHash: IdentityKeyHashSchema,
    now: TimestampSchema,
  })
  .strict();

export const RecoverIdentityRequestSchema = z
  .object({
    participantId: IdSchema,
    identityKeyHash: IdentityKeyHashSchema,
    reconnectTokenHash: TokenHashSchema,
    now: TimestampSchema,
  })
  .strict();

export const RecoverIdentityResultSchema = z
  .object({
    participantId: IdSchema,
    role: LobbyRoleSchema,
    nickname: z.string().min(2).max(16),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    expiresAt: TimestampSchema,
  })
  .strict();

export const PublicJoinRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    nickname: z.string().max(64).optional(),
    role: z.enum(['player', 'spectator', 'display']).optional(),
    browserIdentityToken: BrowserIdentityTokenSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if ((request.role ?? 'player') !== 'display' && !request.browserIdentityToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['browserIdentityToken'],
        message: 'A browser identity is required to join a participant seat.',
      });
    }
  });
export type PublicJoinRequest = z.infer<typeof PublicJoinRequestSchema>;

export const PublicCreateRoomRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    nickname: z.string().max(64),
    browserIdentityToken: BrowserIdentityTokenSchema,
  })
  .strict();
export type PublicCreateRoomRequest = z.infer<typeof PublicCreateRoomRequestSchema>;

export const PublicLeaveRoomRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: IdSchema,
    reconnectToken: z.string().min(32).max(64),
    browserIdentityToken: BrowserIdentityTokenSchema,
  })
  .strict();

export const PublicClaimRoomRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: IdSchema,
    reconnectToken: z.string().min(32).max(64),
    browserIdentityToken: BrowserIdentityTokenSchema,
  })
  .strict();

export const PublicRecoverRoomRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    browserIdentityToken: BrowserIdentityTokenSchema,
  })
  .strict();

export const BrowserIdentityClaimSchema = z
  .object({
    schemaVersion: z.literal(1),
    identityKeyHash: IdentityKeyHashSchema,
    roomCode: RoomCodeSchema,
    participantId: IdSchema,
    status: z.enum(['pending', 'active']),
    expiresAt: TimestampSchema,
  })
  .strict();
export type BrowserIdentityClaim = z.infer<typeof BrowserIdentityClaimSchema>;

export const BrowserIdentityReserveRequestSchema = z
  .object({
    identityKeyHash: IdentityKeyHashSchema,
    roomCode: RoomCodeSchema,
    participantId: IdSchema,
    now: TimestampSchema,
  })
  .strict();

export const BrowserIdentityCommitRequestSchema = z
  .object({
    roomCode: RoomCodeSchema,
    participantId: IdSchema,
    expiresAt: TimestampSchema,
    now: TimestampSchema,
  })
  .strict();

export const BrowserIdentityReleaseRequestSchema = z
  .object({ roomCode: RoomCodeSchema, participantId: IdSchema })
  .strict();

export const BrowserIdentityRecoverRequestSchema = z
  .object({ identityKeyHash: IdentityKeyHashSchema, now: TimestampSchema })
  .strict();

export const BrowserIdentityRecoverResponseSchema = z
  .object({ roomCode: RoomCodeSchema, participantId: IdSchema, expiresAt: TimestampSchema })
  .strict();

export const LobbyIdentityStatusRequestSchema = z
  .object({ participantId: IdSchema, identityKeyHash: IdentityKeyHashSchema })
  .strict();

export const LobbyIdentityStatusSchema = z
  .object({ active: z.boolean(), expiresAt: TimestampSchema.optional() })
  .strict();

export const PublicRoomInfoSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    roomCode: RoomCodeSchema,
    phase: LobbyPhaseSchema,
    mode: LobbyModeSchema,
    speed: LobbySpeedSchema,
    revealOrder: RevealOrderSchema,
    playerCount: z.number().int().min(1).max(8),
    readyCount: z.number().int().min(0).max(8),
    spectatorCount: z.number().int().min(0).max(20),
    hasDisplay: z.boolean(),
    expiresAt: TimestampSchema,
  })
  .strict();
export type PublicRoomInfo = z.infer<typeof PublicRoomInfoSchema>;

export const PublicErrorSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    error: z.string().min(1).max(48),
    message: z.string().min(1).max(160),
  })
  .strict();

export const JoinResponseSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: IdSchema,
    role: LobbyRoleSchema,
    nickname: z.string().min(2).max(16),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    reconnectToken: z.string().min(32).max(64),
    socketPath: z.string().min(1),
  })
  .strict();
export type JoinResponse = z.infer<typeof JoinResponseSchema>;

export const ParticipantProjectionSchema = z
  .object({
    id: IdSchema,
    nickname: z.string().min(2).max(16),
    role: LobbyRoleSchema,
    ready: z.boolean(),
    isConnected: z.boolean(),
    lockedThisRound: z.boolean(),
    hasLeft: z.boolean(),
  })
  .strict();

const DisplayValueProjectionSchema = z
  .object({
    label: z.string(),
    values: z.array(z.union([z.number(), z.string()])),
    units: z.string().optional(),
  })
  .strict();

const ComponentProjectionSchema = z
  .object({
    id: z.string().min(1),
    slot: SlotSchema,
    name: z.string().min(1),
    iconRef: z.string().min(1),
    shortDescription: z.string(),
    fullDescription: z.string(),
    cooldown: DisplayValueProjectionSchema.optional(),
    cooldowns: z.array(DisplayValueProjectionSchema).optional(),
    range: DisplayValueProjectionSchema.optional(),
    ranges: z.array(DisplayValueProjectionSchema).optional(),
    healthCost: DisplayValueProjectionSchema.optional(),
    healthCosts: z.array(DisplayValueProjectionSchema).optional(),
    values: z.array(DisplayValueProjectionSchema),
    availability: AvailabilitySchema,
    dependencies: z.array(z.object({ kind: z.string(), description: z.string() }).strict()),
    carriedMechanics: z.array(z.object({ id: z.string(), description: z.string() }).strict()),
    bodyStats: BodyStatsSchema.optional(),
  })
  .strict();

const RevealedBuildSlotSchema = z
  .object({
    slot: SlotSchema,
    componentId: z.string().min(1),
    name: z.string().min(1),
    iconRef: z.string().min(1),
    shortDescription: z.string(),
    fullDescription: z.string(),
    champion: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        title: z.string().min(1),
        icon: z.string().min(1),
        defaultSplash: z.string().min(1),
        defaultLoading: z.string().min(1),
      })
      .strict(),
    variant: z.object({ id: z.string().min(1), label: z.string().optional() }).strict(),
  })
  .strict();

const RevealedBuildSchema = z
  .object({
    participantId: IdSchema,
    nickname: z.string().min(2).max(16),
    hasLeft: z.boolean(),
    build: z
      .object({
        body: RevealedBuildSlotSchema,
        q: RevealedBuildSlotSchema,
        w: RevealedBuildSlotSchema,
        e: RevealedBuildSlotSchema,
        r: RevealedBuildSlotSchema,
        passive: RevealedBuildSlotSchema,
      })
      .strict(),
  })
  .strict();

const VoteTotalSchema = z
  .object({ participantId: IdSchema, votes: z.number().int().min(0).max(28) })
  .strict();

export const OfferProjectionSchema = z
  .object({
    id: z.string().min(1),
    champion: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        title: z.string().min(1),
        icon: z.string().min(1),
        defaultSplash: z.string().min(1),
        defaultLoading: z.string().min(1),
      })
      .strict(),
    variant: z.object({ id: z.string().min(1), label: z.string().optional() }).strict(),
    selectableSlots: z.array(SlotSchema),
    components: z
      .object({
        body: ComponentProjectionSchema,
        q: ComponentProjectionSchema,
        w: ComponentProjectionSchema,
        e: ComponentProjectionSchema,
        r: ComponentProjectionSchema,
        passive: ComponentProjectionSchema,
      })
      .strict(),
  })
  .strict();
export type OfferProjection = z.infer<typeof OfferProjectionSchema>;

export const PublicOfferIdentitySchema = z
  .object({
    champion: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        title: z.string().min(1),
        icon: z.string().min(1),
        defaultSplash: z.string().min(1),
        defaultLoading: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type PublicOfferIdentity = z.infer<typeof PublicOfferIdentitySchema>;

export const PlayerOfferProjectionSchema = z
  .object({
    participantId: IdSchema,
    nickname: z.string().min(2).max(16),
    offer: PublicOfferIdentitySchema,
  })
  .strict();

export const LobbyProjectionSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    snapshotVersion: z.string().min(1),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    phase: LobbyPhaseSchema,
    role: z.enum(['host', 'player', 'spectator', 'display', 'observer']),
    selfParticipantId: IdSchema.nullable(),
    hostParticipantId: IdSchema,
    settings: LobbySettingsSchema,
    participants: z.array(ParticipantProjectionSchema).max(29),
    builds: z.array(RevealedBuildSchema).max(8),
    expiresAt: TimestampSchema,
    deadlineAt: TimestampSchema.nullable(),
    lockedCount: z.number().int().min(0).max(8),
    playerCount: z.number().int().min(1).max(8),
    candidateCount: z.number().int().min(0).max(8),
    revealedCount: z.number().int().min(0).max(8),
    selfHasVoted: z.boolean(),
    votesCastCount: z.number().int().min(0).max(28),
    votableParticipantIds: z.array(IdSchema).max(8).optional(),
    voteTotals: z.array(VoteTotalSchema).max(8).optional(),
    winnerIds: z.array(IdSchema).max(8).optional(),
    currentRound: z.number().int().min(1).max(6).optional(),
    offer: z.union([OfferProjectionSchema, PublicOfferIdentitySchema]).optional(),
    offersByPlayer: z.array(PlayerOfferProjectionSchema).max(8).optional(),
  })
  .strict();
export type LobbyProjection = z.infer<typeof LobbyProjectionSchema>;

export const ServerEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
      revision: z.number().int().positive(),
      type: z.literal('lobby.snapshot'),
      payload: LobbyProjectionSchema,
    })
    .strict(),
  z
    .object({
      protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
      revision: z.number().int().positive(),
      type: z.literal('command.ack'),
      payload: z
        .object({
          commandId: CommandIdSchema,
          appliedRevision: z.number().int().positive(),
          duplicate: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
      revision: z.number().int().positive(),
      type: z.literal('lobby.error'),
      payload: z
        .object({
          commandId: CommandIdSchema.optional(),
          code: z.enum([
            'invalid_command',
            'stale_revision',
            'unauthorized',
            'wrong_phase',
            'not_enough_ready_players',
            'participant_not_found',
            'unsupported_command',
            'rate_limited',
            'offer_generation_failed',
            'already_locked',
            'offer_mismatch',
          ]),
          message: z.string().min(1).max(160),
        })
        .strict(),
    })
    .strict(),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const WebSocketAttachmentSchema = z
  .object({
    schemaVersion: z.literal(LOBBY_STATE_VERSION),
    participantId: IdSchema,
    connectionId: IdSchema,
  })
  .strict();
export type WebSocketAttachment = z.infer<typeof WebSocketAttachmentSchema>;

export const WebSocketAttachmentV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    participantId: IdSchema,
    connectionId: IdSchema,
  })
  .strict();

export const SocketProtocolSchema = z.literal('buildchamp.v3');

export const LobbyStartResultSchema = z
  .object({ revision: z.number().int().positive(), phase: z.literal('drafting') })
  .strict();

export const CreateResultSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    roomCode: RoomCodeSchema,
    participantId: IdSchema,
    nickname: z.string().min(2).max(16),
    revision: z.number().int().positive(),
    expiresAt: TimestampSchema,
  })
  .strict();

export const AddParticipantResultSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: IdSchema,
    role: LobbyRoleSchema,
    nickname: z.string().min(2).max(16),
    roomCode: RoomCodeSchema,
    revision: z.number().int().positive(),
    expiresAt: TimestampSchema,
  })
  .strict();
