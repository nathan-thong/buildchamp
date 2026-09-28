import { expect, test, type Page } from '@playwright/test';
import { preview, type PreviewServer } from 'vite';

const slotLabels = {
  body: 'Body',
  q: 'Q',
  w: 'W',
  e: 'E',
  r: 'R',
  passive: 'Passive',
} as const;

async function closePreview(server: PreviewServer) {
  if (!server.httpServer.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.httpServer.close((error) => (error ? reject(error) : resolve()));
  });
}

async function verifyOfflineRefresh(page: Page, disconnect: () => Promise<void>) {
  await page.goto('/solo');
  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const choice = page.locator('button[data-choice-slot]').first();
  const slot = await choice.getAttribute('data-choice-slot');
  if (!slot || !(slot in slotLabels)) {
    throw new Error(`Unexpected component slot ${slot ?? 'missing'}.`);
  }

  const label = slotLabels[slot as keyof typeof slotLabels];
  await choice.click();
  await page.getByRole('button', { name: `Lock ${label} permanently` }).click();
  await expect(
    page.getByRole('listitem', { name: new RegExp(`${label} slot, locked`, 'i') }),
  ).toBeVisible();

  await disconnect();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 5_000 });

  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem', { name: new RegExp(`${label} slot, locked`, 'i') }),
  ).toBeVisible();

  const nextChoice = page.locator('button[data-choice-slot]').first();
  const nextSlot = await nextChoice.getAttribute('data-choice-slot');
  if (!nextSlot || !(nextSlot in slotLabels)) {
    throw new Error(`Unexpected component slot ${nextSlot ?? 'missing'}.`);
  }
  const nextLabel = slotLabels[nextSlot as keyof typeof slotLabels];
  await nextChoice.click();
  await page.getByRole('button', { name: `Lock ${nextLabel} permanently` }).click();
  await expect(
    page.getByRole('listitem', { name: new RegExp(`${nextLabel} slot, locked`, 'i') }),
  ).toBeVisible();
}

test('restores an active build after an offline refresh', async ({
  browser,
  browserName,
  context,
  page,
}) => {
  if (browserName !== 'webkit') {
    await verifyOfflineRefresh(page, () => context.setOffline(true));
    return;
  }

  // Playwright's WebKit context.setOffline(true) fails navigations internally.
  // Stopping the app origin exercises the service worker's real network-failure path.
  const server = await preview({
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
  });

  try {
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('The isolated preview server did not bind a TCP port.');
    }

    const isolatedContext = await browser.newContext({
      baseURL: `http://127.0.0.1:${address.port}`,
    });
    try {
      const isolatedPage = await isolatedContext.newPage();
      await verifyOfflineRefresh(isolatedPage, () => closePreview(server));
    } finally {
      await isolatedContext.close();
    }
  } finally {
    await closePreview(server);
  }
});
