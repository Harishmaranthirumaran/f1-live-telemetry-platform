import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../../../lib/rateLimit";
import { cacheGet, cacheSet } from "../../../lib/cache";
import { buildTelemetryResponse } from "../../../lib/analytics";
import {
  getCarData,
  getCurrentSession,
  getDrivers,
  getIntervals,
  getRecentIntervals,
  getLaps,
  getLapsForLapNumbers,
  getNextSession,
  getRaceControl,
  getStints,
  getWeather,
  getWeekendSchedule,
  OpenF1LiveLockError,
  type OpenF1CarData,
  type OpenF1Driver,
  type OpenF1Interval,
  type OpenF1Lap,
  type OpenF1RaceControl,
  type OpenF1Session,
  type OpenF1Stint,
  type OpenF1Weather,
} from "../../../lib/openf1";

export const runtime = "nodejs";

type WeekendSessionSlot = {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string | null;
};

type TelemetryPayload =
  | (ReturnType<typeof buildTelemetryResponse> & {
      status: "live";
      next_session?: null;
      telemetry_intelligence?: TelemetryIntelligence;
      weekend_schedule?: WeekendSessionSlot[];
      warnings?: string[];
    })
  | {
      status: "no_live";
      session: string;
      timestamp: number;
      drivers: ReturnType<typeof buildTelemetryResponse>["drivers"];
      next_session: {
        session_key: number | string;
        session_name: string;
        session_type: string;
        country_name: string;
        location: string;
        circuit_short_name: string;
        date_start: string | null;
        date_end: string | null;
      } | null;
      weekend_schedule?: WeekendSessionSlot[];
      warnings?: string[];
      telemetry_intelligence?: TelemetryIntelligence;
    };

const FRESH_TTL_S = 5;
const STALE_TTL_S = 60;
const MAX_CAR_DATA_DRIVERS = 6;
const TELEMETRY_RESPONSE_TIMEOUT_MS = 9_000;
const FALLBACK_NEXT_SESSION_TIMEOUT_MS = 4_000;

const CACHE_KEY_PAYLOAD = "telemetry:payload";
const CACHE_KEY_FETCHED_AT = "telemetry:fetchedAt";

type DriverTelemetryInsight = {
  driver_number: number;
  code: string;
  name: string;
  team: string;
  position: number | null;
  current_lap: number | null;
  compound: string | null;
  tyre_age_laps: number | null;
  stint_number: number | null;
  pit_stops: number;
  last_lap_time: number | null;
  top_speed: number | null;
  elimination_status: string;
  battery_status: string;
};

type TelemetryIntelligence = {
  session_name: string;
  session_type: string;
  status: "live" | "no_live";
  generated_at: string;
  weather: {
    air_temperature: number | null;
    track_temperature: number | null;
    humidity: number | null;
    rainfall: number | null;
    wind_speed: number | null;
    pressure: number | null;
  } | null;
  drivers: DriverTelemetryInsight[];
  race_control: {
    category: string | null;
    flag: string | null;
    message: string;
    lap_number: number | null;
  }[];
  eliminations: {
    drivers: string[];
    teams: string[];
    note: string;
  };
  battery: {
    available: boolean;
    note: string;
  };
  track_status: string;
  data_notes: string[];
};

// Module-level in-flight guard: deduplicates concurrent rebuild requests
// within a single process instance. KV handles cross-instance coordination.
let inFlight: Promise<TelemetryPayload> | null = null;

async function fetchWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3) {
  let attempt = 0;
  let delayMs = 500;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  throw new Error("Retry attempts exhausted");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

function latestByDate<T extends { date?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))[0] ?? null;
}

function latestLapByDriver(laps: OpenF1Lap[]) {
  const latest = new Map<number, OpenF1Lap>();
  laps.forEach((lap) => {
    const current = latest.get(lap.driver_number);
    if (!current || lap.lap_number > current.lap_number) {
      latest.set(lap.driver_number, lap);
    }
  });
  return latest;
}

function latestCarSpeedByDriver(carData: OpenF1CarData[]) {
  const latest = new Map<number, OpenF1CarData>();
  carData.forEach((sample) => {
    const current = latest.get(sample.driver_number);
    if (!current || Date.parse(sample.date) > Date.parse(current.date)) {
      latest.set(sample.driver_number, sample);
    }
  });
  return latest;
}

function stintsByDriver(stints: OpenF1Stint[]) {
  const grouped = new Map<number, OpenF1Stint[]>();
  stints.forEach((stint) => {
    const current = grouped.get(stint.driver_number) ?? [];
    current.push(stint);
    grouped.set(stint.driver_number, current);
  });
  grouped.forEach((driverStints) => {
    driverStints.sort((a, b) => Number(a.stint_number ?? 0) - Number(b.stint_number ?? 0));
  });
  return grouped;
}

