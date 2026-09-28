import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectWcagA11y(page: Page, surface: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  const summary = violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    targets: nodes.map(({ target }) => target),
  }));

  expect(summary, `axe found WCAG A/AA violations on ${surface}`).toEqual([]);
}

async function completeDraft(page: Page) {
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
}

test('home, solo draft, and details dialog have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /build your own champion/i }),
  ).toBeVisible();
  await expectWcagA11y(page, 'home');

  await page.goto('/solo');
  await expect(
    page.getByRole('heading', { level: 1, name: /choose one part to keep/i }),
  ).toBeVisible();
  await expectWcagA11y(page, 'solo draft');

  await page
    .getByRole('button', { name: /full details for/i })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectWcagA11y(page, 'solo details dialog');

  await page.goto('/?preview=fatal');
  await expect(page.getByRole('alert')).toContainText(/could not load the page/i);
  await expectWcagA11y(page, 'fatal error');
});

test('completed and shared results have no WCAG A/AA violations', async ({ page }) => {
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
  await completeDraft(page);
  await expect(page.getByRole('heading', { name: 'Your composite champion' })).toBeVisible();
  await expectWcagA11y(page, 'completed solo result');

  await page.getByRole('button', { name: 'Copy result link' }).click();
  const sharedUrl = await page.evaluate(
    () => (window as Window & { __buildChampCopied?: string }).__buildChampCopied,
  );
  if (!sharedUrl) {
    throw new Error('The completed build did not produce a share URL.');
  }

  await page.evaluate(() => localStorage.clear());
  await page.goto(sharedUrl);
  await expect(page.getByRole('heading', { name: 'Your composite champion' })).toBeVisible();
  await expectWcagA11y(page, 'shared result');
});
