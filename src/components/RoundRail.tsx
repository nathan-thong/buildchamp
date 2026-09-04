type RoundRailProps = {
  readonly activeRound: number;
  readonly completedThrough?: number;
};

export function RoundRail({ activeRound, completedThrough = 0 }: RoundRailProps) {
  return (
    <ol aria-label="Draft rounds" className="round-rail">
      {Array.from({ length: 6 }, (_, index) => {
        const round = index + 1;
        const isComplete = round <= completedThrough;
        const isActive = round === activeRound;

        return (
          <li
            aria-current={isActive ? 'step' : undefined}
            className={`round-rail__step ${isComplete ? 'round-rail__step--complete' : ''} ${isActive ? 'round-rail__step--active' : ''}`.trim()}
            key={round}
          >
            <span>{String(round).padStart(2, '0')}</span>
          </li>
        );
      })}
    </ol>
  );
}
