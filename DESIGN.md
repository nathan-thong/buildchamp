---
name: BuildChamp
description: Six slots. One build.
colors:
  canvas: '#070d16'
  surface: '#0d1825'
  surface-raised: '#13283b'
  surface-soft: '#1b3a52'
  paper: '#f0e6d2'
  paper-muted: '#c1bdaf'
  ink: '#07111c'
  ink-muted: '#7f91a4'
  gold: '#c8aa6e'
  gold-bright: '#e7c982'
  gold-deep: '#80683f'
  mint: '#0ac8b9'
  blue: '#0bc4e3'
  line: 'rgba(240, 230, 210, 0.15)'
  line-strong: 'rgba(240, 230, 210, 0.32)'
typography:
  display:
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif'
    fontSize: 'clamp(4rem, 7vw, 7.2rem)'
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: '-0.065em'
  headline:
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif'
    fontSize: 'clamp(3.5rem, 7vw, 7rem)'
    fontWeight: 700
    lineHeight: 0.84
    letterSpacing: '-0.065em'
  body:
    fontFamily: 'Avenir Next, Helvetica Neue, Helvetica, Arial, sans-serif'
    fontSize: '16px'
    lineHeight: 1.5
  label:
    fontFamily: 'Avenir Next, Helvetica Neue, Helvetica, Arial, sans-serif'
    fontSize: '0.62rem'
    fontWeight: 700
    letterSpacing: '0.12em'
    lineHeight: 1.3
  mono:
    fontFamily: 'SFMono-Regular, Monaco, Consolas, Liberation Mono, monospace'
rounded:
  sm: '0.25rem'
  md: '0.35rem'
spacing:
  page: 'clamp(1.25rem, 5vw, 5rem)'
components:
  button-primary:
    backgroundColor: '{colors.gold-bright}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '0.75rem 1rem'
    height: '2.8rem'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.paper}'
    rounded: '{rounded.sm}'
    padding: '0.75rem 1rem'
    height: '2.8rem'
  panel:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.md}'
    padding: 'clamp(1rem, 2vw, 1.35rem)'
  slot-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.paper}'
    rounded: '0'
    padding: '0.7rem'
  reveal-frame:
    backgroundColor: '{colors.surface-soft}'
    textColor: '{colors.paper}'
    rounded: '0'
    padding: '1rem'
---

# Design System: BuildChamp

## Overview

**Creative North Star: “The Split Champion Board.”**

BuildChamp is a compact drafting game for League of Legends players who want to make a quick,
subjective build choice. The interface keeps the earlier split composition: a clear action and
short rule on one side, a champion board on the other. The board is an authored interface object,
not a paper ticket, stat dashboard, or imitation of the League client.

The atmosphere is low-light and focused. Deep blue surfaces establish the play space, warm gold
marks a decision, and teal marks active or confirmed state. Headings use a stable grotesk face with
weight and scale doing the expressive work; copy describes the action plainly.

**Key Characteristics:**

- A split first viewport with a large direct headline and an angled champion board.
- League-inspired navy, parchment, gold, and teal palette without Riot or League branding.
- Helvetica Neue display headings with Avenir Next body copy and sparse measurement mono.
- Six-slot strips and cards that keep Body, Q, W, E, R, and Passive visible in order.

## Colors

The palette borrows the mood of a League companion interface while remaining an original BuildChamp
identity: blue-black surfaces, warm parchment text, muted gold decisions, and luminous teal state.

### Primary

- **Decision Gold** (`#c8aa6e`): Structural borders, round counters, and the visual language of a lock.
- **Bright Gold** (`#e7c982`): Primary actions and the most important attention cue.

### Secondary

- **State Teal** (`#0ac8b9`): Active progress, confirmed state, and ability glyphs.
- **Signal Blue** (`#0bc4e3`): Secondary emphasis in the fixture field.

### Neutral

- **Board Canvas** (`#070d16`): The low-light page ground.
- **Board Surface** (`#0d1825`), **Raised Surface** (`#13283b`), and **Soft Surface** (`#1b3a52`): Tonal layers for panels and the board.
- **Parchment Paper** (`#f0e6d2`) and **Muted Paper** (`#c1bdaf`): Primary and explanatory text.
- **Muted Ink** (`#7f91a4`): Metadata and low-emphasis labels.

### Named Rules

**The Decision Color Rule.** Gold identifies a choice or action; teal identifies state. Neither color
is allowed to carry meaning without a visible word or shape.

## Typography

**Display Font:** Helvetica Neue, Helvetica, Arial, sans-serif

**Body Font:** Avenir Next, Helvetica Neue, Helvetica, Arial, sans-serif

**Label/Mono Font:** SFMono-Regular, Monaco, Consolas, Liberation Mono

