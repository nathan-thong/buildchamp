import { FOUNDATION_CHAMPION } from '../data/foundation-fixture';

export function ChampionFixture() {
  return (
    <div aria-label={FOUNDATION_CHAMPION.artLabel} className="champion-visual" role="img">
      <div aria-hidden="true" className="champion-visual__grid" />
      <div aria-hidden="true" className="champion-visual__orbit champion-visual__orbit--one" />
      <div aria-hidden="true" className="champion-visual__orbit champion-visual__orbit--two" />
      <div aria-hidden="true" className="champion-visual__figure">
        <span className="champion-visual__horn champion-visual__horn--left" />
        <span className="champion-visual__horn champion-visual__horn--right" />
        <span className="champion-visual__head" />
        <span className="champion-visual__shoulder champion-visual__shoulder--left" />
        <span className="champion-visual__shoulder champion-visual__shoulder--right" />
        <span className="champion-visual__core" />
      </div>
      <div className="champion-visual__stamp">
        <span>EXAMPLE</span>
        <strong>01</strong>
      </div>
      <div className="champion-visual__scanline" />
    </div>
  );
}