function getCurrentStint(driverStints: OpenF1Stint[], currentLap: number | null) {
  if (!driverStints.length) return null;
  if (currentLap === null) return driverStints[driverStints.length - 1] ?? null;
  return driverStints.find((stint) => {
    const start = stint.lap_start ?? 0;
    const end = stint.lap_end ?? Number.MAX_SAFE_INTEGER;
    return start <= currentLap && currentLap <= end;
  }) ?? driverStints[driverStints.length - 1] ?? null;
}

function tyreAge(stint: OpenF1Stint | null, currentLap: number | null) {
  if (!stint || currentLap === null || stint.lap_start === null || stint.lap_start === undefined) return null;
  const ageAtStart = stint.tyre_age_at_start ?? 0;
  return Math.max(0, currentLap - stint.lap_start + ageAtStart + 1);
}

function inferEliminations(messages: OpenF1RaceControl[], drivers: OpenF1Driver[]) {
  const driverByNumber = new Map(drivers.map((driver) => [driver.driver_number, driver]));
  const eliminationMessages = messages.filter((message) => {
    const text = message.message?.toLowerCase() ?? "";
    return /retired|stopped|out of session|will not take part|dnf|eliminated/.test(text);
  });

  const driverLabels = new Set<string>();
  const teamLabels = new Set<string>();
  eliminationMessages.forEach((message) => {
    if (!message.driver_number) return;
    const driver = driverByNumber.get(message.driver_number);
    if (!driver) return;
    driverLabels.add(driver.name_acronym ?? driver.broadcast_name ?? driver.full_name ?? String(driver.driver_number));
    if (driver.team_name) teamLabels.add(driver.team_name);
  });

  return {
    drivers: [...driverLabels],
    teams: [...teamLabels],
    note: eliminationMessages.length
      ? "Derived from race-control retirement/stopped messages."
      : "No driver or team elimination is indicated by the OpenF1 race-control feed. Qualifying elimination is only available during qualifying sessions.",
  };
}

