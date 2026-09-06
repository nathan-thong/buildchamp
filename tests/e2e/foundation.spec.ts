import { expect, test } from '@playwright/test';

test('home starts a solo draft and exposes the six-slot board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /choose six slots/i })).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 1, name: /choose a slot/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a slot' })).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'Lock Body' })).toBeEnabled();
});

test('solo completes the six-lock snapshot-backed journey and starts a fresh rematch', async ({
  page,
}) => {
  await page.goto('/solo');
  await expect(page.locator('.draft-board .champion-art')).toHaveCount(0);
  await expect(page.getByText('Live snapshot')).toBeVisible();
  await expect(page.getByText('Full details').first()).toBeVisible();

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
    await page.getByRole('button', { name: `Lock ${label}` }).click();
    await page.getByRole('button', { name: `Confirm lock ${label}` }).click();
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
  await expect(page.getByText(/six parts/i)).toBeVisible();
  await page.getByRole('button', { name: /play again/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Choose a slot' })).toBeVisible();
  await expect(page.getByLabel('Round 1 of six')).toBeVisible();
});

test('solo gameplay remains within a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/solo');

  await expect(page.getByRole('heading', { level: 1, name: /choose a slot/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: /choose one component/i }),
  ).toBeVisible();
  await expect(page.locator('.build-status__placeholder')).toHaveCount(6);
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
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
  await expect(page.getByRole('heading', { level: 1, name: /choose six slots/i })).toBeVisible();
});

test('the home layout remains readable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /choose six slots/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /start solo draft/i })).toBeVisible();
  await expect(page.getByText(/unofficial fan project/i)).toBeVisible();
});
