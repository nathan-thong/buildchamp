import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(Math.max(widths.rootScrollWidth, widths.bodyScrollWidth)).toBeLessThanOrEqual(
    widths.innerWidth + 1,
  );
}

test('home starts a solo draft and exposes the six-slot board', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /build your own champion/i }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Rules' })).toBeVisible();
  await expect(page.locator('.home-how__item')).toHaveCount(4);
  await expect(page.locator('.home-build-card .champion-visual')).toHaveCount(0);
  await expect(page.locator('.home-build-card__slot-icon')).toHaveCount(6);
  await expect(page.locator('.home-build-card__art')).toHaveAttribute(
    'data-body-preview-id',
    /.+/,
    { timeout: 8_000 },
  );
  const firstCarouselSlot = page.locator('[data-carousel-slot="Body"]');
  const firstIconId = await firstCarouselSlot.getAttribute('data-icon-id');
  await expect
    .poll(() => firstCarouselSlot.getAttribute('data-icon-id'), { timeout: 8_000 })
    .not.toBe(firstIconId);
  await expect(page.locator('.home-build-card__art')).toHaveAttribute(
    'data-body-preview-id',
    await firstCarouselSlot.getAttribute('data-icon-id'),
  );
  await expect(page.getByRole('link', { name: /buildchamp home/i })).toBeVisible();

  await page.getByRole('link', { name: /start solo draft/i }).click();
  await expect(page).toHaveURL(/\/solo$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expect(page.getByText('Patch 16.17.1')).toBeVisible();
  await expect(page.getByRole('button', { name: /01 \/ body/i })).toBeVisible();
  await expect(page.locator('.build-status-list .build-status')).toHaveCount(6);
  await expect(page.getByRole('listitem', { name: /passive slot/i })).toBeVisible();
});

test('solo lock interaction is keyboard reachable', async ({ page }) => {
  await page.goto('/solo');
  const bodySlot = page.getByRole('button', { name: /01 \/ body/i });

  await bodySlot.focus();
  await page.keyboard.press('Enter');
  await expect(bodySlot).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Lock Body permanently' })).toBeEnabled();
});

test('solo can be completed with keyboard-only input', async ({ page }) => {
  await page.goto('/solo');

  const labels = {
    body: 'Body',
    q: 'Q',
    w: 'W',
    e: 'E',
    r: 'R',
    passive: 'Passive',
  } as const;

  for (let lock = 0; lock < 6; lock += 1) {
    const choice = page.locator('button[data-choice-slot]').first();
    const draftSlot = await choice.getAttribute('data-choice-slot');
    if (!draftSlot || !(draftSlot in labels)) {
      throw new Error(`Unexpected draft slot ${draftSlot ?? 'missing'}.`);
    }

    const label = labels[draftSlot as keyof typeof labels];
    await choice.focus();
    await page.keyboard.press('Enter');
    const lockButton = page.getByRole('button', { name: `Lock ${label} permanently` });
    await expect(lockButton).toBeEnabled();
    await lockButton.focus();
    await page.keyboard.press('Enter');
  }

  const completionHeading = page.getByRole('heading', { name: 'Your composite champion' });
  await expect(completionHeading).toBeVisible();
  await expect(completionHeading).toBeFocused();
});

