export type OpenF1Session = {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end?: string | null;
  circuit_short_name?: string | null;
  country_name?: string | null;
  location?: string | null;
  meeting_key?: number | null;
  circuit_key?: number | null;
  session_type?: string | null;
  year?: number | null;
};

export type OpenF1Meeting = {
  meeting_key: number;
  meeting_name?: string | null;
  date_start: string;
  date_end?: string | null;
  circuit_short_name?: string | null;
  country_name?: string | null;
  location?: string | null;
  year?: number | null;
};

export type OpenF1Driver = {
  driver_number: number;
  name_acronym?: string | null;
  full_name?: string | null;
  broadcast_name?: string | null;
  team_name?: string | null;
  team_colour?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headshot_url?: string | null;
  country_code?: string | null;
};

export type OpenF1Lap = {
  driver_number: number;
  lap_number: number;
  lap_duration?: number | null;
  duration_sector_1?: number | null;
  duration_sector_2?: number | null;
  duration_sector_3?: number | null;
  position?: number | null;
  date_start?: string | null;
  compound?: string | null;
  is_pit_out_lap?: boolean | null;
};

export type OpenF1Interval = {
  driver_number: number;
  gap_to_leader?: string | number | null;
  interval?: string | number | null;
  date?: string | null;
  lap_number?: number | null;
};

export type OpenF1RaceControl = {
  date: string;
  category?: string | null;
  flag?: string | null;
  message?: string | null;
  lap_number?: number | null;
  driver_number?: number | null;
};

export type OpenF1Stint = {
  session_key: number;
  driver_number: number;
  compound?: string | null;
  lap_start?: number | null;
  lap_end?: number | null;
  stint_number?: number | null;
  tyre_age_at_start?: number | null;
};

export type OpenF1CarData = {
  session_key: number;
  driver_number: number;
  date: string;
  speed?: number | null;
  throttle?: number | null;
  brake?: number | null;
  drs?: number | null;
};

export type OpenF1Weather = {
  session_key: number;
  date: string;
  air_temperature?: number | null;
  track_temperature?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  rainfall?: number | null;
  wind_direction?: number | null;
  wind_speed?: number | null;
};

export type OpenF1TeamRadio = {
  session_key: number;
  date: string;
  driver_number?: number | null;
  recording_url?: string | null;
  transcript?: string | null;
  message?: string | null;
};

const BASE_URL = "https://api.openf1.org/v1/";

/**
 * Thrown when OpenF1 returns its live-session lockout response.
 * Callers can catch this specifically to show a "race in progress" UI
 * rather than treating it as a generic error.
 */
export class OpenF1LiveLockError extends Error {
  readonly isLiveLock = true;
  constructor(detail?: string) {
    super(detail ?? "OpenF1 API is locked during a live session");
    this.name = "OpenF1LiveLockError";
  }
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 8_000;

async function fetchOpenF1<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = buildUrl(path, params);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store", signal: controller.signal });
    } catch (error) {
      clearTimeout(timeoutId);

      const retryable = error instanceof DOMException && error.name === "AbortError";
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(`OpenF1 request failed: ${url}`, { cause: error });
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      const json = await response.json();
      // OpenF1 returns HTTP 200 with {"detail":"Live F1 session..."} during
      // a live race to gate unauthenticated access. Treat this as a lockout.
      if (json && typeof json === "object" && !Array.isArray(json) && "detail" in json) {
        const detail = String((json as Record<string, unknown>).detail ?? "");
        if (detail.toLowerCase().includes("live f1 session")) {
          throw new OpenF1LiveLockError(detail);
        }
      }
      return json as T;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`OpenF1 request failed (${response.status}): ${url}`);
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
  }

  // Unreachable — loop always throws above
  throw new Error(`OpenF1 request failed after retries: ${url}`);
}

export async function getLatestRaceSession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();
  let sessions: OpenF1Session[] = [];

  try {
    sessions = await fetchOpenF1<OpenF1Session[]>("/sessions", {
      year,
      session_name: "Race",
    });
  } catch {
    sessions = [];
  }

  if (!sessions.length) {
    try {
      sessions = await fetchOpenF1<OpenF1Session[]>("/sessions", {
        session_name: "Race",
      });
    } catch {
      sessions = [];
    }
  }

  if (!sessions.length) return null;

  const nowTs = now.getTime();
  const sorted = sessions
    .filter((session) => (session.date_start ? Date.parse(session.date_start) <= nowTs : true))
    .sort((a, b) => {
      const aTs = a.date_start ? Date.parse(a.date_start) : 0;
      const bTs = b.date_start ? Date.parse(b.date_start) : 0;
      return bTs - aTs;
    });

  return sorted[0] ?? sessions[0] ?? null;
}

