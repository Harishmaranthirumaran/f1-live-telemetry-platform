import { test, expect, type Page } from '@playwright/test';

const miamiNextSession = {
  session_key: 11270,
  session_name: 'Practice 1',
  session_type: 'Practice',
  country_name: 'United States',
  location: 'Miami Gardens',
  circuit_short_name: 'Miami',
  date_start: '2026-05-01T16:00:00+00:00',
  date_end: '2026-05-01T17:30:00+00:00',
};

const telemetryStandbyPayload = {
  status: 'no_live',
  session: 'no-live-session',
  timestamp: 1777651200,
  drivers: [],
  next_session: miamiNextSession,
  warnings: ['Using scheduled Miami fallback while live telemetry warms up.'],
  telemetry_intelligence: {
    session_name: miamiNextSession.session_name,
    session_type: miamiNextSession.session_type,
    status: 'no_live',
    generated_at: '2026-05-01T16:00:00.000Z',
    weather: null,
    drivers: [],
    race_control: [],
    eliminations: {
      drivers: [],
      teams: [],
      note: 'No driver or team elimination is indicated by the OpenF1 race-control feed.',
    },
    battery: {
      available: false,
      note: 'OpenF1 does not expose ERS/battery state in the public feed used by this app.',
    },
    track_status: 'No active race-control flag in feed',
    data_notes: [],
  },
};

const nextRacePayload = {
  next_race: {
    session_key: 'miami-gp-fallback',
    session_name: 'Miami Grand Prix',
    session_type: 'Race',
    country_name: 'United States',
    location: 'Miami Gardens',
    circuit_short_name: 'Miami',
    date_start: '2026-05-03T20:00:00Z',
    current_lap: 'SCHEDULED',
    status: 'NO_RACE',
  },
};

const standingsPayload = {
  season: '2026',
  round: '0',
  fetchedAt: '2026-05-01T16:00:00.000Z',
  drivers: [],
  constructors: [],
  warnings: ['Standings stubbed for visual snapshot.'],
};

const mockVariableRaceData = async (page: Page) => {
  await page.route('**/api/telemetry', (route) => route.fulfill({ json: telemetryStandbyPayload }));
  await page.route('**/api/schedule/next-race', (route) => route.fulfill({ json: nextRacePayload }));
  await page.route('**/api/standings*', (route) => route.fulfill({ json: standingsPayload }));
};

const waitForStableUI = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('body').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
};

test.beforeEach(async ({ page }) => {
  await mockVariableRaceData(page);
});

test('home page visual baseline', async ({ page }) => {
  await page.goto('/');
  await waitForStableUI(page);
  await expect(page).toHaveScreenshot('home-page.png');
});

test('replay page visual baseline', async ({ page }) => {
  await page.goto('/replay');
  await waitForStableUI(page);
  await expect(page).toHaveScreenshot('replay-page.png');
});

test('pitwall page visual baseline', async ({ page }) => {
  await page.goto('/pitwall');
  await waitForStableUI(page);
  await expect(page).toHaveScreenshot('pitwall-page.png');
});
