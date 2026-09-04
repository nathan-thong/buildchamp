export const SLOT_ORDER = ['Body', 'Q', 'W', 'E', 'R', 'Passive'] as const;

export type Slot = (typeof SLOT_ORDER)[number];

export type SlotMetadata = {
  readonly label: string;
  readonly index: string;
  readonly description: string;
};

export const SLOT_METADATA = {
  Body: {
    label: 'Body',
    index: '01',
    description: 'Base stats',
  },
  Q: {
    label: 'Q',
    index: '02',
    description: 'First ability',
  },
  W: {
    label: 'W',
    index: '03',
    description: 'Second ability',
  },
  E: {
    label: 'E',
    index: '04',
    description: 'Third ability',
  },
  R: {
    label: 'R',
    index: '05',
    description: 'Ultimate ability',
  },
  Passive: {
    label: 'Passive',
    index: '06',
    description: 'Passive effect',
  },
} satisfies Readonly<Record<Slot, SlotMetadata>>;

export function isSlot(value: string): value is Slot {
  return (SLOT_ORDER as readonly string[]).includes(value);
}
