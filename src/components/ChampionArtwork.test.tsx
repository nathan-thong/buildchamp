import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUNDLED_CHAMPION_SNAPSHOT } from '../data/runtime-snapshot';
import { ChampionArtwork } from './ChampionArtwork';

describe('ChampionArtwork', () => {
  it('shows an accessible fallback when the champion artwork fails to load', () => {
    const champion = BUNDLED_CHAMPION_SNAPSHOT.champions[0];
    if (!champion) {
      throw new Error('The bundled champion snapshot must not be empty.');
    }

    render(<ChampionArtwork champion={champion} />);

    expect(document.querySelector('picture source')).toHaveAttribute(
      'srcset',
      champion.assetRefs.defaultLoading,
    );

    fireEvent.error(screen.getByRole('img', { name: `${champion.name} champion artwork` }));

    expect(
      screen.getByRole('img', { name: `${champion.name} champion artwork` }),
    ).toHaveTextContent('Artwork unavailable');
  });
});
