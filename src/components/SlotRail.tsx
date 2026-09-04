import { SLOT_METADATA, SLOT_ORDER, type Slot } from '../domain/slots';
import { SlotGlyph } from './SlotGlyph';

type SlotRailProps = {
  readonly lockedSlots?: readonly Slot[];
  readonly selectedSlot?: Slot | null;
  readonly onSelect?: (slot: Slot) => void;
  readonly interactive?: boolean;
  readonly className?: string;
};

export function SlotRail({
  lockedSlots = [],
  selectedSlot = null,
  onSelect,
  interactive = true,
  className = '',
}: SlotRailProps) {
  return (
    <div aria-label="Build slots" className={`slot-rail ${className}`.trim()}>
      {SLOT_ORDER.map((slot) => {
        const metadata = SLOT_METADATA[slot];
        const isLocked = lockedSlots.includes(slot);
        const isSelected = selectedSlot === slot;
        const cardClassName = [
          'slot-card',
          `slot-card--${slot.toLowerCase()}`,
          isLocked ? 'slot-card--locked' : 'slot-card--open',
          isSelected ? 'slot-card--selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const content = (
          <>
            <span className="slot-card__topline">
              <span className="slot-card__index">{metadata.index}</span>
              <span className="slot-card__state">{isLocked ? 'LOCKED' : 'OPEN'}</span>
            </span>
            <SlotGlyph className="slot-card__glyph" slot={slot} />
            <span className="slot-card__label">{metadata.label}</span>
            <span className="slot-card__description">{metadata.description}</span>
            <span aria-hidden="true" className="slot-card__rule" />
          </>
        );

        if (!interactive) {
          return (
            <div
              aria-label={`${metadata.label} slot, ${isLocked ? 'locked' : 'open'}`}
              className={cardClassName}
              key={slot}
              role="group"
            >
              {content}
            </div>
          );
        }

        return (
          <button
            aria-label={`${metadata.label} slot, ${isLocked ? 'locked' : 'open'}`}
            aria-pressed={isSelected}
            className={cardClassName}
            data-slot={slot}
            disabled={isLocked}
            key={slot}
            onClick={() => onSelect?.(slot)}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
