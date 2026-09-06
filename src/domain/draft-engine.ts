import type {
  Champion,
  ChampionSnapshot,
  Component,
  DraftVariant,
  Slot as SnapshotSlot,
} from '../data/snapshot-schema.ts';

/**
 * The engine uses the normalized snapshot's stable slot ids. The presentation
 * layer can map these to the title-cased labels used by the board.
 */
export const DRAFT_SLOT_ORDER = ['body', 'q', 'w', 'e', 'r', 'passive'] as const;
export type DraftSlot = (typeof DRAFT_SLOT_ORDER)[number] & SnapshotSlot;

const SLOT_BITS: Readonly<Record<DraftSlot, number>> = {
  body: 1 << 0,
  q: 1 << 1,
  w: 1 << 2,
  e: 1 << 3,
  r: 1 << 4,
  passive: 1 << 5,
};
const COMPLETE_SLOT_MASK = (1 << DRAFT_SLOT_ORDER.length) - 1;

export type RandomSource = () => number;

/** Create a reproducible random source for tests and deterministic replays. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || !Number.isFinite(seed)) {
    throw new DraftEngineError('invalid-state', 'A seeded random source requires an integer seed.');
  }

  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export type Selection = Readonly<{
  offerId: string;
  championId: string;
  variantId: string;
  slot: DraftSlot;
  componentId: string;
}>;

export type LockedSelection = Selection;

export type LockedBuild = Readonly<Partial<Record<DraftSlot, LockedSelection>>>;
export type CompleteLockedBuild = Readonly<Record<DraftSlot, LockedSelection>>;

export type Completion = Readonly<{
  snapshotVersion: string;
  build: CompleteLockedBuild;
  picks: readonly LockedSelection[];
}>;

export type Offer = Readonly<{
  id: string;
  championId: string;
  variantId: string;
  champion: Champion;
  variant: DraftVariant;
  components: Readonly<DraftVariant['components']>;
  selectableSlots: readonly DraftSlot[];
  selectableComponents: readonly Component[];
}>;

type RunStateBase = Readonly<{
  snapshotVersion: string;
  /** Number of locks already made. A new run starts at 0 and completes at 6. */
  round: number;
  usedChampionIds: readonly string[];
  lockedBuild: LockedBuild;
  picks: readonly LockedSelection[];
}>;

export type DraftingRunState = RunStateBase &
  Readonly<{
    status: 'drafting';
    offer: Offer;
    completion: null;
  }>;

export type CompletedRunState = RunStateBase &
  Readonly<{
    status: 'complete';
    offer: null;
    completion: Completion;
  }>;

export type RunState = DraftingRunState | CompletedRunState;

/** Versioned, compact representation used by the browser recovery adapter. */
export const PERSISTED_DRAFTING_RUN_VERSION = 1 as const;
export type PersistedDraftingRun = Readonly<{
  schemaVersion: typeof PERSISTED_DRAFTING_RUN_VERSION;
  snapshotVersion: string;
  round: number;
  usedChampionIds: readonly string[];
  lockedBuild: LockedBuild;
  picks: readonly LockedSelection[];
  offer: Readonly<Pick<Offer, 'id' | 'championId' | 'variantId'>>;
}>;

export type DraftEngineErrorCode =
  | 'invalid-state'
  | 'invalid-selection'
  | 'invalid-final-choice'
  | 'no-legal-offer'
  | 'run-complete';

export class DraftEngineError extends Error {
  readonly code: DraftEngineErrorCode;

  constructor(code: DraftEngineErrorCode, message: string) {
    super(message);
    this.name = 'DraftEngineError';
    this.code = code;
  }
}

type SearchContext = {
  readonly champions: readonly Champion[];
  readonly variantsByChampionId: ReadonlyMap<string, readonly DraftVariant[]>;
  readonly legalOffersByState: Map<string, readonly Offer[]>;
  readonly completionByState: Map<string, boolean>;
};

type SearchPosition = {
  readonly lockedSlotMask: number;
  readonly usedChampionIds: ReadonlySet<string>;
};

/**
 * Start a run and generate its first safe offer.
 */
