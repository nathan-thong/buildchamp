import { z } from 'zod';

import { DRAFT_SLOT_ORDER, type DraftSlot } from './draft-engine';
import type { SelectionReference } from './selection-details';
import { SlotSchema } from '../data/snapshot-schema';

export const SHARE_CODEC_VERSION = 1 as const;
export const SHARE_PAYLOAD_PREFIX = `v${SHARE_CODEC_VERSION}`;
export const MAX_SHARE_PAYLOAD_LENGTH = 1024;

const IdentifierSchema = z.string().min(1).max(160);
const EncodedSelectionSchema = z.tuple([
  IdentifierSchema,
  IdentifierSchema,
  SlotSchema,
  IdentifierSchema,
]);

const ShareEnvelopeSchema = z
  .object({
    v: z.literal(SHARE_CODEC_VERSION),
    s: IdentifierSchema,
    b: z.array(EncodedSelectionSchema).length(DRAFT_SLOT_ORDER.length),
  })
  .strict();

type EncodedSelection = z.infer<typeof EncodedSelectionSchema>;

export type ShareableResult = Readonly<{
  readonly snapshotVersion: string;
  readonly build: Readonly<Record<DraftSlot, SelectionReference>>;
}>;

export type ShareResult = ShareableResult;

export type ShareDecodeResult =
  | { readonly ok: true; readonly value: ShareResult }
  | { readonly ok: false; readonly reason: 'malformed' | 'unsupported-version' };

export function encodeShareResult(result: ShareableResult): string {
  const envelope = {
    v: SHARE_CODEC_VERSION,
    s: result.snapshotVersion,
    b: DRAFT_SLOT_ORDER.map((slot) => {
      const selection = result.build[slot];
      return [selection.championId, selection.variantId, slot, selection.componentId] as const;
    }),
  };

  return `${SHARE_PAYLOAD_PREFIX}.${encodeBase64Url(JSON.stringify(envelope))}`;
}

export function createSharePath(result: ShareableResult): string {
  return `/build/${encodeShareResult(result)}`;
}

export function decodeShareResult(payload: string): ShareDecodeResult {
  if (payload.length === 0 || payload.length > MAX_SHARE_PAYLOAD_LENGTH) {
    return { ok: false, reason: 'malformed' };
  }

  const match = payload.match(/^v(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!match) {
    return { ok: false, reason: 'malformed' };
  }

  if (match[1] !== String(SHARE_CODEC_VERSION)) {
    return { ok: false, reason: 'unsupported-version' };
  }

  try {
    const parsed = ShareEnvelopeSchema.safeParse(JSON.parse(decodeBase64Url(match[2])));
    if (!parsed.success) {
      return { ok: false, reason: 'malformed' };
    }

    const build = buildRecordFromSelections(parsed.data.b);
    if (!build) {
      return { ok: false, reason: 'malformed' };
    }

    return {
      ok: true,
      value: {
        snapshotVersion: parsed.data.s,
        build,
      },
    };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

function buildRecordFromSelections(
  selections: readonly EncodedSelection[],
): Readonly<Record<DraftSlot, SelectionReference>> | null {
  const bySlot: Partial<Record<DraftSlot, SelectionReference>> = {};

  for (const [championId, variantId, slot, componentId] of selections) {
    if (bySlot[slot]) {
      return null;
    }

    bySlot[slot] = { championId, variantId, slot, componentId };
  }

  if (DRAFT_SLOT_ORDER.some((slot) => !bySlot[slot])) {
    return null;
  }

  return bySlot as Readonly<Record<DraftSlot, SelectionReference>>;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string {
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
