import { BUNDLED_CHAMPION_SNAPSHOT } from '../src/data/runtime-snapshot.ts';
import { generateRoomCode } from './lobby/state.ts';
import {
  AddParticipantResultSchema,
  BrowserIdentityRecoverResponseSchema,
  CreateResultSchema,
  JoinResponseSchema,
  LOBBY_PROTOCOL_VERSION,
  PublicLeaveRoomRequestSchema,
  PublicCreateRoomRequestSchema,
  PublicClaimRoomRequestSchema,
  PublicErrorSchema,
  PublicJoinRequestSchema,
  PublicRecoverRoomRequestSchema,
  PublicRoomInfoSchema,
  RecoverIdentityResultSchema,
} from './lobby/schemas.ts';

export { BuildChampLobby } from './lobby/durable-object.ts';
export { BuildChampBrowserIdentity } from './identity-object.ts';

export type Env = WorkerEnv;

const MAX_API_BODY_BYTES = 4 * 1024;
const REQUEST_RATE_LIMITS = {
  create: { windowMs: 60_000, maximum: 5 },
  join: { windowMs: 10_000, maximum: 30 },
  recover: { windowMs: 10_000, maximum: 20 },
} as const;
const requestWindows = new Map<string, number[]>();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: https://ddragon.leagueoflegends.com https://raw.communitydragon.org",
} as const;

function isApplicationRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/solo' ||
    pathname.startsWith('/build/') ||
    !pathname.includes('.')
  );
}

function isMissingStaticAsset(pathname: string, response: Response): boolean {
  if (isApplicationRoute(pathname) || pathname === '/index.html' || pathname === '/404.html') {
    return false;
  }

  return (
    response.status === 200 &&
    response.headers.get('Content-Type')?.split(';', 1)[0]?.toLowerCase() === 'text/html'
  );
}

function requestClass(pathname: string): 'application' | 'asset' | 'static' {
  if (isApplicationRoute(pathname)) {
    return 'application';
  }

  if (pathname.startsWith('/assets/')) {
    return 'asset';
  }

  return 'static';
}

function addResponseHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (response.status >= 400) {
    headers.set('Cache-Control', 'no-store');
  } else if (pathname.startsWith('/assets/')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (headers.get('Content-Type')?.startsWith('text/html')) {
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function handleRoomApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/rooms/recover') {
    if (request.method !== 'POST')
      return apiError(405, 'method_not_allowed', 'Use POST to recover an active room.');
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    if (isRateLimited(request, 'recover')) return rateLimitResponse();
    const body = await readApiJson(request, PublicRecoverRoomRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The recovery request was invalid.');
    return recoverPublicParticipant(body.browserIdentityToken, env);
  }

  if (pathname === '/api/rooms') {
    if (request.method !== 'POST')
      return apiError(405, 'method_not_allowed', 'Use POST to create a room.');
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    if (isRateLimited(request, 'create')) return rateLimitResponse();
    const body = await readApiJson(request, PublicCreateRoomRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The request body was invalid.');
    const identityKeyHash = await hashIdentityToken(body.browserIdentityToken);
    return createPublicRoom(body.nickname, identityKeyHash, env);
  }

  const match = pathname.match(
    /^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|socket|leave|claim))?$/u,
  );
  if (!match) return apiError(404, 'not_found', 'Room route not found.');
  const roomCode = match[1];
  const action = match[2];
  if (!roomCode) return apiError(404, 'not_found', 'Room route not found.');
  const stub = env.LOBBIES.getByName(roomCode);

  if (!action && request.method === 'GET') {
    const response = await stub.fetch(new Request('https://lobby.internal/internal/info'));
    if (!response.ok) return apiFailureFromInternal(response, 'Room not found.');
    const info = PublicRoomInfoSchema.safeParse(await safeResponseJson(response));
    return info.success
      ? apiJson(info.data)
      : apiError(502, 'invalid_room_response', 'Room information is temporarily unavailable.');
  }

  if (action === 'join' && request.method === 'POST') {
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    if (isRateLimited(request, 'join')) return rateLimitResponse();
    const body = await readApiJson(request, PublicJoinRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The request body was invalid.');
    const participantId = crypto.randomUUID();
    const reconnectToken = makeReconnectToken();
    const reconnectTokenHash = await hashReconnectToken(reconnectToken);
    const requestedRole = body.role ?? 'player';
    const identityKeyHash =
      requestedRole === 'display'
        ? null
        : await hashIdentityToken(body.browserIdentityToken as string);
    if (identityKeyHash) {
      const reserved = await reserveBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      if (!reserved.ok) return reserved.response;
    }
    const response = await stub.fetch(
      internalJsonRequest('/internal/join', {
        protocolVersion: LOBBY_PROTOCOL_VERSION,
        participantId,
        ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
        requestedRole,
        reconnectTokenHash,
        identityKeyHash,
        now: Date.now(),
      }),
    );
    if (!response.ok) {
      if (identityKeyHash)
        await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      return apiFailureFromInternal(response, 'The room could not accept this participant.');
    }
    const result = AddParticipantResultSchema.safeParse(await safeResponseJson(response));
    if (!result.success) {
      if (identityKeyHash) {
        await leaveInternalRoom(roomCode, participantId, reconnectTokenHash, env);
        await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      }
      return apiError(502, 'invalid_room_response', 'The room response was invalid.');
    }
    if (identityKeyHash) {
      const committed = await commitBrowserIdentity(
        identityKeyHash,
        roomCode,
        participantId,
        result.data.expiresAt,
        env,
      );
      if (!committed.ok) {
        await leaveInternalRoom(roomCode, participantId, reconnectTokenHash, env);
        await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
        return identityErrorResponse(committed.response);
      }
    }
    const joined = JoinResponseSchema.safeParse({
      protocolVersion: LOBBY_PROTOCOL_VERSION,
      participantId: result.data.participantId,
      role: result.data.role,
      nickname: result.data.nickname,
      roomCode,
      revision: result.data.revision,
      reconnectToken,
      socketPath: `/api/rooms/${roomCode}/socket`,
    });
    return joined.success
      ? apiJson(joined.data, 201)
      : apiError(502, 'invalid_room_response', 'The room response was invalid.');
  }

  if (action === 'leave' && request.method === 'POST') {
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    const body = await readApiJson(request, PublicLeaveRoomRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The leave request was invalid.');
    const identityKeyHash = await hashIdentityToken(body.browserIdentityToken);
    const response = await stub.fetch(
      internalJsonRequest('/internal/leave', {
        participantId: body.participantId,
        reconnectTokenHash: await hashReconnectToken(body.reconnectToken),
        now: Date.now(),
      }),
    );
    if (response.status === 404) {
      await releaseBrowserIdentity(identityKeyHash, roomCode, body.participantId, env);
      return apiJson({ left: true });
    }
    if (!response.ok)
      return apiFailureFromInternal(response, 'This room session could not be left.');
    await releaseBrowserIdentity(identityKeyHash, roomCode, body.participantId, env);
    return apiJson({ left: true });
  }

  if (action === 'claim' && request.method === 'POST') {
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    const body = await readApiJson(request, PublicClaimRoomRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The saved room session was invalid.');
    const identityKeyHash = await hashIdentityToken(body.browserIdentityToken);
    const reserved = await reserveBrowserIdentity(
      identityKeyHash,
      roomCode,
      body.participantId,
      env,
    );
    if (!reserved.ok) return identityErrorResponse(reserved.response);
    const attached = await stub.fetch(
      internalJsonRequest('/internal/claim-identity', {
        participantId: body.participantId,
        reconnectTokenHash: await hashReconnectToken(body.reconnectToken),
        identityKeyHash,
        now: Date.now(),
      }),
    );
    if (!attached.ok) {
      if (reserved.status === 'pending') {
        await releaseBrowserIdentity(identityKeyHash, roomCode, body.participantId, env);
      }
      return apiFailureFromInternal(attached, 'This saved room session could not be restored.');
    }
    const result = (await safeResponseJson(attached)) as { expiresAt?: unknown };
    if (typeof result?.expiresAt !== 'number') {
      return apiError(
        502,
        'invalid_room_response',
        'The room could not confirm its active session.',
      );
    }
    const committed = await commitBrowserIdentity(
      identityKeyHash,
      roomCode,
      body.participantId,
      result.expiresAt,
      env,
    );
    return committed.ok ? apiJson({ claimed: true }) : identityErrorResponse(committed.response);
  }

  if (action === 'socket' && request.method === 'GET') {
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return apiError(426, 'upgrade_required', 'A WebSocket connection is required.');
    }
    const internalRequest = new Request('https://lobby.internal/internal/socket', request);
    return stub.fetch(internalRequest);
  }

  return apiError(405, 'method_not_allowed', 'This room route does not support that method.');
}

async function createPublicRoom(
  nickname: string,
  identityKeyHash: string,
  env: Env,
): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomCode = generateRoomCode(secureRandom);
    const participantId = crypto.randomUUID();
    const reconnectToken = makeReconnectToken();
    const reconnectTokenHash = await hashReconnectToken(reconnectToken);
    const reserved = await reserveBrowserIdentity(identityKeyHash, roomCode, participantId, env);
    if (!reserved.ok) return reserved.response;
    const response = await env.LOBBIES.getByName(roomCode).fetch(
      internalJsonRequest('/internal/create', {
        protocolVersion: LOBBY_PROTOCOL_VERSION,
        roomCode,
        snapshotVersion: BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion,
        now: Date.now(),
        host: { participantId, nickname, reconnectTokenHash, identityKeyHash },
      }),
    );
    if (response.status === 409) {
      await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      continue;
    }
    if (!response.ok) {
      await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      return apiFailureFromInternal(response, 'The room could not be created.');
    }
    const created = CreateResultSchema.safeParse(await safeResponseJson(response));
    if (!created.success) {
      await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      return apiError(502, 'invalid_room_response', 'The room response was invalid.');
    }
    const committed = await commitBrowserIdentity(
      identityKeyHash,
      roomCode,
      participantId,
      created.data.expiresAt,
      env,
    );
    if (!committed.ok) {
      await leaveInternalRoom(roomCode, participantId, reconnectTokenHash, env);
      await releaseBrowserIdentity(identityKeyHash, roomCode, participantId, env);
      return identityErrorResponse(committed.response);
    }
    const result = JoinResponseSchema.safeParse({
      protocolVersion: LOBBY_PROTOCOL_VERSION,
      participantId: created.data.participantId,
      role: 'host',
      nickname: created.data.nickname,
      roomCode: created.data.roomCode,
      revision: created.data.revision,
      reconnectToken,
      socketPath: `/api/rooms/${roomCode}/socket`,
    });
    return result.success
      ? apiJson(result.data, 201)
      : apiError(502, 'invalid_room_response', 'The room response was invalid.');
  }
  return apiError(503, 'room_code_unavailable', 'A room could not be created. Please try again.');
}

