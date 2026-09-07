import { useEffect, useId, useRef, useState } from 'react';

import { AppLink } from '../components/AppLink';
import { ChampionArtwork, type ChampionArtworkAbility } from '../components/ChampionArtwork';
import { ComponentCard, ComponentDetailsPopover } from '../components/ComponentCard';
import { RoundRail } from '../components/RoundRail';
import { BUNDLED_CHAMPION_SNAPSHOT } from '../data/runtime-snapshot';
import type { Champion, ChampionSnapshot, Component, DraftVariant } from '../data/snapshot-schema';
import {
  createRun,
  currentRound,
  DRAFT_SLOT_ORDER,
  freshRematch,
  lockSelection,
  selectionForSlot,
  type DraftSlot,
  type RandomSource,
  type RunState,
  type Selection,
} from '../domain/draft-engine';
import { SLOT_METADATA, type Slot } from '../domain/slots';
import {
  clearSoloRun,
  getSoloRunStorage,
  readSoloRun,
  writeSoloRun,
} from '../lib/solo-run-storage';
import { useSound } from '../lib/sound';

type SoloDraftPageProps = {
  readonly snapshot?: ChampionSnapshot;
  readonly random?: RandomSource;
  readonly storage?: Storage;
};

const DISPLAY_SLOT_BY_DRAFT_SLOT: Readonly<Record<DraftSlot, Slot>> = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
};

