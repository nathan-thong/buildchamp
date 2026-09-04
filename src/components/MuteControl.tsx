type MuteControlProps = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};

export function MuteControl({ muted, onToggle }: MuteControlProps) {
  return (
    <button
      aria-label={muted ? 'Turn sound on' : 'Mute sound'}
      aria-pressed={muted}
      className="mute-control"
      onClick={onToggle}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="sound-icon"
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11 5 6 9H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l5 4V5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        {!muted && (
          <>
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.7"
            />
            <path
              d="M18.5 5.5a9 9 0 0 1 0 13"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.7"
            />
          </>
        )}
        {muted && (
          <path
            className="sound-icon__muted-slash"
            d="m5 5 14 14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        )}
      </svg>
      <span className="mute-control__text">{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  );
}
