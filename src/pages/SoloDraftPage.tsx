import { useState } from 'react';

import { ChampionFixture } from '../components/ChampionFixture';
import { RoundRail } from '../components/RoundRail';
import { SlotGlyph } from '../components/SlotGlyph';
import { FOUNDATION_CHAMPION, FOUNDATION_COMPONENTS } from '../data/foundation-fixture';
import { SLOT_METADATA, SLOT_ORDER, type Slot } from '../domain/slots';

export function SoloDraftPage() {
  const [lockedSlots, setLockedSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [announcement, setAnnouncement] = useState('Select a slot.');

  const openSlots = SLOT_ORDER.filter((slot) => !lockedSlots.includes(slot));
  const isComplete = lockedSlots.length === SLOT_ORDER.length;
  const activeRound = Math.min(lockedSlots.length + 1, SLOT_ORDER.length);

  function handleSelect(slot: Slot) {
    if (lockedSlots.includes(slot)) {
      return;
    }

    setSelectedSlot(slot);
    setAnnouncement(`${SLOT_METADATA[slot].label} selected.`);
  }

  function handleLock() {
    if (!selectedSlot || lockedSlots.includes(selectedSlot)) {
      return;
    }

    const nextLockedSlots = [...lockedSlots, selectedSlot];
    setLockedSlots(nextLockedSlots);
    setSelectedSlot(null);
    setAnnouncement(
      nextLockedSlots.length === SLOT_ORDER.length
        ? 'Preview complete.'
        : `${SLOT_METADATA[selectedSlot].label} locked.`,
    );
  }

  function handleReset() {
    setLockedSlots([]);
    setSelectedSlot(null);
    setAnnouncement('Reset. Select a slot.');
  }

  return (
    <div className="page-container draft-page">
      <header className="draft-heading">
        <div>
          <p className="draft-heading__meta">Solo draft</p>
          <h1>Choose a slot</h1>
        </div>
        <div aria-label={`Round ${activeRound} of six`} className="round-counter">
          <span className="round-counter__label">Round</span>
          <strong>{String(activeRound).padStart(2, '0')}</strong>
          <span className="round-counter__total">/ 06</span>
        </div>
      </header>

      <div className="draft-progress">
        <RoundRail activeRound={activeRound} completedThrough={lockedSlots.length} />
      </div>

      <div className="preview-ribbon" role="note">
        <span className="preview-ribbon__label">Preview only</span>
        <span>This uses example data.</span>
      </div>

      <section aria-label="Draft board" className="draft-board">
        <aside aria-label="Offer" className="panel console-panel offer-panel">
          <div className="panel__topline">
            <span className="panel__kicker">Offer</span>
            <span className="panel__status">Preview</span>
          </div>
          <div className="offer-emblem">
            <span className="offer-emblem__diamond" />
            <span className="offer-emblem__dot" />
          </div>
          <p className="screen-label">{FOUNDATION_CHAMPION.eyebrow}</p>
          <h2>{FOUNDATION_CHAMPION.name}</h2>
        </aside>

        <article className="panel reveal-panel">
          <div className="panel__topline">
            <span className="panel__kicker">Reveal</span>
            <span className="panel__status">Round {String(activeRound).padStart(2, '0')}</span>
          </div>
          <ChampionFixture />
          <div className="reveal-panel__caption">
            <div>
              <h2>Round offer</h2>
            </div>
            <p>Locked slots cannot change.</p>
          </div>
        </article>

        <aside aria-labelledby="build-title" className="panel build-panel">
          <div className="panel__topline">
            <div>
              <p className="panel__kicker">Build</p>
              <h2 id="build-title">Slots</h2>
            </div>
            <span className="build-panel__count">
              <strong>{String(lockedSlots.length).padStart(2, '0')}</strong> / 06
            </span>
          </div>
          <ol className="build-status-list">
            {SLOT_ORDER.map((slot) => {
              const isLocked = lockedSlots.includes(slot);
              const isSelected = selectedSlot === slot;

              return (
                <li
                  className={`build-status ${isLocked ? 'build-status--locked' : ''} ${isSelected ? 'build-status--selected' : ''}`.trim()}
                  key={slot}
                >
                  <span className="build-status__index">{SLOT_METADATA[slot].index}</span>
                  <SlotGlyph className="build-status__glyph" slot={slot} />
                  <span className="build-status__label">{SLOT_METADATA[slot].label}</span>
                  <span className="build-status__state">
                    {isLocked ? 'Locked' : isSelected ? 'Selected' : 'Open'}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>

      <section aria-labelledby="choice-title" className="panel choice-panel">
        <div className="choice-panel__heading">
          <div>
            <h2 id="choice-title">Open slots</h2>
          </div>
          <span className="choice-panel__state" aria-live="polite">
            {isComplete
              ? 'Preview complete'
              : openSlots.length === 1
                ? '1 available'
                : `${openSlots.length} available`}
          </span>
        </div>

        <div className="choice-grid">
          {openSlots.map((slot) => {
            const metadata = SLOT_METADATA[slot];
            const component = FOUNDATION_COMPONENTS[slot];
            const isSelected = selectedSlot === slot;

            return (
              <button
                aria-pressed={isSelected}
                className={`choice-card ${isSelected ? 'choice-card--selected' : ''}`.trim()}
                key={slot}
                onClick={() => handleSelect(slot)}
                type="button"
              >
                <span className="choice-card__topline">
                  <span>
                    {metadata.index} / {metadata.label}
                  </span>
                  <span className="choice-card__state">{isSelected ? 'Selected' : 'Open'}</span>
                </span>
                <SlotGlyph className="choice-card__glyph" slot={slot} />
                <strong>{component.name}</strong>
              </button>
            );
          })}
        </div>

        <div className="lock-bar">
          <p aria-live="polite" className="lock-bar__status">
            {announcement}
          </p>
          <div className="lock-bar__actions">
            {isComplete && (
              <button className="button button--secondary" onClick={handleReset} type="button">
                Reset
              </button>
            )}
            <button
              className="button button--primary"
              disabled={!selectedSlot || isComplete}
              onClick={handleLock}
              type="button"
            >
              {selectedSlot ? `Lock ${selectedSlot}` : 'Select a slot'}{' '}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
