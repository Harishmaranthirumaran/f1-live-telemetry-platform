import type { DashboardData } from '../types/f1';
import { fetchJsonWithPolicy } from './http';
import { telemetryResponseSchema, type TelemetryResponseDto } from './schemas';

const MIAMI_FALLBACK_START = '2026-05-01T16:00:00+00:00';

function formatLapTime(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function normaliseCompound(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().trim();
  if (s.includes('INTER')) return 'INTER';
  if (s.includes('SOFT')) return 'SOFT';
  if (s.includes('MED')) return 'MEDIUM';
  if (s.includes('HARD')) return 'HARD';
  if (s.includes('WET')) return 'WET';
  return s;
}

function mapTelemetryToDashboard(payload: TelemetryResponseDto): DashboardData {
  const isApiLocked = payload.status === 'live' && payload.session === 'live-session-api-locked';
  const liveStatus = payload.status === 'live' ? 'LIVE' : 'NO_RACE';

  const driversSorted = [...(payload.drivers ?? [])].sort((a, b) => {
    const aPos = a.position ?? Number.MAX_SAFE_INTEGER;
    const bPos = b.position ?? Number.MAX_SAFE_INTEGER;
    return aPos - bPos;
  });

  let fallbackPos = 1;
  const leaderboard = driversSorted.map((driver) => ({
    position: driver.position ?? fallbackPos++,
    driver_number: 0,
    name_acronym: driver.code,
    full_name: driver.name,
    team_name: driver.team,
    team_colour: driver.color,
    gap_to_leader: driver.gapToLeader ?? '--',
    interval: driver.intervalGap ?? null,
    last_lap: formatLapTime(driver.lapTime),
    tyre: normaliseCompound(driver.compound),
    lap_number: driver.lap ?? null,
  }));

  const laps = payload.drivers
    .map((driver) => driver.lapTime)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const bestLap = laps.length ? Math.min(...laps) : null;

  const currentLap = payload.drivers.reduce((max, driver) => {
    if (typeof driver.lap === 'number' && driver.lap > max) return driver.lap;
    return max;
  }, 0);

  const nextSessionPayload = payload.next_session ?? null;
  const nextSession = nextSessionPayload
    ? {
        session_key: nextSessionPayload.session_key,
        session_name: nextSessionPayload.session_name,
        session_type: nextSessionPayload.session_type ?? 'Race',
        country_name: nextSessionPayload.country_name ?? '',
        location: nextSessionPayload.location ?? '',
        circuit_short_name: nextSessionPayload.circuit_short_name ?? nextSessionPayload.session_name,
        date_start: nextSessionPayload.date_start ?? new Date().toISOString(),
        date_end: nextSessionPayload.date_end ?? undefined,
        current_lap: '--',
        status: 'NO_RACE' as const,
      }
    : null;

  return {
    session:
      liveStatus === 'LIVE'
        ? {
            session_key: payload.session,
            session_name: payload.session_name ?? payload.session.toUpperCase(),
            session_type: payload.session_type ?? 'Race',
            country_name: payload.country_name ?? 'OpenF1',
            location: payload.location ?? 'Trackside',
            circuit_short_name: payload.circuit_short_name ?? payload.session,
            date_start: new Date(payload.timestamp * 1000).toISOString(),
            current_lap: currentLap || '--',
            status: 'LIVE',
          }
        : (nextSession ?? {
            session_key: payload.session,
            session_name: 'NO LIVE SESSION',
            session_type: 'Race',
            country_name: '',
            location: '',
            circuit_short_name: 'TRACK CLEAR',
            date_start: new Date().toISOString(),
            current_lap: '--',
            status: 'NO_RACE',
          }),
    leaderboard,
    max_stats: {
      best_lap: formatLapTime(bestLap),
      top_speed: 'UNAVAILABLE',
      started: liveStatus === 'LIVE' ? 'LIVE' : 'TRACK CLEAR',
      tyres: liveStatus === 'LIVE' ? 'UNKNOWN' : 'N/A',
    },
    live_status: liveStatus,
    next_session: nextSession,
    weekend_schedule: payload.weekend_schedule ?? [],
    api_locked: isApiLocked || undefined,
  };
}

const offlineFallbackDashboard = (): DashboardData => ({
  session: {
    session_key: 'offline',
    session_name: 'TELEMETRY OFFLINE',
    session_type: 'Race',
    country_name: '',
    location: '',
    circuit_short_name: 'DATA UNAVAILABLE',
    date_start: new Date().toISOString(),
    current_lap: '--',
    status: 'NO_RACE',
  },
  leaderboard: [],
  max_stats: {
    best_lap: '--:--.---',
    top_speed: '--',
    started: 'OFFLINE',
    tyres: 'N/A',
  },
  live_status: 'NO_RACE',
  next_session: null,
  data_health: 'offline',
  warnings: ['No telemetry data available.'],
});

let lastGoodDashboard: DashboardData | null = null;

function scheduledFallbackTelemetry(): TelemetryResponseDto {
  return telemetryResponseSchema.parse({
    status: 'no_live',
    session: 'no-live-session',
    timestamp: Math.floor(Date.now() / 1000),
    drivers: [],
    next_session: {
      session_key: 11270,
      session_name: 'Practice 1',
      session_type: 'Practice',
      country_name: 'United States',
      location: 'Miami Gardens',
      circuit_short_name: 'Miami',
      date_start: MIAMI_FALLBACK_START,
      date_end: '2026-05-01T17:30:00+00:00',
    },
    warnings: ['Using scheduled Miami fallback while live telemetry warms up.'],
  });
}

function lastGoodTelemetryFallback(): TelemetryResponseDto | undefined {
  if (!lastGoodDashboard) return undefined;
  return telemetryResponseSchema.parse({
    session: String(lastGoodDashboard.session.session_name ?? 'fallback-session'),
    timestamp: Math.floor(Date.now() / 1000),
    status: 'no_live',
    drivers: [],
    next_session: lastGoodDashboard.next_session
      ? {
          session_key: lastGoodDashboard.next_session.session_key,
          session_name: lastGoodDashboard.next_session.session_name,
          session_type: lastGoodDashboard.next_session.session_type,
          country_name: lastGoodDashboard.next_session.country_name,
          location: lastGoodDashboard.next_session.location,
          circuit_short_name: lastGoodDashboard.next_session.circuit_short_name,
          date_start: lastGoodDashboard.next_session.date_start,
          date_end: lastGoodDashboard.next_session.date_end ?? null,
        }
      : undefined,
  });
}

export async function getLiveDashboardData(): Promise<DashboardData> {
  try {
    const fallbackTelemetry = lastGoodTelemetryFallback() ?? scheduledFallbackTelemetry();
    const result = await fetchJsonWithPolicy({
      url: '/api/telemetry',
      init: { cache: 'no-store' },
      timeoutMs: 7_000,
      retries: 0,
      schema: telemetryResponseSchema,
      fallbackData: fallbackTelemetry,
      fallbackLabel: lastGoodDashboard ? 'last good telemetry shape' : 'scheduled Miami fallback',
    });

    const mapped = mapTelemetryToDashboard(result.data);
    const dashboard = {
      ...mapped,
      data_health: result.health,
      warnings: result.warnings,
    } as DashboardData;

    if (dashboard.leaderboard.length > 0 || dashboard.live_status === 'LIVE') {
      lastGoodDashboard = dashboard;
    }

    if (result.health === 'degraded' && lastGoodDashboard) {
      return {
        ...lastGoodDashboard,
        data_health: 'degraded',
        warnings: result.warnings,
      };
    }

    return dashboard;
  } catch (error) {
    if (lastGoodDashboard) {
      return {
        ...lastGoodDashboard,
        data_health: 'degraded',
        warnings: [error instanceof Error ? error.message : 'Telemetry degraded.'],
      };
    }

    return offlineFallbackDashboard();
  }
}