export function SoloDraftPage({
  snapshot = BUNDLED_CHAMPION_SNAPSHOT,
  random,
  storage,
}: SoloDraftPageProps = {}) {
  const randomRef = useRef<RandomSource>(random ?? Math.random);
  const storageRef = useRef<Storage | undefined>(storage ?? getSoloRunStorage());
  const offerHeadingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusOfferHeadingRef = useRef(false);
  const lockInProgressRef = useRef(false);
  const committedLockKeyRef = useRef<string | null>(null);
  const revealSoundTimerRef = useRef<number | null>(null);
  const didRecoverRunRef = useRef(false);
  const sound = useSound();
  const [run, setRun] = useState<RunState>(() => {
    const recovered = readSoloRun(snapshot, storageRef.current);
    if (recovered) {
      didRecoverRunRef.current = true;
      return recovered;
    }

    return createRun(snapshot, randomRef.current);
  });
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<DraftSlot | null>(null);
  const [expandedBuildSlot, setExpandedBuildSlot] = useState<DraftSlot | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [announcement, setAnnouncement] = useState(
    didRecoverRunRef.current
      ? 'Draft restored. Your locked choices remain permanent.'
      : 'Choose one part to keep.',
  );

  useEffect(() => {
    if (run.status === 'drafting') {
      if (!writeSoloRun(run, storageRef.current)) {
        setStorageWarning(
          'This browser could not save recovery. You can keep playing here, but refreshing may lose this run.',
        );
      }
    } else {
      clearSoloRun(storageRef.current);
      setStorageWarning(null);
    }
  }, [run]);

  useEffect(() => {
    return () => {
      if (revealSoundTimerRef.current !== null) {
        window.clearTimeout(revealSoundTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (run.status !== 'drafting' || !shouldFocusOfferHeadingRef.current) {
      return;
    }

    shouldFocusOfferHeadingRef.current = false;
    offerHeadingRef.current?.focus();
  }, [run]);

  if (run.status === 'complete') {
    return (
      <CompletedDraft
        run={run}
        snapshot={snapshot}
        onPlayAgain={() => {
          clearSoloRun(storageRef.current);
          shouldFocusOfferHeadingRef.current = true;
          setRun(freshRematch(snapshot, randomRef.current));
          setSelectedSelection(null);
          setExpandedSlot(null);
          setExpandedBuildSlot(null);
          setLockError(null);
          setStorageWarning(null);
          setAnnouncement('Fresh run started. Choose one open component.');
        }}
      />
    );
  }

  const activeRound = currentRound(run);
  const selectedSlot = selectedSelection?.slot ?? null;
  const openSlots = DRAFT_SLOT_ORDER.filter((slot) => !run.lockedBuild[slot]);
  const selectedSlotLabel = selectedSlot ? DISPLAY_SLOT_BY_DRAFT_SLOT[selectedSlot] : null;
  const selectedDetails = selectedSelection
    ? findSelectionDetails(snapshot, selectedSelection)
    : null;
  const choiceState =
    openSlots.length === 1 ? 'Final slot · lock it to finish' : `${openSlots.length} slots open`;

  function handleSelect(slot: DraftSlot) {
    if (run.status !== 'drafting' || run.lockedBuild[slot]) {
      return;
    }

    sound.unlock();

    try {
      const selection = selectionForSlot(run.offer, slot);
      setSelectedSelection(selection);
      setLockError(null);
      setAnnouncement(
        `${DISPLAY_SLOT_BY_DRAFT_SLOT[slot]} selected. Review it before locking permanently.`,
      );
    } catch {
      setSelectedSelection(null);
      setLockError('That component is unavailable. Choose another open component.');
      setAnnouncement('That component is unavailable. Choose another open component.');
    }
  }

  function handleLock() {
    if (!selectedSelection || run.status !== 'drafting' || lockInProgressRef.current) {
      return;
    }

    sound.unlock();

    const lockKey = `${run.round}:${selectedSelection.offerId}:${selectedSelection.slot}:${selectedSelection.componentId}`;
    if (committedLockKeyRef.current === lockKey) {
      return;
    }

    committedLockKeyRef.current = lockKey;
    lockInProgressRef.current = true;
    setIsLocking(true);
    const lockedSlotLabel = DISPLAY_SLOT_BY_DRAFT_SLOT[selectedSelection.slot];

    try {
      const nextRun = lockSelection(snapshot, run, selectedSelection, randomRef.current);
      const recoverySaved =
        nextRun.status === 'drafting' ? writeSoloRun(nextRun, storageRef.current) : true;
      if (nextRun.status === 'complete') {
        clearSoloRun(storageRef.current);
      }
      setRun(nextRun);
      setSelectedSelection(null);
      setExpandedSlot(null);
      setExpandedBuildSlot(null);
      setLockError(null);
      if (nextRun.status === 'drafting') {
        shouldFocusOfferHeadingRef.current = true;
      }
      setStorageWarning(
        recoverySaved
          ? null
          : 'This browser could not save recovery. You can keep playing here, but refreshing may lose this run.',
      );
      if (nextRun.status === 'complete') {
        clearRevealSoundTimer();
        sound.play('complete');
        setAnnouncement('Draft complete. Your composite champion is ready to inspect.');
      } else {
        sound.play('lock');
        queueRevealSound();
        setAnnouncement(
          `${lockedSlotLabel} locked permanently. New offer: ${nextRun.offer.champion.name}. Round ${currentRound(nextRun)} of six. Choose another open component.`,
        );
      }
    } catch {
      committedLockKeyRef.current = null;
      setLockError('That lock could not be completed. Your selection is still available.');
      setAnnouncement('That lock could not be completed. Your selection is still available.');
    } finally {
      lockInProgressRef.current = false;
      setIsLocking(false);
    }
  }

  function handleToggleDetails(slot: DraftSlot) {
    setExpandedSlot((currentSlot) => (currentSlot === slot ? null : slot));
  }

  function handleToggleBuildDetails(slot: DraftSlot) {
    setExpandedBuildSlot((currentSlot) => (currentSlot === slot ? null : slot));
  }

  function queueRevealSound() {
    clearRevealSoundTimer();

    revealSoundTimerRef.current = window.setTimeout(() => {
      revealSoundTimerRef.current = null;
      sound.play('reveal');
    }, 180);
  }

  function clearRevealSoundTimer() {
    if (revealSoundTimerRef.current === null) {
      return;
    }

    window.clearTimeout(revealSoundTimerRef.current);
    revealSoundTimerRef.current = null;
  }

  return (
    <div className="page-container draft-page">
      <header className="draft-heading">
        <div>
          <p className="draft-heading__meta">Solo draft · untimed</p>
          <h1 id="draft-title" ref={offerHeadingRef} tabIndex={-1}>
            Choose one part to keep.
          </h1>
        </div>
        <div aria-label={`Round ${activeRound} of six`} className="round-counter">
          <span className="round-counter__label">Round</span>
          <strong>{String(activeRound).padStart(2, '0')}</strong>
          <span className="round-counter__total">/ 06</span>
        </div>
      </header>

      <p aria-live="polite" className="visually-hidden" role="status">
        {announcement}
      </p>

      <div className="draft-progress">
        <RoundRail activeRound={activeRound} completedThrough={run.round} />
      </div>

      <section aria-label="Draft board" className="draft-board">
        <aside aria-labelledby="offer-title" className="panel offer-panel">
          <div className="offer-panel__topline">
            <span className="panel__kicker">Champion offer</span>
            <span className="panel__status">Patch {snapshot.dataDragonVersion}</span>
          </div>
          <div className="offer-panel__content">
            <img
              alt={`${run.offer.champion.name} icon`}
              className="offer-panel__icon"
              height="96"
              src={run.offer.champion.assetRefs.icon}
              width="96"
            />
            <div className="offer-panel__identity">
              {run.offer.variant.label && (
                <p className="offer-panel__variant">Variant · {run.offer.variant.label}</p>
              )}
              <h2 id="offer-title">{run.offer.champion.name}</h2>
              <p className="offer-panel__title">{run.offer.champion.title}</p>
            </div>
            <div aria-hidden="true" className="offer-panel__round">
              <span>Round</span>
              <strong>{String(activeRound).padStart(2, '0')}</strong>
              <span>/ 06</span>
            </div>
          </div>
        </aside>

        <BuildReference
          expandedSlot={expandedBuildSlot}
          run={run}
          selectedSlot={selectedSlot}
          snapshot={snapshot}
          onToggleDetails={handleToggleBuildDetails}
        />

        <section aria-labelledby="choice-title" className="panel choice-panel">
          <div className="choice-panel__heading">
            <div>
              <p className="screen-label">Available parts</p>
              <h2 id="choice-title">Your options</h2>
            </div>
            <span aria-live="polite" className="choice-panel__state">
              {choiceState}
            </span>
          </div>

          <div className="choice-grid">
            {openSlots.map((slot) => {
              const component = run.offer.components[slot];
              const isUnavailable = component.availability.status === 'unavailable';
              const state = isUnavailable
                ? 'unavailable'
                : selectedSlot === slot
                  ? 'selected'
                  : 'selectable';

              return (
                <ComponentCard
                  component={component}
                  detailsOpen={expandedSlot === slot}
                  key={slot}
                  onSelect={() => handleSelect(slot)}
                  onToggleDetails={() => handleToggleDetails(slot)}
                  slot={slot}
                  state={state}
                />
              );
            })}
          </div>

          <div className={`lock-bar ${selectedSelection ? 'lock-bar--active' : ''}`.trim()}>
            <div className="lock-bar__copy">
              <p aria-live="polite" className="lock-bar__status">
                {selectedDetails && selectedSlotLabel ? (
                  <>
                    <strong>
                      {selectedSlotLabel}: {selectedDetails.component.name}
                    </strong>{' '}
                    from {formatSourceName(selectedDetails)}. Locking is permanent.
                  </>
                ) : openSlots.length === 1 ? (
                  'Only one slot remains. Choose the final component, then lock it permanently.'
                ) : (
                  'Choose a component to enable the permanent lock.'
                )}
              </p>
              {lockError && (
                <p className="lock-bar__error" role="alert">
                  {lockError}
                </p>
              )}
              {storageWarning && (
                <p className="lock-bar__warning" role="status">
                  {storageWarning}
                </p>
              )}
            </div>
            <div className="lock-bar__actions">
              <button
                aria-label={
                  selectedSlotLabel ? `Lock ${selectedSlotLabel} permanently` : 'Choose a component'
                }
                className="button button--primary"
                disabled={!selectedSelection || isLocking}
                onClick={handleLock}
                type="button"
              >
                {selectedSlotLabel ? `Lock ${selectedSlotLabel} permanently` : 'Choose a component'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

type BuildReferenceProps = {
  readonly run: Extract<RunState, { status: 'drafting' }>;
  readonly snapshot: ChampionSnapshot;
  readonly selectedSlot: DraftSlot | null;
  readonly expandedSlot: DraftSlot | null;
  readonly onToggleDetails: (slot: DraftSlot) => void;
};

function BuildReference({
  run,
  snapshot,
  selectedSlot,
  expandedSlot,
  onToggleDetails,
}: BuildReferenceProps) {
  const [isExpanded, setIsExpanded] = useState(
    () => window.matchMedia?.('(max-width: 960px)').matches !== true,
  );

  return (
    <aside
      aria-labelledby="build-title"
      className="panel build-panel"
      data-build-expanded={isExpanded}
    >
      <div className="build-panel__heading">
        <div>
          <p className="panel__kicker">Build reference</p>
          <h2 id="build-title">Your build</h2>
        </div>
        <span className="build-panel__count">
          <strong>{String(run.round).padStart(2, '0')}</strong> / 06
        </span>
      </div>
      <button
        aria-expanded={isExpanded}
        className="build-panel__toggle"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        type="button"
      >
        {isExpanded ? 'Compact build reference' : 'Expand full build reference'}
      </button>
      <ol className="build-status-list">
        {DRAFT_SLOT_ORDER.map((slot) => {
          const selection = run.lockedBuild[slot];
          const details = selection ? findSelectionDetails(snapshot, selection) : null;

          return (
            <BuildSlotReference
              details={details}
              expanded={expandedSlot === slot}
              isSelected={selectedSlot === slot}
              isLocked={Boolean(selection)}
              key={slot}
              onToggleDetails={() => onToggleDetails(slot)}
              slot={slot}
            />
          );
        })}
      </ol>
      <div aria-label="Build state legend" className="build-panel__legend">
        <span>
          <i className="legend-dot legend-dot--open" /> Open
        </span>
        <span>
          <i className="legend-dot legend-dot--selected" /> Selected
        </span>
        <span>
          <i className="legend-dot legend-dot--locked" /> Locked
        </span>
      </div>
    </aside>
  );
}

type BuildSlotReferenceProps = {
  readonly slot: DraftSlot;
  readonly details: SelectionDetails | null;
  readonly isLocked: boolean;
  readonly isSelected: boolean;
  readonly expanded: boolean;
  readonly onToggleDetails: () => void;
};

function BuildSlotReference({
  slot,
  details,
  isLocked,
  isSelected,
  expanded,
  onToggleDetails,
}: BuildSlotReferenceProps) {
  const detailsId = `build-details-${useId().replaceAll(':', '')}`;
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const displaySlot = DISPLAY_SLOT_BY_DRAFT_SLOT[slot];
  const metadata = SLOT_METADATA[displaySlot];
  const stateLabel = isLocked ? 'Locked' : isSelected ? 'Selected' : 'Open';
  const accessibleLabel = details
    ? `${metadata.label} slot, locked, ${details.component.name}, from ${formatSourceName(details)}`
    : `${metadata.label} slot, ${stateLabel.toLowerCase()}`;

  return (
    <li
      aria-label={accessibleLabel}
      className={`build-status ${isLocked ? 'build-status--locked' : ''} ${isSelected ? 'build-status--selected' : ''}`.trim()}
    >
      <div className="build-status__summary">
        <div className="build-status__primary">
          <span className="build-status__index">{metadata.index}</span>
          {details ? (
            <img
              alt=""
              className="build-status__icon"
              height="32"
              src={details.component.iconRef}
              width="32"
            />
          ) : (
            <span aria-hidden="true" className="build-status__placeholder">
              ?
            </span>
          )}
          <div className="build-status__content">
            <span className="build-status__slot">{metadata.label}</span>
            <strong className="build-status__component">
              {details?.component.name ?? (isSelected ? 'Selected' : 'Open slot')}
            </strong>
            <span className="build-status__source">
              {details ? `From ${formatSourceName(details)}` : 'Awaiting a lock'}
            </span>
          </div>
        </div>
        <span className="build-status__state">{stateLabel}</span>
      </div>
      {details && (
        <>
          <button
            aria-controls={detailsId}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide details' : 'Inspect details'} for ${details.component.name}`}
            className="build-status__details-toggle"
            onClick={onToggleDetails}
            ref={detailsTriggerRef}
            type="button"
          >
            {expanded ? 'Hide details' : 'Inspect details'}
          </button>
          <ComponentDetailsPopover
            component={details.component}
            detailsId={detailsId}
            detailsOpen={expanded}
            onClose={onToggleDetails}
            slotLabel={metadata.label}
            triggerRef={detailsTriggerRef}
          />
        </>
      )}
    </li>
  );
}

type CompletedDraftProps = {
  readonly run: Extract<RunState, { status: 'complete' }>;
  readonly snapshot: ChampionSnapshot;
  readonly onPlayAgain: () => void;
};

function CompletedDraft({ run, snapshot, onPlayAgain }: CompletedDraftProps) {
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [expandedSlot, setExpandedSlot] = useState<DraftSlot | null>(null);
  const bodySelection = run.completion.build.body;
  const bodyDetails = findSelectionDetails(snapshot, bodySelection);

  useEffect(() => {
    completionHeadingRef.current?.focus();
  }, []);

  if (!bodyDetails) {
    return null;
  }

  const abilityIcons: ChampionArtworkAbility[] = DRAFT_SLOT_ORDER.slice(1).flatMap((slot) => {
    const details = findSelectionDetails(snapshot, run.completion.build[slot]);
    return details
      ? [
          {
            slot: DISPLAY_SLOT_BY_DRAFT_SLOT[slot],
            name: details.component.name,
            iconRef: details.component.iconRef,
          },
        ]
      : [];
  });

  return (
    <div className="page-container draft-page completion-page">
      <header className="draft-heading">
        <div>
          <p className="draft-heading__meta">Solo draft · complete</p>
          <h1>Build complete</h1>
        </div>
        <div aria-label="Six rounds complete" className="round-counter round-counter--complete">
          <span className="round-counter__label">Locked</span>
          <strong>06</strong>
          <span className="round-counter__total">/ 06</span>
        </div>
      </header>

      <div className="draft-progress">
        <RoundRail activeRound={6} completedThrough={6} />
      </div>

      <section
        aria-labelledby="completion-title"
        aria-live="polite"
        className="completion-hero panel"
      >
        <div className="completion-hero__art">
          <ChampionArtwork
            abilities={abilityIcons}
            champion={bodyDetails.champion}
            variant={bodyDetails.variant}
          />
        </div>
        <div className="completion-hero__copy">
          <p className="screen-label">Final reveal</p>
          <h2 id="completion-title" ref={completionHeadingRef} tabIndex={-1}>
            Your composite champion
          </h2>
          <p>
            <strong>{bodyDetails.component.name}</strong> supplies the Body. The other five slots
            are drawn from the champions you locked along the way.
          </p>
          <div className="completion-hero__meta">
            <span>Six slots locked</span>
            <span>Patch {run.completion.snapshotVersion}</span>
          </div>
        </div>
      </section>

      <section aria-label="Completion actions" className="result-actions">
        <div>
          <p className="screen-label">Next run</p>
          <h2>Draft again</h2>
        </div>
        <div className="result-actions__buttons">
          <button className="button button--primary" onClick={onPlayAgain} type="button">
            Play Again <span aria-hidden="true">↗</span>
          </button>
          <AppLink className="button button--secondary" href="/">
            Back to home
          </AppLink>
        </div>
      </section>

      <section aria-labelledby="completed-slots-title" className="completion-pieces">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="screen-label">The locked build</p>
            <h2 id="completed-slots-title">Inspect each choice</h2>
          </div>
          <p>Open any part to review its details and source champion.</p>
        </div>
        <div className="completion-grid">
          {DRAFT_SLOT_ORDER.map((slot) => {
            const selection = run.completion.build[slot];
            const details = findSelectionDetails(snapshot, selection);
            if (!details) {
              return null;
            }

            return (
              <div className="completion-piece" key={slot}>
                <ComponentCard
                  component={details.component}
                  detailsOpen={expandedSlot === slot}
                  onToggleDetails={() =>
                    setExpandedSlot((currentSlot) => (currentSlot === slot ? null : slot))
                  }
                  slot={slot}
                  state="locked"
                />
                <p className="completion-piece__source">From {formatSourceName(details)}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type SelectionDetails = {
  readonly champion: Champion;
  readonly variant: DraftVariant;
  readonly component: Component;
};

function findSelectionDetails(
  snapshot: ChampionSnapshot,
  selection: Selection,
): SelectionDetails | null {
  const champion = snapshot.champions.find((candidate) => candidate.id === selection.championId);
  const variant = champion?.variants.find((candidate) => candidate.id === selection.variantId);
  const component = variant?.components[selection.slot];

  if (!champion || !variant || !component || component.id !== selection.componentId) {
    return null;
  }

  return { champion, variant, component };
}

function formatSourceName(details: SelectionDetails): string {
  return details.variant.label
    ? `${details.champion.name} · ${details.variant.label}`
    : details.champion.name;
}
