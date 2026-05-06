import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../components/Layout";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
const PRESETS = [100, 500, 1000, 5000];

export function DuelsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { user } = useAuth();
  const [bet, setBet] = useState("100");
  const [gameId, setGameId] = useState("slot-basic");
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "mine" | "history">("open");

  const { data: open, isLoading: openLoading } = useQuery({
    queryKey: ["duels-open"],
    queryFn: () => fetch(`${API}/api/v1/duels/open`, { headers: auth() }).then(r => r.json()),
    refetchInterval: 3000,
  });
  const { data: mine } = useQuery({
    queryKey: ["duels-mine"],
    queryFn: () => fetch(`${API}/api/v1/duels/mine`, { headers: auth() }).then(r => r.json()),
  });

  const createM = useMutation({
    mutationFn: (d: { gameId: string; betAmount: number }) =>
      fetch(`${API}/api/v1/duels`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["duels-open"] }); qc.invalidateQueries({ queryKey: ["duels-mine"] }); nav(`/duels/${d.id}`); },
    onError: (e: Error) => setMsg(e.message),
  });

  const openDuels = open?.duels || [];
  const myDuels = mine?.duels || [];
  const activeDuels = myDuels.filter((d: any) => d.status === "active" || d.status === "open");
  const settledDuels = myDuels.filter((d: any) => d.status === "settled" || d.status === "cancelled");

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in-up" data-page="duels">
      <div className="flex items-center justify-between mb-4">
        <h2 className="!mb-0">⚔️ PvP Arena</h2>
        <span className="text-[10px] text-casino-muted bg-[rgba(107,107,128,.1)] px-2.5 py-1 rounded-full border border-[rgba(107,107,128,.15)]">{activeDuels.length} active</span>
      </div>

      {/* Create */}
      <div className="arena-card-glass p-5 mb-5">
        <h3 className="text-[11px] text-casino-muted uppercase tracking-wider font-semibold mb-3">CREATE DUEL</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-[9px] text-casino-muted uppercase tracking-wider block mb-1.5">Bet</label>
            <div className="flex gap-1 mb-1.5">
              {PRESETS.map(p => <button key={p} className={`bet-quick ${Number(bet)===p?"active":""}`} onClick={()=>setBet(String(p))}>{p}</button>)}
            </div>
            <input type="number" className="arena-input w-full" value={bet} onChange={e=>setBet(e.target.value)} min="10" />
          </div>
          <div>
            <label className="text-[9px] text-casino-muted uppercase tracking-wider block mb-1.5">Game</label>
            <select className="arena-input w-36" value={gameId} onChange={e=>setGameId(e.target.value)}>
              <option value="slot-basic">🎰 Basic Slots</option>
              <option value="slot-fruit">🍒 Fruit Slots</option>
            </select>
          </div>
          <button className="arena-btn !w-auto !px-6" onClick={()=>{const b=parseInt(bet);if(isNaN(b)||b<10){setMsg("Min bet: 10");return;}createM.mutate({gameId,betAmount:b})}} disabled={createM.isPending}>
            {createM.isPending?"CREATING...":"⚔️ CREATE"}
          </button>
        </div>
        {msg&&<p className="text-xs text-lose mt-2">{msg}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["open","mine","history"] as const).map(t=>
          <button key={t} className={`arena-tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
            {t==="open"&&"🔥 Open"}{t==="mine"&&"⚔️ My Duels"}{t==="history"&&"📜 History"}
          </button>
        )}
      </div>

      {/* Open */}
      {tab==="open"&&<>
        {openLoading&&<div className="arena-empty"><div className="arena-empty-icon">🎰</div><p className="arena-empty-text">Loading arena...</p></div>}
        {!openLoading&&openDuels.length===0&&<div className="arena-empty"><div className="arena-empty-icon">⚔️</div><p className="arena-empty-text">No open duels. Create one above!</p></div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {openDuels.map((d:any)=><Link key={d.id} to={`/duels/${d.id}`} className="arena-card-glass arena-card-animated p-4 arena-link flex items-center gap-3 hover:border-primary/30">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,51,85,.12)] flex items-center justify-center text-sm font-bold shrink-0">{(d.creatorEmail as string)?.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{(d.creatorEmail as string)?.split("@")[0]}</div><div className="text-[9px] text-casino-muted">{d.gameId} &middot; {new Date(d.createdAt as string).toLocaleTimeString()}</div></div>
            <div className="text-right"><div className="text-sm font-bold text-gold">{d.betAmount}</div><div className="text-[9px] text-win uppercase">JOIN</div></div>
          </Link>)}
        </div>
      </>}

      {/* Mine */}
      {tab==="mine"&&<>
        {myDuels.filter((d:any)=>d.status!=="settled"&&d.status!=="cancelled").length===0&&<p className="text-xs text-casino-muted italic py-4">No active duels.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {myDuels.filter((d:any)=>d.status!=="settled"&&d.status!=="cancelled").map((d:any)=><DuelCard key={d.id} duel={d} user={user} />)}
        </div>
      </>}

      {/* History */}
      {tab==="history"&&<>
        {settledDuels.length===0&&<p className="text-xs text-casino-muted italic py-4">No history.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {settledDuels.slice(0,20).map((d:any)=><DuelCard key={d.id} duel={d} user={user} />)}
        </div>
      </>}
    </div>
  );
}

function DuelCard({duel,user}:{duel:any;user:any}) {
  const won = duel.winnerId===user?.id;
  const lost = duel.status==="settled"&&duel.winnerId&&!won;
  const badge = duel.status==="open"?"arena-badge-open":duel.status==="active"?"arena-badge-active":won?"arena-badge-won":lost?"arena-badge-lost":"arena-badge-tie";
  const label = duel.status==="open"?"⚔️ Open":duel.status==="active"?"🎰 Active":won?"🏆 Won":lost?"💀 Lost":"🤝 Tie";
  return (
    <Link to={`/duels/${duel.id}`} className="arena-card-glass p-3 arena-link hover:border-primary/30 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2"><span className="text-sm font-bold text-gold">{duel.betAmount}</span><span className="text-[9px] text-casino-muted">{duel.gameId}</span></div>
        <div className="text-[9px] text-casino-muted">{new Date(duel.createdAt as string).toLocaleDateString()}</div>
      </div>
      <span className={`arena-badge ${badge}`}>{label}</span>
    </Link>
  );
}