async function recoverPublicParticipant(browserIdentityToken: string, env: Env): Promise<Response> {
  const identityKeyHash = await hashIdentityToken(browserIdentityToken);
  const identityResponse = await env.IDENTITIES.getByName(identityKeyHash).fetch(
    identityJsonRequest('/internal/recover', {
      identityKeyHash,
      now: Date.now(),
    }),
  );
  if (!identityResponse.ok) return identityErrorResponse(identityResponse);
  const claim = BrowserIdentityRecoverResponseSchema.safeParse(
    await safeResponseJson(identityResponse),
  );
  if (!claim.success) {
    return apiError(503, 'identity_unavailable', 'Your active room could not be verified.');
  }

  const reconnectToken = await deriveRecoveryReconnectToken(
    browserIdentityToken,
    claim.data.roomCode,
    claim.data.participantId,
  );
  const response = await env.LOBBIES.getByName(claim.data.roomCode).fetch(
    internalJsonRequest('/internal/recover-identity', {
      participantId: claim.data.participantId,
      identityKeyHash,
      reconnectTokenHash: await hashReconnectToken(reconnectToken),
      now: Date.now(),
    }),
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 404) {
      await releaseBrowserIdentity(
        identityKeyHash,
        claim.data.roomCode,
        claim.data.participantId,
        env,
      );
    }
    return apiFailureFromInternal(response, 'This active room could not be recovered.');
  }
  const recovered = RecoverIdentityResultSchema.safeParse(await safeResponseJson(response));
  if (!recovered.success) {
    return apiError(502, 'invalid_room_response', 'The recovered room session was invalid.');
  }
  const committed = await commitBrowserIdentity(
    identityKeyHash,
    recovered.data.roomCode,
    recovered.data.participantId,
    recovered.data.expiresAt,
    env,
  );
  if (!committed.ok) return identityErrorResponse(committed.response);
  return apiJson(
    JoinResponseSchema.parse({
      protocolVersion: LOBBY_PROTOCOL_VERSION,
      participantId: recovered.data.participantId,
      role: recovered.data.role,
      nickname: recovered.data.nickname,
      roomCode: recovered.data.roomCode,
      revision: recovered.data.revision,
      reconnectToken,
      socketPath: `/api/rooms/${recovered.data.roomCode}/socket`,
    }),
  );
}

