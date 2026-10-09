import { DurableObject } from 'cloudflare:workers';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../../src/data/runtime-snapshot.ts';
import {
  AddParticipantResultSchema,
  CreateLobbyRequestSchema,
  CreateResultSchema,
  JoinLobbyRequestSchema,
  LobbyStateSchema,
  PublicRoomInfoSchema,
  ServerEventSchema,
  WebSocketAttachmentSchema,
  type LobbyState,
  type ServerEvent,
  type WebSocketAttachment,
} from './schemas.ts';
import {
  addLobbyParticipant,
  connectLobbyParticipant,
  createLobbyState,
  disconnectLobbyParticipant,
  handleLobbyCommand,
  isLobbyExpired,
  isDraftingPlayer,
  projectLobby,
  type LobbyCommandFailure,
} from './state.ts';
import { ClientCommandSchema } from './schemas.ts';

const STATE_KEY = 'lobby-state-v1';
const MAX_COMMAND_BYTES = 4 * 1024;
const COMMAND_WINDOW_MS = 10_000;
const MAX_COMMANDS_PER_WINDOW = 24;

export type LobbyEnv = WorkerEnv;
type LobbyErrorCode = Extract<ServerEvent, { type: 'lobby.error' }>['payload']['code'];

export class BuildChampLobby extends DurableObject<LobbyEnv> {
  private commandWindows = new Map<string, number[]>();
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: LobbyEnv) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/internal/create' && request.method === 'POST') {
      return this.createRoom(request);
    }
    if (path === '/internal/info' && request.method === 'GET') {
      return this.roomInfo();
    }
    if (path === '/internal/join' && request.method === 'POST') {
      return this.joinRoom(request);
    }
    if (path === '/internal/socket' && request.method === 'GET') {
      return this.connectSocket(request);
    }
    return jsonResponse({ error: 'not_found', message: 'Room route not found.' }, 404);
  }

  async alarm(): Promise<void> {
    await this.serialize(async () => {
      const state = await this.readState();
      if (!state) return;
      if (isLobbyExpired(state, Date.now())) {
        this.closeAllSockets(1001, 'Room expired.');
        await this.ctx.storage.deleteAll();
        return;
      }
      await this.ctx.storage.setAlarm(state.expiresAt);
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.serialize(async () => {
      const attachment = readAttachment(ws);
      if (!attachment) {
        ws.close(1008, 'Invalid connection.');
        return;
      }
      if (!this.allowCommand(attachment.participantId, Date.now())) {
        this.sendError(ws, undefined, 'rate_limited', 'Please slow down and try again.');
        return;
      }

      const byteLength =
        typeof message === 'string'
          ? new TextEncoder().encode(message).byteLength
          : message.byteLength;
      if (byteLength > MAX_COMMAND_BYTES || typeof message !== 'string') {
        this.sendError(ws, undefined, 'invalid_command', 'Send a small JSON command envelope.');
        return;
      }

      let raw: unknown;
      try {
        raw = JSON.parse(message);
      } catch {
        this.sendError(ws, undefined, 'invalid_command', 'The command was not valid JSON.');
        return;
      }
      const parsed = ClientCommandSchema.safeParse(raw);
      if (!parsed.success) {
        this.sendError(ws, undefined, 'invalid_command', 'The command envelope was invalid.');
        return;
      }

      const state = await this.readState();
      if (!state) {
        ws.close(1008, 'Room expired.');
        return;
      }
      const result = handleLobbyCommand(
        state,
        { participantId: attachment.participantId, connectionId: attachment.connectionId },
        parsed.data,
        {
          now: Date.now(),
          snapshot: BUNDLED_CHAMPION_SNAPSHOT,
          random: secureRandom,
        },
      );

      if (!result.ok) {
        this.sendCommandFailure(ws, result);
        return;
      }

      await this.saveState(result.state);
      this.sendEvent(ws, {
        protocolVersion: result.state.protocolVersion,
        revision: result.state.revision,
        type: 'command.ack',
        payload: {
          commandId: result.commandId,
          appliedRevision: result.appliedRevision,
          duplicate: result.duplicate,
        },
      });
      if (result.changed) {
        this.broadcastSnapshots(result.state);
      }
    });
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    void code;
    void reason;
    void wasClean;
    const attachment = readAttachment(ws);
    if (!attachment) return;
    await this.serialize(async () => {
      const state = await this.readState();
      if (!state) return;
      const nextState = disconnectLobbyParticipant(
        state,
        attachment.participantId,
        attachment.connectionId,
        Date.now(),
      );
      if (nextState === state) return;
      await this.saveState(nextState);
      this.broadcastSnapshots(nextState);
    });
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    void error;
    await this.webSocketClose(ws, 1011, 'Connection error.', false);
  }

  private async createRoom(request: Request): Promise<Response> {
    const parsed = await parseJsonRequest(request, CreateLobbyRequestSchema);
    if (!parsed.success) return invalidBodyResponse();

    return this.serialize(async () => {
      const existing = await this.readState();
      if (existing)
        return jsonResponse({ error: 'room_exists', message: 'Room code already exists.' }, 409);

      let state: LobbyState;
      try {
        state = this.createInitialState(parsed.data);
      } catch {
        return jsonResponse({ error: 'invalid_room', message: 'Could not create the room.' }, 400);
      }
      await this.saveState(state);
      const result = CreateResultSchema.parse({
        protocolVersion: 1,
        roomCode: state.roomCode,
        participantId: state.hostParticipantId,
        nickname: state.participants[0]?.nickname,
        revision: state.revision,
        expiresAt: state.expiresAt,
      });
      return jsonResponse(result, 201);
    });
  }

  private async roomInfo(): Promise<Response> {
    return this.serialize(async () => {
      const state = await this.readState();
      if (!state) return jsonResponse({ error: 'room_not_found', message: 'Room not found.' }, 404);

      const info = PublicRoomInfoSchema.parse({
        protocolVersion: 1,
        roomCode: state.roomCode,
        phase: state.phase,
        mode: state.settings.mode,
        speed: state.settings.speed,
        revealOrder: state.settings.revealOrder,
        playerCount: state.participants.filter(isDraftingPlayer).length,
        readyCount: state.participants.filter(
          (participant) => isDraftingPlayer(participant) && participant.ready,
        ).length,
        spectatorCount: state.participants.filter((participant) => participant.role === 'spectator')
          .length,
        hasDisplay: state.participants.some((participant) => participant.role === 'display'),
        expiresAt: state.expiresAt,
      });
      return jsonResponse(info);
    });
  }

  private async joinRoom(request: Request): Promise<Response> {
    const parsed = await parseJsonRequest(request, JoinLobbyRequestSchema);
    if (!parsed.success) return invalidBodyResponse();

    return this.serialize(async () => {
      const state = await this.readState();
      if (!state) return jsonResponse({ error: 'room_not_found', message: 'Room not found.' }, 404);
      try {
        const joined = addLobbyParticipant(state, parsed.data);
        await this.saveState(joined.state);
        const result = AddParticipantResultSchema.parse({
          protocolVersion: 1,
          participantId: joined.participant.id,
          role: joined.participant.role,
          nickname: joined.participant.nickname,
          roomCode: state.roomCode,
          revision: joined.state.revision,
          expiresAt: joined.state.expiresAt,
        });
        return jsonResponse(result, 201);
      } catch (error) {
        const response = mapLobbyError(error);
        return jsonResponse(response.body, response.status);
      }
    });
  }

  private async connectSocket(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse(
        { error: 'upgrade_required', message: 'A WebSocket connection is required.' },
        426,
      );
    }
    const credentials = parseSocketCredentials(request.headers.get('Sec-WebSocket-Protocol'));
    if (!credentials) {
      return jsonResponse(
        { error: 'unauthorized', message: 'Reconnect credentials are required.' },
        401,
      );
    }
    const tokenHash = await hashToken(credentials.token);

    return this.serialize(async () => {
      const state = await this.readState();
      if (!state)
        return jsonResponse(
          { error: 'room_not_found', message: 'Room not found or expired.' },
          404,
        );
      const participant = state.participants.find(
        (candidate) => candidate.id === credentials.participantId,
      );
      if (!participant || !constantTimeEqual(participant.reconnectTokenHash, tokenHash)) {
        return jsonResponse(
          { error: 'unauthorized', message: 'Reconnect credentials are invalid.' },
          401,
        );
      }

      for (const existing of this.ctx.getWebSockets()) {
        const attachment = readAttachment(existing);
        if (attachment?.participantId === participant.id) {
          existing.close(4001, 'Reconnected from another session.');
        }
      }

      const connectionId = crypto.randomUUID();
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const attachment = WebSocketAttachmentSchema.parse({
        schemaVersion: 1,
        participantId: participant.id,
        connectionId,
      });
      server.serializeAttachment(attachment satisfies WebSocketAttachment);
      this.ctx.acceptWebSocket(server, ['participant']);

      const nextState = connectLobbyParticipant(state, participant.id, connectionId, Date.now());
      await this.saveState(nextState);
      const role = nextState.participants.find(
        (candidate) => candidate.id === participant.id,
      )?.role;
      const projection = projectLobby(
        nextState,
        { role: role ?? 'spectator', participantId: participant.id },
        BUNDLED_CHAMPION_SNAPSHOT,
      );
      this.sendEvent(server, {
        protocolVersion: nextState.protocolVersion,
        revision: nextState.revision,
        type: 'lobby.snapshot',
        payload: projection,
      });
      this.broadcastSnapshots(nextState, participant.id);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Sec-WebSocket-Protocol': 'buildchamp.v1',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      });
    });
  }

  private createInitialState(input: ReturnType<typeof CreateLobbyRequestSchema.parse>): LobbyState {
    return LobbyStateSchema.parse(createLobbyStateFromRequest(input));
  }

  private async readState(): Promise<LobbyState | null> {
    const raw = await this.ctx.storage.get<unknown>(STATE_KEY);
    if (raw === undefined) return null;
    const parsed = LobbyStateSchema.safeParse(raw);
    if (!parsed.success) {
      await this.ctx.storage.deleteAll();
      return null;
    }
    if (isLobbyExpired(parsed.data, Date.now())) {
      this.closeAllSockets(1001, 'Room expired.');
      await this.ctx.storage.deleteAll();
      return null;
    }
    return parsed.data;
  }

  private async saveState(state: LobbyState): Promise<void> {
    const validated = LobbyStateSchema.parse(state);
    await this.ctx.storage.put(STATE_KEY, validated);
    await this.ctx.storage.setAlarm(validated.expiresAt);
  }

  private broadcastSnapshots(state: LobbyState, exceptParticipantId?: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = readAttachment(ws);
      if (!attachment || attachment.participantId === exceptParticipantId) continue;
      const participant = state.participants.find(
        (candidate) => candidate.id === attachment.participantId,
      );
      if (
        !participant ||
        !participant.isConnected ||
        participant.connectionId !== attachment.connectionId
      ) {
        ws.close(1008, 'This connection no longer controls a participant.');
        continue;
      }
      try {
        this.sendEvent(ws, {
          protocolVersion: state.protocolVersion,
          revision: state.revision,
          type: 'lobby.snapshot',
          payload: projectLobby(
            state,
            { role: participant.role, participantId: participant.id },
            BUNDLED_CHAMPION_SNAPSHOT,
          ),
        });
      } catch {
        ws.close(1011, 'Unable to send room state.');
      }
    }
  }

  private sendCommandFailure(ws: WebSocket, failure: LobbyCommandFailure): void {
    this.sendError(ws, failure.commandId, failure.code, failure.message, failure.state.revision);
  }

  private sendError(
    ws: WebSocket,
    commandId: string | undefined,
    code: LobbyErrorCode,
    message: string,
    revision = 1,
  ): void {
    const event = ServerEventSchema.parse({
      protocolVersion: 1,
      revision,
      type: 'lobby.error',
      payload: { ...(commandId ? { commandId } : {}), code, message: message.slice(0, 160) },
    });
    this.sendEvent(ws, event);
  }

  private sendEvent(ws: WebSocket, event: ServerEvent): void {
    const validated = ServerEventSchema.parse(event);
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(validated));
  }

  private allowCommand(participantId: string, now: number): boolean {
    const recent = (this.commandWindows.get(participantId) ?? []).filter(
      (timestamp) => now - timestamp < COMMAND_WINDOW_MS,
    );
    if (recent.length >= MAX_COMMANDS_PER_WINDOW) {
      this.commandWindows.set(participantId, recent);
      return false;
    }
    recent.push(now);
    this.commandWindows.set(participantId, recent);
    if (this.commandWindows.size > 64) {
      for (const [storedParticipantId, timestamps] of this.commandWindows) {
        if (timestamps.every((timestamp) => now - timestamp >= COMMAND_WINDOW_MS)) {
          this.commandWindows.delete(storedParticipantId);
        }
      }
      while (this.commandWindows.size > 64) {
        const oldestId = this.commandWindows.keys().next().value as string | undefined;
        if (!oldestId) break;
        this.commandWindows.delete(oldestId);
      }
    }
    return true;
  }

  private closeAllSockets(code: number, reason: string): void {
    for (const ws of this.ctx.getWebSockets()) ws.close(code, reason);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function createLobbyStateFromRequest(
  input: ReturnType<typeof CreateLobbyRequestSchema.parse>,
): LobbyState {
  return createLobbyState({
    roomCode: input.roomCode,
    snapshotVersion: input.snapshotVersion,
    hostParticipantId: input.host.participantId,
    hostNickname: input.host.nickname,
    reconnectTokenHash: input.host.reconnectTokenHash,
    now: input.now,
  });
}

function parseSocketCredentials(
  value: string | null,
): { participantId: string; token: string } | null {
  if (!value) return null;
  const protocols = value.split(',').map((part) => part.trim());
  if (!protocols.includes('buildchamp.v1')) return null;
  const participantId = protocols
    .find((part) => part.startsWith('participant.'))
    ?.slice('participant.'.length);
  const token = protocols.find((part) => part.startsWith('token.'))?.slice('token.'.length);
  if (
    !participantId ||
    !token ||
    !/^[0-9a-f-]{36}$/iu.test(participantId) ||
    token.length < 32 ||
    token.length > 64
  ) {
    return null;
  }
  return { participantId, token };
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function readAttachment(ws: WebSocket): WebSocketAttachment | null {
  const parsed = WebSocketAttachmentSchema.safeParse(ws.deserializeAttachment());
  return parsed.success ? parsed.data : null;
}

function secureRandom(): number {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return (bytes[0] ?? 0) / 0x1_0000_0000;
}

async function parseJsonRequest<T>(
  request: Request,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): Promise<{ success: true; data: T } | { success: false }> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' || !request.body) return { success: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_COMMAND_BYTES) {
        await reader.cancel();
        return { success: false };
      }
      chunks.push(value);
    }
  } catch {
    return { success: false };
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    const parsed = schema.safeParse(raw);
    return parsed.success ? { success: true, data: parsed.data } : { success: false };
  } catch {
    return { success: false };
  }
}

function invalidBodyResponse(): Response {
  return jsonResponse({ error: 'invalid_request', message: 'The request body was invalid.' }, 400);
}

function mapLobbyError(error: unknown): {
  status: number;
  body: { error: string; message: string };
} {
  if (!(error instanceof Error) || !('code' in error)) {
    return {
      status: 400,
      body: { error: 'invalid_request', message: 'The request could not be applied.' },
    };
  }
  const code = String(error.code);
  const status =
    code === 'player_capacity_full' || code === 'spectator_capacity_full' || code === 'display_full'
      ? 409
      : code === 'participant_exists'
        ? 409
        : 400;
  return { status, body: { error: code, message: error.message.slice(0, 160) } };
}

function jsonResponse(body: unknown, status = 200): Response {
  const responseBody =
    typeof body === 'object' && body !== null && 'error' in body
      ? { protocolVersion: 1, ...body }
      : body;
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
