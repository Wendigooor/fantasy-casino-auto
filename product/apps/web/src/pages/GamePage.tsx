import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSound } from "../hooks/useSound";
import { ComboFeverMeter } from "../components/ComboFeverMeter";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣"];

async function fetchHistory() {
  const res = await fetch(`${API_URL}/api/v1/games/history`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function spinApi(d: { betAmount: number; idempotencyKey: string; gameId: string }) {
  const res = await fetch(`${API_URL}/api/v1/games/slot/spin`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: JSON.stringify(d) });
  if (!res.ok) throw new Error("Spin failed");
  return res.json();
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const qc = useQueryClient();
  const [bet, setBet] = useState("50");
  const [msg, setMsg] = useState<string | null>(null);
  const [spin, setSpin] = useState<Record<string, unknown> | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const { play, muted, toggle: toggleMute } = useSound();
  const { data: history, isLoading: histLoading } = useQuery({ queryKey: ["roundHistory"], queryFn: fetchHistory });
  const sm = useMutation({
    mutationFn: spinApi,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["roundHistory"] }); qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["comboFever"] });
      setSpin(d);
      setMsg((d.winAmount as number) > 0 ? `+${d.winAmount} — You won!` : "No win this time");
      if ((d.winAmount as number) > 0) { setConfetti(true); setShowBanner(true); play("win"); setTimeout(() => setShowBanner(false), 3000); }
      setTimeout(() => setConfetti(false), 3500);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const title = gameId === "slot-basic" ? "Basic Slots" : gameId === "slot-fruit" ? "Fruit Slots" : "Slot Machine";

  return (
    <div className="max-w-[700px] mx-auto animate-fade-in-up">
      {confetti && <Confetti />}
      {showBanner && (spin?.winAmount as number) > 0 && (
        <div className="win-banner">
          <h1>+{spin?.winAmount as number}</h1>
          <p>Nice win!</p>
        </div>
      )}
      <ComboFeverMeter />
      <Link to="/" className="text-xs text-casino-muted hover:text-casino-text no-underline">&larr; Lobby</Link>
      <div className="flex items-center gap-2 mt-1 mb-4">
        <h2 className="!mb-0">{title}</h2>
        <button onClick={toggleMute} className="text-sm opacity-50 hover:opacity-100" title={muted ? "Unmute" : "Mute"}>{muted ? "🔇" : "🔊"}</button>
      </div>

      <div className="card p-6 text-center bg-casino-gradient border-2 border-casino-border shadow-[inset_0_0_40px_rgba(0,0,0,.3)]">
        <div className="flex justify-center gap-2 mb-3">
          {spin ? (spin.reels as number[]).map((s, i) => (
            <div key={i} className={`reel ${(spin.winAmount as number) > 0 ? "win" : ""}`}>
              {SYMBOLS[s % 7]}
            </div>
          )) : [...Array(5)].map((_, i) => <div key={i} className="reel">🎰</div>)}
        </div>
        {spin && <div className={`text-base font-bold ${(spin.winAmount as number) > 0 ? "text-win" : "text-lose"}`}>{(spin.winAmount as number) > 0 ? `+${spin.winAmount}` : `-${spin.betAmount}`}</div>}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        {[10, 25, 50, 100, 250, 500].map((amt) => (
          <button key={amt} className={`bet-quick ${parseInt(bet) === amt ? "active" : ""}`} onClick={() => setBet(String(amt))}>{amt}</button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3">
        <button className="btn-outline" onClick={() => setBet(b => String(Math.max(10, parseInt(b || "10") / 2)))}>1/2</button>
        <input type="number" className="w-24 text-center py-2 bg-casino-surface border border-casino-border rounded-lg text-white font-bold text-base focus:outline-none focus:border-primary" value={bet} onChange={e => setBet(e.target.value)} min="10" />
        <button className="btn-outline" onClick={() => setBet(b => String(parseInt(b || "10") * 2))}>2x</button>
      </div>
      <div className="text-center mt-3">
        <button className="px-10 py-3.5 bg-gradient-to-r from-primary to-primary-hover text-white font-extrabold text-sm uppercase tracking-widest rounded-full shadow-[0_4px_24px_rgba(255,51,85,.3)] hover:scale-105 hover:shadow-[0_6px_32px_rgba(255,51,85,.4)] transition-all disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => { const amt = parseInt(bet); if (isNaN(amt) || amt < 10) { setMsg("Min 10"); return; } play("spin"); sm.mutate({ betAmount: amt, idempotencyKey: crypto.randomUUID(), gameId: gameId! }); }} disabled={sm.isPending}>{sm.isPending ? "..." : "Spin"}</button>
      </div>
      {msg && <p className="text-center text-sm mt-3">{msg}</p>}

      <h4 className="mt-6">Recent Rounds</h4>
      {histLoading && <p className="text-xs text-casino-muted py-2">Loading...</p>}
      {history?.rounds?.length > 0 ? (
        <table className="table-casino"><thead><tr><th>Bet</th><th>Win</th><th>State</th><th>Date</th></tr></thead><tbody>{history.rounds.slice(0, 10).map((r: { id: string; betAmount: number; winAmount: number; state: string; createdAt: string }) => <tr key={r.id}><td>{r.betAmount}</td><td className={r.winAmount > 0 ? "text-win" : ""}>{r.winAmount}</td><td>{r.state}</td><td className="text-casino-muted">{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
      ) : <p className="text-xs text-casino-muted italic py-2">No rounds yet</p>}
    </div>
  );
}

function Confetti() {
  const cols = ["#ff3355","#ffb020","#00e676","#0095ff","#ff6b8a","#fff"];
  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => (
        <div key={i} className="confetti-piece rounded-sm" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 1.5}s`, background: cols[i % 6], width: `${5 + Math.random() * 8}px`, height: `${5 + Math.random() * 8}px` }} />
      ))}
      {Array.from({ length: 20 }, (_, i) => (
        <div key={`c${i}`} className="confetti-piece text-2xl" style={{ left: `${20 + Math.random() * 60}%`, animationDelay: `${Math.random() * 1}s` }}>🪙</div>
      ))}
    </div>
  );
}
