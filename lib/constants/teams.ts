export type TeamId =
  | "mercedes"
  | "ferrari"
  | "red_bull"
  | "mclaren"
  | "aston_martin"
  | "alpine"
  | "racing_bulls"
  | "haas"
  | "audi"
  | "williams"
  | "cadillac";

export interface TeamMeta {
  id: TeamId;
  shortName: string;
  fullName: string;
  primary: string;
  secondary: string;
  glow: string;
  drivers: string[];
}

const TEAMS_BY_ID: Record<TeamId, TeamMeta> = {
  mercedes: {
    id: "mercedes",
    shortName: "Mercedes",
    fullName: "Mercedes-AMG Petronas F1 Team",
    primary: "#27F4D2",
    secondary: "#00A19B",
    glow: "rgba(39, 244, 210, 0.55)",
    drivers: ["RUS", "ANT"],
  },
  ferrari: {
    id: "ferrari",
    shortName: "Ferrari",
    fullName: "Scuderia Ferrari HP",
    primary: "#E8002D",
    secondary: "#FFD200",
    glow: "rgba(232, 0, 45, 0.55)",
    drivers: ["LEC", "HAM"],
  },
  red_bull: {
    id: "red_bull",
    shortName: "Red Bull",
    fullName: "Oracle Red Bull Racing",
    primary: "#3671C6",
    secondary: "#FFC906",
    glow: "rgba(54, 113, 198, 0.55)",
    drivers: ["VER", "HAD"],
  },
  mclaren: {
    id: "mclaren",
    shortName: "McLaren",
    fullName: "McLaren Formula 1 Team",
    primary: "#FF8000",
    secondary: "#47C7FC",
    glow: "rgba(255, 128, 0, 0.55)",
    drivers: ["NOR", "PIA"],
  },
  aston_martin: {
    id: "aston_martin",
    shortName: "Aston Martin",
    fullName: "Aston Martin Aramco F1 Team",
    primary: "#229971",
    secondary: "#3F1A4D",
    glow: "rgba(34, 153, 113, 0.55)",
    drivers: ["ALO", "STR"],
  },
  alpine: {
    id: "alpine",
    shortName: "Alpine",
    fullName: "BWT Alpine F1 Team",
    primary: "#00A1E8",
    secondary: "#FF87BC",
    glow: "rgba(0, 161, 232, 0.55)",
    drivers: ["GAS", "COL"],
  },
  racing_bulls: {
    id: "racing_bulls",
    shortName: "Racing Bulls",
    fullName: "Visa Cash App Racing Bulls F1 Team",
    primary: "#6692FF",
    secondary: "#1660AD",
    glow: "rgba(102, 146, 255, 0.55)",
    drivers: ["LAW", "LIN"],
  },
  haas: {
    id: "haas",
    shortName: "Haas",
    fullName: "MoneyGram Haas F1 Team",
    primary: "#B6BABD",
    secondary: "#ED1C24",
    glow: "rgba(182, 186, 189, 0.55)",
    drivers: ["OCO", "BEA"],
  },
  audi: {
    id: "audi",
    shortName: "Audi",
    fullName: "Audi F1 Team",
    primary: "#A7ADB1",
    secondary: "#E10600",
    glow: "rgba(167, 173, 177, 0.55)",
    drivers: ["HUL", "BOR"],
  },
  williams: {
    id: "williams",
    shortName: "Williams",
    fullName: "Atlassian Williams Racing",
    primary: "#1868DB",
    secondary: "#04D9D9",
    glow: "rgba(24, 104, 219, 0.55)",
    drivers: ["ALB", "SAI"],
  },
  cadillac: {
    id: "cadillac",
    shortName: "Cadillac",
    fullName: "Cadillac F1 Team",
    primary: "#AAAAAD",
    secondary: "#7A0019",
    glow: "rgba(170, 170, 173, 0.55)",
    drivers: ["PER", "BOT"],
  },
};

const NAME_ALIASES: Record<string, TeamId> = {
  "mercedes": "mercedes",
  "mercedes-amg petronas": "mercedes",
  "mercedes amg petronas formula one team": "mercedes",
  "ferrari": "ferrari",
  "scuderia ferrari": "ferrari",
  "scuderia ferrari hp": "ferrari",
  "red bull": "red_bull",
  "red bull racing": "red_bull",
  "oracle red bull racing": "red_bull",
  "mclaren": "mclaren",
  "mclaren f1 team": "mclaren",
  "aston martin": "aston_martin",
  "aston martin aramco": "aston_martin",
  "aston martin aramco f1 team": "aston_martin",
  "alpine": "alpine",
  "alpine f1 team": "alpine",
  "bwt alpine f1 team": "alpine",
  "racing bulls": "racing_bulls",
  "rb": "racing_bulls",
  "rb f1 team": "racing_bulls",
  "visa cash app rb": "racing_bulls",
  "visa cash app racing bulls f1 team": "racing_bulls",
  "haas": "haas",
  "haas f1 team": "haas",
  "moneygram haas f1 team": "haas",
  "audi": "audi",
  "audi f1 team": "audi",
  "sauber": "audi",
  "kick sauber": "audi",
  "stake f1 team kick sauber": "audi",
  "williams": "williams",
  "williams racing": "williams",
  "atlassian williams racing": "williams",
  "cadillac": "cadillac",
  "cadillac f1 team": "cadillac",
};

export function resolveTeam(rawName: string | null | undefined): TeamMeta | null {
  if (!rawName) return null;
  const key = rawName.trim().toLowerCase();
  const direct = NAME_ALIASES[key];
  if (direct) return TEAMS_BY_ID[direct];
  for (const [alias, id] of Object.entries(NAME_ALIASES)) {
    if (key.includes(alias)) return TEAMS_BY_ID[id];
  }
  return null;
}

export function getTeamById(id: TeamId): TeamMeta {
  return TEAMS_BY_ID[id];
}

export const ALL_TEAMS: readonly TeamMeta[] = Object.values(TEAMS_BY_ID);

export function teamMonogram(team: TeamMeta): string {
  return team.shortName.charAt(0).toUpperCase();
}
