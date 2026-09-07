import { useEffect, useRef, useState } from 'react';

import { AppLink } from '../components/AppLink';
import { ChampionArtwork, type ChampionArtworkAbility } from '../components/ChampionArtwork';
import { ChampionFixture } from '../components/ChampionFixture';
import { ComponentCard } from '../components/ComponentCard';
import { RoundRail } from '../components/RoundRail';
import { ShareResultActions } from '../components/ShareResultActions';
import { SlotRail } from '../components/SlotRail';
import { InvalidResultState, UnavailableResultState } from '../components/StatePanels';
import { getChampionSnapshot } from '../data/snapshot-registry';
import type { ChampionSnapshot } from '../data/snapshot-schema';
import { DRAFT_SLOT_ORDER, type DraftSlot } from '../domain/draft-engine';
import {
  findSelectionDetails,
  formatSourceName,
  type SelectionDetails,
} from '../domain/selection-details';
import { createSharePath, decodeShareResult, type ShareResult } from '../domain/share-codec';
import { SLOT_METADATA, SLOT_ORDER } from '../domain/slots';

type ResultPageProps = {
  readonly payload: string;
};

export function ResultPage({ payload }: ResultPageProps) {
  if (payload === 'demo') {
    return <DemoResultPage />;
  }

  const decoded = decodeShareResult(payload);
  if (!decoded.ok) {
    return (
      <InvalidResultState
        description={
          decoded.reason === 'unsupported-version'
            ? 'This result link uses a newer BuildChamp format. Ask the sender for a fresh link.'
            : 'The result link is malformed or incomplete. Start a new draft to make another result.'
        }
      />
    );
  }

  const snapshot = getChampionSnapshot(decoded.value.snapshotVersion);
  if (!snapshot) {
    return <UnavailableResultState snapshotVersion={decoded.value.snapshotVersion} />;
  }

  const details = resolveSharedBuild(snapshot, decoded.value);
  if (!details) {
    return (
      <InvalidResultState description="This result does not contain six valid, available component choices." />
    );
  }

  return <SharedResultPage details={details} result={decoded.value} snapshot={snapshot} />;
}

type SharedResultPageProps = {
  readonly details: CompleteSelectionDetails;
  readonly result: ShareResult;
  readonly snapshot: ChampionSnapshot;
};

