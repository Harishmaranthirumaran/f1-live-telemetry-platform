"use client";

import { Trophy } from "lucide-react";
import type { ClientDriverStanding } from "../../services/standings";
import DriverAvatar from "./DriverAvatar";

interface LiveDriversChampionshipProps {
  drivers: ClientDriverStanding[];
  season: string;
  round: string;
  loading?: boolean;
  error?: string | null;
}

function formatPoints(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

export default function LiveDriversChampionship({
  drivers,
  season,
  round,
  loading = false,
  error = null,
}: LiveDriversChampionshipProps) {
  const leader = drivers[0];

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
          <Trophy size={16} color="#FFD200" />
          <strong
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.16em",
              color: "var(--accent-cyan, #27F4D2)",
              textTransform: "uppercase",
            }}
          >
            Drivers Championship
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
        <div style={{ color: "#ef4444", fontSize: "0.78rem", padding: "0.5rem 0" }}>
          {error}
        </div>
      )}

      {!error && loading && drivers.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>
          Loading standings…
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {drivers.map((row) => {
          const primary = row.team?.primary ?? "#5e6b73";
          const isLeader = row === leader;
          const leaderGap = leader ? leader.points - row.points : 0;

          return (
            <div
              key={row.driverCode + row.position}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 48px 1fr auto auto",
                gap: "0.6rem",
                alignItems: "center",
                padding: "0.5rem 0.6rem",
                borderRadius: 8,
                background: isLeader
                  ? `linear-gradient(90deg, ${primary}26 0%, transparent 60%)`
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${isLeader ? primary + "55" : "rgba(255,255,255,0.05)"}`,
                borderLeft: `3px solid ${primary}`,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: isLeader ? "#FFD200" : "var(--text-primary, #f8fafc)",
                  textAlign: "center",
                }}
              >
                {row.position}
              </span>
              <DriverAvatar
                code={row.driverCode}
                team={row.team}
                size={36}
                permanentNumber={row.permanentNumber}
              />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    color: "var(--text-primary, #f8fafc)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.fullName}
                </span>
                <span
                  style={{
                    color: primary,
                    fontSize: "0.7rem",
                    letterSpacing: "0.04em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.team?.shortName ?? row.rawTeamName}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.74rem",
                  color: "var(--text-muted, #8b95a4)",
                  textAlign: "right",
                }}
              >
                {row.wins}W
              </span>
              <div style={{ textAlign: "right", minWidth: 60 }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--text-primary, #f8fafc)",
                    lineHeight: 1.1,
                  }}
                >
                  {formatPoints(row.points)}
                </div>
                {!isLeader && leaderGap > 0 && (
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.66rem",
                      color: "var(--text-muted, #8b95a4)",
                    }}
                  >
                    −{formatPoints(leaderGap)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && !error && drivers.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", padding: "0.5rem 0" }}>
            No standings data yet — season pending.
          </div>
        )}
      </div>
    </div>
  );
}
