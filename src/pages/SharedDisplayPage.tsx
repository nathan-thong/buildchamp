import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { formatCountdown, useRemainingSeconds } from '../components/LobbyCountdown';
import { LobbyBuildCard } from '../components/LobbyBuildCard';
import { joinLobby, findLobbySession, type LobbySession } from '../lib/lobby-client';
import { useLobbyConnection } from '../lib/use-lobby-connection';
import { useSound } from '../lib/sound';
import type { LobbyProjection, PublicOfferIdentity } from '../../worker/lobby/schemas';

export function SharedDisplayPage({ roomCode }: { readonly roomCode: string }) {
  const [session, setSession] = useState<LobbySession | null>(() =>
    findLobbySession(roomCode, 'display'),
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const joinStartedRef = useRef(false);

  useEffect(() => {
    if (session || joinStartedRef.current) return;
    joinStartedRef.current = true;
    let active = true;
    void joinLobby(roomCode, 'Shared display', 'display').then(
      (createdSession) => {
        if (active) setSession(createdSession);
      },
      (error: unknown) => {
        if (active)
          setJoinError(
            error instanceof Error ? error.message : 'The display could not join this room.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [roomCode, session]);

  if (joinError) {
    return (
      <div className="page-container display-page">
        <h1>Display could not join.</h1>
        <p role="alert">{joinError}</p>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="page-container display-page">
        <p role="status">Connecting the shared display…</p>
      </div>
    );
  }
  return <ConnectedSharedDisplay roomCode={roomCode} session={session} />;
}

function ConnectedSharedDisplay({
  roomCode,
  session,
}: {
  readonly roomCode: string;
  readonly session: LobbySession;
}) {
  const { projection, status, error } = useLobbyConnection(session);
  const seconds = useRemainingSeconds(projection?.deadlineAt ?? null);
  const sound = useSound();
  const cuedDeadlineRef = useRef<number | null>(null);
  const joinUrl = `${window.location.origin}/room/${roomCode}`;

  useEffect(() => {
    if (
      seconds !== null &&
      seconds <= 5 &&
      seconds > 0 &&
      projection?.deadlineAt !== null &&
      projection?.deadlineAt !== undefined &&
      cuedDeadlineRef.current !== projection.deadlineAt
    ) {
      cuedDeadlineRef.current = projection.deadlineAt;
      sound.play('timer');
    }
  }, [projection?.deadlineAt, seconds, sound]);

  if (!projection) {
    return (
      <div className="page-container display-page">
        <p role="status">
          {status === 'reconnecting' ? 'Reconnecting the display…' : 'Connecting the display…'}
        </p>
      </div>
    );
  }

  const offers = projection.offersByPlayer ?? [];
  const sharedOffer = isPublicOffer(projection.offer) ? projection.offer : null;
  const lockedPlayers = projection.participants.filter(
    (participant) =>
      (participant.role === 'host' || participant.role === 'player') && participant.lockedThisRound,
  ).length;

  return (
    <div className="page-container display-page">
      <header className="display-header">
        <div>
          <p className="display-header__status">
            {status === 'connected' ? 'Room display connected' : 'Room display reconnecting'}
          </p>
          <h1>{displayHeadline(projection.phase)}</h1>
          <p>Scan the code to join as a player or spectator.</p>
        </div>
        <div className="display-code-block">
          <span>Room code</span>
          <strong>{projection.roomCode}</strong>
          <QRCodeSVG
            aria-label={`QR code for joining room ${projection.roomCode}`}
            bgColor="#f0e6d2"
            className="display-qr"
            fgColor="#07111c"
            level="M"
            marginSize={2}
            size={176}
            title={`Join BuildChamp room ${projection.roomCode}`}
            value={joinUrl}
          />
          <a href={joinUrl}>
            {new URL(joinUrl).host}/room/{projection.roomCode}
          </a>
        </div>
      </header>

      {projection.phase === 'waiting' && (
        <section aria-labelledby="display-waiting-title" className="display-waiting">
          <h2 id="display-waiting-title">Waiting for the host</h2>
          <p>
            {projection.settings.mode === 'same' ? 'Same Champs' : 'Random Champs'} ·{' '}
            {timerLabel(projection.settings.speed)}
            {' · '}
            {projection.settings.revealOrder === 'staged' ? 'staged reveal' : 'All at Once reveal'}
          </p>
          <DisplayProgress projection={projection} lockedPlayers={0} />
        </section>
      )}

      {projection.phase === 'drafting' && (
        <section aria-labelledby="display-round-title" className="display-draft">
          <div className="display-round-heading">
            <div>
              <h2 id="display-round-title">Round {projection.currentRound} of 6</h2>
              <p>
                {projection.settings.mode === 'same'
                  ? 'One shared champion offer'
                  : 'Each player has a different champion offer'}
              </p>
            </div>
            <div
              className={`lobby-timer lobby-timer--display ${seconds !== null && seconds <= 5 ? 'lobby-timer--urgent' : ''}`}
            >
              <span>Time left</span>
              <strong aria-label={`Time left ${formatCountdown(seconds)}`} aria-live="off">
                {formatCountdown(seconds)}
              </strong>
            </div>
          </div>

          {projection.settings.mode === 'same' && sharedOffer && (
            <ChampionDisplay offer={sharedOffer} />
          )}
          {projection.settings.mode === 'random' && (
            <div className="display-player-offers">
              {offers.map((entry) => (
                <article className="display-player-offer" key={entry.participantId}>
                  <span>{entry.nickname}</span>
                  <ChampionDisplay compact offer={entry.offer} />
                </article>
              ))}
            </div>
          )}
          <DisplayProgress projection={projection} lockedPlayers={lockedPlayers} />
        </section>
      )}

      {projection.phase === 'draft-complete' && (
        <section aria-labelledby="display-complete-title" className="display-waiting">
          <h2 id="display-complete-title">All six rounds are complete.</h2>
          <p>The reveal is being prepared.</p>
          <DisplayProgress projection={projection} lockedPlayers={projection.playerCount} />
        </section>
      )}

      {projection.phase === 'revealing' && (
        <section aria-labelledby="display-reveal-title" className="display-phase">
          <div className="display-phase__heading">
            <div>
              <p className="screen-label">The reveal</p>
              <h2 id="display-reveal-title">
                {projection.revealedCount} of {projection.candidateCount} builds revealed
              </h2>
              <p>
                {projection.settings.revealOrder === 'staged'
                  ? 'The host controls the pace. Each build appears in turn.'
                  : 'All completed builds are now on display.'}
              </p>
            </div>
            <DisplayTimer seconds={seconds} label="Next reveal" />
          </div>
          <div className="lobby-build-grid lobby-build-grid--display">
            {projection.builds.map((build) => (
              <LobbyBuildCard build={build} key={build.participantId} />
            ))}
          </div>
        </section>
      )}

      {projection.phase === 'voting' && (
        <section aria-labelledby="display-voting-title" className="display-phase">
          <div className="display-phase__heading">
            <div>
              <p className="screen-label">Secret ballot</p>
              <h2 id="display-voting-title">Which build do you prefer?</h2>
              <p>
                {projection.votesCastCount} ballots received · choices stay hidden until results
              </p>
            </div>
            <DisplayTimer seconds={seconds} label="Voting closes" />
          </div>
          <div className="lobby-build-grid lobby-build-grid--display">
            {projection.builds.map((build) => (
              <LobbyBuildCard build={build} key={build.participantId} />
            ))}
          </div>
        </section>
      )}

      {projection.phase === 'results' && (
        <section aria-labelledby="display-results-title" className="display-phase display-results">
          <div className="display-phase__heading">
            <div>
              <p className="screen-label">Room results</p>
              <h2 id="display-results-title">
                {projection.winnerIds?.length === 0
                  ? 'No ballots were cast'
                  : projection.winnerIds?.length === 1
                    ? 'The room’s favourite build'
                    : 'A shared victory'}
              </h2>
              <p>Every vote total is shown; tied favourites share the win.</p>
            </div>
          </div>
          <div className="lobby-build-grid lobby-build-grid--display">
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
        </section>
      )}

      {error && (
        <p className="display-connection-note" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

function displayHeadline(phase: LobbyProjection['phase']): string {
  switch (phase) {
    case 'waiting':
      return 'Join the draft.';
    case 'drafting':
      return 'The draft is on.';
    case 'draft-complete':
      return 'Draft complete.';
    case 'revealing':
      return 'The reveal is on.';
    case 'voting':
      return 'Voting is open.';
    case 'results':
      return 'The results are in.';
  }
}

function ChampionDisplay({
  offer,
  compact = false,
}: {
  readonly offer: PublicOfferIdentity;
  readonly compact?: boolean;
}) {
  return (
    <article className={`display-champion ${compact ? 'display-champion--compact' : ''}`}>
      <img
        alt={`${offer.champion.name} artwork`}
        className="display-champion__art"
        height={compact ? 120 : 270}
        src={compact ? offer.champion.defaultLoading : offer.champion.defaultSplash}
        width={compact ? 220 : 520}
      />
      <div className="display-champion__identity">
        <img alt="" height="42" src={offer.champion.icon} width="42" />
        <div>
          <p>{offer.champion.title}</p>
          <h3>{offer.champion.name}</h3>
        </div>
      </div>
    </article>
  );
}

function DisplayProgress({
  projection,
  lockedPlayers,
}: {
  readonly projection: LobbyProjection;
  readonly lockedPlayers: number;
}) {
  const players = projection.participants.filter(
    (participant) =>
      !participant.hasLeft && (participant.role === 'host' || participant.role === 'player'),
  );
  return (
    <div className="display-progress">
      <div className="display-progress__heading">
        <h2>Player progress</h2>
        {projection.phase === 'drafting' && (
          <span>
            {lockedPlayers} / {players.length} locked
          </span>
        )}
      </div>
      <ul>
        {players.map((participant) => (
          <li key={participant.id}>
            <strong>{participant.nickname}</strong>
            <span>
              {projection.phase === 'draft-complete'
                ? 'Draft complete'
                : participant.lockedThisRound
                  ? 'Locked'
                  : participant.isConnected
                    ? 'Choosing'
                    : 'Deadline pick'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisplayTimer({
  seconds,
  label,
}: {
  readonly seconds: number | null;
  readonly label: string;
}) {
  return (
    <div
      className={`lobby-timer lobby-timer--display ${seconds !== null && seconds <= 5 ? 'lobby-timer--urgent' : ''}`}
    >
      <span>{label}</span>
      <strong aria-label={`${label}: ${formatCountdown(seconds)}`} aria-live="off">
        {formatCountdown(seconds)}
      </strong>
    </div>
  );
}

function isPublicOffer(offer: LobbyProjection['offer']): offer is PublicOfferIdentity {
  return Boolean(offer && !('id' in offer));
}

function timerLabel(speed: LobbyProjection['settings']['speed']) {
  if (speed === 'quick') return '15-second rounds';
  if (speed === 'relaxed') return '45-second rounds';
  return '30-second rounds';
}
