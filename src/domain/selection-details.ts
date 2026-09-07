import type { Champion, ChampionSnapshot, Component, DraftVariant } from '../data/snapshot-schema';
import type { Selection } from './draft-engine';

export type SelectionReference = Pick<
  Selection,
  'championId' | 'variantId' | 'slot' | 'componentId'
>;

export type SelectionDetails = {
  readonly champion: Champion;
  readonly variant: DraftVariant;
  readonly component: Component;
};

export function findSelectionDetails(
  snapshot: ChampionSnapshot,
  selection: SelectionReference,
): SelectionDetails | null {
  const champion = snapshot.champions.find((candidate) => candidate.id === selection.championId);
  const variant = champion?.variants.find((candidate) => candidate.id === selection.variantId);
  const component = variant?.components[selection.slot];

  if (!champion || !variant || !component || component.id !== selection.componentId) {
    return null;
  }

  return { champion, variant, component };
}

export function formatSourceName(details: SelectionDetails): string {
  return details.variant.label
    ? `${details.champion.name} · ${details.variant.label}`
    : details.champion.name;
}
