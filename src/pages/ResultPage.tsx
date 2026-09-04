import { AppLink } from '../components/AppLink';
import { ChampionFixture } from '../components/ChampionFixture';
import { RoundRail } from '../components/RoundRail';
import { SlotRail } from '../components/SlotRail';
import { InvalidResultState } from '../components/StatePanels';
import { SLOT_ORDER } from '../domain/slots';

type ResultPageProps = {
  readonly payload: string;
};

export function ResultPage({ payload }: ResultPageProps) {
  if (payload !== 'demo') {
    return <InvalidResultState />;
  }

  return (
    <div className="page-container result-page">
      <header className="result-heading">
        <div>
          <p className="result-heading__meta">Shared result</p>
          <h1>Build complete</h1>
        </div>
      </header>

      <div className="result-progress">
        <RoundRail activeRound={6} completedThrough={6} />
      </div>

      <div className="preview-ribbon" role="note">
        <span className="preview-ribbon__label">Preview only</span>
        <span>This uses example data.</span>
      </div>

      <section aria-labelledby="result-title" className="result-hero panel">
        <div className="result-hero__art">
          <ChampionFixture />
        </div>
        <div className="result-hero__copy">
          <p className="screen-label">Example build</p>
          <h2 id="result-title">Completed build</h2>
          <div className="result-hero__details">
            <span>
              <strong>06</strong> slots
            </span>
            <span>
              <strong>—</strong> No score
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="result-pieces-title" className="result-pieces">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="screen-label">Completed build</p>
            <h2 id="result-pieces-title">Slots</h2>
          </div>
        </div>
        <SlotRail className="result-slot-rail" interactive={false} lockedSlots={SLOT_ORDER} />
      </section>

      <section aria-label="Result actions" className="result-actions">
        <div>
          <p className="screen-label">New draft</p>
          <h2>Start a new draft</h2>
        </div>
        <div className="result-actions__buttons">
          <AppLink className="button button--primary" href="/solo">
            Start draft <span aria-hidden="true">↗</span>
          </AppLink>
          <AppLink className="button button--secondary" href="/">
            Back to home
          </AppLink>
        </div>
      </section>
    </div>
  );
}
