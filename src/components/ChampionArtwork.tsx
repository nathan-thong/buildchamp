import { useState } from 'react';

import type { Champion, DraftVariant } from '../data/snapshot-schema';

type ChampionArtworkProps = {
  readonly champion: Champion;
  readonly variant?: DraftVariant;
  readonly className?: string;
};

export function ChampionArtwork({ champion, variant, className = '' }: ChampionArtworkProps) {
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
        <span>{variantLabel ?? 'Default form'}</span>
        <strong>{champion.name}</strong>
      </div>
    </div>
  );
}
