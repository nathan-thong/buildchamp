import { z } from 'zod';

import {
  ClientCommandSchema,
  BrowserIdentityTokenSchema,
  JoinResponseSchema,
  LOBBY_PROTOCOL_VERSION,
  PublicCreateRoomRequestSchema,
  PublicClaimRoomRequestSchema,
  PublicErrorSchema,
  PublicJoinRequestSchema,
  PublicRecoverRoomRequestSchema,
  ServerEventSchema,
  type ClientCommand,
  type JoinResponse,
  type LobbyProjection,
} from '../../worker/lobby/schemas';

export const LOBBY_SESSION_STORAGE_KEY = 'buildchamp.multiplayer-sessions.v1';
export const BROWSER_IDENTITY_STORAGE_KEY = 'buildchamp.browser-identity.v1';
const BROWSER_IDENTITY_LOCK = 'buildchamp.browser-identity-lock-v1';
let memoryIdentityToken: string | null = null;

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

export class LobbySessionError extends Error {
  constructor(
    message: string,
    readonly terminal: boolean,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'LobbySessionError';
  }
}

const LobbySessionStoreSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessions: z.array(LobbySessionSchema).max(8),
  })
  .strict();

const LegacyLobbySessionSchema = z
  .object({
    protocolVersion: z.literal(2),
    participantId: z.string().uuid(),
    reconnectToken: z.string().min(32).max(64),
    socketPath: z.string().regex(/^\/api\/rooms\/[A-HJ-NP-Z2-9]{6}\/socket$/u),
    roomCode: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/u),
    role: z.enum(['host', 'player', 'spectator', 'display']),
    nickname: z.string().min(2).max(16),
  })
  .strict();
const LegacyLobbySessionStoreSchema = z
  .object({ schemaVersion: z.literal(1), sessions: z.array(LegacyLobbySessionSchema).max(8) })
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
  | { type: 'host.reveal.advance'; payload: Record<string, never> }
  | { type: 'player.vote'; payload: { participantId: string } }
  | { type: 'host.rematch'; payload: Record<string, never> }
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

export async function getBrowserIdentityToken(storage?: Storage): Promise<string> {
  const target = getStorage(storage);
  if (!target) {
    memoryIdentityToken ??= createBrowserIdentityToken();
    return memoryIdentityToken;
  }
  const readOrCreate = () => {
    try {
      const raw = target.getItem(BROWSER_IDENTITY_STORAGE_KEY);
      const parsed = BrowserIdentityTokenSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      const token = createBrowserIdentityToken();
      target.setItem(BROWSER_IDENTITY_STORAGE_KEY, token);
      const confirmed = BrowserIdentityTokenSchema.safeParse(
        target.getItem(BROWSER_IDENTITY_STORAGE_KEY),
      );
      return confirmed.success ? confirmed.data : token;
    } catch {
      memoryIdentityToken ??= createBrowserIdentityToken();
      return memoryIdentityToken;
    }
  };
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request(BROWSER_IDENTITY_LOCK, readOrCreate);
  }
  return readOrCreate();
}

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
    const value: unknown = JSON.parse(raw);
    const parsed = LobbySessionStoreSchema.safeParse(value);
    if (parsed.success) return parsed.data.sessions;
    const legacy = LegacyLobbySessionStoreSchema.safeParse(value);
    if (legacy.success) {
      const migrated = LobbySessionStoreSchema.parse({
        schemaVersion: 1,
        sessions: legacy.data.sessions.map((session) => ({
          ...session,
          protocolVersion: LOBBY_PROTOCOL_VERSION,
        })),
      });
      target.setItem(LOBBY_SESSION_STORAGE_KEY, JSON.stringify(migrated));
      return migrated.sessions;
    }
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
    const sessions = readLobbySessions(target).filter((candidate) =>
      session.role === 'display'
        ? candidate.participantId !== session.participantId
        : candidate.role === 'display' || candidate.participantId === session.participantId,
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
  const browserIdentityToken = await getBrowserIdentityToken();
  const existing = await claimSavedParticipantSession(browserIdentityToken);
  if (existing) return existing;
  const body = PublicCreateRoomRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    nickname,
    browserIdentityToken,
  });
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJoinResponseOrRecover(response, browserIdentityToken);
}

