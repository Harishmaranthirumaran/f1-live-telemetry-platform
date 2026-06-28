"use client";

import type { TeamMeta } from "../../../lib/constants/teams";
import { teamMonogram } from "../../../lib/constants/teams";

interface TeamCrestProps {
  team: TeamMeta | null;
  fallback?: string;
  size?: number;
}

export default function TeamCrest({ team, fallback = "?", size = 32 }: TeamCrestProps) {
  const primary = team?.primary ?? "#5e6b73";
  const secondary = team?.secondary ?? "#1f2937";
  const label = team ? teamMonogram(team) : fallback.charAt(0).toUpperCase();
  const px = `${size}px`;

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: px,
        height: px,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 800,
        letterSpacing: "0.04em",
        fontSize: `${Math.round(size * 0.46)}px`,
        color: "#0d1117",
        background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${secondary} 100%)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 6px 18px ${team?.glow ?? "rgba(0,0,0,0.4)"}`,
        textShadow: "0 1px 0 rgba(255,255,255,0.35)",
        flex: "0 0 auto",
      }}
    >
      {label}
    </span>
  );
}
