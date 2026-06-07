import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 45_000,
  expect: {
    toHaveScreenshot: {
      // Keep CI and local runs on the same checked-in baselines instead of
      // requiring separate Linux/macOS snapshots for the same Chromium render.
      pathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}-darwin{ext}',
      maxDiffPixelRatio: 0.04,
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { browserName: 'chromium' },
    },
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
