import { AppLink } from './AppLink';

type LoadingStateProps = {
  readonly label?: string;
};

export function LoadingState({ label = 'Please wait.' }: LoadingStateProps) {
  return (
    <section aria-busy="true" aria-live="polite" className="state-page" role="status">
      <div className="state-panel state-panel--loading">
        <span aria-hidden="true" className="state-mark state-mark--loading">
          <span />
          <span />
          <span />
        </span>
        <p className="eyebrow">LOADING</p>
        <h1>Loading</h1>
        <p>{label}</p>
      </div>
    </section>
  );
}

type FatalErrorStateProps = {
  readonly onReset?: () => void;
};

export function FatalErrorState({ onReset }: FatalErrorStateProps) {
  function handleReset() {
    if (onReset) {
      onReset();
      return;
    }

    window.location.assign('/');
  }

  return (
    <section aria-labelledby="fatal-error-title" className="state-page" role="alert">
      <div className="state-panel state-panel--error">
        <span aria-hidden="true" className="state-mark state-mark--error">
          !
        </span>
        <p className="eyebrow">ERROR</p>
        <h1 id="fatal-error-title">Could not load the page</h1>
        <p>Go home and try again.</p>
        <button className="button button--primary" onClick={handleReset} type="button">
          Go home <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  );
}

export function InvalidResultState() {
  return (
    <section aria-labelledby="invalid-result-title" className="state-page state-page--result">
      <div className="state-panel state-panel--result">
        <span aria-hidden="true" className="state-mark state-mark--result">
          ?
        </span>
        <p className="eyebrow">RESULT UNAVAILABLE</p>
        <h1 id="invalid-result-title">Result not available</h1>
        <p>The result link is invalid.</p>
        <div className="state-actions">
          <AppLink className="button button--primary" href="/solo">
            Start draft <span aria-hidden="true">↗</span>
          </AppLink>
          <AppLink className="button button--secondary" href="/">
            Back to home
          </AppLink>
        </div>
      </div>
    </section>
  );
}