export async function getCurrentSession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();
  let sessions: OpenF1Session[] = [];

  try {
    sessions = await fetchOpenF1<OpenF1Session[]>("/sessions", { year });
  } catch {
    sessions = [];
  }

  if (!sessions.length) {
    try {
      sessions = await fetchOpenF1<OpenF1Session[]>("/sessions");
    } catch {
      sessions = [];
    }
  }

  const nowTs = now.getTime();
  return sessions
    .filter((session) => {
      if (!session.date_start) return false;
      const startTs = Date.parse(session.date_start);
      const endTs = session.date_end ? Date.parse(session.date_end) : startTs + 3 * 60 * 60 * 1000;
      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return false;
      return startTs <= nowTs && nowTs <= endTs + 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))[0] ?? null;
}

export async function getNextRaceSession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();

  const fetchYear = async (targetYear: number) => {
    try {
      return await fetchOpenF1<OpenF1Session[]>("/sessions", {
        year: targetYear,
        session_name: "Race",
      });
    } catch {
      return [] as OpenF1Session[];
    }
  };

  const sessionsThisYear = await fetchYear(year);
  const nextInYear = sessionsThisYear
    .filter((session) => (session.date_start ? Date.parse(session.date_start) > now.getTime() : false))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0];

  if (nextInYear) return nextInYear;

  const sessionsNextYear = await fetchYear(year + 1);
  return sessionsNextYear
    .filter((session) => session.date_start)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
}

export async function getCurrentOrNextRaceSession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();
  const fetchYear = async (targetYear: number) => {
    try {
      return await fetchOpenF1<OpenF1Session[]>("/sessions", {
        year: targetYear,
        session_name: "Race",
      });
    } catch {
      return [] as OpenF1Session[];
    }
  };

  const sessions = [...await fetchYear(year), ...await fetchYear(year + 1)]
    .filter((session) => session.date_start)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  const nowTs = now.getTime();
  const keepCurrentRaceUntilMs = 12 * 60 * 60 * 1000;

  return sessions.find((session) => {
    const startTs = Date.parse(session.date_start);
    const endTs = session.date_end ? Date.parse(session.date_end) : startTs + 3 * 60 * 60 * 1000;
    return nowTs <= endTs + keepCurrentRaceUntilMs;
  }) ?? null;
}

/**
 * Returns the next upcoming session of ANY type (Practice, Qualifying, Sprint, Race)
 * across this year and next. Used for schedule display and backdrop context.
 */
export async function getNextAnySession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();
  const fetchYear = async (targetYear: number) => {
    try {
      return await fetchOpenF1<OpenF1Session[]>("/sessions", { year: targetYear });
    } catch {
      return [] as OpenF1Session[];
    }
  };

  const sessionsThisYear = await fetchYear(year);
  const nextInYear = sessionsThisYear
    .filter((s) => s.date_start && Date.parse(s.date_start) > now.getTime())
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0];

  if (nextInYear) return nextInYear;

  const sessionsNextYear = await fetchYear(year + 1);
  return sessionsNextYear
    .filter((s) => s.date_start)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
}

/**
 * Returns all sessions for the current or next race weekend (same meeting_key).
 * Sorted chronologically. Used to show the full weekend timetable.
 */
export async function getWeekendSchedule(now = new Date()): Promise<OpenF1Session[]> {
  const year = now.getUTCFullYear();

  let allSessions: OpenF1Session[] = [];
  try {
    allSessions = await fetchOpenF1<OpenF1Session[]>("/sessions", { year });
  } catch {
    return [];
  }

  if (!allSessions.length) return [];

  const sorted = allSessions
    .filter((s) => s.date_start)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));

  const nowTs = now.getTime();
  const weekendWindowMs = 7 * 24 * 60 * 60 * 1000;

  // Find the meeting_key of the current or next event
  // "Current" = any session whose window overlaps now (within 1h after end)
  // "Next" = first future session if no live event
  const liveSession = sorted.find((s) => {
    const start = Date.parse(s.date_start);
    const end = s.date_end ? Date.parse(s.date_end) : start + 3 * 60 * 60 * 1000;
    return start <= nowTs && nowTs <= end + 60 * 60 * 1000;
  });

  const anchorSession = liveSession ?? sorted.find((s) => Date.parse(s.date_start) > nowTs - weekendWindowMs);
  if (!anchorSession?.meeting_key) return [];

  const meetingKey = anchorSession.meeting_key;
  return sorted.filter((s) => s.meeting_key === meetingKey);
}

