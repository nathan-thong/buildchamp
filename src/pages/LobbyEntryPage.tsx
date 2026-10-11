import { useState, type FormEvent } from 'react';

import { AppLink } from '../components/AppLink';
import { joinLobby, createLobby } from '../lib/lobby-client';
import { useLobbySession } from '../lib/lobby-session-context';

export function LobbyEntryPage({ initialRoomCode = '' }: { readonly initialRoomCode?: string }) {
  const { activateSession, session: activeSession } = useLobbySession();
  const [hostNickname, setHostNickname] = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [requestedRole, setRequestedRole] = useState<'player' | 'spectator'>('player');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await createLobby(hostNickname);
      activateSession(session);
      navigate(`/room/${session.roomCode}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The room could not be created. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await joinLobby(roomCode, nickname, requestedRole);
      activateSession(session);
      navigate(`/room/${session.roomCode}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The room could not be joined. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-container lobby-entry-page">
      <header className="lobby-entry-heading">
        <h1>Bring a room together.</h1>
        <p>Draft privately, then share the room screen with everyone watching.</p>
      </header>

      <div className="lobby-entry-layout">
        <section aria-labelledby="create-room-title" className="lobby-entry-section">
          <h2 id="create-room-title">Create a room</h2>
          <p>Choose a temporary nickname. You can invite up to seven players.</p>
          <form className="lobby-form" onSubmit={(event) => void handleCreate(event)}>
            <label htmlFor="host-nickname">Your nickname</label>
            <input
              autoComplete="nickname"
              id="host-nickname"
              maxLength={16}
              minLength={2}
              onChange={(event) => setHostNickname(event.target.value)}
              required
              value={hostNickname}
            />
            <button
              className="button button--primary"
              disabled={busy || Boolean(activeSession)}
              type="submit"
            >
              {busy ? 'Creating…' : 'Create private room'}
            </button>
          </form>
        </section>

        <section aria-labelledby="join-room-title" className="lobby-entry-section">
          <h2 id="join-room-title">Join a room</h2>
          <p>Enter the six-character code from your host or scan the shared display.</p>
          <form className="lobby-form" onSubmit={(event) => void handleJoin(event)}>
            <label htmlFor="room-code">Room code</label>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              className="lobby-code-input"
              id="room-code"
              maxLength={6}
              minLength={6}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              pattern="[A-HJ-NP-Z2-9]{6}"
              required
              value={roomCode}
            />
            <label htmlFor="player-nickname">Your nickname</label>
            <input
              autoComplete="nickname"
              id="player-nickname"
              maxLength={16}
              minLength={2}
              onChange={(event) => setNickname(event.target.value)}
              required
              value={nickname}
            />
            <label htmlFor="join-role">I’m joining as</label>
            <select
              id="join-role"
              onChange={(event) => setRequestedRole(event.target.value as 'player' | 'spectator')}
              value={requestedRole}
            >
              <option value="player">Player</option>
              <option value="spectator">Spectator</option>
            </select>
            <button
              className="button button--secondary"
              disabled={busy || Boolean(activeSession)}
              type="submit"
            >
              {busy ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </section>
      </div>

      {error && (
        <p className="lobby-entry-error" role="alert">
          {error}
        </p>
      )}
      <p className="lobby-entry-footnote">
        No account or chat. <AppLink href="/solo">Play solo instead</AppLink>.
      </p>
      {activeSession && (
        <div className="lobby-entry-active-room" role="status">
          <p>
            This browser is already in room {activeSession.roomCode}. Return there or leave it
            before joining another room.
          </p>
          <AppLink
            className="button button--secondary button--small"
            href={`/room/${activeSession.roomCode}`}
          >
            Return to room
          </AppLink>
        </div>
      )}
    </div>
  );
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
