import { useEffect, useRef, useState } from 'react';

import { AppLink } from '../components/AppLink';
import { LobbyBuildCard } from '../components/LobbyBuildCard';
import { formatCountdown, useRemainingSeconds } from '../components/LobbyCountdown';
import { DRAFT_SLOT_ORDER } from '../domain/draft-engine';
import { findLobbySession, type LobbyCommandRequest, type LobbySession } from '../lib/lobby-client';
import { useLobbySession } from '../lib/lobby-session-context';
import type { LobbyConnectionStatus } from '../lib/use-lobby-connection';
import { useSound } from '../lib/sound';
import { LobbyEntryPage } from './LobbyEntryPage';
import type { LobbyProjection, OfferProjection } from '../../worker/lobby/schemas';

const SLOT_LABELS = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
} as const;

export function LobbyRoomPage({ roomCode }: { readonly roomCode: string }) {
  const { session: activeSession, activateSession } = useLobbySession();
  const savedSession = findLobbySession(roomCode);
  const session = activeSession?.roomCode === roomCode ? activeSession : savedSession;

  useEffect(() => {
    if (
      session &&
      session.role !== 'display' &&
      activeSession?.participantId !== session.participantId
    ) {
      activateSession(session);
    }
  }, [activeSession?.participantId, activateSession, session]);

  if (activeSession && activeSession.roomCode !== roomCode) {
    return (
      <div className="page-container lobby-entry-page">
        <h1>You’re already in a room.</h1>
        <p>Leave room {activeSession.roomCode} before joining this one.</p>
        <AppLink className="button button--primary" href={`/room/${activeSession.roomCode}`}>
          Return to your room
        </AppLink>
      </div>
    );
  }
  if (!session) {
    return <LobbyEntryPage initialRoomCode={roomCode} />;
  }
  if (session.role === 'display') {
    return (
      <div className="page-container lobby-entry-page">
        <h1>This session is the shared display.</h1>
        <p>Open the player screen on another device, or return to the display.</p>
        <AppLink className="button button--primary" href={`/display/${roomCode}`}>
          Open shared display
        </AppLink>
      </div>
    );
  }
  return <ConnectedLobbyRoom session={session} />;
}

