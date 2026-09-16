import { DRAFT_SLOT_ORDER, type DraftSlot } from '../domain/draft-engine';
import {
  formatSourceName,
  getVariantDisplayLabel,
  type SelectionDetails,
} from '../domain/selection-details';
import { SLOT_METADATA, type Slot } from '../domain/slots';

const CARD_WIDTH = 1600;
const CARD_HEIGHT = 900;
const IMAGE_TIMEOUT_MS = 2500;

const COLORS = {
  canvas: '#070d16',
  surface: '#0d1825',
  surfaceRaised: '#13283b',
  surfaceSoft: '#1b3a52',
  paper: '#f0e6d2',
  paperMuted: '#c1bdaf',
  inkMuted: '#7f91a4',
  gold: '#c8aa6e',
  goldBright: '#e7c982',
  mint: '#0ac8b9',
  line: 'rgba(240, 230, 210, 0.15)',
  lineStrong: 'rgba(240, 230, 210, 0.32)',
} as const;

const DISPLAY_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const BODY_FONT = '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO_FONT = '"SFMono-Regular", Monaco, Consolas, "Liberation Mono", monospace';

const DISPLAY_SLOT_BY_DRAFT_SLOT: Readonly<Record<DraftSlot, Slot>> = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
};

export type ShareCardSlot = Readonly<{
  readonly label: string;
  readonly componentName: string;
  readonly sourceName: string;
  readonly iconRef: string;
}>;

export type ShareCardData = Readonly<{
  readonly championName: string;
  readonly variantLabel?: string;
  readonly artworkRef: string;
  readonly snapshotVersion: string;
  readonly slots: readonly ShareCardSlot[];
}>;

export function createShareCardData(
  snapshotVersion: string,
  details: Readonly<Partial<Record<DraftSlot, SelectionDetails>>>,
): ShareCardData | null {
  const resolvedDetails = DRAFT_SLOT_ORDER.map((slot) => details[slot]);
  if (resolvedDetails.some((selectionDetails) => !selectionDetails)) {
    return null;
  }

  const completeDetails = resolvedDetails as readonly SelectionDetails[];
  const bodyDetails = completeDetails[0];
  if (!bodyDetails) {
    return null;
  }

  return {
    championName: bodyDetails.champion.name,
    variantLabel: getVariantDisplayLabel(bodyDetails.champion, bodyDetails.variant),
    artworkRef: bodyDetails.champion.assetRefs.defaultSplash,
    snapshotVersion,
    slots: DRAFT_SLOT_ORDER.map((slot, index) => {
      const selectionDetails = completeDetails[index];
      const displaySlot = DISPLAY_SLOT_BY_DRAFT_SLOT[slot];

      return {
        label: SLOT_METADATA[displaySlot].label,
        componentName: selectionDetails.component.name,
        sourceName: formatSourceName(selectionDetails),
        iconRef: selectionDetails.component.iconRef,
      };
    }),
  };
}

export async function createShareCardPng(data: ShareCardData): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('PNG export requires a browser document.');
  }

  let artwork: HTMLImageElement | null = null;
  let icons: readonly (HTMLImageElement | null)[] = data.slots.map(() => null);

  try {
    const loadedImages = await Promise.all([
      loadImage(data.artworkRef),
      ...data.slots.map((slot) => loadImage(slot.iconRef)),
    ]);
    artwork = loadedImages[0] ?? null;
    icons = loadedImages.slice(1);
  } catch {
    // A missing or blocked remote image should not prevent the text card from copying.
  }

  try {
    return await renderShareCard(data, artwork, icons);
  } catch {
    // A remote image without CORS can taint a canvas. Retry with the branded text fallback.
    return renderShareCard(
      data,
      null,
      data.slots.map(() => null),
    );
  }
}

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;

    const finish = (value: HTMLImageElement | null) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => finish(null), IMAGE_TIMEOUT_MS);
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = source;
  });
}

async function renderShareCard(
  data: ShareCardData,
  artwork: HTMLImageElement | null,
  icons: readonly (HTMLImageElement | null)[],
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The browser could not create a PNG canvas.');
  }

  drawShareCard(context, data, artwork, icons);
  return canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('The browser could not encode the PNG.'));
        }
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

