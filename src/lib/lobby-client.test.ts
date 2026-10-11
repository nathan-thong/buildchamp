import { beforeEach, describe, expect, it } from 'vitest';

import {
  findLobbySession,
  LOBBY_SESSION_STORAGE_KEY,
  readLobbySessions,
  saveLobbySession,
  type LobbySession,
} from './lobby-client';

const validSession: LobbySession = {
  protocolVersion: 2,
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
});
