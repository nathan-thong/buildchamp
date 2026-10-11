import { SLOT_METADATA } from '../domain/slots';
import type { LobbyProjection } from '../../worker/lobby/schemas';

type LobbyBuild = LobbyProjection['builds'][number];

type LobbyBuildCardProps = {
  readonly build: LobbyBuild;
  readonly voted?: boolean;
  readonly disabled?: boolean;
  readonly voteCount?: number;
  readonly isWinner?: boolean;
  readonly canVote?: boolean;
  readonly onVote?: () => void;
};

export function LobbyBuildCard({
  build,
  voted = false,
  disabled = false,
  voteCount,
  isWinner = false,
  canVote = false,
  onVote,
}: LobbyBuildCardProps) {
  const body = build.build.body;
  return (
    <article
      aria-label={`${build.nickname}'s completed build${isWinner ? ', winner' : ''}`}
      className={`lobby-build-card ${isWinner ? 'lobby-build-card--winner' : ''}`.trim()}
    >
      <header className="lobby-build-card__header">
        <img
          alt=""
          className="lobby-build-card__art"
          height="112"
          loading="lazy"
          src={body.champion.defaultLoading}
          width="224"
        />
        <div className="lobby-build-card__identity">
          <p className="screen-label">
            {isWinner ? 'Winner' : build.hasLeft ? 'Build locked' : 'Completed build'}
          </p>
          <h3>{build.nickname}</h3>
          <p>{body.champion.name} supplies the Body</p>
          {voteCount !== undefined && (
            <strong className="lobby-build-card__votes">
              {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
            </strong>
          )}
        </div>
      </header>

      <ol aria-label={`${build.nickname}'s six slots`} className="lobby-build-card__slots">
        {(
          [
            ['body', 'Body'],
            ['q', 'Q'],
            ['w', 'W'],
            ['e', 'E'],
            ['r', 'R'],
            ['passive', 'Passive'],
          ] as const
        ).map(([slot, metadataSlot]) => {
          const component = build.build[slot];
          return (
            <li className="lobby-build-slot" key={slot}>
              <img alt="" height="40" loading="lazy" src={component.iconRef} width="40" />
              <div>
                <span>{SLOT_METADATA[metadataSlot].label}</span>
                <strong>{component.name}</strong>
                <small>From {component.champion.name}</small>
              </div>
            </li>
          );
        })}
      </ol>

      {canVote && onVote && (
        <button
          aria-label={`Vote for ${build.nickname}'s build`}
          className="button button--secondary lobby-build-card__vote"
          disabled={disabled || voted}
          onClick={onVote}
          type="button"
        >
          {voted ? 'Ballot locked' : 'Vote for this build'}
        </button>
      )}
    </article>
  );
}
