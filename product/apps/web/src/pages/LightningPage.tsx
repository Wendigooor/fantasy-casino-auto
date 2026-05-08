import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

function Countdown({ endsAt }) {
  const [r, setR] = React.useState(Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)));
  React.useEffect(() => {
    if (r <= 0) return;
    const t = setInterval(() => { setR(Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))); }, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  const m = Math.floor(r / 60); const s = r % 60;
  return <span className="text-3xl font-black text-win tabular-nums">{m}:{s.toString().padStart(2, "0")}</span>;
}

export function LightningPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["lightning"], queryFn: () => fetch(`${API}/api/v1/lightning/active`, { headers: auth() }).then(r => r.json()), refetchInterval: 2000 });
  const joinM = useMutation({ mutationFn: (rid) => fetch(`${API}/api/v1/lightning/${rid}/join`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: "{}" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["lightning"] }) });

  const round = data?.round; const me = data?.me || {}; const lb = data?.leaderboard || [];
  if (isLoading) return <div data-page="lightning" data-ready="false"><div className="skeleton h-96 rounded-2xl" /></div>;
  if (!round || round.status === "ended") return <div data-page="lightning" data-ready="true" data-state="ended" className="max-w-3xl mx-auto text-center py-12"><div className="text-5xl mb-4">⏰</div><p className="text-casino-muted">No active lightning round.</p></div>;

  return (
    <div className="max-w-4xl mx-auto" data-page="lightning" data-ready="true" data-state={me.joined ? "joined" : "active"}>
      <div className="arena-card-glass-premium p-6 mb-5 text-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 700px 200px at 50% 0%, rgba(255,176,32,.1), transparent), radial-gradient(ellipse 400px 200px at 80% 100%, rgba(255,51,85,.05), transparent)" }} />
        <div className="relative">
          <div className="text-[10px] text-gold uppercase tracking-[3px] font-semibold mb-1">⚡ Limited Time Event</div>
          <h2 className="text-2xl font-black mb-1">Lightning Round</h2>
          <p className="text-xs text-casino-muted mb-1">3x score boost for 15 minutes</p>
          <div className="mb-3"><Countdown endsAt={round.endsAt} /></div>
          <div className="flex justify-center gap-4 text-center mb-3 text-xs">
            <div><span className="text-gold font-bold">{round.multiplier}x</span> boost</div>
            <div className="w-px bg-casino-border" /><div><span className="text-gold font-bold">{lb.length}</span> players</div>
            <div className="w-px bg-casino-border" /><div><span className="text-gold font-bold">{me.score || "0"}pts</span> your score</div>
          </div>
          {!me.joined ? (
            <button className="arena-btn !w-auto !px-8 !inline-flex !text-[11px]" onClick={() => joinM.mutate(round.id)} disabled={joinM.isPending}>⚡ JOIN</button>
          ) : (
            <div className="flex items-center justify-center gap-3"><span className="text-win font-bold text-xs">✓ Joined</span><div className="bg-[rgba(255,176,32,.12)] border border-gold/20 rounded-lg px-3 py-1 text-xs"><span className="text-gold font-bold">{round.multiplier}x</span> active</div></div>
          )}
        </div>
      </div>
      {me.joined && <div className="arena-card-glass p-4 mb-5 flex items-center justify-between">
        <div><div className="text-[10px] text-casino-muted uppercase">Your Score</div><div className="text-2xl font-black text-gold">{me.score}pts</div><div className="text-xs text-casino-muted">{me.spins} spins</div></div>
        <div className="text-right"><div className="text-[10px] text-casino-muted">Rank</div><div className="text-xl font-bold">{lb.findIndex(e => e.isCurrentUser) + 1}/{lb.length}</div></div>
      </div>}
      {lb.length > 0 && <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-2">Leaderboard</h3>}
      <div className="space-y-1.5 mb-5">{lb.map(e => (
        <div key={e.rank} className={`arena-card-glass p-2.5 flex items-center gap-2.5 text-sm ${e.isCurrentUser ? "ring-1 ring-primary/40 bg-[rgba(255,51,85,.04)]" : ""}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${e.rank <= 3 ? "bg-gradient-to-br from-gold to-primary text-white" : "bg-[rgba(19,19,31,.6)] text-casino-muted"}`}>{e.rank}</span>
          <span className="flex-1 font-semibold text-xs">{e.player} {e.isCurrentUser ? "(you)" : ""}</span>
          <div className="text-right"><div className="text-xs font-bold text-gold">{e.score}pts</div></div>
        </div>
      ))}</div>
    </div>
  );
}
