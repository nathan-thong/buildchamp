import type { Slot } from '../domain/slots';

type SlotGlyphProps = {
  readonly slot: Slot;
  readonly className?: string;
};

const GLYPH_PATHS: Readonly<Record<Slot, string>> = {
  Body: 'M20 8c-4 0-6 3-6 7v3l-7 4v10h26V22l-7-4v-3c0-4-2-7-6-7Zm-4 10h8M13 25h14',
  Q: 'm7 25 6-13 4 7 4-11 6 17-8-4-12 4Z',
  W: 'M20 6 15 18l-6-4 4 10h14l4-10-6 4-5-12Zm-8 18 4 5h8l4-5',
  E: 'm7 24 8-13 1 8 9-5-5 12-1-8-12 6Z',
  R: 'M20 5v5m0 20v-5m15-5h-5M10 20H5m25.6-10.6-3.5 3.5M12.9 27.1l-3.5 3.5m21.2 0-3.5-3.5M12.9 12.9 9.4 9.4M20 11a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  Passive: 'M20 5 24 15l10 5-10 5-4 10-4-10L6 20l10-5 4-10Zm0 9v12m-6-6h12',
};

export function SlotGlyph({ slot, className }: SlotGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={GLYPH_PATHS[slot]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
