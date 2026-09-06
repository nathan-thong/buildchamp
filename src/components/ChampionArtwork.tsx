import { useState } from 'react';

import type { Champion, DraftVariant } from '../data/snapshot-schema';

export type ChampionArtworkAbility = {
  readonly slot: string;
  readonly name: string;
  readonly iconRef: string;
};

type ChampionArtworkProps = {
  readonly champion: Champion;
  readonly variant?: DraftVariant;
  readonly abilities?: readonly ChampionArtworkAbility[];
  readonly className?: string;
};

export function ChampionArtwork({
  champion,
  variant,
  abilities = [],
  className = '',
}: ChampionArtworkProps) {
  const variantLabel = variant?.label;
  const imageSource = champion.assetRefs.defaultSplash;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const alt = variantLabel
    ? `${champion.name}, ${variantLabel} champion artwork`
    : `${champion.name} champion artwork`;

  return (
    <div className={`champion-art ${className}`.trim()}>
      {failedSource === imageSource ? (
        <div aria-label={alt} className="champion-art__fallback" role="img">
          <span>Artwork unavailable</span>
          <strong>{champion.name}</strong>
        </div>
      ) : (
        <img
          alt={alt}
          className="champion-art__image"
          decoding="async"
          height="1080"
          loading="eager"
          onError={() => setFailedSource(imageSource)}
          src={imageSource}
          width="1920"
        />
      )}
      <div aria-hidden="true" className="champion-art__wash" />
      <div aria-hidden="true" className="champion-art__grid" />
      <div className="champion-art__stamp">
        <div className="champion-art__stamp-row">
          <div className="champion-art__body-label">
            <span>Body{variantLabel ? ` · ${variantLabel}` : ''}</span>
            <strong>{champion.name}</strong>
          </div>
          {abilities.length > 0 && (
            <div
              aria-label="Composite ability icons"
              className="champion-art__abilities"
              role="group"
            >
              {abilities.map((ability) => (
                <img
                  alt={`${ability.slot}: ${ability.name}`}
                  className="champion-art__ability-icon"
                  data-composite-ability-slot={ability.slot}
                  height="64"
                  key={ability.slot}
                  loading="eager"
                  src={ability.iconRef}
                  title={`${ability.slot}: ${ability.name}`}
                  width="64"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