function drawShareCard(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  artwork: HTMLImageElement | null,
  icons: readonly (HTMLImageElement | null)[],
): void {
  context.fillStyle = COLORS.canvas;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawHeader(context);
  drawArtworkPanel(context, data, artwork);
  drawBuildPanel(context, data.slots, icons);
  drawFooter(context, data.snapshotVersion);
}

function drawHeader(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.gold;
  context.fillRect(72, 48, 112, 5);

  context.fillStyle = COLORS.paper;
  context.font = `700 25px ${DISPLAY_FONT}`;
  context.fillText('BUILDCHAMP', 72, 91);

  context.fillStyle = COLORS.inkMuted;
  context.font = `700 13px ${MONO_FONT}`;
  context.fillText('COMPOSITE CHAMPION', 248, 90);

  context.fillStyle = COLORS.goldBright;
  context.font = `700 40px ${DISPLAY_FONT}`;
  context.fillText('YOUR BUILD', 72, 137);

  context.fillStyle = COLORS.paperMuted;
  context.font = `400 18px ${BODY_FONT}`;
  context.fillText('Six locked choices. One composite champion.', 72, 169);
}

function drawArtworkPanel(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  artwork: HTMLImageElement | null,
): void {
  const x = 72;
  const y = 196;
  const width = 540;
  const height = 594;
  const radius = 8;

  context.save();
  roundedRectPath(context, x, y, width, height, radius);
  context.clip();
  context.fillStyle = COLORS.surfaceSoft;
  context.fillRect(x, y, width, height);

  if (artwork) {
    drawImageCover(context, artwork, x, y, width, height);
  } else {
    context.fillStyle = COLORS.surfaceRaised;
    context.fillRect(x, y, width, height);
    context.fillStyle = COLORS.gold;
    context.font = `700 180px ${DISPLAY_FONT}`;
    context.fillText(data.championName.slice(0, 1).toUpperCase(), x + 213, y + 350);
    context.fillStyle = COLORS.inkMuted;
    context.font = `700 13px ${MONO_FONT}`;
    context.fillText('ARTWORK UNAVAILABLE', x + 32, y + 45);
  }

  context.fillStyle = 'rgba(7, 13, 22, 0.28)';
  context.fillRect(x, y, width, height);
  context.fillStyle = 'rgba(7, 13, 22, 0.9)';
  context.fillRect(x, y + height - 178, width, 178);
  context.restore();

  context.strokeStyle = COLORS.lineStrong;
  context.lineWidth = 1;
  strokeRoundedRect(context, x, y, width, height, radius);

  context.fillStyle = COLORS.mint;
  context.font = `700 13px ${MONO_FONT}`;
  context.fillText('BODY', x + 32, y + height - 133);

  drawFittedText(
    context,
    data.championName,
    x + 32,
    y + height - 88,
    width - 64,
    42,
    27,
    DISPLAY_FONT,
    700,
    COLORS.paper,
  );

  if (data.variantLabel) {
    drawFittedText(
      context,
      `Variant · ${data.variantLabel}`,
      x + 32,
      y + height - 49,
      width - 64,
      17,
      13,
      BODY_FONT,
      400,
      COLORS.paperMuted,
    );
  }
}

