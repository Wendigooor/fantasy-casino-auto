import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const MULTIPLIER_TIERS = [
  { streak: 2, mult: 1.5, label: "x1.5" },
  { streak: 3, mult: 2.0, label: "x2" },
  { streak: 5, mult: 3.0, label: "x3" },
  { streak: 7, mult: 5.0, label: "x5" },
  { streak: 10, mult: 10.0, label: "x10" },
];

async function fetchCombo(): Promise<{ streak: number; multiplier: number; nextThreshold: number }> {
  const res = await fetch(`${API_URL}/api/v1/combo/fever`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) return { streak: 0, multiplier: 1, nextThreshold: 2 };
  return res.json();
}

function getMultiplierColor(mult: number): string {
  if (mult >= 5) return "#ff3355";
  if (mult >= 3) return "#ffb020";
  if (mult >= 2) return "#00e676";
  return "#6b6b80";
}

function getMultiplierLabel(streak: number): string {
  for (const t of MULTIPLIER_TIERS) {
    if (streak >= t.streak) return t.label;
  }
  return "x1";
}

function getNextLabel(streak: number): string {
  for (const t of MULTIPLIER_TIERS) {
    if (streak < t.streak) return `Next: ${t.streak} wins → ${t.label}`;
  }
  return "MAXED";
}

export function ComboFeverMeter({ onStreakChange }: { onStreakChange?: (streak: number) => void }) {
  const [animate, setAnimate] = useState(false);
  const [prevStreak, setPrevStreak] = useState(0);

  const { data } = useQuery({
    queryKey: ["comboFever"],
    queryFn: fetchCombo,
    refetchInterval: 3000,
  });

  const streak = data?.streak ?? 0;
  const mult = data?.multiplier ?? 1;
  const next = data?.nextThreshold ?? 2;

  useEffect(() => {
    if (streak > prevStreak && streak > 0) {
      setAnimate(true);
      onStreakChange?.(streak);
      const t = setTimeout(() => setAnimate(false), 800);
      return () => clearTimeout(t);
    }
    if (streak === 0 && prevStreak > 0) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
    setPrevStreak(streak);
  }, [streak]);

  if (streak === 0 && prevStreak === 0 && !data) return null;

  const color = getMultiplierColor(mult);
  const segments = 10;

  return (
    <div style={{
      background: "rgba(17,17,34,.95)",
      border: `1px solid ${streak > 0 ? color : "rgba(40,40,70,.4)"}`,
      borderRadius: 14,
      padding: "12px 16px",
      marginBottom: 12,
      transition: "border-color 0.3s",
      boxShadow: animate && streak > 0 ? `0 0 24px ${color}22` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b6b80", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>
          Combo Fever
        </span>
        <span style={{
          fontSize: 20,
          fontWeight: 900,
          color,
          transition: "all 0.3s",
          transform: animate ? "scale(1.2)" : "scale(1)",
        }}>
          {streak > 0 ? getMultiplierLabel(streak) : "—"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i < streak;
          return (
            <div key={i} style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: filled ? color : "rgba(40,40,70,.4)",
              opacity: filled ? 1 : 0.3,
              transition: "all 0.3s",
              transform: animate && i === streak - 1 ? "scaleY(1.5)" : "scaleY(1)",
            }} />
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#6b6b80" }}>
        <span>{streak > 0 ? `${streak} win streak` : "No streak"}</span>
        <span>{getNextLabel(streak)}</span>
      </div>
    </div>
  );
}