export async function getNextSession(now = new Date()): Promise<OpenF1Session | null> {
  const year = now.getUTCFullYear();

  const fetchYear = async (targetYear: number) => {
    try {
      return await fetchOpenF1<OpenF1Session[]>("/sessions", { year: targetYear });
    } catch {
      return [] as OpenF1Session[];
    }
  };

  const sessionsThisYear = await fetchYear(year);
  const nextInYear = sessionsThisYear
    .filter((session) => (session.date_start ? Date.parse(session.date_start) > now.getTime() : false))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0];

  if (nextInYear) return nextInYear;

  const sessionsNextYear = await fetchYear(year + 1);
  return sessionsNextYear
    .filter((session) => session.date_start)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))[0] ?? null;
}

export async function getDrivers(sessionKey: number) {
  return fetchOpenF1<OpenF1Driver[]>("/drivers", { session_key: sessionKey });
}

export async function getMeetings(year: number) {
  return fetchOpenF1<OpenF1Meeting[]>("/meetings", { year });
}

export async function getSessionsForMeeting(meetingKey: number) {
  return fetchOpenF1<OpenF1Session[]>("/sessions", { meeting_key: meetingKey });
}

export async function getSessions(year: number) {
  return fetchOpenF1<OpenF1Session[]>("/sessions", { year });
}

export async function getRaceSessions(year: number) {
  let sessions: OpenF1Session[] = [];
  try {
    sessions = await fetchOpenF1<OpenF1Session[]>("/sessions", { year, session_name: "Race" });
  } catch {
    sessions = [];
  }

  if (!sessions.length) {
    try {
      sessions = await fetchOpenF1<OpenF1Session[]>("/sessions", { session_name: "Race" });
      const filtered = sessions.filter((session) => session.year === year);
      if (filtered.length) return filtered;
    } catch {
      sessions = [];
    }
  }

  return sessions;
}

export async function getLaps(sessionKey: number) {
  return fetchOpenF1<OpenF1Lap[]>("/laps", { session_key: sessionKey });
}

export async function getLapsForLapNumbers(sessionKey: number, lapNumbers: number[]) {
  const uniqueLapNumbers = Array.from(new Set(lapNumbers)).filter((lap) => lap >= 0);
  if (!uniqueLapNumbers.length) return [];

  const results = await Promise.all(
    uniqueLapNumbers.map((lap_number) =>
      fetchOpenF1<OpenF1Lap[]>("/laps", { session_key: sessionKey, lap_number })
    )
  );

  return results.flat();
}

export async function getIntervals(sessionKey: number) {
  return fetchOpenF1<OpenF1Interval[]>("/intervals", { session_key: sessionKey });
}

/**
 * Fetch only intervals recorded after `afterDate` (ISO string).
 * Uses OpenF1's `date>` inequality filter to reduce payload size during long races.
 * Falls back to empty array on error — callers should fall back to getIntervals().
 */
export async function getRecentIntervals(sessionKey: number, afterDate: string): Promise<OpenF1Interval[]> {
  // Build the URL manually so the `>` operator is not URL-encoded as a param value
  const url = `${BASE_URL}intervals?session_key=${sessionKey}&date>${encodeURIComponent(afterDate)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`getRecentIntervals failed (${response.status})`);
    return response.json() as Promise<OpenF1Interval[]>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getRaceControl(sessionKey: number) {
  return fetchOpenF1<OpenF1RaceControl[]>("/race_control", { session_key: sessionKey });
}

export async function getStints(sessionKey: number) {
  return fetchOpenF1<OpenF1Stint[]>("/stints", { session_key: sessionKey });
}

export async function getCarData(sessionKey: number, driverNumber?: number) {
  return fetchOpenF1<OpenF1CarData[]>("/car_data", {
    session_key: sessionKey,
    driver_number: driverNumber,
  });
}

export async function getWeather(sessionKey: number) {
  return fetchOpenF1<OpenF1Weather[]>("/weather", { session_key: sessionKey });
}

export async function getTeamRadio(sessionKey: number) {
  return fetchOpenF1<OpenF1TeamRadio[]>("/team_radio", { session_key: sessionKey });
}

export type OpenF1Position = {
  driver_number: number;
  date: string;
  x: number | null;
  y: number | null;
};

export async function getSessionPositions(sessionKey: number | string) {
  return fetchOpenF1<OpenF1Position[]>("/position", { session_key: sessionKey });
}