export function createRun(
  snapshot: ChampionSnapshot,
  random: RandomSource = Math.random,
): DraftingRunState {
  const position: SearchPosition = {
    lockedSlotMask: 0,
    usedChampionIds: new Set<string>(),
  };
  const offer = generateOfferAtPosition(snapshot, position, random);

  return {
    snapshotVersion: snapshot.dataDragonVersion,
    round: 0,
    status: 'drafting',
    offer,
    completion: null,
    usedChampionIds: [],
    lockedBuild: {},
    picks: [],
  };
}

/** Start a new, independent run. */
export const createFreshRun = createRun;

/** Start a fresh rematch without carrying over any prior picks or offer. */
export function freshRematch(
  snapshot: ChampionSnapshot,
  random: RandomSource = Math.random,
): DraftingRunState {
  return createRun(snapshot, random);
}

/** Alias that reads naturally at call sites handling a completed run. */
export const rematch = freshRematch;

/** Reduce an active run to identifiers that are safe to keep in local storage. */
export function serializeDraftingRun(state: DraftingRunState): PersistedDraftingRun {
  return {
    schemaVersion: PERSISTED_DRAFTING_RUN_VERSION,
    snapshotVersion: state.snapshotVersion,
    round: state.round,
    usedChampionIds: [...state.usedChampionIds],
    lockedBuild: { ...state.lockedBuild },
    picks: [...state.picks],
    offer: {
      id: state.offer.id,
      championId: state.offer.championId,
      variantId: state.offer.variantId,
    },
  };
}

/**
 * Rehydrate a stored active run against the current bundled snapshot. The
 * offer is rebuilt from its references and must still be a legal offer for the
 * recovered position before it is returned to the UI.
 */
export function restoreDraftingRun(
  snapshot: ChampionSnapshot,
  persisted: PersistedDraftingRun,
): DraftingRunState {
  if (persisted.schemaVersion !== PERSISTED_DRAFTING_RUN_VERSION) {
    throw new DraftEngineError('invalid-state', 'Stored draft data uses an unsupported version.');
  }

  if (persisted.snapshotVersion !== snapshot.dataDragonVersion) {
    throw new DraftEngineError(
      'invalid-state',
      `Stored draft snapshot ${persisted.snapshotVersion} does not match ${snapshot.dataDragonVersion}.`,
    );
  }

  const champion = snapshot.champions.find(
    (candidate) => candidate.id === persisted.offer.championId,
  );
  const variant = champion?.variants.find(
    (candidate) => candidate.id === persisted.offer.variantId,
  );
  if (!champion || !variant || champion.excluded) {
    throw new DraftEngineError('invalid-state', 'Stored draft offer is no longer available.');
  }

  const offer = createOffer(champion, variant, getLockedSlotMask(persisted.lockedBuild));
  if (
    offer.id !== persisted.offer.id ||
    offer.championId !== persisted.offer.championId ||
    offer.variantId !== persisted.offer.variantId
  ) {
    throw new DraftEngineError('invalid-state', 'Stored draft offer references are inconsistent.');
  }

  const recovered: DraftingRunState = {
    snapshotVersion: persisted.snapshotVersion,
    round: persisted.round,
    status: 'drafting',
    offer,
    completion: null,
    usedChampionIds: [...persisted.usedChampionIds],
    lockedBuild: { ...persisted.lockedBuild },
    picks: [...persisted.picks],
  };

  assertRunState(snapshot, recovered);
  const legalOffer = getLegalOffers(snapshot, recovered).find(
    (candidate) => candidate.id === recovered.offer.id,
  );
  if (!legalOffer) {
    throw new DraftEngineError('invalid-state', 'Stored draft offer is not legal for this run.');
  }

  return { ...recovered, offer: legalOffer };
}

/** Return the one-based round currently shown to a player. */
export function currentRound(state: RunState): number {
  return state.status === 'complete' ? DRAFT_SLOT_ORDER.length : state.round + 1;
}

/** Return the open slots in canonical order. */
export function openSlots(state: RunState): readonly DraftSlot[] {
  const lockedSlotMask = getLockedSlotMask(state.lockedBuild);
  return DRAFT_SLOT_ORDER.filter((slot) => (lockedSlotMask & SLOT_BITS[slot]) === 0);
}