test('solo completes the six-lock snapshot-backed journey and starts a fresh rematch', async ({
  page,
}) => {
  await page.goto('/solo');
  await expect(page.locator('.draft-board .champion-art')).toHaveCount(0);
  await expect(page.getByText('Patch 16.17.1')).toBeVisible();
  await expect(page.getByRole('button', { name: /full details for/i }).first()).toBeVisible();

  const labels = {
    body: 'Body',
    q: 'Q',
    w: 'W',
    e: 'E',
    r: 'R',
    passive: 'Passive',
  } as const;

  for (let lock = 0; lock < 6; lock += 1) {
    const choice = page.locator('button[data-choice-slot]').first();
    const draftSlot = await choice.getAttribute('data-choice-slot');
    if (!draftSlot || !(draftSlot in labels)) {
      throw new Error(`Unexpected draft slot ${draftSlot ?? 'missing'}.`);
    }

    const label = labels[draftSlot as keyof typeof labels];
    await choice.click();
    await page.getByRole('button', { name: `Lock ${label} permanently` }).click();
  }

  await expect(page.getByRole('heading', { name: 'Your composite champion' })).toBeVisible();
  await expect(page.locator('.completion-page .champion-art')).toBeVisible();
  await expect(
    page.locator('.completion-page .champion-art__image, .completion-page .champion-art__fallback'),
  ).toHaveCount(1);
  await expect(page.locator('.champion-art__body-label')).toHaveText(/Body/);
  await expect(page.getByText('Default form')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Composite ability icons' })).toBeVisible();
  await expect(page.locator('[data-composite-ability-slot]')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Inspect each choice' })).toBeVisible();
  await page.getByRole('button', { name: /play again/i }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expect(page.getByLabel('Round 1 of six')).toBeVisible();
});

test('completed builds round-trip through a clean shared result URL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { __buildChampCopied?: string }).__buildChampCopied = value;
        },
      },
    });
  });
  await page.goto('/solo');

  const labels = {
    body: 'Body',
    q: 'Q',
    w: 'W',
    e: 'E',
    r: 'R',
    passive: 'Passive',
  } as const;

  for (let lock = 0; lock < 6; lock += 1) {
    const choice = page.locator('button[data-choice-slot]').first();
    const draftSlot = await choice.getAttribute('data-choice-slot');
    if (!draftSlot || !(draftSlot in labels)) {
      throw new Error(`Unexpected draft slot ${draftSlot ?? 'missing'}.`);
    }

    await choice.click();
    await page
      .getByRole('button', { name: `Lock ${labels[draftSlot as keyof typeof labels]} permanently` })
      .click();
  }

  await page.getByRole('button', { name: 'Copy result link' }).click();
  const sharedUrl = await page.evaluate(
    () => (window as Window & { __buildChampCopied?: string }).__buildChampCopied,
  );

  expect(sharedUrl).toMatch(/\/build\/v1\.[A-Za-z0-9_-]+$/);
  if (!sharedUrl) {
    throw new Error('The completed build did not produce a share URL.');
  }

  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(sharedUrl);
  await expect(page.getByRole('heading', { name: 'Your composite champion' })).toBeVisible();
  await expect(page.getByText('Patch 16.17.1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inspect each choice' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('completed build sections use aligned frames within each grid row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/solo');

  const labels = {
    body: 'Body',
    q: 'Q',
    w: 'W',
    e: 'E',
    r: 'R',
    passive: 'Passive',
  } as const;

  for (let lock = 0; lock < 6; lock += 1) {
    const choice = page.locator('button[data-choice-slot]').first();
    const draftSlot = await choice.getAttribute('data-choice-slot');
    if (!draftSlot || !(draftSlot in labels)) {
      throw new Error(`Unexpected draft slot ${draftSlot ?? 'missing'}.`);
    }

    const label = labels[draftSlot as keyof typeof labels];
    await choice.click();
    await page.getByRole('button', { name: `Lock ${label} permanently` }).click();
  }

  await expect(page.getByRole('heading', { name: 'Inspect each choice' })).toBeVisible();

  const rowMetrics = await page
    .locator('.completion-grid > .completion-piece')
    .evaluateAll((pieces) => {
      const rows = new Map<number, { cardHeights: number[]; sourceOffsets: number[] }>();

      for (const piece of pieces) {
        const pieceBounds = piece.getBoundingClientRect();
        const card = piece.querySelector('.component-card');
        const source = piece.querySelector('.completion-piece__source');
        if (!card || !source) {
          throw new Error('Completion piece is missing its card or source label.');
        }

        const cardHeights = rows.get(Math.round(pieceBounds.top)) ?? {
          cardHeights: [],
          sourceOffsets: [],
        };
        cardHeights.cardHeights.push(card.getBoundingClientRect().height);
        cardHeights.sourceOffsets.push(source.getBoundingClientRect().top - pieceBounds.top);
        rows.set(Math.round(pieceBounds.top), cardHeights);
      }

      return [...rows.values()];
    });

  expect(rowMetrics).not.toHaveLength(0);
  for (const { cardHeights, sourceOffsets } of rowMetrics) {
    expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
    expect(Math.max(...sourceOffsets) - Math.min(...sourceOffsets)).toBeLessThanOrEqual(1);
  }
});

test('solo gameplay remains within a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/solo');

  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /your options/i })).toBeVisible();
  await expect(page.locator('.offer-panel')).toBeVisible();
  await expect(page.locator('.offer-panel__round')).toBeVisible();
  const firstChoiceAt390 = await page.locator('.component-card').first().boundingBox();
  expect(firstChoiceAt390?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);
  await expect(page.locator('.build-status__placeholder')).toHaveCount(6);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/solo');
  await expect(page.locator('.offer-panel')).toBeVisible();
  const firstChoiceAt320 = await page.locator('.component-card').first().boundingBox();
  expect(firstChoiceAt320?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);
  await expectNoHorizontalOverflow(page);
});