function ConnectedLobbyRoom({ session }: { readonly session: LobbySession }) {
  const { projection, status, error, sendCommand, leaveActiveSession } = useLobbySession();
  const sound = useSound();
  const seconds = useRemainingSeconds(projection?.deadlineAt ?? null);
  const [selectedSlot, setSelectedSlot] = useState<keyof typeof SLOT_LABELS | null>(null);
  const [lockSending, setLockSending] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const previousRevealCountRef = useRef<number | null>(null);
  const previousRoundRef = useRef<number | null>(null);

  useEffect(() => {
    const currentRound = projection?.currentRound ?? null;
    if (currentRound === null) return;
    if (previousRoundRef.current !== null && currentRound !== previousRoundRef.current) {
      setSelectedSlot(null);
      setLockSending(false);
      sound.play('reveal');
    }
    previousRoundRef.current = currentRound;
  }, [projection?.currentRound, sound]);

  useEffect(() => {
    if (error) setLockSending(false);
  }, [error]);

  useEffect(() => {
    if (projection?.phase !== 'revealing') {
      previousRevealCountRef.current = null;
      return;
    }
    if (
      previousRevealCountRef.current !== null &&
      projection.revealedCount > previousRevealCountRef.current
    ) {
      sound.play('reveal');
    }
    previousRevealCountRef.current = projection.revealedCount;
  }, [projection?.phase, projection?.revealedCount, sound]);

  if (!projection) {
    return (
      <div className="page-container lobby-loading">
        <p role="status">
          {status === 'reconnecting' ? 'Reconnecting to your room…' : 'Connecting to your room…'}
        </p>
      </div>
    );
  }

  const activeProjection = projection;
  const me = activeProjection.participants.find(
    ({ id }) => id === activeProjection.selfParticipantId,
  );
  const fullOffer = isFullOffer(activeProjection.offer) ? activeProjection.offer : null;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${activeProjection.roomCode}`,
      );
      setCopyStatus('Room link copied.');
    } catch {
      setCopyStatus('Copy is unavailable here. Share the room code instead.');
    }
  }

  function confirmLock() {
    if (
      !fullOffer ||
      !selectedSlot ||
      me?.lockedThisRound ||
      lockSending ||
      status !== 'connected'
    ) {
      return;
    }
    const component = fullOffer.components[selectedSlot];
    const sent = sendCommand({
      type: 'player.lock',
      payload: {
        round: activeProjection.currentRound ?? 1,
        selection: {
          offerId: fullOffer.id,
          championId: fullOffer.champion.id,
          variantId: fullOffer.variant.id,
          slot: selectedSlot,
          componentId: component.id,
        },
      },
    });
    if (sent) {
      setLockSending(true);
      setSelectedSlot(null);
      sound.play('lock');
    }
  }

  async function leaveRoom() {
    setLeaveError(null);
    try {
      await leaveActiveSession();
      window.history.pushState({}, '', '/lobby');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (cause) {
      setLeaveError(cause instanceof Error ? cause.message : 'The room could not be left.');
    }
  }

  return (
    <div className="page-container lobby-room-page">
      <header className="lobby-room-header">
        <div>
          <h1>
            {projection.phase === 'waiting'
              ? 'Room waiting'
              : projection.phase === 'revealing'
                ? 'Build reveal'
                : projection.phase === 'voting'
                  ? 'Secret ballot'
                  : projection.phase === 'results'
                    ? 'Room results'
                    : 'Private draft'}
          </h1>
          <p className="lobby-room-header__meta">
            {session.nickname} · {roleName(projection.role)} · {connectionName(status)}
          </p>
        </div>
        <div className="room-code-block">
          <span>Room code</span>
          <strong aria-label={`Room code ${projection.roomCode}`}>{projection.roomCode}</strong>
          <button className="text-action" onClick={() => void copyInvite()} type="button">
            Copy invite link
          </button>
          <AppLink className="text-action" href={`/display/${projection.roomCode}`}>
            Open shared display
          </AppLink>
          <button className="text-action" onClick={() => void leaveRoom()} type="button">
            Leave room
          </button>
        </div>
      </header>

      {projection.phase === 'waiting' && (
        <WaitingRoom projection={projection} sendCommand={sendCommand} status={status} />
      )}

      {projection.phase === 'drafting' && (
        <section aria-labelledby="draft-round-title" className="multiplayer-draft">
          <div className="multiplayer-draft__main">
            <div className="round-heading">
              <div>
                <h2 id="draft-round-title">Round {projection.currentRound} of 6</h2>
                <p>{projection.settings.mode === 'same' ? 'Same Champs' : 'Random Champs'}</p>
              </div>
              <div
                className={`lobby-timer ${seconds !== null && seconds <= 5 ? 'lobby-timer--urgent' : ''}`}
              >
                <span>Time left</span>
                <strong aria-label={`Time left ${formatCountdown(seconds)}`} aria-live="off">
                  {formatCountdown(seconds)}
                </strong>
              </div>
            </div>

            {fullOffer ? (
              <DraftOffer
                locked={Boolean(me?.lockedThisRound) || lockSending}
                offer={fullOffer}
                onSelect={setSelectedSlot}
                onLock={confirmLock}
                selectedSlot={selectedSlot}
                waiting={status !== 'connected'}
              />
            ) : (
              <div className="lobby-lock-notice" role="status">
                {me?.lockedThisRound
                  ? 'Your choice is locked. Everyone’s selections stay hidden until the reveal step.'
                  : projection.role === 'spectator'
                    ? 'You’re watching this round. The shared display shows the public offers.'
                    : 'Your champion offer is loading. Reconnecting will restore your private choice.'}
              </div>
            )}
          </div>
          <ProgressPanel projection={projection} />
        </section>
      )}

      {projection.phase === 'draft-complete' && (
        <section aria-labelledby="draft-complete-title" className="draft-complete-panel">
          <h2 id="draft-complete-title">All six choices are locked.</h2>
          <p>The server is preparing the reveal.</p>
          <ProgressPanel projection={projection} />
        </section>
      )}

      {projection.phase === 'revealing' && (
        <section aria-labelledby="room-reveal-title" className="room-phase-panel">
          <div className="room-phase-panel__heading">
            <div>
              <p className="screen-label">The reveal</p>
              <h2 id="room-reveal-title">
                {projection.revealedCount} of {projection.candidateCount} builds revealed
              </h2>
              <p>
                {projection.settings.revealOrder === 'staged'
                  ? 'Builds appear one at a time. The host can move the room forward.'
                  : 'Every completed build is on display.'}
              </p>
            </div>
            <PhaseTimer seconds={seconds} label="Next reveal" />
          </div>
          <div className="lobby-build-grid">
            {projection.builds.map((build) => (
              <LobbyBuildCard build={build} key={build.participantId} />
            ))}
          </div>
          {projection.role === 'host' && (
            <button
              className="button button--primary"
              disabled={status !== 'connected'}
              onClick={() => sendCommand({ type: 'host.reveal.advance', payload: {} })}
              type="button"
            >
              {projection.revealedCount < projection.candidateCount
                ? 'Reveal next build'
                : 'Begin voting'}
            </button>
          )}
        </section>
      )}

      {projection.phase === 'voting' && (
        <section aria-labelledby="room-voting-title" className="room-phase-panel">
          <div className="room-phase-panel__heading">
            <div>
              <p className="screen-label">Secret ballot</p>
              <h2 id="room-voting-title">Which build do you prefer?</h2>
              <p>
                Your choice stays hidden until results. {projection.votesCastCount} of the room’s
                ballots have been cast.
              </p>
            </div>
            <PhaseTimer seconds={seconds} label="Voting closes" />
          </div>
          {projection.selfHasVoted && (
            <p className="room-vote-note" role="status">
              Your ballot is locked. Its choice remains secret until results.
            </p>
          )}
          <div className="lobby-build-grid">
            {projection.builds.map((build) => {
              const canVote =
                projection.votableParticipantIds?.includes(build.participantId) ?? false;
              return (
                <LobbyBuildCard
                  build={build}
                  canVote={canVote}
                  disabled={status !== 'connected'}
                  key={build.participantId}
                  onVote={() => {
                    const sent = sendCommand({
                      type: 'player.vote',
                      payload: { participantId: build.participantId },
                    });
                    if (sent) sound.play('lock');
                  }}
                  voted={projection.selfHasVoted}
                />
              );
            })}
          </div>
        </section>
      )}

      {projection.phase === 'results' && (
        <section aria-labelledby="room-results-title" className="room-phase-panel room-results">
          <div className="room-phase-panel__heading">
            <div>
              <p className="screen-label">Room results</p>
              <h2 id="room-results-title">
                {projection.winnerIds?.length === 0
                  ? 'No ballots were cast'
                  : projection.winnerIds?.length === 1
                    ? 'The room’s favourite build'
                    : 'A shared victory'}
              </h2>
              <p>Votes reflect the room’s choices, not an automated power score.</p>
            </div>
          </div>
          <div className="lobby-build-grid">
            {projection.builds.map((build) => (
              <LobbyBuildCard
                build={build}
                isWinner={projection.winnerIds?.includes(build.participantId) ?? false}
                key={build.participantId}
                voteCount={
                  projection.voteTotals?.find(
                    (entry) => entry.participantId === build.participantId,
                  )?.votes ?? 0
                }
              />
            ))}
          </div>
          {projection.role === 'host' && (
            <button
              className="button button--primary"
              disabled={status !== 'connected'}
              onClick={() => sendCommand({ type: 'host.rematch', payload: {} })}
              type="button"
            >
              Draft a fresh rematch
            </button>
          )}
        </section>
      )}

      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      {leaveError && (
        <p className="lobby-error" role="alert">
          {leaveError}
        </p>
      )}
      {copyStatus && (
        <p className="visually-hidden" role="status">
          {copyStatus}
        </p>
      )}
      <p className="lobby-room-footer">
        {projection.phase === 'drafting'
          ? 'Locks are permanent. Choices stay private until the reveal.'
          : projection.phase === 'revealing'
            ? 'Completed builds are public as they appear. Ballots stay private until results.'
            : projection.phase === 'voting'
              ? 'Builds are public. Ballots stay private until results.'
              : projection.phase === 'results'
                ? 'Builds and vote totals stay in the room until the next draft.'
                : 'Choose when you are ready; a draft starts after two players are ready.'}
      </p>
    </div>
  );
}

function WaitingRoom({
  projection,
  sendCommand,
  status,
}: {
  readonly projection: LobbyProjection;
  readonly sendCommand: (request: LobbyCommandRequest) => boolean;
  readonly status: LobbyConnectionStatus;
}) {
  const isHost = projection.role === 'host';
  const me = projection.participants.find(({ id }) => id === projection.selfParticipantId);
  const playerParticipants = projection.participants.filter(
    (participant) =>
      !participant.hasLeft && (participant.role === 'host' || participant.role === 'player'),
  );
  const readyCount = playerParticipants.filter(({ ready }) => ready).length;

  return (
    <section aria-labelledby="waiting-title" className="waiting-room">
      <div className="waiting-room__intro">
        <h2 id="waiting-title">Waiting for the host to start</h2>
        <p>At least two players must be ready. Every player seat joins once the draft begins.</p>
      </div>

      {isHost && (
        <div className="lobby-settings-row">
          <label>
            Champion mode
            <select
              onChange={(event) =>
                sendCommand({
                  type: 'host.settings',
                  payload: {
                    ...projection.settings,
                    mode: event.target.value as 'same' | 'random',
                  },
                })
              }
              value={projection.settings.mode}
            >
              <option value="same">Same Champs — one shared offer</option>
              <option value="random">Random Champs — one offer per player</option>
            </select>
          </label>
          <label>
            Round timer
            <select
              onChange={(event) =>
                sendCommand({
                  type: 'host.settings',
                  payload: {
                    ...projection.settings,
                    speed: event.target.value as 'quick' | 'standard' | 'relaxed',
                  },
                })
              }
              value={projection.settings.speed}
            >
              <option value="quick">Quick · 15 seconds</option>
              <option value="standard">Standard · 30 seconds</option>
              <option value="relaxed">Relaxed · 45 seconds</option>
            </select>
          </label>
          <label>
            Reveal style
            <select
              onChange={(event) =>
                sendCommand({
                  type: 'host.settings',
                  payload: {
                    ...projection.settings,
                    revealOrder: event.target.value as 'staged' | 'all-at-once',
                  },
                })
              }
              value={projection.settings.revealOrder}
            >
              <option value="staged">One build at a time</option>
              <option value="all-at-once">All builds at once</option>
            </select>
          </label>
        </div>
      )}
      {!isHost && (
        <p className="lobby-setting-summary">
          {projection.settings.mode === 'same' ? 'Same Champs' : 'Random Champs'} ·{' '}
          {projection.settings.speed === 'quick'
            ? '15 seconds'
            : projection.settings.speed === 'relaxed'
              ? '45 seconds'
              : '30 seconds'}
        </p>
      )}

      <ol aria-label="Room participants" className="participant-list">
        {projection.participants.map((participant) => (
          <li className="participant-row" key={participant.id}>
            <span className="participant-row__name">
              <span
                aria-hidden="true"
                className={`connection-mark ${participant.isConnected ? 'connection-mark--online' : ''}`}
              />
              <strong>{participant.nickname}</strong>
              {participant.id === projection.selfParticipantId && <span>You</span>}
            </span>
            <span>{roleName(participant.role)}</span>
            <span>
              {participant.role === 'spectator' || participant.role === 'display'
                ? 'Watching'
                : participant.ready
                  ? 'Ready'
                  : 'Not ready'}
            </span>
          </li>
        ))}
      </ol>

      <div className="waiting-room__actions">
        {(projection.role === 'host' || projection.role === 'player') && (
          <button
            className={me?.ready ? 'button button--secondary' : 'button button--primary'}
            disabled={status !== 'connected'}
            onClick={() => sendCommand({ type: 'player.ready', payload: { ready: !me?.ready } })}
            type="button"
          >
            {me?.ready ? 'Ready — tap to change' : 'I’m ready'}
          </button>
        )}
        {isHost && (
          <button
            className="button button--secondary"
            disabled={readyCount < 2 || status !== 'connected'}
            onClick={() => sendCommand({ type: 'host.start', payload: {} })}
            type="button"
          >
            Start draft · {readyCount} ready
          </button>
        )}
      </div>
    </section>
  );
}

function DraftOffer({
  offer,
  selectedSlot,
  locked,
  waiting,
  onSelect,
  onLock,
}: {
  readonly offer: OfferProjection;
  readonly selectedSlot: keyof typeof SLOT_LABELS | null;
  readonly locked: boolean;
  readonly waiting: boolean;
  readonly onSelect: (slot: keyof typeof SLOT_LABELS) => void;
  readonly onLock: () => void;
}) {
  return (
    <div className="draft-offer">
      <div className="draft-offer__champion">
        <img
          alt={`${offer.champion.name} artwork`}
          className="draft-offer__art"
          height="260"
          src={offer.champion.defaultSplash}
          width="520"
        />
        <div className="draft-offer__identity">
          <img alt="" height="52" src={offer.champion.icon} width="52" />
          <div>
            <p>{offer.champion.title}</p>
            <h3>{offer.champion.name}</h3>
          </div>
        </div>
      </div>
      <div className="draft-offer__heading">
        <h3>Choose one open slot</h3>
        <p>Select a component, then lock it permanently.</p>
      </div>
      <div className="multiplayer-choice-list">
        {DRAFT_SLOT_ORDER.map((slot) => {
          const component = offer.components[slot];
          const selectable = offer.selectableSlots.includes(slot);
          const closed = !selectable;
          const label =
            component.availability.status === 'unavailable'
              ? `Unavailable: ${component.availability.summary}`
              : component.availability.status === 'conditional'
                ? `Conditional: ${component.availability.summary}`
                : closed
                  ? 'Not selectable in this offer'
                  : 'Selectable';
          const description =
            component.availability.status === 'available'
              ? component.shortDescription
              : component.availability.summary;
          return (
            <button
              aria-pressed={selectedSlot === slot}
              className={`multiplayer-choice ${selectedSlot === slot ? 'multiplayer-choice--selected' : ''} ${closed ? 'multiplayer-choice--closed' : ''}`}
              disabled={closed || locked || waiting}
              key={slot}
              onClick={() => onSelect(slot)}
              type="button"
            >
              <span className="multiplayer-choice__topline">
                <span>{SLOT_LABELS[slot]}</span>
                <span>{selectedSlot === slot ? 'Selected' : label}</span>
              </span>
              <span className="multiplayer-choice__identity">
                <img alt="" height="48" src={component.iconRef} width="48" />
                <strong>{component.name}</strong>
              </span>
              <span className="multiplayer-choice__description">{description}</span>
            </button>
          );
        })}
      </div>
      {selectedSlot && !locked && (
        <button
          className="button button--primary draft-lock-action"
          disabled={waiting}
          onClick={onLock}
          type="button"
        >
          Lock {SLOT_LABELS[selectedSlot]} permanently
        </button>
      )}
      {locked && (
        <p className="lobby-lock-notice" role="status">
          Choice locked. Waiting for the room to finish this round.
        </p>
      )}
    </div>
  );
}

function ProgressPanel({ projection }: { readonly projection: LobbyProjection }) {
  return (
    <aside aria-label="Round progress" className="lobby-progress-panel">
      <div className="lobby-progress-panel__heading">
        <h2>Room progress</h2>
        {projection.phase === 'drafting' && (
          <span>
            {projection.lockedCount}/{projection.playerCount} locked
          </span>
        )}
      </div>
      <ol className="participant-list participant-list--progress">
        {projection.participants
          .filter((participant) => participant.role === 'host' || participant.role === 'player')
          .map((participant) => (
            <li className="participant-row" key={participant.id}>
              <span className="participant-row__name">
                <span
                  aria-hidden="true"
                  className={`connection-mark ${participant.isConnected ? 'connection-mark--online' : ''}`}
                />
                <strong>{participant.nickname}</strong>
                {participant.id === projection.selfParticipantId && <span>You</span>}
              </span>
              <span
                className={
                  participant.lockedThisRound
                    ? 'progress-state progress-state--locked'
                    : 'progress-state'
                }
              >
                {projection.phase === 'draft-complete'
                  ? 'Draft complete'
                  : participant.lockedThisRound
                    ? 'Locked'
                    : participant.isConnected
                      ? 'Choosing'
                      : 'Disconnected · deadline pick'}
              </span>
            </li>
          ))}
      </ol>
    </aside>
  );
}

function isFullOffer(offer: LobbyProjection['offer']): offer is OfferProjection {
  return Boolean(offer && 'id' in offer);
}

function roleName(role: LobbyProjection['role'] | 'player') {
  switch (role) {
    case 'host':
      return 'Host';
    case 'player':
      return 'Player';
    case 'spectator':
      return 'Spectator';
    case 'display':
      return 'Display';
    case 'observer':
      return 'Observer';
  }
}

function connectionName(status: LobbyConnectionStatus) {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'reconnecting':
      return 'Reconnecting';
    case 'blocked':
      return 'Reconnect needed';
  }
}

function PhaseTimer({
  seconds,
  label,
}: {
  readonly seconds: number | null;
  readonly label: string;
}) {
  return (
    <div className={`lobby-timer ${seconds !== null && seconds <= 5 ? 'lobby-timer--urgent' : ''}`}>
      <span>{label}</span>
      <strong aria-label={`${label}: ${formatCountdown(seconds)}`} aria-live="off">
        {formatCountdown(seconds)}
      </strong>
    </div>
  );
}