/**
 * Return all offers that are safe to show for the current run position.
 *
 * A safe offer has the minimum number of selectable components for the round,
 * and every one of those components still has a legal path to completion.
 */
export function getLegalOffers(snapshot: ChampionSnapshot, state: RunState): readonly Offer[] {
  assertRunState(snapshot, state);
  if (state.status === 'complete') {
    return [];
  }

  const context = createSearchContext(snapshot);
  const position = positionFromRun(state);
  return findLegalOffers(snapshot, position, context);
}

/** Generate the next adaptive offer using injected randomness. */
export function generateOffer(
  snapshot: ChampionSnapshot,
  state: RunState,
  random: RandomSource = Math.random,
): Offer {
  assertRunState(snapshot, state);
  if (state.status === 'complete') {
    throw new DraftEngineError('run-complete', 'A completed run has no next offer.');
  }

  return generateOfferAtPosition(snapshot, positionFromRun(state), random);
}

/**
 * Return whether a run position has at least one safe continuation. Completed
 * runs are already complete and therefore return true.
 */
export function hasLegalContinuation(snapshot: ChampionSnapshot, state: RunState): boolean {
  assertRunState(snapshot, state);
  if (state.status === 'complete') {
    return true;
  }

  const context = createSearchContext(snapshot);
  return canComplete(snapshot, positionFromRun(state), context);
}

/**
 * Check a particular current-offer choice without changing the run.
 */
export function hasLegalContinuationAfterSelection(
  snapshot: ChampionSnapshot,
  state: RunState,
  selection: Selection,
): boolean {
  assertRunState(snapshot, state);
  if (state.status === 'complete') {
    return false;
  }

  validateSelection(state, selection);
  const context = createSearchContext(snapshot);
  return canComplete(snapshot, positionAfterSelection(state, selection), context);
}

/** Alias used by callers that describe the check as choice validation. */
export const isSelectionCompletable = hasLegalContinuationAfterSelection;

/** Create a selection reference for one selectable slot in an offer. */
export function selectionForSlot(offer: Offer, slot: DraftSlot): Selection {
  if (!DRAFT_SLOT_ORDER.includes(slot)) {
    throw new DraftEngineError('invalid-selection', `Unknown draft slot ${slot}.`);
  }

  if (!offer.selectableSlots.includes(slot)) {
    throw new DraftEngineError(
      'invalid-selection',
      `The ${slot} component is not selectable in offer ${offer.id}.`,
    );
  }

  const component = offer.components[slot];
  if (component.availability.status === 'unavailable') {
    throw new DraftEngineError(
      'invalid-selection',
      `Component ${component.id} is unavailable and cannot be selected.`,
    );
  }

  return {
    offerId: offer.id,
    championId: offer.championId,
    variantId: offer.variantId,
    slot,
    componentId: component.id,
  };
}

/**
 * Lock a compatible current-offer choice and generate the next offer when the
 * run is not complete.
 */
export function lockSelection(
  snapshot: ChampionSnapshot,
  state: RunState,
  selection: Selection,
  random: RandomSource = Math.random,
): RunState {
  assertRunState(snapshot, state);
  if (state.status === 'complete') {
    throw new DraftEngineError('run-complete', 'A completed run cannot accept another lock.');
  }

  validateSelection(state, selection);
  const context = createSearchContext(snapshot);
  if (!canComplete(snapshot, positionAfterSelection(state, selection), context)) {
    throw new DraftEngineError(
      'invalid-selection',
      `Selection ${selection.componentId} would leave no legal completion path.`,
    );
  }

  const lockedSelection: LockedSelection = { ...selection };
  const lockedBuild: LockedBuild = {
    ...state.lockedBuild,
    [selection.slot]: lockedSelection,
  };
  const picks = [...state.picks, lockedSelection];
  const usedChampionIds = [...state.usedChampionIds, selection.championId];
  const round = state.round + 1;

  if (round === DRAFT_SLOT_ORDER.length) {
    const completion = createCompletion(snapshot.dataDragonVersion, lockedBuild, picks);
    return {
      snapshotVersion: snapshot.dataDragonVersion,
      round,
      status: 'complete',
      offer: null,
      completion,
      usedChampionIds,
      lockedBuild,
      picks,
    };
  }

  const nextState: DraftingRunState = {
    snapshotVersion: snapshot.dataDragonVersion,
    round,
    status: 'drafting',
    offer: generateOfferAtPosition(
      snapshot,
      {
        lockedSlotMask: getLockedSlotMask(lockedBuild),
        usedChampionIds: new Set(usedChampionIds),
      },
      random,
      context,
    ),
    completion: null,
    usedChampionIds,
    lockedBuild,
    picks,
  };

  return nextState;
}

