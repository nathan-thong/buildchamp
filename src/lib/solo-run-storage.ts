import { z } from 'zod';

import {
  PERSISTED_DRAFTING_RUN_VERSION,
  restoreDraftingRun,
  serializeDraftingRun,
  type DraftingRunState,
  type PersistedDraftingRun,
} from '../domain/draft-engine';
import { SlotSchema } from '../data/snapshot-schema';
import type { ChampionSnapshot } from '../data/snapshot-schema';

export const SOLO_RUN_STORAGE_KEY = 'buildchamp.solo-run.v1';

const SelectionSchema = z
  .object({
    offerId: z.string().min(1),
    championId: z.string().min(1),
    variantId: z.string().min(1),
    slot: SlotSchema,
    componentId: z.string().min(1),
  })
  .strict();

const LockedBuildSchema = z
  .object({
    body: SelectionSchema.optional(),
    q: SelectionSchema.optional(),
    w: SelectionSchema.optional(),
    e: SelectionSchema.optional(),
    r: SelectionSchema.optional(),
    passive: SelectionSchema.optional(),
  })
  .strict();

const PersistedOfferSchema = z
  .object({
    id: z.string().min(1),
    championId: z.string().min(1),
    variantId: z.string().min(1),
  })
  .strict();

export const PersistedDraftingRunSchema = z
  .object({
    schemaVersion: z.literal(PERSISTED_DRAFTING_RUN_VERSION),
    snapshotVersion: z.string().min(1),
    round: z.number().int().min(0).max(5),
    usedChampionIds: z.array(z.string().min(1)).max(5),
    lockedBuild: LockedBuildSchema,
    picks: z.array(SelectionSchema).max(5),
    offer: PersistedOfferSchema,
  })
  .strict();

export function getSoloRunStorage(): Storage | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readSoloRun(
  snapshot: ChampionSnapshot,
  storage: Storage | undefined = getSoloRunStorage(),
): DraftingRunState | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(SOLO_RUN_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = PersistedDraftingRunSchema.safeParse(JSON.parse(rawValue));
    if (!parsed.success) {
      discardStoredRun(storage);
      return null;
    }

    return restoreDraftingRun(snapshot, parsed.data);
  } catch {
    discardStoredRun(storage);
    return null;
  }
}

export function writeSoloRun(
  state: DraftingRunState,
  storage: Storage | undefined = getSoloRunStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    const persisted: PersistedDraftingRun = serializeDraftingRun(state);
    const validated = PersistedDraftingRunSchema.parse(persisted);
    storage.setItem(SOLO_RUN_STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch {
    // Storage failures must not stop a player from continuing the run.
    return false;
  }
}

export function clearSoloRun(storage: Storage | undefined = getSoloRunStorage()): void {
  discardStoredRun(storage);
}

function discardStoredRun(storage: Storage | undefined): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SOLO_RUN_STORAGE_KEY);
  } catch {
    // A privacy-mode or quota failure should never prevent the UI from loading.
  }
}
