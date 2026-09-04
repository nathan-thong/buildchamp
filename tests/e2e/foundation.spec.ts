import { expect, test } from '@playwright/test';

test('home starts a solo draft and exposes the six-slot board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /choose six slots/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Rules' })).toBeVisible();
  await expect(page.locator('.home-how__item')).toHaveCount(4);
  await expect(page.getByRole('link', { name: /buildchamp home/i })).toBeVisible();

  await page.getByRole('link', { name: /start solo draft/i }).click();
  await expect(page).toHaveURL(/\/solo$/);
  await expect(page.getByRole('heading', { level: 1, name: /choose a slot/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose a slot' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /01 \/ body/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /06 \/ passive/i })).toBeVisible();
});

test('solo lock interaction is keyboard reachable', async ({ page }) => {
  await page.goto('/solo');
  const bodySlot = page.getByRole('button', { name: /01 \/ body/i });

  await bodySlot.focus();
  await page.keyboard.press('Enter');
  await expect(bodySlot).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Lock Body' })).toBeEnabled();
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
