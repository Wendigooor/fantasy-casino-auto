import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const a = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

export function LeaderboardPage() {
  const [tab, setTab] = useState<"balance" | "spins" | "wins">("balance");
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", tab],
    queryFn: () => fetch(`${API_URL}/api/v1/leaderboard/${tab}`, { headers: a() }).then(r => r.json()),
  });

  const tabs = { balance: "💰 Richest", spins: "🎰 Spinners", wins: "🏆 Big Wins" };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link to="/" className="text-xs text-casino-muted hover:text-casino-text no-underline">&larr; Lobby</Link>
      <h2 className="mt-1">Leaderboard</h2>
      <div className="flex gap-2 mb-4">
        {(Object.keys(tabs) as Array<keyof typeof tabs>).map(t => (
          <button key={t} className={`filter-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{tabs[t]}</button>
        ))}
      </div>
      {isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>}
      {data?.leaderboard?.map((entry: Record<string, unknown>, i: number) => (
        <div key={i} className="card p-3 flex items-center gap-3 mb-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-gradient-to-br from-gold to-primary text-white" : "bg-casino-surface text-casino-muted"}`}>{i + 1}</span>
          <span className="flex-1 font-semibold text-sm">{entry.player as string}</span>
          <span className="text-sm font-bold text-gold">
            {tab === "balance" && `${(entry.balance as number).toLocaleString()} ${entry.currency as string}`}
            {tab === "spins" && `${entry.spins as number} spins`}
            {tab === "wins" && `+${(entry.win as number).toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
}