export async function joinLobby(
  roomCode: string,
  nickname: string,
  role: 'player' | 'spectator' | 'display' = 'player',
): Promise<LobbySession> {
  const normalizedCode = roomCode.trim().toUpperCase();
  if (role !== 'display') {
    const existing = findLobbySession(normalizedCode);
    if (existing) return existing;
  }
  const browserIdentityToken = await getBrowserIdentityToken();
  if (role !== 'display') {
    const existing = await claimSavedParticipantSession(browserIdentityToken);
    if (existing) return existing;
  }
  const body = PublicJoinRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    ...(role === 'display' ? {} : { nickname }),
    role,
    browserIdentityToken,
  });
  const response = await fetch(`/api/rooms/${encodeURIComponent(normalizedCode)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJoinResponseOrRecover(response, browserIdentityToken);
}

export async function leaveLobby(session: LobbySession): Promise<void> {
  const browserIdentityToken = await getBrowserIdentityToken();
  const response = await fetch(`/api/rooms/${encodeURIComponent(session.roomCode)}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      protocolVersion: LOBBY_PROTOCOL_VERSION,
      participantId: session.participantId,
      reconnectToken: session.reconnectToken,
      browserIdentityToken,
    }),
  });
  if (!response.ok) {
    let message = 'The room could not be left. Reconnect and try again.';
    try {
      const parsed = PublicErrorSchema.safeParse(await response.json());
      if (parsed.success) message = parsed.data.message;
    } catch {
      // Keep the useful fallback for non-JSON network errors.
    }
    throw new Error(message);
  }
  removeLobbySession(session);
}

export async function claimLobbySession(session: LobbySession): Promise<void> {
  if (session.role === 'display') return;
  const browserIdentityToken = await getBrowserIdentityToken();
  const body = PublicClaimRoomRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    participantId: session.participantId,
    reconnectToken: session.reconnectToken,
    browserIdentityToken,
  });
  const response = await fetch(`/api/rooms/${encodeURIComponent(session.roomCode)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const error = PublicErrorSchema.safeParse(await response.json().catch(() => undefined));
  const terminal = response.status === 401 || response.status === 404 || response.status === 409;
  if (response.status === 401 || response.status === 404) removeLobbySession(session);
  throw new LobbySessionError(
    error.success ? error.data.message : 'This saved room session could not be restored.',
    terminal,
  );
}

async function claimSavedParticipantSession(
  browserIdentityToken: string,
): Promise<LobbySession | null> {
  const session = readLobbySessions().find((candidate) => candidate.role !== 'display');
  if (!session) return null;
  try {
    await claimSessionWithToken(session, browserIdentityToken);
    return session;
  } catch (error) {
    if (error instanceof Error && error.message === 'stale_saved_session') {
      removeLobbySession(session);
      return null;
    }
    throw error;
  }
}

async function claimSessionWithToken(
  session: LobbySession,
  browserIdentityToken: string,
): Promise<void> {
  const body = PublicClaimRoomRequestSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    participantId: session.participantId,
    reconnectToken: session.reconnectToken,
    browserIdentityToken,
  });
  const response = await fetch(`/api/rooms/${encodeURIComponent(session.roomCode)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const error = PublicErrorSchema.safeParse(await response.json().catch(() => undefined));
  if (response.status === 401 || response.status === 404) throw new Error('stale_saved_session');
  throw new Error(
    error.success ? error.data.message : 'Your saved room session could not be verified.',
  );
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
    const message = error.success
      ? error.data.message
      : 'The room could not be joined. Check the code and try again.';
    throw new LobbySessionError(
      message,
      response.status === 401 || response.status === 404 || response.status === 409,
      error.success ? error.data.error : undefined,
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

async function readJoinResponseOrRecover(
  response: Response,
  browserIdentityToken: string,
): Promise<LobbySession> {
  try {
    return await readJoinResponse(response);
  } catch (cause) {
    if (cause instanceof LobbySessionError && cause.code === 'active_lobby') {
      const body = PublicRecoverRoomRequestSchema.parse({
        protocolVersion: LOBBY_PROTOCOL_VERSION,
        browserIdentityToken,
      });
      const recovered = await fetch('/api/rooms/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return readJoinResponse(recovered);
    }
    throw cause;
  }
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

function createBrowserIdentityToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function connectLobbySocket(
  session: LobbySession,
  handlers: {
    onOpen: () => void;
    onClose: (event: CloseEvent) => void;
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
  phaseDeadlineAt: number | null,
): ClientCommand {
  if (request.type === 'player.vote' && phaseDeadlineAt === null) {
    throw new Error('A vote needs the current voting deadline.');
  }
  const requestWithPhase =
    request.type === 'player.vote'
      ? {
          ...request,
          payload: { ...request.payload, phaseDeadlineAt },
        }
      : request;
  return ClientCommandSchema.parse({
    protocolVersion: LOBBY_PROTOCOL_VERSION,
    commandId: crypto.randomUUID().replaceAll('-', '_'),
    roomRevision,
    ...requestWithPhase,
  });
}