test('solo reflows at 200 percent zoom without clipping the first decision', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/solo');

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });

  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expect(page.locator('.offer-panel')).toBeVisible();
  await expect(page.locator('.component-card').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose a component' })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test('full details open in a popup without changing the choice-card layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/solo');

  const bodyCard = page.locator('.component-card--body');
  const before = await bodyCard.boundingBox();
  const disclosure = bodyCard.locator('.component-card__details-toggle');

  await disclosure.click();

  const details = page.getByRole('dialog', { name: /details for/i });
  await expect(details).toBeVisible();
  await expect(details.locator('.component-details-panel__body-stats')).toBeVisible();
  await expect(details.locator('.component-details-popover__close')).toBeVisible();
  expect(await details.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');

  const after = await bodyCard.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 1);

  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

  await disclosure.click();
  await expect(details).toBeVisible();
  await page.mouse.click(20, 20);
  await expect(details).toBeHidden();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

  await disclosure.click();
  await expect(details).toBeVisible();
  await details.locator('.component-details-popover__close').click();
  await expect(details).toBeHidden();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
});

test('details dialogs preserve focus and reduced motion keeps state changes legible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/solo');

  const disclosure = page.getByRole('button', { name: /full details for/i }).first();
  await disclosure.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: /details for/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /close details for/i })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(disclosure).toBeFocused();

  const reducedMotion = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const cardTransition = await page
    .locator('.component-card')
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);

  expect(reducedMotion).toBe(true);
  expect(Number.parseFloat(cardTransition)).toBeLessThanOrEqual(0.001);
  await expect(page.getByText('6 slots open')).toBeVisible();
});

test('your options cards use aligned frames within each grid row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/solo');

  const rowHeightDifferences = await page
    .locator('.choice-grid > .component-card')
    .evaluateAll((cards) => {
      const rows = new Map<number, number[]>();

      for (const card of cards) {
        const bounds = card.getBoundingClientRect();
        const rowTop = Math.round(bounds.top);
        const heights = rows.get(rowTop) ?? [];
        heights.push(bounds.height);
        rows.set(rowTop, heights);
      }

      return [...rows.values()].map((heights) => Math.max(...heights) - Math.min(...heights));
    });

  expect(rowHeightDifferences.every((difference) => difference <= 1)).toBe(true);
});

test('home example build slots reserve aligned name and source rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const rowHeights = await page.locator('.home-build-card__slot').evaluateAll((slots) => {
    const measure = (selector: string) =>
      slots.map((slot) => slot.querySelector(selector)?.getBoundingClientRect().height ?? 0);

    return {
      nameHeights: measure('strong'),
      sourceHeights: measure('.home-build-card__slot-source'),
    };
  });

  expect(
    Math.max(...rowHeights.nameHeights) - Math.min(...rowHeights.nameHeights),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.max(...rowHeights.sourceHeights) - Math.min(...rowHeights.sourceHeights),
  ).toBeLessThanOrEqual(1);
});

test('sound control keeps its size when toggled', async ({ page }) => {
  await page.goto('/');
  const soundControl = page.getByRole('button', { name: 'Mute sound' });
  const before = await soundControl.boundingBox();

  if (!before) {
    throw new Error('Sound control is not rendered.');
  }

  await soundControl.click();
  const after = await page.getByRole('button', { name: 'Turn sound on' }).boundingBox();

  if (!after) {
    throw new Error('Muted sound control is not rendered.');
  }

  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});

test('result, not-found, loading, and fatal states are user-facing', async ({ page }) => {
  await page.goto('/build/demo');
  await expect(page.getByRole('heading', { name: /build complete/i })).toBeVisible();
  await expect(page.getByText(/no score/i)).toBeVisible();

  await page.goto('/missing');
  await expect(page.getByRole('heading', { level: 1, name: /page not found/i })).toBeVisible();

  await page.goto('/?preview=loading');
  await expect(page.getByRole('status')).toContainText(/loading/i);

  await page.goto('/?preview=fatal');
  await expect(page.getByRole('alert')).toContainText(/could not load the page/i);
  await page.getByRole('button', { name: /go home/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /build your own champion/i }),
  ).toBeVisible();
});

test('the home layout remains readable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /build your own champion/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /start solo draft/i })).toBeVisible();
  await expect(page.getByText(/unofficial fan project/i)).toBeVisible();
});
