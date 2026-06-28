"use client";

import type { TeamMeta } from "../../../lib/constants/teams";

interface DriverAvatarProps {
  code: string;
  team: TeamMeta | null;
  size?: number;
  permanentNumber?: number | null;
}

export default function DriverAvatar({ code, team, size = 40, permanentNumber }: DriverAvatarProps) {
  const primary = team?.primary ?? "#5e6b73";
  const secondary = team?.secondary ?? "#0d1117";
  const px = `${size}px`;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-flex",
        width: px,
        height: px,
        borderRadius: "50%",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(155deg, ${primary} 0%, ${secondary} 100%)`,
        boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.18), 0 4px 14px ${team?.glow ?? "rgba(0,0,0,0.4)"}`,
        flex: "0 0 auto",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 800,
          fontSize: `${Math.round(size * 0.34)}px`,
          letterSpacing: "0.03em",
          color: "#f8fafc",
          textShadow: "0 1px 2px rgba(0,0,0,0.55)",
        }}
      >
        {code}
      </span>
      {permanentNumber != null && (
        <span
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            background: "rgba(13,17,23,0.92)",
            border: `1px solid ${primary}`,
            color: primary,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: `${Math.max(9, Math.round(size * 0.22))}px`,
            padding: "1px 4px",
            borderRadius: 4,
            lineHeight: 1,
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {permanentNumber}
        </span>
      )}
    </span>
  );
}
