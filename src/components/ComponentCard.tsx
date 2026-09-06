import type { Component } from '../data/snapshot-schema';
import type { DraftSlot } from '../domain/draft-engine';
import { SLOT_METADATA, type Slot } from '../domain/slots';

type ComponentCardState = 'selectable' | 'selected' | 'unavailable' | 'locked';

type ComponentCardProps = {
  readonly component: Component;
  readonly slot: DraftSlot;
  readonly state: ComponentCardState;
  readonly onSelect?: () => void;
  readonly detailsOpen?: boolean;
  readonly onToggleDetails?: () => void;
  readonly lockedLabel?: string;
};

const DISPLAY_SLOT_BY_DRAFT_SLOT: Readonly<Record<DraftSlot, Slot>> = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
};

const STATE_LABELS: Readonly<Record<ComponentCardState, string>> = {
  selectable: 'Selectable',
  selected: 'Selected',
  unavailable: 'Unavailable',
  locked: 'Locked',
};

export function ComponentCard({
  component,
  slot,
  state,
  onSelect,
  detailsOpen = false,
  onToggleDetails,
  lockedLabel,
}: ComponentCardProps) {
  const displaySlot = DISPLAY_SLOT_BY_DRAFT_SLOT[slot];
  const metadata = SLOT_METADATA[displaySlot];
  const stateLabel = lockedLabel ?? STATE_LABELS[state];
  const isInteractive = state === 'selectable' || state === 'selected';
  const cardClassName = [
    'component-card',
    `component-card--${slot}`,
    `component-card--${state}`,
  ].join(' ');
  const accessibleLabel = `${metadata.index} / ${metadata.label}: ${component.name}, ${stateLabel}`;

  const content = (
    <>
      <div className="component-card__topline">
        <span>
          {metadata.index} / {metadata.label}
        </span>
        <span className="component-card__state">{stateLabel}</span>
      </div>
      <div className="component-card__identity">
        <img
          alt=""
          className="component-card__icon"
          height="64"
          src={component.iconRef}
          width="64"
        />
        <div>
          <strong>{component.name}</strong>
          <span>
            {component.availability.status === 'conditional' ? 'Conditional' : 'Portable'}
          </span>
        </div>
      </div>
      <p className="component-card__summary">{component.shortDescription}</p>
      <ComponentMetrics component={component} slot={slot} />
      {state === 'unavailable' && (
        <p className="component-card__unavailable" role="note">
          <strong>Unavailable</strong>
          {component.availability.summary}
        </p>
      )}
    </>
  );

  return (
    <article aria-label={accessibleLabel} className={cardClassName} data-slot={slot}>
      {isInteractive ? (
        <button
          aria-pressed={state === 'selected'}
          className="component-card__select"
          data-choice-slot={slot}
          onClick={onSelect}
          type="button"
        >
          {content}
        </button>
      ) : (
        <div className="component-card__surface" role="group">
          {content}
        </div>
      )}
      {onToggleDetails && (
        <button
          aria-controls={detailsOpen ? 'component-details-panel' : undefined}
          aria-expanded={detailsOpen}
          className="component-card__details-toggle"
          onClick={onToggleDetails}
          type="button"
        >
          {detailsOpen ? 'Hide details' : 'Full details'}
        </button>
      )}
    </article>
  );
}

function ComponentMetrics({ component, slot }: { component: Component; slot: DraftSlot }) {
  const metrics =
    slot === 'body' && component.bodyStats
      ? [
          { label: 'Attack', value: capitalize(component.bodyStats.attackType) },
          { label: 'Range', value: formatNumber(component.bodyStats.attackRange) },
          { label: 'Move speed', value: formatNumber(component.bodyStats.movementSpeed) },
        ]
      : [
          ...(component.cooldown
            ? [
                {
                  label: 'Cooldown',
                  value: formatCompactDisplayValue(component.cooldown, 's'),
                  fullValue: formatValues(component.cooldown.values, 's'),
                },
              ]
            : []),
          ...(component.range
            ? [
                {
                  label: 'Range',
                  value: formatCompactDisplayValue(component.range),
                  fullValue: formatValues(component.range.values),
                },
              ]
            : []),
        ];

  if (metrics.length === 0) {
    return null;
  }

  return (
    <dl
      aria-label="Component summary"
      className={`component-card__metrics ${slot === 'body' ? 'component-card__metrics--body' : 'component-card__metrics--ability'}`}
    >
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd aria-label={metric.fullValue} title={metric.fullValue}>
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ComponentDetailsPanel({ component }: { component: Component }) {
  const cooldowns = component.cooldowns?.length
    ? component.cooldowns
    : component.cooldown
      ? [component.cooldown]
      : [];
  const ranges = component.ranges?.length
    ? component.ranges
    : component.range
      ? [component.range]
      : [];

  return (
    <div className="component-details-panel__body">
      {component.fullDescription.split(/\n{2,}/).map((paragraph, index) => (
        <p key={`${component.id}-description-${index}`}>{paragraph}</p>
      ))}
      {component.values.length > 0 && (
        <dl className="component-details-panel__values">
          {component.values.map((value) => (
            <div key={`${component.id}-${value.label}`}>
              <dt>{value.label}</dt>
              <dd>{formatValues(value.values, value.units)}</dd>
            </div>
          ))}
        </dl>
      )}
      {cooldowns.length > 0 && <ValueGroup label="Cooldown" values={cooldowns} suffix="s" />}
      {ranges.length > 0 && <ValueGroup label="Range" values={ranges} />}
      {component.carriedMechanics.length > 0 && (
        <div className="component-details-panel__mechanics">
          <span>Carried mechanics</span>
          <ul>
            {component.carriedMechanics.map((mechanic) => (
              <li key={mechanic.id}>{mechanic.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ValueGroup({
  label,
  values,
  suffix,
}: {
  label: string;
  values: readonly { label: string; values: readonly (number | string)[]; units?: string }[];
  suffix?: string;
}) {
  const display =
    values.length === 1
      ? formatValues(values[0]?.values ?? [], values[0]?.units ?? suffix)
      : values
          .map(
            (value) =>
              `${shortMetricLabel(value.label)}: ${formatValues(value.values, value.units ?? suffix)}`,
          )
          .join(' · ');

  return (
    <dl className="component-details-panel__values component-details-panel__values--grouped">
      <div>
        <dt>{label}</dt>
        <dd>{display}</dd>
      </div>
    </dl>
  );
}

function formatCompactDisplayValue(
  value: { values: readonly (number | string)[]; units?: string },
  fallbackUnits?: string,
): string {
  return formatCompactValues(value.values, value.units ?? fallbackUnits);
}

function formatValues(values: readonly (number | string)[], units?: string): string {
  const formatted = values.map((value) =>
    typeof value === 'number' ? formatNumber(value) : value,
  );
  const unique = formatted.every((value) => value === formatted[0]);
  const display = unique ? (formatted[0] ?? '—') : formatted.join(' / ');
  return units ? `${display} ${units}` : display;
}

function formatCompactValues(values: readonly (number | string)[], units?: string): string {
  const formatted = values.map((value) =>
    typeof value === 'number' ? formatNumber(value) : value,
  );
  const unique = formatted.every((value) => value === formatted[0]);
  const display = unique
    ? (formatted[0] ?? '—')
    : `${formatted[0] ?? '—'} → ${formatted[formatted.length - 1] ?? '—'}`;
  return units ? `${display} ${units}` : display;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function shortMetricLabel(label: string): string {
  return label.split(' — ').at(-1) ?? label;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