**Character:** The display face is sturdy and familiar rather than novelty-condensed. Avenir Next
keeps the explanatory copy open and human, while mono is reserved for serials, counts, and data-like
measurements.

### Hierarchy

- **Display** (700, `clamp(4rem, 7vw, 7.2rem)`, `0.86`): Home hero statement and major route identity.
- **Headline** (700, `clamp(3.5rem, 7vw, 7rem)`, `0.84`): Draft and result route headings.
- **Title** (700, `clamp(2rem, 4vw, 3.8rem)`, `0.86`): Choice panels, board titles, and section headings.
- **Body** (400, `16px`, `1.5`): Instructions and fixture explanations, kept to a practical reading measure.
- **Label** (700, `0.62rem`, `0.12em`, uppercase): Route status and compact UI labels.

### Named Rules

**The Plain Voice Rule.** Use a direct verb for an action and a factual sentence for a state; avoid
trailer copy, hype, and invented claims.

## Layout

The page container uses a responsive gutter of `clamp(1.25rem, 5vw, 5rem)` and caps at `100rem`.
The home first viewport is a two-column split: the action occupies the left column and an angled
champion board occupies the right. The board contains the current fixture, a short title, and the
six-slot strip. A small horizontal explanation section follows below the first decision.

Draft and result routes reuse the same large heading, round rail, reveal field, and six-slot language.
At `1120px` the draft board moves to two columns, at `820px` it stacks with the reveal first, and at
`640px` the header navigation yields to the mark and sound control. Home board slots move from six to
three columns on narrow screens; choice and result grids move from three to two.

## Elevation & Depth

The system uses tonal layering with restrained ambient shadows. The page remains flat at rest; the
angled board and primary action get depth because they are the two objects that need to feel placed
and actionable. Borders are thin structural lines rather than a repeated card effect.

### Shadow Vocabulary

- **Panel** (`0 1.5rem 3rem rgba(0, 0, 0, 0.28)`): Quiet separation for working surfaces.
- **Board** (`0 1.8rem 2.5rem rgba(0, 0, 0, 0.4)`): Lift for the angled home board.
- **Primary action** (`0 0.8rem 1.6rem rgba(0, 0, 0, 0.3)`): Tactile separation from the next choice.

### Named Rules

**The Placed Object Rule.** Use a shadow to place the board or action in the scene, never to make
every panel look like a floating card.

## Shapes

The form language is a clean game-board plate: square slot cells, small-radius controls, thin warm
borders, and circular progress/state marks. The home board uses a slight rotation to preserve the
earlier visual tension. It has an inset border, but no perforations, faux paper edges, stamps, or ticket
cutouts.

## Components

### Buttons

- **Shape:** Compact controls with a small radius (`0.25rem`) and a `2.8rem` minimum height.
- **Primary:** Bright gold fill with dark ink, uppercase action label, and a soft ambient shadow.
- **Hover / Focus:** The action lifts by `2px`; focus uses a visible gold ring with a `4px` offset.
- **Secondary:** Transparent surface with a structural border and teal hover state.

### Cards / Containers

- **Panel:** Board surface, thin line, small panel radius (`0.35rem`), and restrained ambient depth.
- **Champion board:** A dark framed field with the synthetic fixture, a compact title, and six slot cells.
- **Slot card:** A square-edged location with text first, a small authored glyph, and explicit open,
  selected, or locked wording.

### Navigation

The header is a quiet board bar with the original BuildChamp mark, two routes, and a persistent sound
control. Active navigation uses gold trim. On narrow screens, route links hide to protect the brand and
sound control.

### Reveal Field

The champion fixture uses a deep blue field, measured orbit lines, a serial stamp, and a teal scanline.
It is explicitly labelled as a fixture until the validated snapshot arrives; the geometry is a temporary
visual, not a claim about a real champion.

### Recovery States

Loading, error, unavailable-result, and not-found states share the board surface, a direct heading,
short recovery copy, and one clear action where recovery is possible. Motion is optional and never the
only state signal.

## Do's and Don'ts

### Do:

- **Do** make the six-slot mechanism visible before secondary explanation.
- **Do** use Helvetica Neue or a similarly sturdy neutral grotesk for display headings.
- **Do** keep gold for decisions and teal for status, with text labels for both.
- **Do** label the fixture and keep the solo route untimed and account-free.
- **Do** use direct, factual UI copy that tells the player what to do next.

### Don't:

- **Don't** use ticket, perforation, stamp, or faux-paper motifs.
- **Don't** use Riot or League logos, artwork, or implied endorsement as BuildChamp identity.
- **Don't** use an Impact-style or novelty-condensed display stack.
- **Don't** turn the interface into a stats dashboard or add an automated strength score.
- **Don't** make marketing language, color, motion, or sound the only explanation of a state.
