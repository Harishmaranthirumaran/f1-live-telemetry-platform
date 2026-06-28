"use client";

import { Shield } from "lucide-react";
import type { ClientConstructorStanding } from "../../services/standings";
import TeamCrest from "./TeamCrest";

interface LiveConstructorsChampionshipProps {
  constructors: ClientConstructorStanding[];
  season: string;
  round: string;
  loading?: boolean;
  error?: string | null;
}

function formatPoints(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

export default function LiveConstructorsChampionship({
  constructors,
  season,
  round,
  loading = false,
  error = null,
}: LiveConstructorsChampionshipProps) {
  const leaderPoints = constructors[0]?.points ?? 0;
  const maxPoints = Math.max(leaderPoints, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", height: "100%" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid var(--border-light, rgba(255,255,255,0.08))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Shield size={16} color="#FFD200" />
          <strong
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.16em",
              color: "var(--accent-cyan, #27F4D2)",
              textTransform: "uppercase",
            }}
          >
            Constructors Championship
          </strong>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.68rem",
            color: "var(--text-muted, #8b95a4)",
            letterSpacing: "0.08em",
          }}
        >
          {season} · R{round}
        </span>
      </header>

      {error && (
        <div style={{ color: "#ef4444", fontSize: "0.78rem", padding: "0.5rem 0" }}>{error}</div>
      )}

      {!error && loading && constructors.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>
          Loading standings…
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {constructors.map((row) => {
          const primary = row.team?.primary ?? "#5e6b73";
          const secondary = row.team?.secondary ?? "#0d1117";
          const isLeader = row.position === 1;
          const pct = Math.min(100, Math.round((row.points / maxPoints) * 100));
          const gapToLeader = leaderPoints - row.points;

          return (
            <div
              key={(row.team?.id ?? row.rawTeamName) + row.position}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "32px 44px 1fr auto",
                gap: "0.65rem",
                alignItems: "center",
                padding: "0.6rem 0.7rem",
                borderRadius: 10,
                background: `linear-gradient(90deg, ${primary}1f 0%, transparent ${pct}%)`,
                border: `1px solid ${isLeader ? primary + "66" : "rgba(255,255,255,0.05)"}`,
                borderLeft: `3px solid ${primary}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(180deg, transparent 0%, ${secondary}08 100%)`,
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  color: isLeader ? "#FFD200" : "var(--text-primary, #f8fafc)",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                {row.position}
              </span>
              <TeamCrest team={row.team} fallback={row.rawTeamName} size={36} />
              <div style={{ position: "relative", display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    color: "var(--text-primary, #f8fafc)",
                    fontSize: "0.92rem",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.team?.fullName ?? row.rawTeamName}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.68rem",
                    color: primary,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {row.drivers.length > 0 ? row.drivers.join(" · ") : row.nationality}
                  {row.wins > 0 ? `  ·  ${row.wins} WIN${row.wins > 1 ? "S" : ""}` : ""}
                </span>
              </div>
              <div style={{ position: "relative", textAlign: "right", minWidth: 72 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    color: "var(--text-primary, #f8fafc)",
                    lineHeight: 1.1,
                  }}
                >
                  {formatPoints(row.points)}
                </div>
                {!isLeader && gapToLeader > 0 && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.66rem",
                      color: "var(--text-muted, #8b95a4)",
                    }}
                  >
                    −{formatPoints(gapToLeader)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && !error && constructors.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>
            No standings data yet — season pending.
          </div>
        )}
      </div>
    </div>
  );
}