function SharedResultPage({ details, result, snapshot }: SharedResultPageProps) {
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const [expandedSlot, setExpandedSlot] = useState<DraftSlot | null>(null);
  const bodyDetails = details.body;
  const abilityIcons: ChampionArtworkAbility[] = DRAFT_SLOT_ORDER.slice(1).map((slot) => ({
    slot: SLOT_METADATA[displaySlotFor(slot)].label,
    name: details[slot].component.name,
    iconRef: details[slot].component.iconRef,
  }));

  useEffect(() => {
    completionHeadingRef.current?.focus();
  }, []);

  return (
    <div className="page-container draft-page completion-page shared-result-page">
      <header className="draft-heading result-heading">
        <div>
          <p className="draft-heading__meta">Shared result · snapshot pinned</p>
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

      <section aria-labelledby="shared-completion-title" className="completion-hero panel">
        <div className="completion-hero__art">
          <ChampionArtwork
            abilities={abilityIcons}
            champion={bodyDetails.champion}
            variant={bodyDetails.variant}
          />
        </div>
        <div className="completion-hero__copy">
          <p className="screen-label">Shared result</p>
          <h2 id="shared-completion-title" ref={completionHeadingRef} tabIndex={-1}>
            Your composite champion
          </h2>
          <p>
            <strong>{bodyDetails.component.name}</strong> supplies the Body. The other five slots
            are drawn from the champions chosen in the shared build.
          </p>
          <div className="completion-hero__meta">
            <span>Six slots locked</span>
            <span>Patch {snapshot.dataDragonVersion}</span>
          </div>
        </div>
      </section>

      <section aria-label="Result actions" className="result-actions">
        <div>
          <p className="screen-label">Play it forward</p>
          <h2>Share or draft again</h2>
        </div>
        <div className="result-actions__buttons">
          <ShareResultActions sharePath={createSharePath(result)} />
          <AppLink className="button button--primary" href="/solo">
            Start a new draft <span aria-hidden="true">↗</span>
          </AppLink>
          <AppLink className="button button--secondary" href="/">
            Back to home
          </AppLink>
        </div>
      </section>

      <section aria-labelledby="shared-slots-title" className="completion-pieces">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="screen-label">The shared build</p>
            <h2 id="shared-slots-title">Inspect each choice</h2>
          </div>
          <p>Every component stays tied to its source champion and pinned snapshot.</p>
        </div>
        <div className="completion-grid">
          {DRAFT_SLOT_ORDER.map((slot) => (
            <div className="completion-piece" key={slot}>
              <ComponentCard
                component={details[slot].component}
                detailsOpen={expandedSlot === slot}
                onToggleDetails={() =>
                  setExpandedSlot((currentSlot) => (currentSlot === slot ? null : slot))
                }
                slot={slot}
                state="locked"
              />
              <p className="completion-piece__source">From {formatSourceName(details[slot])}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type CompleteSelectionDetails = Readonly<Record<DraftSlot, SelectionDetails>>;

function resolveSharedBuild(
  snapshot: ChampionSnapshot,
  result: ShareResult,
): CompleteSelectionDetails | null {
  const resolved = {} as Record<DraftSlot, SelectionDetails>;
  const championIds = new Set<string>();

  for (const slot of DRAFT_SLOT_ORDER) {
    const selection = result.build[slot];
    const details = findSelectionDetails(snapshot, selection);
    if (!details || details.component.availability.status === 'unavailable') {
      return null;
    }

    if (championIds.has(details.champion.id)) {
      return null;
    }

    championIds.add(details.champion.id);
    resolved[slot] = details;
  }

  return resolved;
}

function displaySlotFor(slot: DraftSlot) {
  const displaySlots = {
    body: 'Body',
    q: 'Q',
    w: 'W',
    e: 'E',
    r: 'R',
    passive: 'Passive',
  } as const;

  return displaySlots[slot];
}

function DemoResultPage() {
  return (
    <div className="page-container result-page">
      <header className="result-heading">
        <div>
          <p className="result-heading__meta">Shared result</p>
          <h1>Build complete</h1>
        </div>
      </header>

      <div className="result-progress">
        <RoundRail activeRound={6} completedThrough={6} />
      </div>

      <div className="preview-ribbon" role="note">
        <span className="preview-ribbon__label">Preview only</span>
        <span>This uses example data.</span>
      </div>

      <section aria-labelledby="result-title" className="result-hero panel">
        <div className="result-hero__art">
          <ChampionFixture />
        </div>
        <div className="result-hero__copy">
          <p className="screen-label">Example build</p>
          <h2 id="result-title">Completed build</h2>
          <div className="result-hero__details">
            <span>
              <strong>06</strong> slots
            </span>
            <span>
              <strong>—</strong> No score
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="result-pieces-title" className="result-pieces">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="screen-label">Completed build</p>
            <h2 id="result-pieces-title">Slots</h2>
          </div>
        </div>
        <SlotRail className="result-slot-rail" interactive={false} lockedSlots={SLOT_ORDER} />
      </section>

      <section aria-label="Result actions" className="result-actions">
        <div>
          <p className="screen-label">New draft</p>
          <h2>Start a new draft</h2>
        </div>
        <div className="result-actions__buttons">
          <AppLink className="button button--primary" href="/solo">
            Start draft <span aria-hidden="true">↗</span>
          </AppLink>
          <AppLink className="button button--secondary" href="/">
            Back to home
          </AppLink>
        </div>
      </section>
    </div>
  );
}
