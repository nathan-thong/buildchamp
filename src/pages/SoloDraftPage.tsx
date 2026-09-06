import { useEffect, useRef, useState } from 'react';

import { AppLink } from '../components/AppLink';
import { ChampionArtwork, type ChampionArtworkAbility } from '../components/ChampionArtwork';
import { ComponentCard, ComponentDetailsPanel } from '../components/ComponentCard';
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
  const [run, setRun] = useState<RunState>(() => {
    const recovered = readSoloRun(snapshot, storageRef.current);
    return recovered ?? createRun(snapshot, randomRef.current);
  });
  const [selectedSelection, setSelectedSelection] = useState<Selection | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<DraftSlot | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState(
    'Choose one open component, then lock it permanently.',
  );

  useEffect(() => {
    if (run.status === 'drafting') {
      writeSoloRun(run, storageRef.current);
    } else {
      clearSoloRun(storageRef.current);
    }
  }, [run]);

  if (run.status === 'complete') {
    return (
      <CompletedDraft
        run={run}
        snapshot={snapshot}
        onPlayAgain={() => {
          clearSoloRun(storageRef.current);
          setRun(freshRematch(snapshot, randomRef.current));
          setSelectedSelection(null);
          setExpandedSlot(null);
          setIsConfirming(false);
          setAnnouncement('Fresh run started. Choose one open component.');
        }}
      />
    );
  }

  const activeRound = currentRound(run);
  const selectedSlot = selectedSelection?.slot ?? null;
  const openSlots = DRAFT_SLOT_ORDER.filter((slot) => !run.lockedBuild[slot]);
  const selectedSlotLabel = selectedSlot ? DISPLAY_SLOT_BY_DRAFT_SLOT[selectedSlot] : null;
  const expandedComponent = expandedSlot ? run.offer.components[expandedSlot] : undefined;

  function handleSelect(slot: DraftSlot) {
    if (run.status !== 'drafting' || run.lockedBuild[slot]) {
      return;
    }

    try {
      const selection = selectionForSlot(run.offer, slot);
      setSelectedSelection(selection);
      setIsConfirming(false);
      setAnnouncement(
        `${DISPLAY_SLOT_BY_DRAFT_SLOT[slot]} selected. Review it before locking permanently.`,
      );
    } catch {
      setSelectedSelection(null);
      setIsConfirming(false);
      setAnnouncement('That component is unavailable. Choose another open component.');
    }
  }

  function handleLockRequest() {
    if (!selectedSelection || run.status !== 'drafting') {
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      setAnnouncement(
        `${selectedSlotLabel} is ready to lock. Activate the button again to confirm; locked choices cannot change.`,
      );
      return;
    }

    try {
      const nextRun = lockSelection(snapshot, run, selectedSelection, randomRef.current);
      setRun(nextRun);
      setSelectedSelection(null);
      setExpandedSlot(null);
      setIsConfirming(false);
      setAnnouncement(
        nextRun.status === 'complete'
          ? 'Draft complete. Your composite champion is ready to reveal.'
          : `${selectedSlotLabel} locked permanently. Choose another open component.`,
      );
    } catch {
      setIsConfirming(false);
      setAnnouncement('That lock could not be completed. Choose another open component.');
    }
  }

  function handleKeepDeciding() {
    setIsConfirming(false);
    setAnnouncement('Keep deciding. Your selected component is not locked yet.');
  }

  function handleToggleDetails(slot: DraftSlot) {
    setExpandedSlot((currentSlot) => (currentSlot === slot ? null : slot));
  }

  return (
    <div className="page-container draft-page">
      <header className="draft-heading">
        <div>
          <p className="draft-heading__meta">Solo draft · untimed</p>
          <h1>Choose a slot</h1>
        </div>
        <div aria-label={`Round ${activeRound} of six`} className="round-counter">
          <span className="round-counter__label">Round</span>
          <strong>{String(activeRound).padStart(2, '0')}</strong>
          <span className="round-counter__total">/ 06</span>
        </div>
      </header>

      <div className="draft-progress">
        <RoundRail activeRound={activeRound} completedThrough={run.round} />
      </div>

      <div className="draft-instruction" role="note">
        <span className="draft-instruction__label">Your decision</span>
        <span>
          Choose one compatible component. Locks are permanent; there are no skips or rerolls.
        </span>
      </div>

      <section aria-label="Draft board" className="draft-board">
        <aside aria-label="Current offer" className="panel console-panel offer-panel">
          <div className="panel__topline">
            <span className="panel__kicker">Offer</span>
            <span className="panel__status">Live snapshot</span>
          </div>
          <img
            alt=""
            className="offer-panel__icon"
            height="96"
            src={run.offer.champion.assetRefs.icon}
            width="96"
          />
          <p className="screen-label">{run.offer.variant.label ?? run.offer.champion.title}</p>
          <h2>{run.offer.champion.name}</h2>
          <p>{run.offer.champion.title}</p>
          <div className="console-panel__rule" />
          <p className="console-panel__footnote">
            One champion identity per round. Every selectable component has a legal path to the
            final slot.
          </p>
        </aside>

        <section aria-labelledby="choice-title" className="panel choice-panel">
          <div className="choice-panel__heading">
            <div>
              <p className="screen-label">The next lock</p>
              <h2 id="choice-title">Choose one component</h2>
            </div>
            <span className="choice-panel__state" aria-live="polite">
              {openSlots.length === 1 ? '1 slot open' : `${openSlots.length} slots open`}
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

          {expandedComponent && expandedSlot && (
            <section
              aria-label="Expanded component details"
              className="component-details-panel"
              id="component-details-panel"
              role="region"
            >
              <div className="component-details-panel__heading">
                <div>
                  <p className="screen-label">Full details</p>
                  <h3>{expandedComponent.name}</h3>
                </div>
                <span>{DISPLAY_SLOT_BY_DRAFT_SLOT[expandedSlot]} component</span>
              </div>
              <ComponentDetailsPanel component={expandedComponent} />
            </section>
          )}

          <div className="lock-bar">
            <div className="lock-bar__copy">
              <p aria-live="polite" className="lock-bar__status">
                {announcement}
              </p>
              {isConfirming && selectedSlotLabel && (
                <p className="lock-bar__warning" role="alert">
                  Lock {selectedSlotLabel} permanently? This choice cannot be changed.
                </p>
              )}
            </div>
            <div className="lock-bar__actions">
              {isConfirming && (
                <button
                  className="button button--secondary"
                  onClick={handleKeepDeciding}
                  type="button"
                >
                  Keep deciding
                </button>
              )}
              <button
                aria-label={
                  selectedSlotLabel
                    ? `${isConfirming ? 'Confirm lock' : 'Lock'} ${selectedSlotLabel}`
                    : 'Select a component'
                }
                className="button button--primary"
                disabled={!selectedSelection}
                onClick={handleLockRequest}
                type="button"
              >
                {selectedSlotLabel
                  ? `${isConfirming ? 'Confirm lock' : 'Lock'} ${selectedSlotLabel}`
                  : 'Select a component'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </section>

        <aside aria-labelledby="build-title" className="panel build-panel">
          <div className="panel__topline">
            <div>
              <p className="panel__kicker">Build</p>
              <h2 id="build-title">Slots</h2>
            </div>
            <span className="build-panel__count">
              <strong>{String(run.round).padStart(2, '0')}</strong> / 06
            </span>
          </div>
          <ol className="build-status-list">
            {DRAFT_SLOT_ORDER.map((slot) => {
              const displaySlot = DISPLAY_SLOT_BY_DRAFT_SLOT[slot];
              const metadata = SLOT_METADATA[displaySlot];
              const lockedSelection = run.lockedBuild[slot];
              const lockedComponent = lockedSelection
                ? findSelectionDetails(snapshot, lockedSelection)?.component
                : undefined;
              const isSelected = selectedSlot === slot;
              const isSelectable = run.offer.selectableSlots.includes(slot);
              const stateLabel = lockedSelection
                ? 'Locked'
                : isSelected
                  ? 'Selected'
                  : isSelectable
                    ? 'Selectable'
                    : 'Unavailable';

              return (
                <li
                  aria-label={`${metadata.label} slot, ${stateLabel.toLowerCase()}${lockedComponent ? ` with ${lockedComponent.name}` : ''}`}
                  className={`build-status ${lockedSelection ? 'build-status--locked' : ''} ${isSelected ? 'build-status--selected' : ''}`.trim()}
                  key={slot}
                >
                  <span className="build-status__index">{metadata.index}</span>
                  {lockedComponent ? (
                    <img
                      alt=""
                      className="build-status__icon"
                      height="24"
                      src={lockedComponent.iconRef}
                      width="24"
                    />
                  ) : (
                    <span aria-hidden="true" className="build-status__placeholder">
                      ?
                    </span>
                  )}
                  <span className="build-status__label">
                    {lockedComponent?.name ?? metadata.label}
                  </span>
                  <span className="build-status__state">{stateLabel}</span>
                </li>
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
      </section>
    </div>
  );
}

type CompletedDraftProps = {
  readonly run: Extract<RunState, { status: 'complete' }>;
  readonly snapshot: ChampionSnapshot;
  readonly onPlayAgain: () => void;
};

function CompletedDraft({ run, snapshot, onPlayAgain }: CompletedDraftProps) {
  const bodySelection = run.completion.build.body;
  const bodyDetails = findSelectionDetails(snapshot, bodySelection);

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
          <h2 id="completion-title">Your composite champion</h2>
          <p>
            <strong>{bodyDetails.component.name}</strong> supplies the Body. The other five slots
            are drawn from the champions you locked along the way.
          </p>
          <div className="result-hero__details">
            <span>
              <strong>06</strong> slots locked
            </span>
            <span>
              <strong>—</strong> No score
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="completed-slots-title" className="completion-pieces">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="screen-label">The finished build</p>
            <h2 id="completed-slots-title">Six parts</h2>
          </div>
          <p>Every choice is locked. There is no automated power score.</p>
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
                <ComponentCard component={details.component} slot={slot} state="locked" />
                <p className="completion-piece__source">From {details.champion.name}</p>
              </div>
            );
          })}
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