function drawBuildPanel(
  context: CanvasRenderingContext2D,
  slots: readonly ShareCardSlot[],
  icons: readonly (HTMLImageElement | null)[],
): void {
  const x = 660;
  const y = 196;
  const width = 868;
  const height = 594;
  const radius = 8;

  fillRoundedRect(context, x, y, width, height, radius, COLORS.surface);
  context.strokeStyle = COLORS.lineStrong;
  context.lineWidth = 1;
  strokeRoundedRect(context, x, y, width, height, radius);

  context.fillStyle = COLORS.paper;
  context.font = `700 24px ${DISPLAY_FONT}`;
  context.fillText('SIX SLOTS', x + 32, y + 49);

  context.fillStyle = COLORS.mint;
  context.font = `700 13px ${MONO_FONT}`;
  context.textAlign = 'right';
  context.fillText('6 / 6 LOCKED', x + width - 32, y + 47);
  context.textAlign = 'left';

  context.strokeStyle = COLORS.line;
  context.beginPath();
  context.moveTo(x + 24, y + 74);
  context.lineTo(x + width - 24, y + 74);
  context.stroke();

  const rowX = x + 24;
  const rowY = y + 90;
  const rowWidth = width - 48;
  const rowHeight = 72;

  slots.forEach((slot, index) => {
    const rowTop = rowY + index * rowHeight;
    if (index === 0) {
      context.fillStyle = 'rgba(200, 170, 110, 0.1)';
      context.fillRect(rowX, rowTop, rowWidth, rowHeight);
    } else {
      context.strokeStyle = COLORS.line;
      context.beginPath();
      context.moveTo(rowX, rowTop);
      context.lineTo(rowX + rowWidth, rowTop);
      context.stroke();
    }

    context.fillStyle = COLORS.gold;
    context.font = `700 13px ${MONO_FONT}`;
    context.fillText(slot.label.toUpperCase(), rowX + 16, rowTop + 41);

    const iconX = rowX + 108;
    const iconY = rowTop + 12;
    const icon = icons[index] ?? null;
    if (icon) {
      context.save();
      roundedRectPath(context, iconX, iconY, 48, 48, 4);
      context.clip();
      drawImageCover(context, icon, iconX, iconY, 48, 48);
      context.restore();
    } else {
      fillRoundedRect(context, iconX, iconY, 48, 48, 4, COLORS.surfaceSoft);
      context.fillStyle = COLORS.gold;
      context.font = `700 16px ${MONO_FONT}`;
      context.fillText(slot.label.slice(0, 1).toUpperCase(), iconX + 18, iconY + 30);
    }

    drawFittedText(
      context,
      slot.componentName,
      rowX + 180,
      rowTop + 30,
      rowWidth - 360,
      20,
      15,
      BODY_FONT,
      700,
      COLORS.paper,
    );
    drawFittedText(
      context,
      `From ${slot.sourceName}`,
      rowX + 180,
      rowTop + 54,
      rowWidth - 360,
      15,
      12,
      BODY_FONT,
      400,
      COLORS.paperMuted,
    );
  });

  context.fillStyle = COLORS.inkMuted;
  context.font = `700 11px ${MONO_FONT}`;
  context.fillText('SOURCES RETAINED PER SNAPSHOT', x + 32, y + height - 28);
}

function drawFooter(context: CanvasRenderingContext2D, snapshotVersion: string): void {
  context.strokeStyle = COLORS.line;
  context.beginPath();
  context.moveTo(72, 820);
  context.lineTo(1528, 820);
  context.stroke();

  context.fillStyle = COLORS.inkMuted;
  context.font = `700 12px ${MONO_FONT}`;
  context.fillText(`PATCH ${snapshotVersion}`, 72, 852);

  context.textAlign = 'right';
  context.fillText('UNOFFICIAL FAN PROJECT · NOT ENDORSED BY RIOT GAMES.', 1528, 852);
  context.textAlign = 'left';
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return;
  }

  const sourceRatio = imageWidth / imageHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = imageHeight * targetRatio;
    sourceX = (imageWidth - sourceWidth) / 2;
  } else {
    sourceHeight = imageWidth / targetRatio;
    sourceY = (imageHeight - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawFittedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
  fontFamily: string,
  fontWeight: number,
  color: string,
): void {
  let fontSize = maxFontSize;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  while (fontSize > minFontSize && context.measureText(text).width > maxWidth) {
    fontSize -= 1;
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  }

  context.fillStyle = color;
  context.fillText(text, x, y);
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const adjustedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + adjustedRadius, y);
  context.lineTo(x + width - adjustedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + adjustedRadius);
  context.lineTo(x + width, y + height - adjustedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - adjustedRadius, y + height);
  context.lineTo(x + adjustedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - adjustedRadius);
  context.lineTo(x, y + adjustedRadius);
  context.quadraticCurveTo(x, y, x + adjustedRadius, y);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = color;
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}
