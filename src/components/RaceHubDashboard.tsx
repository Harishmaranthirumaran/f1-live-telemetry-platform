"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, Clock, MapPin, Trophy, Shield, Calendar, Zap } from "lucide-react";
import type { ClientDriverStanding, ClientConstructorStanding } from "../services/standings";

interface WeekendSession {
  session_key: number;
  session_name: string;
  session_type: string | null;
  date_start: string;
  date_end: string | null;
  country_name: string | null;
  location: string | null;
  circuit_short_name: string | null;
  meeting_key: number | null;
}

interface WeekendPayload {
  sessions: WeekendSession[];
  grand_prix_name: string | null;
  country_name: string | null;
  location: string | null;
}

interface RaceHubDashboardProps {
  drivers: ClientDriverStanding[];
  constructors: ClientConstructorStanding[];
  season: string;
  round: string;
  standingsLoading: boolean;
}

function useCountdown(targetIso: string | null) {
  const getRemaining = useCallback(() => {
    if (!targetIso) return null;
    const diff = Date.parse(targetIso) - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs, diff };
  }, [targetIso]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, [getRemaining]);

  return remaining;
}

function formatLocalTime(isoString: string, tz?: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleString();
  }
}

function sessionTypeLabel(type: string | null, name: string): string {
  if (!type) return name;
  const t = type.toLowerCase();
  if (t.includes("race") && !t.includes("sprint")) return "Race";
  if (t.includes("sprint_shootout") || t.includes("sprint qualifying")) return "Sprint Quali";
  if (t.includes("sprint")) return "Sprint";
  if (t.includes("qualifying")) return "Qualifying";
  if (t.includes("practice 1")) return "FP1";
  if (t.includes("practice 2")) return "FP2";
  if (t.includes("practice 3")) return "FP3";
  if (t.includes("practice")) return name.replace(/practice/i, "FP").replace("FP ", "FP");
  return name;
}

function sessionTypeColor(type: string | null): string {
  if (!type) return "var(--text-secondary)";
  const t = type.toLowerCase();
  if (t.includes("race") && !t.includes("sprint")) return "#E8002D";
  if (t.includes("sprint")) return "#FF8000";
  if (t.includes("qualifying")) return "#27F4D2";
  if (t.includes("practice")) return "rgba(255,255,255,0.45)";
  return "var(--text-secondary)";
}

function isSessionLive(s: WeekendSession, now: number): boolean {
  const start = Date.parse(s.date_start);
  const end = s.date_end ? Date.parse(s.date_end) : start + 3 * 60 * 60 * 1000;
  return start <= now && now <= end;
}

function isSessionPast(s: WeekendSession, now: number): boolean {
  const end = s.date_end ? Date.parse(s.date_end) : Date.parse(s.date_start) + 3 * 60 * 60 * 1000;
  return now > end;
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0.15rem",
      minWidth: "3.5rem",
    }}>
      <span style={{
        fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
        fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1,
        color: "var(--text-primary)",
        letterSpacing: "-0.02em",
      }}>
        {String(value).padStart(2, "0")}
      </span>
      <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function CountdownSeparator() {
  return (
    <span style={{
      fontSize: "clamp(1.2rem, 2.5vw, 1.8rem)",
      fontWeight: 800,
      fontFamily: "'JetBrains Mono', monospace",
      color: "rgba(39,244,210,0.6)",
      lineHeight: 1,
      alignSelf: "flex-start",
      paddingTop: "0.1rem",
    }}>:</span>
  );
}

// ─── Next Race Panel ──────────────────────────────────────────────────────────