async function reserveBrowserIdentity(
  identityKeyHash: string,
  roomCode: string,
  participantId: string,
  env: Env,
): Promise<{ ok: true; status: 'pending' | 'active' } | { ok: false; response: Response }> {
  const response = await env.IDENTITIES.getByName(identityKeyHash).fetch(
    identityJsonRequest('/internal/reserve', {
      identityKeyHash,
      roomCode,
      participantId,
      now: Date.now(),
    }),
  );
  if (!response.ok) return { ok: false, response };
  const result = (await safeResponseJson(response)) as { status?: unknown } | undefined;
  return result?.status === 'pending' || result?.status === 'active'
    ? { ok: true, status: result.status }
    : {
        ok: false,
        response: apiError(
          503,
          'identity_unavailable',
          'Your browser identity could not be reserved.',
        ),
      };
}

async function commitBrowserIdentity(
  identityKeyHash: string,
  roomCode: string,
  participantId: string,
  expiresAt: number,
  env: Env,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const response = await env.IDENTITIES.getByName(identityKeyHash).fetch(
    identityJsonRequest('/internal/commit', {
      roomCode,
      participantId,
      expiresAt,
      now: Date.now(),
    }),
  );
  return response.ok ? { ok: true } : { ok: false, response };
}

async function releaseBrowserIdentity(
  identityKeyHash: string,
  roomCode: string,
  participantId: string,
  env: Env,
): Promise<void> {
  await env.IDENTITIES.getByName(identityKeyHash).fetch(
    identityJsonRequest('/internal/release', { roomCode, participantId }),
  );
}

async function leaveInternalRoom(
  roomCode: string,
  participantId: string,
  reconnectTokenHash: string,
  env: Env,
): Promise<void> {
  await env.LOBBIES.getByName(roomCode).fetch(
    identityJsonRequest('/internal/leave', {
      participantId,
      reconnectTokenHash,
      now: Date.now(),
    }),
  );
}