function buildTelemetryIntelligence(input: {
  sessionName: string;
  sessionType: string;
  status: "live" | "no_live";
  drivers: OpenF1Driver[];
  laps: OpenF1Lap[];
  stints: OpenF1Stint[];
  weather: OpenF1Weather[];
  raceControl: OpenF1RaceControl[];
  carData: OpenF1CarData[];
}): TelemetryIntelligence {
  const latestLaps = latestLapByDriver(input.laps);
  const groupedStints = stintsByDriver(input.stints);
  const latestSpeeds = latestCarSpeedByDriver(input.carData);
  const latestWeather = latestByDate(input.weather);
  const recentRaceControl = [...input.raceControl]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 8);
  const eliminations = inferEliminations(input.raceControl, input.drivers);

  const drivers = input.drivers.map((driver) => {
    const lap = latestLaps.get(driver.driver_number) ?? null;
    const currentLap = lap?.lap_number ?? null;
    const currentStint = getCurrentStint(groupedStints.get(driver.driver_number) ?? [], currentLap);
    return {
      driver_number: driver.driver_number,
      code: driver.name_acronym ?? driver.broadcast_name ?? String(driver.driver_number),
      name: driver.full_name ?? driver.broadcast_name ?? driver.name_acronym ?? String(driver.driver_number),
      team: driver.team_name ?? "Unknown",
      position: lap?.position ?? null,
      current_lap: currentLap,
      compound: currentStint?.compound ?? lap?.compound ?? null,
      tyre_age_laps: tyreAge(currentStint, currentLap),
      stint_number: currentStint?.stint_number ?? null,
      pit_stops: Math.max(0, (groupedStints.get(driver.driver_number)?.length ?? 1) - 1),
      last_lap_time: lap?.lap_duration ?? null,
      top_speed: latestSpeeds.get(driver.driver_number)?.speed ?? null,
      elimination_status: eliminations.drivers.includes(driver.name_acronym ?? "")
        ? "Race-control issue indicated"
        : "No elimination indicated",
      battery_status: "Unavailable in OpenF1 public feed",
    };
  }).sort((a, b) => {
    if (a.position === null && b.position === null) return a.driver_number - b.driver_number;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  return {
    session_name: input.sessionName,
    session_type: input.sessionType,
    status: input.status,
    generated_at: new Date().toISOString(),
    weather: latestWeather
      ? {
          air_temperature: latestWeather.air_temperature ?? null,
          track_temperature: latestWeather.track_temperature ?? null,
          humidity: latestWeather.humidity ?? null,
          rainfall: latestWeather.rainfall ?? null,
          wind_speed: latestWeather.wind_speed ?? null,
          pressure: latestWeather.pressure ?? null,
        }
      : null,
    drivers,
    race_control: recentRaceControl.map((message) => ({
      category: message.category ?? null,
      flag: message.flag ?? null,
      message: message.message ?? "",
      lap_number: message.lap_number ?? null,
    })),
    eliminations,
    battery: {
      available: false,
      note: "OpenF1 does not expose ERS/battery state in the public 2026 feed used by this app.",
    },
    track_status: recentRaceControl.find((message) => message.flag)?.flag ?? "No active race-control flag in feed",
    data_notes: [
      input.stints.length ? "Tyre and pit-stop data is sourced from OpenF1 stints." : "Tyre/stint data is not available until OpenF1 publishes it for the active session.",
      input.weather.length ? "Weather data is sourced from OpenF1 weather samples." : "Weather data is not available for this session yet.",
      "Road-grip and battery deployment are not present in the public OpenF1 API; the dashboard shows track temperature, rainfall, wind, and pressure instead.",
    ],
  };
}

function mapSessionSlot(s: OpenF1Session): WeekendSessionSlot {
  return {
    session_key: s.session_key,
    session_name: s.session_name,
    session_type: s.session_type ?? "Race",
    date_start: s.date_start,
    date_end: s.date_end ?? null,
  };
}

async function buildTelemetryPayload(): Promise<TelemetryPayload> {
  const warnings: string[] = [];

  let session: OpenF1Session | null = null;
  let weekendSessions: OpenF1Session[] = [];
  let isApiLocked = false;

  try {
    [session, weekendSessions] = await Promise.all([
      fetchWithRetry(() => getCurrentSession()),
      getWeekendSchedule().catch(() => [] as OpenF1Session[]),
    ]);
  } catch (err) {
    if (err instanceof OpenF1LiveLockError) {
      // OpenF1 locks the entire API during live sessions for unauthenticated access.
      // We know a race is happening — return a live-locked response so the dashboard
      // shows "RACE IN PROGRESS" instead of "TRACK CLEAR".
      isApiLocked = true;
    } else {
      throw err;
    }
  }

  if (isApiLocked) {
    return {
      status: "live",
      session: "live-session-api-locked",
      session_name: "RACE IN PROGRESS",
      session_type: "Race",
      country_name: "",
      location: "Circuit",
      circuit_short_name: "LIVE",
      timestamp: Math.floor(Date.now() / 1000),
      drivers: [],
      weekend_schedule: [],
      warnings: ["OpenF1 API is locked during the live session. Telemetry resumes when the race ends."],
      telemetry_intelligence: buildTelemetryIntelligence({
        sessionName: "Race In Progress",
        sessionType: "Race",
        status: "live",
        drivers: [],
        laps: [],
        stints: [],
        weather: [],
        raceControl: [],
        carData: [],
      }),
    };
  }

  const weekend_schedule = weekendSessions.map(mapSessionSlot);

  if (!session) {
    const nextSession = await fetchWithRetry(() => getNextSession());
    return {
      status: "no_live",
      session: "no-live-session",
      timestamp: Math.floor(Date.now() / 1000),
      drivers: [],
      next_session: nextSession
        ? {
            session_key: nextSession.session_key,
            session_name: nextSession.session_name,
            session_type: nextSession.session_type ?? "Race",
            country_name: nextSession.country_name ?? "",
            location: nextSession.location ?? "",
            circuit_short_name: nextSession.circuit_short_name ?? nextSession.session_name,
            date_start: nextSession.date_start ?? null,
            date_end: nextSession.date_end ?? null,
          }
        : null,
      weekend_schedule,
      warnings,
      telemetry_intelligence: buildTelemetryIntelligence({
        sessionName: nextSession?.session_name ?? "No live session",
        sessionType: nextSession?.session_type ?? "Race",
        status: "no_live",
        drivers: [],
        laps: [],
        stints: [],
        weather: [],
        raceControl: [],
        carData: [],
      }),
    };
  }

  // Fetch intervals: try the last 10 minutes first to reduce payload during long races.
  // Fall back to all intervals if recent fetch returns nothing (e.g. race just started).
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let intervals: OpenF1Interval[] = [];
  try {
    intervals = await getRecentIntervals(session.session_key, recentCutoff);
  } catch {
    // recent fetch failed — no warning, fall through to full fetch below
  }
  if (intervals.length === 0) {
    intervals = await fetchWithRetry(() => getIntervals(session.session_key)).catch(() => []);
  }

  const [drivers, stints, weather, raceControl] = await Promise.all([
    fetchWithRetry(() => getDrivers(session.session_key)),
    getStints(session.session_key).catch((error) => {
      warnings.push(`stints unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
      return [];
    }),
    getWeather(session.session_key).catch((error) => {
      warnings.push(`weather unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
      return [];
    }),
    getRaceControl(session.session_key).catch((error) => {
      warnings.push(`race control unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
      return [];
    }),
  ]);

  // Determine which lap numbers to fetch. Use the max lap from intervals to avoid
  // pulling thousands of lap records for a race that's 50+ laps in.
  const lapNumbers = intervals
    .map((interval) => interval.lap_number)
    .filter((lap): lap is number => typeof lap === "number" && Number.isFinite(lap));

  const maxLap = lapNumbers.length ? Math.max(...lapNumbers) : null;
  const laps =
    maxLap !== null
      ? await fetchWithRetry(() => getLapsForLapNumbers(session.session_key, [maxLap, maxLap - 1]))
      : await fetchWithRetry(() => getLaps(session.session_key));

  const carData = (
    await Promise.all(
      drivers.slice(0, MAX_CAR_DATA_DRIVERS).map((driver) =>
        getCarData(session.session_key, driver.driver_number).catch((error) => {
          warnings.push(`car data unavailable for ${driver.name_acronym ?? driver.driver_number}: ${error instanceof Error ? error.message : "unknown error"}`);
          return [];
        })
      )
    )
  ).flat();

  return {
    status: "live",
    ...buildTelemetryResponse(session, drivers, laps, intervals),
    telemetry_intelligence: buildTelemetryIntelligence({
      sessionName: session.session_name,
      sessionType: session.session_type ?? "Session",
      status: "live",
      drivers,
      laps,
      stints,
      weather,
      raceControl,
      carData,
    }),
    weekend_schedule,
    warnings,
  };
}

async function refreshTelemetry(): Promise<TelemetryPayload> {
  if (!inFlight) {
    inFlight = (async () => {
      const payload = await buildTelemetryPayload();
      await Promise.all([
        cacheSet(CACHE_KEY_PAYLOAD, payload, STALE_TTL_S),
        cacheSet(CACHE_KEY_FETCHED_AT, Date.now(), STALE_TTL_S),
      ]);
      return payload;
    })();
  }

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const [cachedPayload, lastFetchMs] = await Promise.all([
    cacheGet<TelemetryPayload>(CACHE_KEY_PAYLOAD),
    cacheGet<number>(CACHE_KEY_FETCHED_AT),
  ]);

  try {
    const now = Date.now();

    if (cachedPayload && lastFetchMs && now - lastFetchMs < FRESH_TTL_S * 1000) {
      return NextResponse.json(cachedPayload, {
        status: 200,
        headers: { "x-telemetry-cache": "hit" },
      });
    }

    if (cachedPayload) {
      void refreshTelemetry().catch(() => null);
      return NextResponse.json(cachedPayload, {
        status: 200,
        headers: { "x-telemetry-cache": "stale-while-revalidate" },
      });
    }

    const telemetry = await withTimeout(refreshTelemetry(), TELEMETRY_RESPONSE_TIMEOUT_MS, "Telemetry refresh");
    return NextResponse.json(telemetry, {
      status: 200,
      headers: { "x-telemetry-cache": "miss" },
    });
  } catch {
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        status: 200,
        headers: { "x-telemetry-cache": "stale-on-error" },
      });
    }
    const nextSession = await withTimeout(getNextSession(), FALLBACK_NEXT_SESSION_TIMEOUT_MS, "Next session fallback").catch(() => null);
    return NextResponse.json(
      {
        status: "no_live",
        session: "no-live-session",
        timestamp: Math.floor(Date.now() / 1000),
        drivers: [],
        next_session: nextSession
          ? {
              session_key: nextSession.session_key,
              session_name: nextSession.session_name,
              session_type: nextSession.session_type ?? "Race",
              country_name: nextSession.country_name ?? "",
              location: nextSession.location ?? "",
              circuit_short_name: nextSession.circuit_short_name ?? nextSession.session_name,
              date_start: nextSession.date_start ?? null,
              date_end: nextSession.date_end ?? null,
            }
          : null,
        warnings: ["Telemetry offline fallback response"],
        telemetry_intelligence: buildTelemetryIntelligence({
          sessionName: nextSession?.session_name ?? "No live session",
          sessionType: nextSession?.session_type ?? "Race",
          status: "no_live",
          drivers: [],
          laps: [],
          stints: [],
          weather: [],
          raceControl: [],
          carData: [],
        }),
      },
      { status: 200, headers: { "x-telemetry-cache": "offline-fallback" } }
    );
  }
}
