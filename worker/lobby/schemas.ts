import { z } from 'zod';

import { SlotSchema, AvailabilitySchema, BodyStatsSchema } from '../../src/data/snapshot-schema.ts';
import { PersistedDraftingRunSchema } from '../../src/lib/solo-run-storage.ts';

export const LOBBY_PROTOCOL_VERSION = 2 as const;
export const LOBBY_STATE_VERSION = 2 as const;
export const LOBBY_EXPIRY_MS = 60 * 60 * 1000;
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
    deadlineAt: TimestampSchema.nullable(),
    recentCommands: z.array(RecentCommandSchema).max(MAX_RECENT_COMMANDS),
    createdAt: TimestampSchema,
    lastActivityAt: TimestampSchema,
    expiresAt: TimestampSchema,
  })
  .strict()
  .superRefine((state, context) => {
    const participantIds = new Set<string>();
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

      if (participant.role === 'host') hostCount += 1;
      if (participant.role === 'host' || participant.role === 'player') playerCount += 1;
      if (participant.role === 'spectator') spectatorCount += 1;
      if (participant.role === 'display') displayCount += 1;
    }

    if (
      hostCount !== 1 ||
      !state.participants.some(
        (participant) => participant.id === state.hostParticipantId && participant.role === 'host',
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
    if (
      state.phase === 'waiting' &&
      (draftIds.length > 0 || lockIds.length > 0 || completedIds.length > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['draftsByParticipantId'],
        message: 'Waiting lobbies cannot contain generated draft or lock state.',
      });
    }
    for (const participantId of draftIds) {
      const participant = state.participants.find((candidate) => candidate.id === participantId);
      if (!participant || (participant.role !== 'host' && participant.role !== 'player')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['draftsByParticipantId', participantId],
          message: 'Only drafting players may own a private draft state.',
        });
      }
    }
    const playerIds = new Set(
      state.participants
        .filter((participant) => participant.role === 'host' || participant.role === 'player')
        .map(({ id }) => id),
    );
    if (state.phase === 'drafting') {
      if (
        state.deadlineAt === null ||
        draftIds.length !== playerIds.size ||
        completedIds.length > 0
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
      state.phase !== 'waiting' &&
      (draftIds.length > 0 || lockIds.length > 0 || completedIds.length > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['draftsByParticipantId'],
        message: 'Draft state is retained only while drafting in this slice.',
      });
    }
    if (state.phase !== 'drafting' && state.deadlineAt !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deadlineAt'],
        message: 'Only drafting rooms may hold a round deadline.',
      });
    }
  });
export type LobbyState = z.infer<typeof LobbyStateSchema>;

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
    now: TimestampSchema,
  })
  .strict();
export type JoinLobbyRequest = z.infer<typeof JoinLobbyRequestSchema>;

export const PublicJoinRequestSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    nickname: z.string().max(64).optional(),
    role: z.enum(['player', 'spectator', 'display']).optional(),
  })
  .strict();
export type PublicJoinRequest = z.infer<typeof PublicJoinRequestSchema>;

export const PublicCreateRoomRequestSchema = z
  .object({ protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION), nickname: z.string().max(64) })
  .strict();
export type PublicCreateRoomRequest = z.infer<typeof PublicCreateRoomRequestSchema>;

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
    expiresAt: TimestampSchema,
    deadlineAt: TimestampSchema.nullable(),
    lockedCount: z.number().int().min(0).max(8),
    playerCount: z.number().int().min(1).max(8),
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

export const SocketProtocolSchema = z.literal('buildchamp.v2');

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
