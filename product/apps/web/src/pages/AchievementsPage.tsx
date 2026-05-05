import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const a = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

export function AchievementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetch(`${API_URL}/api/v1/achievements`, { headers: a() }).then(r => r.json()),
  });

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <Link to="/" className="text-xs text-casino-muted hover:text-casino-text no-underline">&larr; Lobby</Link>
      <h2 className="mt-1">Achievements</h2>
      {data && <p className="text-xs text-casino-muted mb-4">{data.earned}/{data.total} unlocked</p>}
      {isLoading && <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>}
      <div className="grid grid-cols-2 gap-3">
        {data?.achievements?.map((a: { emoji: string; name: string; desc: string; earned: boolean; progress: string }, i: number) => (
          <div key={i} className={`card p-4 text-center transition-all ${a.earned ? "border-gold" : "opacity-50 grayscale"}`}>
            <div className="text-3xl mb-1">{a.emoji}</div>
            <div className="text-sm font-bold">{a.name}</div>
            <div className="text-[10px] text-casino-muted">{a.desc}</div>
            <div className="text-[10px] text-gold mt-1">{a.earned ? "✅ Unlocked" : a.progress}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
