import { AppLink } from '../components/AppLink';
import { HomeSlotCarousel } from '../components/HomeSlotCarousel';

export function HomePage() {
  return (
    <div className="page-container home-page">
      <section aria-labelledby="home-title" className="home-hero">
        <div className="home-hero__copy">
          <p className="home-hero__status">
            <span aria-hidden="true" /> Solo draft
          </p>
          <h1 id="home-title">
            Choose six
            <span>slots</span>
          </h1>
          <p className="home-hero__lede">Choose one slot from each offer. Locks are permanent.</p>
          <div className="home-hero__actions">
            <AppLink className="button button--primary" href="/solo">
              Start solo draft <span aria-hidden="true">↗</span>
            </AppLink>
            <a className="home-hero__secondary" href="#how-it-works">
              Rules <span aria-hidden="true">↓</span>
            </a>
          </div>
          <dl className="home-hero__stats">
            <div>
              <dt>Rounds</dt>
              <dd>06</dd>
            </div>
            <div>
              <dt>Locks</dt>
              <dd>06</dd>
            </div>
            <div>
              <dt>Timer</dt>
              <dd>None</dd>
            </div>
          </dl>
        </div>

        <div className="home-stage">
          <div aria-hidden="true" className="home-stage__halo" />
          <article aria-labelledby="home-board-title" className="home-build-card">
            <div className="home-build-card__topline">
              <span>Solo draft</span>
              <span>Preview</span>
            </div>
            <div className="home-build-card__title">
              <span>Six slots</span>
              <h2 id="home-board-title">Build</h2>
            </div>
            <HomeSlotCarousel />
          </article>
        </div>
      </section>

      <section aria-labelledby="rules-title" className="home-how" id="how-it-works">
        <div className="home-how__heading">
          <h2 id="rules-title">Rules</h2>
          <p>Six rounds. One choice each round.</p>
        </div>
        <ol className="home-how__list">
          <li className="home-how__item">
            <h3>Offers</h3>
            <p>Each round shows a champion offer.</p>
          </li>
          <li className="home-how__item">
            <h3>Slots</h3>
            <p>Choose Body, Q, W, E, R, or Passive.</p>
          </li>
          <li className="home-how__item">
            <h3>Locks</h3>
            <p>You cannot change a locked slot.</p>
          </li>
          <li className="home-how__item">
            <h3>Order</h3>
            <p>Choose open slots in any order.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
