import { DurableObject } from 'cloudflare:workers';

import {
  BrowserIdentityClaimSchema,
  BrowserIdentityCommitRequestSchema,
  BrowserIdentityRecoverRequestSchema,
  BrowserIdentityRecoverResponseSchema,
  BrowserIdentityReleaseRequestSchema,
  BrowserIdentityReserveRequestSchema,
  LobbyIdentityStatusSchema,
  type BrowserIdentityClaim,
} from './lobby/schemas.ts';

const CLAIM_KEY = 'browser-identity-claim-v1';
const PENDING_LEASE_MS = 60_000;

type WorkerIdentityEnv = WorkerEnv;

/** Admission-only owner: each lobby remains authoritative for gameplay state. */
export class BuildChampBrowserIdentity extends DurableObject<WorkerIdentityEnv> {
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: WorkerIdentityEnv) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST') return identityResponse({ error: 'method_not_allowed' }, 405);
    if (path === '/internal/reserve') return this.reserve(request);
    if (path === '/internal/commit') return this.commit(request);
    if (path === '/internal/release') return this.release(request);
    if (path === '/internal/recover') return this.recover(request);
    return identityResponse({ error: 'not_found' }, 404);
  }

  async alarm(): Promise<void> {
    await this.serialize(async () => {
      const claim = await this.readClaim();
      if (!claim) return;
      const now = Date.now();
      if (claim.status === 'pending') {
        if (claim.expiresAt > now) {
          await this.ctx.storage.setAlarm(claim.expiresAt);
          return;
        }
        const room = await this.roomStatus(claim);
        if (room === null) {
          await this.ctx.storage.setAlarm(now + PENDING_LEASE_MS);
          return;
        }
        if (room.active) {
          const activeClaim = {
            ...claim,
            status: 'active' as const,
            expiresAt: room.expiresAt ?? claim.expiresAt,
          };
          await this.ctx.storage.put(CLAIM_KEY, activeClaim);
          await this.ctx.storage.setAlarm(Math.max(now + 1_000, activeClaim.expiresAt));
          return;
        }
        await this.ctx.storage.delete(CLAIM_KEY);
        return;
      }
      const active = await this.roomStatus(claim);
      if (active === null) {
        await this.ctx.storage.setAlarm(now + PENDING_LEASE_MS);
        return;
      }
      if (!active.active) {
        await this.ctx.storage.delete(CLAIM_KEY);
        return;
      }
      const next = { ...claim, expiresAt: active.expiresAt ?? claim.expiresAt };
      await this.ctx.storage.put(CLAIM_KEY, next);
      await this.ctx.storage.setAlarm(Math.max(now + 1_000, next.expiresAt));
    });
  }

  private async reserve(request: Request): Promise<Response> {
    const body = await readJson(request, BrowserIdentityReserveRequestSchema);
    if (!body) return identityResponse({ error: 'invalid_request' }, 400);
    return this.serialize(async () => {
      const existing = await this.readClaim();
      if (existing && existing.identityKeyHash !== body.identityKeyHash) {
        return identityResponse({ error: 'identity_claim_invalid' }, 409);
      }
      if (existing?.status === 'pending' && existing.expiresAt > body.now) {
        if (existing.roomCode === body.roomCode && existing.participantId === body.participantId) {
          return identityResponse({ reserved: true, status: 'pending' });
        }
        return identityResponse({ error: 'identity_claim_pending' }, 409);
      }
      if (existing?.status === 'pending') {
        const pendingRoom = await this.roomStatus(existing);
        if (pendingRoom === null) {
          return identityResponse({ error: 'identity_check_unavailable' }, 503);
        }
        if (pendingRoom.active) {
          const activeClaim: BrowserIdentityClaim = {
            ...existing,
            status: 'active',
            expiresAt: pendingRoom.expiresAt ?? existing.expiresAt,
          };
          await this.ctx.storage.put(CLAIM_KEY, activeClaim);
          await this.ctx.storage.setAlarm(activeClaim.expiresAt);
          if (
            existing.roomCode === body.roomCode &&
            existing.participantId === body.participantId
          ) {
            return identityResponse({ reserved: true, status: 'active' });
          }
          return identityResponse({ error: 'active_lobby' }, 409);
        }
      }
      if (existing?.status === 'active') {
        const current = await this.roomStatus(existing);
        if (current === null) return identityResponse({ error: 'identity_check_unavailable' }, 503);
        if (current.active) {
          const refreshed = { ...existing, expiresAt: current.expiresAt ?? existing.expiresAt };
          await this.ctx.storage.put(CLAIM_KEY, refreshed);
          await this.ctx.storage.setAlarm(refreshed.expiresAt);
          if (
            existing.roomCode === body.roomCode &&
            existing.participantId === body.participantId
          ) {
            return identityResponse({ reserved: true, status: 'active' });
          }
          return identityResponse({ error: 'active_lobby' }, 409);
        }
      }
      const claim = BrowserIdentityClaimSchema.parse({
        schemaVersion: 1,
        identityKeyHash: body.identityKeyHash,
        roomCode: body.roomCode,
        participantId: body.participantId,
        status: 'pending',
        expiresAt: body.now + PENDING_LEASE_MS,
      });
      await this.ctx.storage.put(CLAIM_KEY, claim);
      await this.ctx.storage.setAlarm(claim.expiresAt);
      return identityResponse({ reserved: true, status: 'pending' });
    });
  }

  private async commit(request: Request): Promise<Response> {
    const body = await readJson(request, BrowserIdentityCommitRequestSchema);
    if (!body) return identityResponse({ error: 'invalid_request' }, 400);
    return this.serialize(async () => {
      const existing = await this.readClaim();
      if (
        existing?.roomCode === body.roomCode &&
        existing.participantId === body.participantId &&
        existing.status === 'active'
      ) {
        const refreshed = { ...existing, expiresAt: body.expiresAt };
        await this.ctx.storage.put(CLAIM_KEY, refreshed);
        await this.ctx.storage.setAlarm(refreshed.expiresAt);
        return identityResponse({ committed: true });
      }
      if (
        existing?.roomCode !== body.roomCode ||
        existing.participantId !== body.participantId ||
        existing.status !== 'pending' ||
        body.expiresAt <= body.now
      ) {
        return identityResponse({ error: 'identity_reservation_expired' }, 409);
      }
      if (existing.expiresAt <= body.now) {
        const active = await this.roomStatus(existing);
        if (active === null) {
          return identityResponse({ error: 'identity_check_unavailable' }, 503);
        }
        if (!active.active) {
          return identityResponse({ error: 'identity_reservation_expired' }, 409);
        }
      }
      const claim: BrowserIdentityClaim = {
        ...existing,
        status: 'active',
        expiresAt: body.expiresAt,
      };
      await this.ctx.storage.put(CLAIM_KEY, claim);
      await this.ctx.storage.setAlarm(claim.expiresAt);
      return identityResponse({ committed: true });
    });
  }

  private async release(request: Request): Promise<Response> {
    const body = await readJson(request, BrowserIdentityReleaseRequestSchema);
    if (!body) return identityResponse({ error: 'invalid_request' }, 400);
    return this.serialize(async () => {
      const existing = await this.readClaim();
      const released = Boolean(
        existing?.roomCode === body.roomCode && existing.participantId === body.participantId,
      );
      if (released) await this.ctx.storage.delete(CLAIM_KEY);
      return identityResponse({ released });
    });
  }

  private async recover(request: Request): Promise<Response> {
    const body = await readJson(request, BrowserIdentityRecoverRequestSchema);
    if (!body) return identityResponse({ error: 'invalid_request' }, 400);
    return this.serialize(async () => {
      const claim = await this.readClaim();
      if (!claim || claim.identityKeyHash !== body.identityKeyHash) {
        return identityResponse({ error: 'active_room_not_found' }, 404);
      }
      const room = await this.roomStatus(claim);
      if (room === null) return identityResponse({ error: 'identity_check_unavailable' }, 503);
      if (!room.active) {
        if (claim.status === 'pending' && claim.expiresAt > body.now) {
          return identityResponse({ error: 'identity_claim_pending' }, 409);
        }
        await this.ctx.storage.delete(CLAIM_KEY);
        return identityResponse({ error: 'active_room_not_found' }, 404);
      }
      const activeClaim = {
        ...claim,
        status: 'active' as const,
        expiresAt: room.expiresAt ?? claim.expiresAt,
      };
      await this.ctx.storage.put(CLAIM_KEY, activeClaim);
      await this.ctx.storage.setAlarm(activeClaim.expiresAt);
      return identityResponse(
        BrowserIdentityRecoverResponseSchema.parse({
          roomCode: activeClaim.roomCode,
          participantId: activeClaim.participantId,
          expiresAt: activeClaim.expiresAt,
        }),
      );
    });
  }

  private async readClaim(): Promise<BrowserIdentityClaim | null> {
    const raw = await this.ctx.storage.get<unknown>(CLAIM_KEY);
    if (raw === undefined) return null;
    const parsed = BrowserIdentityClaimSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    await this.ctx.storage.delete(CLAIM_KEY);
    return null;
  }

  private async roomStatus(
    claim: Pick<BrowserIdentityClaim, 'roomCode' | 'participantId' | 'identityKeyHash'>,
  ): Promise<{ active: boolean; expiresAt?: number } | null> {
    try {
      const response = await this.env.LOBBIES.getByName(claim.roomCode).fetch(
        new Request('https://lobby.internal/internal/identity-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: claim.participantId,
            identityKeyHash: claim.identityKeyHash,
          }),
        }),
      );
      const raw: unknown = await response.json();
      const parsed = LobbyIdentityStatusSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
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

async function readJson<T>(
  request: Request,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
): Promise<T | null> {
  if (
    request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    return null;
  }
  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function identityResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