function NextRacePanel({ weekend }: { weekend: WeekendPayload | null }) {
  const [userTz] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });

  const raceSession = weekend?.sessions.find((s) => {
    const t = (s.session_type ?? "").toLowerCase();
    return t.includes("race") && !t.includes("sprint");
  }) ?? null;

  const countdown = useCountdown(raceSession?.date_start ?? null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const sessions = weekend?.sessions ?? [];
  const gpName = weekend?.grand_prix_name ?? "Next Grand Prix";
  const location = weekend?.location ?? weekend?.country_name ?? "";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
            <Flag size={13} color="var(--accent-f1)" strokeWidth={2.5} />
            <span style={{ fontSize: "0.63rem", color: "var(--accent-f1)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
              Next Race
            </span>
          </div>
          <h2 style={{
            fontSize: "clamp(1rem, 2vw, 1.35rem)",
            fontWeight: 800,
            color: "var(--text-primary)",
            lineHeight: 1.15,
            margin: 0,
          }}>
            {gpName}
          </h2>
          {location && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.3rem" }}>
              <MapPin size={11} color="var(--text-muted)" />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{location}</span>
            </div>
          )}
        </div>
        <div style={{
          padding: "0.25rem 0.6rem",
          borderRadius: 999,
          background: "rgba(39,244,210,0.1)",
          border: "1px solid rgba(39,244,210,0.25)",
          fontSize: "0.58rem",
          color: "var(--accent-cyan)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {userTz.replace("_", " ")}
        </div>
      </div>

      {/* Countdown */}
      {countdown ? (
        <div style={{
          padding: "1rem 1.2rem",
          borderRadius: 10,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(39,244,210,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Clock size={11} color="rgba(39,244,210,0.7)" />
            <span style={{ fontSize: "0.6rem", color: "rgba(39,244,210,0.7)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Race starts in
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <CountdownBlock value={countdown.days} label="days" />
            <CountdownSeparator />
            <CountdownBlock value={countdown.hours} label="hrs" />
            <CountdownSeparator />
            <CountdownBlock value={countdown.mins} label="min" />
            <CountdownSeparator />
            <CountdownBlock value={countdown.secs} label="sec" />
          </div>
          {raceSession && (
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              {formatLocalTime(raceSession.date_start, userTz)}
            </div>
          )}
        </div>
      ) : raceSession && isSessionLive(raceSession, now) ? (
        <div style={{
          padding: "1rem 1.2rem",
          borderRadius: 10,
          background: "rgba(232,0,45,0.08)",
          border: "1px solid rgba(232,0,45,0.35)",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#E8002D",
            boxShadow: "0 0 8px #E8002D",
            animation: "pulse 1.2s infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#E8002D", letterSpacing: "0.1em" }}>
            RACE IN PROGRESS
          </span>
        </div>
      ) : null}

      {/* Session timetable */}
      {sessions.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            marginBottom: "0.55rem",
          }}>
            <Calendar size={11} color="var(--text-muted)" />
            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Weekend Schedule
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {sessions.map((s) => {
              const live = isSessionLive(s, now);
              const past = !live && isSessionPast(s, now);
              const label = sessionTypeLabel(s.session_type, s.session_name);
              const color = sessionTypeColor(s.session_type);

              return (
                <div
                  key={s.session_key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.4rem 0.65rem",
                    borderRadius: 7,
                    background: live
                      ? "rgba(232,0,45,0.1)"
                      : past
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${live ? "rgba(232,0,45,0.3)" : "rgba(255,255,255,0.06)"}`,
                    opacity: past ? 0.45 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {live && (
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "#E8002D",
                      boxShadow: "0 0 6px #E8002D",
                      flexShrink: 0,
                    }} />
                  )}
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color,
                    minWidth: "4.5rem",
                    letterSpacing: "0.04em",
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: "0.7rem",
                    color: live ? "var(--text-primary)" : "var(--text-secondary)",
                    flex: 1,
                  }}>
                    {formatLocalTime(s.date_start, userTz).replace(/\w+,\s*/, "")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mini Driver Row ──────────────────────────────────────────────────────────

function DriverRow({ d, leaderPoints }: { d: ClientDriverStanding; leaderPoints: number }) {
  const isLeader = d.position === 1;
  const gap = isLeader ? null : leaderPoints - d.points;
  const pct = leaderPoints > 0 ? (d.points / leaderPoints) * 100 : 0;
  const teamColor = d.team?.primary ?? "#555";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.3rem 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{
        fontSize: "0.62rem",
        color: isLeader ? "var(--accent-cyan)" : "var(--text-muted)",
        fontWeight: 700,
        minWidth: "1.1rem",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {d.position}
      </span>
      {/* Team color bar */}
      <div style={{
        width: 3,
        height: 26,
        borderRadius: 2,
        background: teamColor,
        boxShadow: isLeader ? `0 0 6px ${teamColor}` : undefined,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: isLeader ? "var(--text-primary)" : "var(--text-secondary)",
            letterSpacing: "0.05em",
          }}>
            {d.driverCode}
          </span>
          <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.03em" }}>
            {d.team?.shortName ?? d.rawTeamName}
          </span>
        </div>
        {/* Points bar */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, marginTop: "0.2rem", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${teamColor}, ${teamColor}88)`,
            borderRadius: 1,
            transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }} />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{
          fontSize: "0.78rem",
          fontWeight: 800,
          color: isLeader ? "var(--text-primary)" : "var(--text-secondary)",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {d.points}
        </span>
        {gap !== null && (
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            -{gap}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini Constructor Row ─────────────────────────────────────────────────────

function ConstructorRow({ c, leaderPoints }: { c: ClientConstructorStanding; leaderPoints: number }) {
  const isLeader = c.position === 1;
  const gap = isLeader ? null : leaderPoints - c.points;
  const pct = leaderPoints > 0 ? (c.points / leaderPoints) * 100 : 0;
  const teamColor = c.team?.primary ?? "#555";
  const secondaryColor = c.team?.secondary ?? "#777";
  const name = c.team?.shortName ?? c.rawTeamName;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.3rem 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    }}>
      <span style={{
        fontSize: "0.62rem",
        color: isLeader ? "var(--accent-cyan)" : "var(--text-muted)",
        fontWeight: 700,
        minWidth: "1.1rem",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {c.position}
      </span>
      {/* Team crest dot */}
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 5,
        background: `linear-gradient(135deg, ${teamColor}, ${secondaryColor})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: isLeader ? `0 0 8px ${teamColor}55` : undefined,
      }}>
        <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "#fff", letterSpacing: 0 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: isLeader ? "var(--text-primary)" : "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {name}
          </span>
          {c.wins > 0 && (
            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{c.wins}W</span>
          )}
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, marginTop: "0.2rem", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${teamColor}, ${secondaryColor})`,
            borderRadius: 1,
            transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }} />
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{
          fontSize: "0.78rem",
          fontWeight: 800,
          color: isLeader ? "var(--text-primary)" : "var(--text-secondary)",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {c.points}
        </span>
        {gap !== null && (
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            -{gap}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function RaceHubDashboard({
  drivers,
  constructors,
  season,
  round,
  standingsLoading,
}: RaceHubDashboardProps) {
  const [weekend, setWeekend] = useState<WeekendPayload | null>(null);
  const [weekendLoading, setWeekendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/schedule/weekend", { cache: "no-store" });
        const data = (await res.json()) as WeekendPayload;
        if (!cancelled) setWeekend(data);
      } catch {
        // silently degrade — panel shows empty state
      } finally {
        if (!cancelled) setWeekendLoading(false);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const topDrivers = drivers.slice(0, 8);
  const topConstructors = constructors.slice(0, 8);
  const driverLeaderPts = drivers[0]?.points ?? 0;
  const constructorLeaderPts = constructors[0]?.points ?? 0;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "1px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
      overflow: "hidden",
    }}>

      {/* ── Col 1: Next Race ─────────────────────────── */}
      <div style={{
        background: "rgba(5,8,14,0.82)",
        backdropFilter: "blur(20px)",
        padding: "1.25rem 1.1rem",
        minHeight: "22rem",
      }}>
        {weekendLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[80, 60, 100, 70, 90].map((w, i) => (
              <div key={i} style={{ height: 12, width: `${w}%`, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        ) : (
          <NextRacePanel weekend={weekend} />
        )}
      </div>

      {/* ── Col 2: Drivers Championship ──────────────── */}
      <div style={{
        background: "rgba(5,8,14,0.82)",
        backdropFilter: "blur(20px)",
        padding: "1.25rem 1.1rem",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <Trophy size={13} color="var(--accent-cyan)" strokeWidth={2.5} />
          <span style={{ fontSize: "0.63rem", color: "var(--accent-cyan)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            Drivers Championship
          </span>
          {season && round !== "0" && (
            <span style={{ marginLeft: "auto", fontSize: "0.58rem", color: "var(--text-muted)" }}>
              R{round} · {season}
            </span>
          )}
        </div>

        {standingsLoading && drivers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ height: 32, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : topDrivers.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", padding: "1rem 0" }}>
            No standings data available
          </div>
        ) : (
          <div>
            {topDrivers.map((d) => (
              <DriverRow key={d.driverCode} d={d} leaderPoints={driverLeaderPts} />
            ))}
          </div>
        )}
      </div>

      {/* ── Col 3: Constructors Championship ─────────── */}
      <div style={{
        background: "rgba(5,8,14,0.82)",
        backdropFilter: "blur(20px)",
        padding: "1.25rem 1.1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
          <Shield size={13} color="#FF8000" strokeWidth={2.5} />
          <span style={{ fontSize: "0.63rem", color: "#FF8000", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            Constructors Championship
          </span>
        </div>

        {standingsLoading && constructors.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ height: 32, borderRadius: 4, background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : topConstructors.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", padding: "1rem 0" }}>
            No standings data available
          </div>
        ) : (
          <div>
            {topConstructors.map((c) => (
              <ConstructorRow key={c.rawTeamName} c={c} leaderPoints={constructorLeaderPts} />
            ))}
          </div>
        )}

        {/* Live data hint */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          marginTop: "0.85rem",
          paddingTop: "0.65rem",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Zap size={9} color="rgba(39,244,210,0.5)" />
          <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
            Updated every 30 min · Jolpica API
          </span>
        </div>
      </div>
    </div>
  );
}
