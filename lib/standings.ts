import { cacheGet, cacheSet } from "./cache";
import { DRIVERS } from "./constants/drivers";
import { resolveTeam, type TeamMeta } from "./constants/teams";

const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
const STANDINGS_TTL_SECONDS = 60 * 30; // 30 min

export interface DriverStandingEntry {
  position: number;
  driverCode: string;
  givenName: string;
  familyName: string;
  fullName: string;
  nationality: string;
  points: number;
  wins: number;
  podiums: number | null;
  team: TeamMeta | null;
  rawTeamName: string;
  permanentNumber: number | null;
}

export interface ConstructorStandingEntry {
  position: number;
  team: TeamMeta | null;
  rawTeamName: string;
  points: number;
  wins: number;
  nationality: string;
  drivers: string[];
}

export interface ChampionshipPayload {
  season: string;
  round: string;
  fetchedAt: string;
  drivers: DriverStandingEntry[];
  constructors: ConstructorStandingEntry[];
  warnings: string[];
}

interface JolpicaDriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    permanentNumber?: string;
    code?: string;
    givenName: string;
    familyName: string;
    nationality: string;
  };
  Constructors: { constructorId: string; name: string; nationality: string }[];
}

interface JolpicaConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: { constructorId: string; name: string; nationality: string };
}

interface JolpicaDriverStandingsResponse {
  MRData: {
    StandingsTable: {
      season: string;
      round: string;
      StandingsLists: {
        season: string;
        round: string;
        DriverStandings: JolpicaDriverStanding[];
      }[];
    };
  };
}

interface JolpicaConstructorStandingsResponse {
  MRData: {
    StandingsTable: {
      season: string;
      round: string;
      StandingsLists: {
        season: string;
        round: string;
        ConstructorStandings: JolpicaConstructorStanding[];
      }[];
    };
  };
}

async function fetchJolpica<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Jolpica ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

function deriveCodeFromDriverId(driverId: string): string {
  return driverId.slice(0, 3).toUpperCase();
}

function lookupDriverFullName(code: string, fallback: string): string {
  return DRIVERS[code]?.name ?? fallback;
}

function buildDrivers(raw: JolpicaDriverStanding[]): DriverStandingEntry[] {
  return raw.map((entry) => {
    const code = (entry.Driver.code ?? deriveCodeFromDriverId(entry.Driver.driverId)).toUpperCase();
    const constructor = entry.Constructors[entry.Constructors.length - 1];
    const team = resolveTeam(constructor?.name ?? null);
    const fallbackName = `${entry.Driver.givenName} ${entry.Driver.familyName}`;
    return {
      position: parseInt(entry.position, 10),
      driverCode: code,
      givenName: entry.Driver.givenName,
      familyName: entry.Driver.familyName,
      fullName: lookupDriverFullName(code, fallbackName),
      nationality: entry.Driver.nationality,
      points: Number.parseFloat(entry.points),
      wins: Number.parseInt(entry.wins, 10),
      podiums: null,
      team,
      rawTeamName: constructor?.name ?? "",
      permanentNumber: entry.Driver.permanentNumber ? Number.parseInt(entry.Driver.permanentNumber, 10) : null,
    };
  });
}

function buildConstructors(raw: JolpicaConstructorStanding[]): ConstructorStandingEntry[] {
  return raw.map((entry) => {
    const team = resolveTeam(entry.Constructor.name);
    return {
      position: parseInt(entry.position, 10),
      team,
      rawTeamName: entry.Constructor.name,
      points: Number.parseFloat(entry.points),
      wins: Number.parseInt(entry.wins, 10),
      nationality: entry.Constructor.nationality,
      drivers: team?.drivers ?? [],
    };
  });
}

export async function getChampionshipStandings(
  season: string = "current",
  { force = false }: { force?: boolean } = {}
): Promise<ChampionshipPayload> {
  const cacheKey = `standings:${season}`;
  if (!force) {
    const cached = await cacheGet<ChampionshipPayload>(cacheKey);
    if (cached) return cached;
  }

  const warnings: string[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const [driverRes, constructorRes] = await Promise.all([
      fetchJolpica<JolpicaDriverStandingsResponse>(
        `${JOLPICA_BASE}/${season}/driverStandings.json`,
        controller.signal
      ),
      fetchJolpica<JolpicaConstructorStandingsResponse>(
        `${JOLPICA_BASE}/${season}/constructorStandings.json`,
        controller.signal
      ),
    ]);

    const driverList = driverRes.MRData.StandingsTable.StandingsLists[0];
    const constructorList = constructorRes.MRData.StandingsTable.StandingsLists[0];

    if (!driverList) warnings.push("No driver standings available for the current season.");
    if (!constructorList) warnings.push("No constructor standings available for the current season.");

    const payload: ChampionshipPayload = {
      season: driverList?.season ?? constructorList?.season ?? season,
      round: driverList?.round ?? constructorList?.round ?? "0",
      fetchedAt: new Date().toISOString(),
      drivers: buildDrivers(driverList?.DriverStandings ?? []),
      constructors: buildConstructors(constructorList?.ConstructorStandings ?? []),
      warnings,
    };

    await cacheSet(cacheKey, payload, STANDINGS_TTL_SECONDS);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
