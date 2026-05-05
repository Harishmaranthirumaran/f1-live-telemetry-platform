import type { DashboardData, DriverPosition, SeasonRace } from '../types/f1';
import { DRIVERS } from '../../lib/constants/drivers';

interface JolpicaSeasonResponse {
  MRData: {
    RaceTable: {
      Races: SeasonRace[];
    };
  };
}

interface JolpicaResult {
  position: string;
  number: string;
  grid: string;
  status: string;
  Time?: {
    time: string;
  };
  FastestLap?: {
    rank?: string;
    lap?: string;
    Time?: {
      time: string;
    };
  };
  Driver: {
    code?: string;
    givenName: string;
    familyName: string;
  };
  Constructor: {
    name: string;
  };
}

interface JolpicaRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      country: string;
    };
  };
  Results: JolpicaResult[];
}

interface JolpicaResultsResponse {
  MRData: {
    RaceTable: {
      Races: JolpicaRace[];
    };
  };
}

export type CompletedRaceSummary = {
  raceName: string;
  round: string;
  date: string;
  circuitName: string;
  country: string;
  podium: {
    position: number;
    code: string;
    fullName: string;
    teamName: string;
    status: string;
  }[];
  fastestLap: {
    code: string;
    fullName: string;
    teamName: string;
    time: string;
    lap?: string;
  } | null;
};

// Fetching historical completed race data from Jolpica (Ergast replacement)

export async function fetchSeasonRaces(year: string): Promise<SeasonRace[]> {
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`);
    if (!response.ok) {
      throw new Error('Jolpica API Failed');
    }

    const json = (await response.json()) as JolpicaSeasonResponse;
    return json.MRData.RaceTable.Races || [];
  } catch (err: unknown) {
    void err;
    return [];
  }
}

export async function fetchHistoricalData(year?: string, round?: string): Promise<DashboardData> {
  try {
    let endpoint = 'https://api.jolpi.ca/ergast/f1/current/last/results.json';

    if (year && round) {
      endpoint = `https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error('Jolpica API Failed');
    }

    const json = (await response.json()) as JolpicaResultsResponse;
    const race = json.MRData.RaceTable.Races[0];

    if (!race) {
      throw new Error('No completed race data found for this selection.');
    }

    let maxBestLap = '--:--.---';
    let maxGrid = '--';

    const mappedLeaderboard: DriverPosition[] = race.Results.map((result) => {
      const code = result.Driver.code || 'UKN';
      const meta = DRIVERS[code] || {
        color: '#ffffff',
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor.name,
      };

      if (code === 'VER') {
        maxGrid = result.grid;
        if (result.FastestLap?.Time?.time) {
          maxBestLap = result.FastestLap.Time.time;
        }
      }

      return {
        position: parseInt(result.position, 10),
        driver_number: parseInt(result.number, 10),
        name_acronym: code,
        full_name: meta.name,
        team_name: result.Constructor.name,
        team_colour: meta.color,
        date: result.status === 'Finished' && result.Time ? result.Time.time : result.status,
        interval: null,
        last_lap: result.FastestLap?.Time?.time ?? null,
        tyre: null,
        lap_number: null,
      };
    });

    return {
      session: {
        session_key: race.round,
        session_name: race.raceName,
        session_type: 'Historical Race',
        country_name: race.Circuit.Location.country,
        location: race.Circuit.circuitName,
        circuit_short_name: race.Circuit.circuitId,
        date_start: `${race.date}T${race.time || '00:00:00Z'}`,
        current_lap: 'FINISHED',
      },
      leaderboard: mappedLeaderboard,
      max_stats: {
        best_lap: maxBestLap,
        top_speed: 'UNAVAILABLE',
        started: `P${maxGrid}`,
        tyres: 'STATIC DATA',
      },
      live_status: 'LIVE',
      next_session: null,
    };
  } catch (err: unknown) {
    throw new Error('Unable to load latest completed race from Jolpica.', { cause: err });
  }
}

function getDriverDisplay(result: JolpicaResult) {
  const code = result.Driver.code || 'UKN';
  const meta = DRIVERS[code] || {
    color: '#ffffff',
    name: `${result.Driver.givenName} ${result.Driver.familyName}`,
    team: result.Constructor.name,
  };

  return {
    code,
    fullName: meta.name,
    teamName: result.Constructor.name,
  };
}

export async function fetchLatestCompletedRaceSummary(): Promise<CompletedRaceSummary> {
  return fetchCompletedRaceSummaryFromEndpoint('https://api.jolpi.ca/ergast/f1/current/last/results.json');
}

async function fetchCompletedRaceSummaryFromEndpoint(endpoint: string): Promise<CompletedRaceSummary> {
  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Jolpica API Failed');
    }

    const json = (await response.json()) as JolpicaResultsResponse;
    const race = json.MRData.RaceTable.Races[0];

    if (!race) {
      throw new Error('No completed race data found.');
    }

    const podium = race.Results.slice(0, 3).map((result) => ({
      position: parseInt(result.position, 10),
      ...getDriverDisplay(result),
      status: result.status === 'Finished' && result.Time ? result.Time.time : result.status,
    }));

    const fastestLapResult = race.Results
      .filter((result) => result.FastestLap?.Time?.time)
      .sort((a, b) => {
        const aRank = Number(a.FastestLap?.rank ?? Number.POSITIVE_INFINITY);
        const bRank = Number(b.FastestLap?.rank ?? Number.POSITIVE_INFINITY);
        return aRank - bRank;
      })[0];

    const fastestLap = fastestLapResult?.FastestLap?.Time?.time
      ? {
          ...getDriverDisplay(fastestLapResult),
          time: fastestLapResult.FastestLap.Time.time,
          lap: fastestLapResult.FastestLap.lap,
        }
      : null;

    return {
      raceName: race.raceName,
      round: race.round,
      date: race.date,
      circuitName: race.Circuit.circuitName,
      country: race.Circuit.Location.country,
      podium,
      fastestLap,
    };
  } catch (err: unknown) {
    throw new Error('Unable to load completed race summary from Jolpica.', { cause: err });
  }
}

function normalizeRaceName(value: string) {
  return value.toLowerCase().replace(/grand prix|gp/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function fetchRaceSummary(year: string, round: string): Promise<CompletedRaceSummary> {
  return fetchCompletedRaceSummaryFromEndpoint(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`);
}

export async function fetchPreviousEditionRaceSummary(grandPrix: string, currentYear: number): Promise<CompletedRaceSummary> {
  const targetYear = String(currentYear - 1);
  const search = normalizeRaceName(grandPrix);
  const races = await fetchSeasonRaces(targetYear);
  const match = races.find((race) => {
    const raceName = 'raceName' in race && typeof race.raceName === 'string' ? race.raceName : '';
    const normalized = normalizeRaceName(raceName);
    return search.split(' ').every((part) => normalized.includes(part)) || normalized.includes(search) || search.includes(normalized);
  });

  if (!match?.round) {
    throw new Error(`No previous edition found for ${grandPrix} in ${targetYear}.`);
  }

  return fetchRaceSummary(targetYear, match.round);
}
