import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_IDENTITY_STORAGE_KEY,
  createLobby,
  getBrowserIdentityToken,
  findLobbySession,
  LOBBY_SESSION_STORAGE_KEY,
  readLobbySessions,
  saveLobbySession,
  type LobbySession,
} from './lobby-client';

const validSession: LobbySession = {
  protocolVersion: 3,
  participantId: 'f899b9f9-ae84-471a-8aec-7bd735d43b9a',
  reconnectToken: 'private-token-value-that-is-long-enough-1234567890',
  socketPath: '/api/rooms/ABC234/socket',
  roomCode: 'ABC234',
  role: 'player',
  nickname: 'Player One',
};

describe('lobby session storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves validated credentials for reconnect without placing them in the room URL', () => {
    expect(saveLobbySession(validSession)).toBe(true);
    expect(findLobbySession('abc234')).toEqual(validSession);
    expect(readLobbySessions()).toHaveLength(1);
    expect(window.location.pathname).not.toContain(validSession.reconnectToken);
  });

  it('clears malformed or unsupported stored sessions before reconnecting', () => {
    localStorage.setItem(LOBBY_SESSION_STORAGE_KEY, '{ malformed');
    expect(readLobbySessions()).toEqual([]);
    expect(localStorage.getItem(LOBBY_SESSION_STORAGE_KEY)).toBeNull();

    localStorage.setItem(
      LOBBY_SESSION_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, sessions: [validSession] }),
    );
    expect(findLobbySession('ABC234')).toBeNull();
    expect(localStorage.getItem(LOBBY_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects malformed credentials rather than persisting them', () => {
    expect(saveLobbySession({ ...validSession, reconnectToken: 'short' })).toBe(false);
    expect(readLobbySessions()).toEqual([]);
  });

  it('reuses one high-entropy browser identity token and replaces malformed storage', async () => {
    const first = await getBrowserIdentityToken(localStorage);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(await getBrowserIdentityToken(localStorage)).toBe(first);
    expect(localStorage.getItem(BROWSER_IDENTITY_STORAGE_KEY)).toBe(first);
    expect(window.location.href).not.toContain(first);

    localStorage.setItem(BROWSER_IDENTITY_STORAGE_KEY, 'not-a-valid-identity');
    const repaired = await getBrowserIdentityToken(localStorage);
    expect(repaired).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(repaired).not.toBe('not-a-valid-identity');
    expect(localStorage.getItem(BROWSER_IDENTITY_STORAGE_KEY)).toBe(repaired);
  });

  it('recovers the saved browser identity after a room-create response was lost', async () => {
    const fetchStub = vi.fn<typeof fetch>();
    fetchStub
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            protocolVersion: 3,
            error: 'active_lobby',
            message: 'An active room already exists.',
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            protocolVersion: 3,
            participantId: validSession.participantId,
            role: 'host',
            nickname: 'Recovered Host',
            roomCode: validSession.roomCode,
            revision: 1,
            reconnectToken: 'recovered-private-token-long-enough-1234567890',
            socketPath: validSession.socketPath,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchStub);

    const recovered = await createLobby('New Host');

    expect(recovered).toMatchObject({
      participantId: validSession.participantId,
      roomCode: validSession.roomCode,
      nickname: 'Recovered Host',
      role: 'host',
    });
    expect(fetchStub.mock.calls.map(([url]) => url)).toEqual(['/api/rooms', '/api/rooms/recover']);
    expect(readLobbySessions()).toEqual([recovered]);
    expect(JSON.stringify(recovered)).not.toContain(
      localStorage.getItem(BROWSER_IDENTITY_STORAGE_KEY) ?? '',
    );
  });
});