/** Choose a uniformly random compatible component from the current offer. */
export function chooseRandomSelection(
  state: RunState,
  random: RandomSource = Math.random,
): Selection {
  assertDraftingState(state);
  const components = state.offer.selectableComponents;
  if (components.length === 0) {
    throw new DraftEngineError(
      'no-legal-offer',
      `Offer ${state.offer.id} has no selectable component for round ${currentRound(state)}.`,
    );
  }

  const component = components[randomIndex(components.length, random)];
  if (!component) {
    throw new DraftEngineError('no-legal-offer', 'Random autopick could not choose a component.');
  }

  return selectionForSlot(state.offer, component.slot as DraftSlot);
}

/** Lock a uniformly random compatible component from the current offer. */
export function autopick(
  snapshot: ChampionSnapshot,
  state: RunState,
  random: RandomSource = Math.random,
): RunState {
  return lockSelection(snapshot, state, chooseRandomSelection(state, random), random);
}

/** Descriptive alias for timeout and disconnect handling in later adapters. */
export const randomCompatibleAutopick = autopick;

/**
 * Lock the only remaining component in the final round. The generator ensures
 * the final offer cannot be empty, and one open slot means there can be at
 * most one selectable component.
 */
export function lockFinalChoice(snapshot: ChampionSnapshot, state: RunState): RunState {
  assertDraftingState(state);
  if (state.round !== DRAFT_SLOT_ORDER.length - 1) {
    throw new DraftEngineError(
      'invalid-final-choice',
      'The forced final choice is only available in round six.',
    );
  }

  if (state.offer.selectableComponents.length !== 1) {
    throw new DraftEngineError(
      'invalid-final-choice',
      'The final offer must contain exactly one selectable component.',
    );
  }

  const component = state.offer.selectableComponents[0];
  if (!component) {
    throw new DraftEngineError('invalid-final-choice', 'The final offer is missing its component.');
  }

  return lockSelection(snapshot, state, selectionForSlot(state.offer, component.slot as DraftSlot));
}

/** Alias for call sites that use the product wording. */
export const forceFinalChoice = lockFinalChoice;

function generateOfferAtPosition(
  snapshot: ChampionSnapshot,
  position: SearchPosition,
  random: RandomSource,
  context: SearchContext = createSearchContext(snapshot),
): Offer {
  const legalOffers = findLegalOffers(snapshot, position, context);
  if (legalOffers.length === 0) {
    throw new DraftEngineError(
      'no-legal-offer',
      `No legal offer can complete round ${popcount(position.lockedSlotMask) + 1}.`,
    );
  }

  const offersByChampion = new Map<string, Offer[]>();
  for (const offer of legalOffers) {
    const championOffers = offersByChampion.get(offer.championId) ?? [];
    championOffers.push(offer);
    offersByChampion.set(offer.championId, championOffers);
  }

  const championGroups = [...offersByChampion.entries()]
    .map(([championId, offers]) => ({
      championId,
      weight: offers[0]?.champion.randomWeight ?? 0,
      offers,
    }))
    .sort((left, right) => left.championId.localeCompare(right.championId));
  const selectedChampion = weightedPick(championGroups, random);
  const variants = [...selectedChampion.offers].sort((left, right) =>
    left.variantId.localeCompare(right.variantId),
  );
  return variants[randomIndex(variants.length, random)] as Offer;
}

