import { BUNDLED_CHAMPION_SNAPSHOT } from '../src/data/runtime-snapshot.ts';
import { generateRoomCode } from './lobby/state.ts';
import {
  AddParticipantResultSchema,
  CreateResultSchema,
  JoinResponseSchema,
  PublicCreateRoomRequestSchema,
  PublicErrorSchema,
  PublicJoinRequestSchema,
  PublicRoomInfoSchema,
} from './lobby/schemas.ts';

export { BuildChampLobby } from './lobby/durable-object.ts';

export type Env = WorkerEnv;

const MAX_API_BODY_BYTES = 4 * 1024;
const REQUEST_RATE_LIMITS = {
  create: { windowMs: 60_000, maximum: 5 },
  join: { windowMs: 10_000, maximum: 30 },
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
  if (pathname === '/api/rooms') {
    if (request.method !== 'POST')
      return apiError(405, 'method_not_allowed', 'Use POST to create a room.');
    if (!isSameOrigin(request))
      return apiError(403, 'origin_rejected', 'This request origin is not allowed.');
    if (isRateLimited(request, 'create')) return rateLimitResponse();
    const body = await readApiJson(request, PublicCreateRoomRequestSchema);
    if (!body) return apiError(400, 'invalid_request', 'The request body was invalid.');
    return createPublicRoom(body.nickname, env);
  }

  const match = pathname.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})(?:\/(join|socket))?$/u);
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
    const response = await stub.fetch(
      internalJsonRequest('/internal/join', {
        protocolVersion: 1,
        participantId,
        ...(body.nickname !== undefined ? { nickname: body.nickname } : {}),
        requestedRole,
        reconnectTokenHash,
        now: Date.now(),
      }),
    );
    if (!response.ok)
      return apiFailureFromInternal(response, 'The room could not accept this participant.');
    const result = AddParticipantResultSchema.safeParse(await safeResponseJson(response));
    if (!result.success)
      return apiError(502, 'invalid_room_response', 'The room response was invalid.');
    const joined = JoinResponseSchema.safeParse({
      protocolVersion: 1,
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

async function createPublicRoom(nickname: string, env: Env): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomCode = generateRoomCode(secureRandom);
    const participantId = crypto.randomUUID();
    const reconnectToken = makeReconnectToken();
    const reconnectTokenHash = await hashReconnectToken(reconnectToken);
    const response = await env.LOBBIES.getByName(roomCode).fetch(
      internalJsonRequest('/internal/create', {
        protocolVersion: 1,
        roomCode,
        snapshotVersion: BUNDLED_CHAMPION_SNAPSHOT.dataDragonVersion,
        now: Date.now(),
        host: { participantId, nickname, reconnectTokenHash },
      }),
    );
    if (response.status === 409) continue;
    if (!response.ok) return apiFailureFromInternal(response, 'The room could not be created.');
    const created = CreateResultSchema.safeParse(await safeResponseJson(response));
    if (!created.success)
      return apiError(502, 'invalid_room_response', 'The room response was invalid.');
    const result = JoinResponseSchema.safeParse({
      protocolVersion: 1,
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
  return apiJson({ protocolVersion: 1, error, message }, status);
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
