import type { TeamMeta } from "../../lib/constants/teams";

export interface ClientDriverStanding {
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

export interface ClientConstructorStanding {
  position: number;
  team: TeamMeta | null;
  rawTeamName: string;
  points: number;
  wins: number;
  nationality: string;
  drivers: string[];
}

export interface ClientChampionships {
  season: string;
  round: string;
  fetchedAt: string;
  drivers: ClientDriverStanding[];
  constructors: ClientConstructorStanding[];
  warnings: string[];
  error?: string;
}

export async function fetchChampionshipStandings(season: string = "current"): Promise<ClientChampionships> {
  const response = await fetch(`/api/standings?season=${encodeURIComponent(season)}`, { cache: "no-store" });
  const payload = (await response.json()) as ClientChampionships;
  return payload;
}
