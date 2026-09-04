import { AppLink } from '../components/AppLink';

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="state-page">
      <div className="state-panel state-panel--not-found">
        <span aria-hidden="true" className="state-mark state-mark--not-found">
          404
        </span>
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p>Check the address or go home.</p>
        <AppLink className="button button--primary" href="/">
          Go home <span aria-hidden="true">↗</span>
        </AppLink>
      </div>
    </section>
  );
}
