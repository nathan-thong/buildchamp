import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const viteCliPath = resolve('node_modules/vite/bin/vite.js');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1'
      ? undefined
      : {
          command: `${process.execPath} ${viteCliPath} preview --host 127.0.0.1 --port 4174 --strictPort`,
          url: 'http://127.0.0.1:4174',
          reuseExistingServer: false,
          timeout: 120_000,
        },
});
