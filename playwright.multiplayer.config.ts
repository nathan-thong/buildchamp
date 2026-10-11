import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const wranglerCliPath = resolve('node_modules/wrangler/bin/wrangler.js');
const persistencePath = resolve('.wrangler', `multiplayer-integration-${randomUUID()}`);

export default defineConfig({
  testDir: './tests/multiplayer',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-worker',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" "${wranglerCliPath}" dev --local --ip 127.0.0.1 --port 4175 --persist-to "${persistencePath}" --show-interactive-dev-session=false`,
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
