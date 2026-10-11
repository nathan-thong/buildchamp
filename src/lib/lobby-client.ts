import { z } from 'zod';

import {
  ClientCommandSchema,
  JoinResponseSchema,
  LOBBY_PROTOCOL_VERSION,
  PublicCreateRoomRequestSchema,
  PublicErrorSchema,
  PublicJoinRequestSchema,
  ServerEventSchema,
  type ClientCommand,
  type JoinResponse,
  type LobbyProjection,
} from '../../worker/lobby/schemas';

export const LOBBY_SESSION_STORAGE_KEY = 'buildchamp.multiplayer-sessions.v1';

export const LobbySessionSchema = z
  .object({
    protocolVersion: z.literal(LOBBY_PROTOCOL_VERSION),
    participantId: z.string().uuid(),
    reconnectToken: z.string().min(32).max(64),
    socketPath: z.string().regex(/^\/api\/rooms\/[A-HJ-NP-Z2-9]{6}\/socket$/u),
    roomCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/u),
    role: z.enum(['host', 'player', 'spectator', 'display']),
    nickname: z.string().min(2).max(16),
  })
  .strict();
export type LobbySession = z.infer<typeof LobbySessionSchema>;

const LobbySessionStoreSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessions: z.array(LobbySessionSchema).max(8),
  })
  .strict();

export type LobbyCommandRequest =
  | { type: 'player.ready'; payload: { ready: boolean } }
  | {
      type: 'host.settings';
      payload: {
        mode: 'same' | 'random';
        speed: 'quick' | 'standard' | 'relaxed';
        revealOrder: 'staged' | 'all-at-once';
      };
    }
  | { type: 'host.remove'; payload: { participantId: string } }
  | { type: 'host.start'; payload: Record<string, never> }
  | {
      type: 'player.lock';
      payload: {
        round: number;
        selection: {
          offerId: string;
          championId: string;
          variantId: string;
          slot: 'body' | 'q' | 'w' | 'e' | 'r' | 'passive';
          componentId: string;
        };
      };
    };

function getStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readLobbySessions(storage?: Storage): LobbySession[] {
  const target = getStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(LOBBY_SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = LobbySessionStoreSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data.sessions;
    target.removeItem(LOBBY_SESSION_STORAGE_KEY);
    return [];
  } catch {
    try {
      target.removeItem(LOBBY_SESSION_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
    return [];
  }
}

export function findLobbySession(
  roomCode: string,
  role?: LobbySession['role'],
  storage?: Storage,
): LobbySession | null {
  const normalizedCode = roomCode.toUpperCase();
  return (
    readLobbySessions(storage).find(
      (session) =>
        session.roomCode === normalizedCode && (role === undefined || session.role === role),
    ) ?? null
  );
}

export function saveLobbySession(input: LobbySession, storage?: Storage): boolean {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    const session = LobbySessionSchema.parse(input);
    const sessions = readLobbySessions(target).filter(
      (candidate) => candidate.participantId !== session.participantId,
    );
    target.setItem(
      LOBBY_SESSION_STORAGE_KEY,
      JSON.stringify(
        LobbySessionStoreSchema.parse({ schemaVersion: 1, sessions: [...sessions, session] }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export function removeLobbySession(session: LobbySession, storage?: Storage): void {
  const target = getStorage(storage);
  if (!target) return;
  try {
    const sessions = readLobbySessions(target).filter(
      (candidate) => candidate.participantId !== session.participantId,
    );
    if (sessions.length === 0) target.removeItem(LOBBY_SESSION_STORAGE_KEY);
    else target.setItem(LOBBY_SESSION_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, sessions }));
  } catch {
    // Losing a saved reconnect token must not affect the current in-memory session.
  }
}

export async function createLobby(nickname: string): Promise<LobbySession> {
  const body = PublicCreateRoomRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    nickname,
  });
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJoinResponse(response);
}

export async function joinLobby(
  roomCode: string,
  nickname: string,
  role: 'player' | 'spectator' | 'display' = 'player',
): Promise<LobbySession> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const body = PublicJoinRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    ...(role === 'display' ? {} : { nickname }),
    role,
  });
  const response = await fetch(`/api/rooms/${encodeURIComponent(normalizedCode)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJoinResponse(response);
}

async function readJoinResponse(response: Response): Promise<LobbySession> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new Error('The room server returned an unreadable response. Try again.');
  }
  if (!response.ok) {
    const error = PublicErrorSchema.safeParse(raw);
    throw new Error(
      error.success
        ? error.data.message
        : 'The room could not be joined. Check the code and try again.',
    );
  }
  const parsed = JoinResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('The room server returned an invalid session. Try again.');
  const session = toLobbySession(parsed.data);
  if (!saveLobbySession(session)) {
    // Keep the token only in memory when persistent storage is unavailable.
  }
  return session;
}

function toLobbySession(response: JoinResponse): LobbySession {
  return LobbySessionSchema.parse({
    protocolVersion: response.protocolVersion,
    participantId: response.participantId,
    reconnectToken: response.reconnectToken,
    socketPath: response.socketPath,
    roomCode: response.roomCode,
    role: response.role,
    nickname: response.nickname,
  });
}

export function connectLobbySocket(
  session: LobbySession,
  handlers: {
    onOpen: () => void;
    onClose: () => void;
    onProjection: (projection: LobbyProjection) => void;
    onError: (message: string) => void;
  },
): WebSocket {
  const socketUrl = new URL(session.socketPath, window.location.href);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(socketUrl, [
    `buildchamp.v${LOBBY_PROTOCOL_VERSION}`,
    `participant.${session.participantId}`,
    `token.${session.reconnectToken}`,
  ]);
  socket.addEventListener('open', handlers.onOpen);
  socket.addEventListener('close', handlers.onClose);
  socket.addEventListener('message', (event) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(event.data)) as unknown;
    } catch {
      handlers.onError('The room sent an unreadable message. Reconnecting…');
      socket.close(1002, 'Invalid server message.');
      return;
    }
    const parsed = ServerEventSchema.safeParse(raw);
    if (!parsed.success) {
      handlers.onError('The room sent an unsupported message. Reconnecting…');
      socket.close(1002, 'Invalid server message.');
      return;
    }
    if (parsed.data.type === 'lobby.snapshot') handlers.onProjection(parsed.data.payload);
    if (parsed.data.type === 'lobby.error') handlers.onError(parsed.data.payload.message);
  });
  return socket;
}

export function makeClientCommand(
  roomRevision: number,
  request: LobbyCommandRequest,
): ClientCommand {
  return ClientCommandSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    commandId: crypto.randomUUID().replaceAll('-', '_'),
    roomRevision,
    ...request,
  });
}