function createSearchContext(snapshot: ChampionSnapshot): SearchContext {
  const champions = [...snapshot.champions].sort((left, right) => left.id.localeCompare(right.id));
  const variantsByChampionId = new Map<string, readonly DraftVariant[]>();
  for (const champion of champions) {
    variantsByChampionId.set(
      champion.id,
      [...champion.variants].sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  return {
    champions,
    variantsByChampionId,
    legalOffersByState: new Map(),
    completionByState: new Map(),
  };
}

function findLegalOffers(
  snapshot: ChampionSnapshot,
  position: SearchPosition,
  context: SearchContext,
): readonly Offer[] {
  const key = positionKey(position);
  const cached = context.legalOffersByState.get(key);
  if (cached) {
    return cached;
  }

  const round = popcount(position.lockedSlotMask);
  const minimumSelectableComponents = round < DRAFT_SLOT_ORDER.length - 1 ? 2 : 1;
  const offers: Offer[] = [];
  for (const champion of context.champions) {
    if (
      champion.excluded ||
      champion.randomWeight <= 0 ||
      position.usedChampionIds.has(champion.id)
    ) {
      continue;
    }

    const variants = context.variantsByChampionId.get(champion.id) ?? [];
    for (const variant of variants) {
      const offer = createOffer(champion, variant, position.lockedSlotMask);
      if (offer.selectableComponents.length < minimumSelectableComponents) {
        continue;
      }

      if (isOfferSafe(snapshot, position, offer, context)) {
        offers.push(offer);
      }
    }
  }

  context.legalOffersByState.set(key, offers);
  return offers;
}

function findAnyLegalOffer(
  snapshot: ChampionSnapshot,
  position: SearchPosition,
  context: SearchContext,
): Offer | null {
  const round = popcount(position.lockedSlotMask);
  const minimumSelectableComponents = round < DRAFT_SLOT_ORDER.length - 1 ? 2 : 1;
  for (const champion of context.champions) {
    if (
      champion.excluded ||
      champion.randomWeight <= 0 ||
      position.usedChampionIds.has(champion.id)
    ) {
      continue;
    }

    const variants = context.variantsByChampionId.get(champion.id) ?? [];
    for (const variant of variants) {
      const offer = createOffer(champion, variant, position.lockedSlotMask);
      if (offer.selectableComponents.length < minimumSelectableComponents) {
        continue;
      }

      if (isOfferSafe(snapshot, position, offer, context)) {
        return offer;
      }
    }
  }

  return null;
}

function isOfferSafe(
  snapshot: ChampionSnapshot,
  position: SearchPosition,
  offer: Offer,
  context: SearchContext,
): boolean {
  return offer.selectableSlots.every((slot) =>
    canComplete(
      snapshot,
      {
        lockedSlotMask: position.lockedSlotMask | SLOT_BITS[slot],
        usedChampionIds: addChampion(position.usedChampionIds, offer.championId),
      },
      context,
    ),
  );
}

function canComplete(
  snapshot: ChampionSnapshot,
  position: SearchPosition,
  context: SearchContext,
): boolean {
  if (position.lockedSlotMask === COMPLETE_SLOT_MASK) {
    return true;
  }

  const key = positionKey(position);
  const cached = context.completionByState.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = findAnyLegalOffer(snapshot, position, context) !== null;
  context.completionByState.set(key, result);
  return result;
}

function createOffer(champion: Champion, variant: DraftVariant, lockedSlotMask: number): Offer {
  const selectableSlots = DRAFT_SLOT_ORDER.filter((slot) => {
    if ((lockedSlotMask & SLOT_BITS[slot]) !== 0) {
      return false;
    }
    return variant.components[slot].availability.status !== 'unavailable';
  });

  return {
    id: `${champion.id}::${variant.id}`,
    championId: champion.id,
    variantId: variant.id,
    champion,
    variant,
    components: variant.components,
    selectableSlots,
    selectableComponents: selectableSlots.map((slot) => variant.components[slot]),
  };
}

function createCompletion(
  snapshotVersion: string,
  lockedBuild: LockedBuild,
  picks: readonly LockedSelection[],
): Completion {
  const build = {} as Record<DraftSlot, LockedSelection>;
  for (const slot of DRAFT_SLOT_ORDER) {
    const selection = lockedBuild[slot];
    if (!selection) {
      throw new DraftEngineError(
        'invalid-state',
        `Cannot complete a run without a locked ${slot} component.`,
      );
    }
    build[slot] = selection;
  }

  return {
    snapshotVersion,
    build,
    picks,
  };
}

function positionFromRun(state: DraftingRunState): SearchPosition;
function positionFromRun(state: CompletedRunState): SearchPosition;
function positionFromRun(state: RunState): SearchPosition {
  return {
    lockedSlotMask: getLockedSlotMask(state.lockedBuild),
    usedChampionIds: new Set(state.usedChampionIds),
  };
}

function positionAfterSelection(state: DraftingRunState, selection: Selection): SearchPosition;
function positionAfterSelection(state: RunState, selection: Selection): SearchPosition {
  return {
    lockedSlotMask: getLockedSlotMask(state.lockedBuild) | SLOT_BITS[selection.slot],
    usedChampionIds: addChampion(new Set(state.usedChampionIds), selection.championId),
  };
}

function validateSelection(state: DraftingRunState, selection: Selection): void;
function validateSelection(state: RunState, selection: Selection): void {
  assertDraftingState(state);
  const offer = state.offer;
  if (
    selection.offerId !== offer.id ||
    selection.championId !== offer.championId ||
    selection.variantId !== offer.variantId
  ) {
    throw new DraftEngineError(
      'invalid-selection',
      `Selection ${selection.componentId} does not belong to the current offer.`,
    );
  }

  if (!DRAFT_SLOT_ORDER.includes(selection.slot)) {
    throw new DraftEngineError('invalid-selection', `Unknown draft slot ${selection.slot}.`);
  }

  if (state.lockedBuild[selection.slot]) {
    throw new DraftEngineError(
      'invalid-selection',
      `The ${selection.slot} slot is already locked and cannot be changed.`,
    );
  }

  const component = offer.components[selection.slot];
  if (component.id !== selection.componentId) {
    throw new DraftEngineError(
      'invalid-selection',
      `Component ${selection.componentId} does not match the ${selection.slot} component.`,
    );
  }
  if (component.availability.status === 'unavailable') {
    throw new DraftEngineError(
      'invalid-selection',
      `Component ${component.id} is unavailable and cannot be selected.`,
    );
  }
}

function assertRunState(snapshot: ChampionSnapshot, state: RunState): void {
  if (state.snapshotVersion !== snapshot.dataDragonVersion) {
    throw new DraftEngineError(
      'invalid-state',
      `Run snapshot ${state.snapshotVersion} does not match ${snapshot.dataDragonVersion}.`,
    );
  }

  if (!Number.isInteger(state.round) || state.round < 0 || state.round > DRAFT_SLOT_ORDER.length) {
    throw new DraftEngineError('invalid-state', 'Run round must be an integer from 0 through 6.');
  }

  if (state.picks.length !== state.round || state.usedChampionIds.length !== state.round) {
    throw new DraftEngineError(
      'invalid-state',
      'Run round, picks, and used champion identities are out of sync.',
    );
  }

  if (new Set(state.usedChampionIds).size !== state.usedChampionIds.length) {
    throw new DraftEngineError('invalid-state', 'A run cannot use the same base champion twice.');
  }

  const lockedSlots = Object.keys(state.lockedBuild);
  if (lockedSlots.length !== state.round) {
    throw new DraftEngineError('invalid-state', 'Run locked slots are out of sync with its round.');
  }

  if (!lockedSlots.every((slot): slot is DraftSlot => isDraftSlot(slot))) {
    throw new DraftEngineError('invalid-state', 'Run contains an unknown locked slot.');
  }

  const pickSlots = new Set<string>();
  for (const [pickIndex, pick] of state.picks.entries()) {
    if (!isDraftSlot(pick.slot) || pickSlots.has(pick.slot)) {
      throw new DraftEngineError('invalid-state', 'A run can lock each draft slot only once.');
    }
    pickSlots.add(pick.slot);

    const usedChampionId = state.usedChampionIds[pickIndex];
    const lockedSelection = state.lockedBuild[pick.slot];
    if (
      usedChampionId !== pick.championId ||
      !lockedSelection ||
      lockedSelection.offerId !== pick.offerId ||
      lockedSelection.componentId !== pick.componentId
    ) {
      throw new DraftEngineError('invalid-state', 'Run picks and locked build are out of sync.');
    }

    assertSelectionReference(snapshot, pick);
  }

  if (lockedSlots.some((slot) => !pickSlots.has(slot))) {
    throw new DraftEngineError(
      'invalid-state',
      'Run locked slots are missing a corresponding pick.',
    );
  }

  for (const slot of DRAFT_SLOT_ORDER) {
    const selection = state.lockedBuild[slot];
    if (selection && selection.slot !== slot) {
      throw new DraftEngineError(
        'invalid-state',
        `Locked ${slot} selection references ${selection.slot} instead.`,
      );
    }
  }

  if (state.status === 'drafting') {
    if (
      state.round >= DRAFT_SLOT_ORDER.length ||
      state.offer === null ||
      state.completion !== null
    ) {
      throw new DraftEngineError(
        'invalid-state',
        'Drafting state has an invalid completion boundary.',
      );
    }
    if (state.usedChampionIds.includes(state.offer.championId)) {
      throw new DraftEngineError(
        'invalid-state',
        'The current offer repeats a used base champion.',
      );
    }
    if (
      state.offer.champion.id !== state.offer.championId ||
      state.offer.variant.championId !== state.offer.championId ||
      state.offer.variant.id !== state.offer.variantId
    ) {
      throw new DraftEngineError(
        'invalid-state',
        'The current offer identity is internally inconsistent.',
      );
    }
  } else if (state.status !== 'complete') {
    throw new DraftEngineError('invalid-state', 'Run status is invalid.');
  } else if (state.round !== DRAFT_SLOT_ORDER.length || state.offer !== null || !state.completion) {
    throw new DraftEngineError('invalid-state', 'Completed state is missing its final build.');
  }
}

function assertSelectionReference(snapshot: ChampionSnapshot, selection: LockedSelection): void {
  const champion = snapshot.champions.find((candidate) => candidate.id === selection.championId);
  const variant = champion?.variants.find((candidate) => candidate.id === selection.variantId);
  const component = variant?.components[selection.slot];
  if (
    !champion ||
    champion.excluded ||
    !variant ||
    `${selection.championId}::${selection.variantId}` !== selection.offerId ||
    !component ||
    component.id !== selection.componentId ||
    component.availability.status === 'unavailable'
  ) {
    throw new DraftEngineError(
      'invalid-state',
      'Run contains a selection not found in the snapshot.',
    );
  }
}

function assertDraftingState(state: RunState): asserts state is DraftingRunState {
  if (state.status !== 'drafting') {
    throw new DraftEngineError('run-complete', 'This operation requires an active draft.');
  }
}

function isDraftSlot(value: string): value is DraftSlot {
  return (DRAFT_SLOT_ORDER as readonly string[]).includes(value);
}

function getLockedSlotMask(lockedBuild: LockedBuild): number {
  return DRAFT_SLOT_ORDER.reduce(
    (mask, slot) => (lockedBuild[slot] ? mask | SLOT_BITS[slot] : mask),
    0,
  );
}

function addChampion(usedChampionIds: ReadonlySet<string>, championId: string): Set<string> {
  const next = new Set(usedChampionIds);
  next.add(championId);
  return next;
}

function positionKey(position: SearchPosition): string {
  return `${position.lockedSlotMask}|${[...position.usedChampionIds].sort().join(',')}`;
}

function popcount(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining !== 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function weightedPick<T extends { weight: number }>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) {
    throw new DraftEngineError(
      'no-legal-offer',
      'Cannot choose from an empty weighted offer list.',
    );
  }
  if (items.length === 1) {
    return items[0] as T;
  }

  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new DraftEngineError('no-legal-offer', 'Eligible offers have no positive random weight.');
  }

  let target = nextRandom(random) * totalWeight;
  for (const item of items) {
    target -= item.weight;
    if (target < 0) {
      return item;
    }
  }

  return items[items.length - 1] as T;
}

function randomIndex(length: number, random: RandomSource): number {
  if (length <= 0) {
    throw new DraftEngineError('no-legal-offer', 'Cannot choose an item from an empty list.');
  }
  if (length === 1) {
    return 0;
  }
  return Math.min(length - 1, Math.floor(nextRandom(random) * length));
}

function nextRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) {
    throw new DraftEngineError('invalid-state', 'Injected random input must be finite.');
  }
  return Math.min(1 - Number.EPSILON, Math.max(0, value));
}