function identityJsonRequest(path: string, body: unknown): Request {
  return new Request(`https://identity.internal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function identityErrorResponse(response: Response): Promise<Response> {
  let code = 'identity_unavailable';
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') code = payload.error;
  } catch {
    // Keep the client message generic when the internal result is malformed.
  }
  const message =
    code === 'active_lobby'
      ? 'You already have an active room in this browser. Leave that room before joining another.'
      : code === 'active_room_not_found'
        ? 'No active room could be recovered. Try joining or creating again.'
        : code === 'identity_claim_pending'
          ? 'A room action is still being completed. Wait a moment, then try again.'
          : 'Your active room could not be verified. Try again shortly.';
  return apiError(response.status, code, message);
}

function internalJsonRequest(path: string, body: unknown): Request {
  return new Request(`https://lobby.internal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readApiJson<T>(
  request: Request,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): Promise<T | null> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_API_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function safeResponseJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function apiFailureFromInternal(response: Response, fallback: string): Promise<Response> {
  const parsed = PublicErrorSchema.safeParse(await safeResponseJson(response));
  if (!parsed.success) return apiError(response.status, 'room_error', fallback);
  return apiJson(parsed.data, response.status);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isRateLimited(request: Request, action: keyof typeof REQUEST_RATE_LIMITS): boolean {
  const now = Date.now();
  const address = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `${action}:${address}`;
  const limit = REQUEST_RATE_LIMITS[action];
  const recent = (requestWindows.get(key) ?? []).filter(
    (timestamp) => now - timestamp < limit.windowMs,
  );
  if (recent.length >= limit.maximum) {
    requestWindows.set(key, recent);
    return true;
  }
  recent.push(now);
  requestWindows.set(key, recent);

  if (requestWindows.size > 2048) {
    for (const [storedKey, timestamps] of requestWindows) {
      if (timestamps.every((timestamp) => now - timestamp >= 60_000))
        requestWindows.delete(storedKey);
    }
    while (requestWindows.size > 2048) {
      const oldestKey = requestWindows.keys().next().value as string | undefined;
      if (!oldestKey) break;
      requestWindows.delete(oldestKey);
    }
  }
  return false;
}

function rateLimitResponse(): Response {
  const response = apiError(429, 'rate_limited', 'Please wait before trying again.');
  response.headers.set('Retry-After', '60');
  return response;
}

function makeReconnectToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function hashReconnectToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashIdentityToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function deriveRecoveryReconnectToken(
  browserIdentityToken: string,
  roomCode: string,
  participantId: string,
): Promise<string> {
  const material = `buildchamp:reconnect-recovery:v1:${roomCode}:${participantId}:${browserIdentityToken}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const binary = Array.from(new Uint8Array(digest), (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function secureRandom(): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return value / 0x1_0000_0000;
}

function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function apiError(status: number, error: string, message: string): Response {
  return apiJson({ protocolVersion: LOBBY_PROTOCOL_VERSION, error, message }, status);
}

async function notFoundResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL('/404.html', request.url);
  const response = await env.ASSETS.fetch(new Request(url));
  return new Response(response.body, {
    headers: response.headers,
    status: 404,
    statusText: 'Not Found',
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname;
    const route = requestClass(pathname);

    if (pathname.startsWith('/api/rooms')) {
      try {
        return await handleRoomApi(request, env);
      } catch {
        return apiError(503, 'unavailable', 'BuildChamp is temporarily unavailable.');
      }
    }

    try {
      const assetResponse = await env.ASSETS.fetch(request);
      const response = isMissingStaticAsset(pathname, assetResponse)
        ? await notFoundResponse(request, env)
        : assetResponse;
      const finalResponse = addResponseHeaders(response, pathname);

      if (finalResponse.status >= 500) {
        console.error({
          event: 'asset_response_failure',
          route,
          status: finalResponse.status,
          durationMs: Date.now() - startedAt,
        });
      }

      return finalResponse;
    } catch {
      console.error({
        event: 'asset_request_failure',
        route,
        durationMs: Date.now() - startedAt,
      });

      return addResponseHeaders(
        new Response('BuildChamp is temporarily unavailable.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 503,
          statusText: 'Service Unavailable',
        }),
        pathname,
      );
    }
  },
};
