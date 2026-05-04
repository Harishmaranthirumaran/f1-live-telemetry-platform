import type { OpenF1Driver, OpenF1Interval, OpenF1Lap, OpenF1Session } from "./openf1";
import { DEFAULT_DRIVER_COLOR, DRIVERS } from "./constants/drivers";

export type TelemetryDriver = {
  code: string;
  name: string;
  team: string;
  color: string;
  position: number | null;
  lap: number | null;
  lapTime: number | null;
  deltaToBest: number | null;
  /** Formatted gap to leader: "LEADER", "+1.234", "+1L" */
  gapToLeader: string | null;
  /** Formatted gap to car directly ahead: "+0.456", "+1L", or null for leader */
  intervalGap: string | null;
  compound: string | null;
  sectors: [number | null, number | null, number | null];
  stint: number | null;
};

export type TelemetryResponse = {
  session: string;
  timestamp: number;
  drivers: TelemetryDriver[];
};

/** Format an OpenF1 gap/interval value into a display string. */
function formatGapString(
  value: string | number | null | undefined,
  isLeader: boolean
): string | null {
  if (isLeader) return "LEADER";
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (value === 0) return "LEADER";
    return `+${Math.abs(value).toFixed(3)}`;
  }

  const str = String(value).trim();
  if (str === "" || str === "0" || str === "0.000") return "LEADER";

  // Lapped cars: "1 LAP", "+1 LAP", "1L", "2 LAPS"
  if (/lap/i.test(str)) {
    const lapMatch = str.match(/\d+/);
    const lapCount = lapMatch ? Number(lapMatch[0]) : 1;
    return `+${lapCount}L`;
  }

  // Regular time gap — always show with +
  const numMatch = str.match(/\d*\.?\d+/);
  if (!numMatch) return str;
  const num = Number(numMatch[0]);
  if (!Number.isFinite(num)) return str;
  return `+${num.toFixed(3)}`;
}

function pickLatestLap(laps: OpenF1Lap[]) {
  const latest = new Map<number, OpenF1Lap>();
  for (const lap of laps) {
    const existing = latest.get(lap.driver_number);
    if (!existing) {
      latest.set(lap.driver_number, lap);
      continue;
    }
    if (lap.lap_number > existing.lap_number) {
      latest.set(lap.driver_number, lap);
      continue;
    }
    if (lap.lap_number === existing.lap_number) {
      const lapTs = lap.date_start ? Date.parse(lap.date_start) : 0;
      const existingTs = existing.date_start ? Date.parse(existing.date_start) : 0;
      if (lapTs > existingTs) latest.set(lap.driver_number, lap);
    }
  }
  return latest;
}

function pickLatestInterval(intervals: OpenF1Interval[]) {
  const latest = new Map<number, OpenF1Interval>();
  for (const interval of intervals) {
    const existing = latest.get(interval.driver_number);
    if (!existing) {
      latest.set(interval.driver_number, interval);
      continue;
    }
    const lapNumber = interval.lap_number ?? -1;
    const existingLap = existing.lap_number ?? -1;
    if (lapNumber > existingLap) {
      latest.set(interval.driver_number, interval);
      continue;
    }
    if (lapNumber === existingLap) {
      const intervalTs = interval.date ? Date.parse(interval.date) : 0;
      const existingTs = existing.date ? Date.parse(existing.date) : 0;
      if (intervalTs > existingTs) latest.set(interval.driver_number, interval);
    }
  }
  return latest;
}

/**
 * Derive race positions from intervals when lap.position is unavailable.
 * Leader has gap_to_leader = 0 or null. Lapped drivers go to the back.
 */
function derivePositionsFromIntervals(
  intervals: Map<number, OpenF1Interval>
): Map<number, number> {
  const parsed = Array.from(intervals.entries()).map(([driverNumber, interval]) => {
    const raw = interval.gap_to_leader;
    if (raw === null || raw === undefined) return { driverNumber, gap: 0 };
    if (typeof raw === "number") return { driverNumber, gap: raw };
    const str = String(raw).trim();
    if (str === "" || str === "0" || str === "0.000") return { driverNumber, gap: 0 };
    if (/lap/i.test(str)) {
      const lapMatch = str.match(/\d+/);
      return { driverNumber, gap: 10000 + (lapMatch ? Number(lapMatch[0]) : 1) };
    }
    const numMatch = str.match(/\d*\.?\d+/);
    return { driverNumber, gap: numMatch ? Number(numMatch[0]) : 99999 };
  });

  parsed.sort((a, b) => a.gap - b.gap);
  return new Map(parsed.map(({ driverNumber }, index) => [driverNumber, index + 1]));
}

export function buildTelemetryResponse(
  session: OpenF1Session,
  drivers: OpenF1Driver[],
  laps: OpenF1Lap[],
  intervals: OpenF1Interval[]
): TelemetryResponse {
  const latestLaps = pickLatestLap(laps);
  const latestIntervals = pickLatestInterval(intervals);
  const derivedPositions = derivePositionsFromIntervals(latestIntervals);

  const lapTimes = Array.from(latestLaps.values())
    .map((lap) => lap.lap_duration)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const bestLap = lapTimes.length ? Math.min(...lapTimes) : null;

  const driverRows: TelemetryDriver[] = drivers.map((driver) => {
    const lap = latestLaps.get(driver.driver_number);
    const interval = latestIntervals.get(driver.driver_number);

    const code =
      driver.name_acronym || driver.broadcast_name || driver.full_name || String(driver.driver_number);
    const driverMeta = DRIVERS[code];

    const lapTime = lap?.lap_duration ?? null;
    const sectors: [number | null, number | null, number | null] = [
      lap?.duration_sector_1 ?? null,
      lap?.duration_sector_2 ?? null,
      lap?.duration_sector_3 ?? null,
    ];

    const deltaToBest =
      lapTime !== null && bestLap !== null && Number.isFinite(lapTime)
        ? Number((lapTime - bestLap).toFixed(3))
        : null;

    // Prefer lap.position; fall back to interval-derived order
    const position = lap?.position ?? derivedPositions.get(driver.driver_number) ?? null;
    const isLeader = position === 1;

    return {
      code,
      name: driverMeta?.name || driver.full_name || driver.broadcast_name || code,
      team: driverMeta?.team || driver.team_name || "Unknown",
      color: driverMeta?.color || driver.team_colour?.replace("#", "") || DEFAULT_DRIVER_COLOR,
      position,
      lap: lap?.lap_number ?? null,
      lapTime: lapTime !== null ? Number(lapTime.toFixed(3)) : null,
      deltaToBest,
      gapToLeader: formatGapString(interval?.gap_to_leader ?? null, isLeader),
      intervalGap: isLeader ? null : formatGapString(interval?.interval ?? null, false),
      compound: lap?.compound ?? null,
      sectors: sectors.map((v) => (v !== null ? Number(v.toFixed(3)) : null)) as [
        number | null,
        number | null,
        number | null,
      ],
      stint: null,
    };
  });

  const sortedDrivers = driverRows.sort((a, b) => {
    if (a.position === null && b.position === null) return 0;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  const sessionYear =
    session.year ?? (session.date_start ? new Date(session.date_start).getUTCFullYear() : undefined);
  const sessionSlugBase = `${session.circuit_short_name || session.session_name}`.trim();
  const slug = `${sessionYear ?? "unknown"}-${sessionSlugBase}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return {
    session: slug,
    timestamp: Math.floor(Date.now() / 1000),
    drivers: sortedDrivers,
  };
}
