import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../components/Layout";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣"];
const SYM_COLORS = ["#ff3860", "#ffb020", "#ff8c00", "#a855f7", "#00e676", "#38bdf8", "#ffd700"];

function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; x: number; color: string; delay: number; size: number }>>([]);
  const COLORS = ["#ff3355", "#ffb020", "#00e676", "#38bdf8", "#a855f7", "#ff8c00"];
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    setPieces(Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2, size: 6 + Math.random() * 8,
    })));
    const timer = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(timer);
  }, [active]);
  if (!pieces.length) return null;
  return (<div className="confetti-container">
    {pieces.map(p => (<div key={p.id} className="confetti-piece" style={{left:`${p.x}%`,top:"-5%",width:p.size,height:p.size*1.5,background:p.color,borderRadius:"2px",animationDelay:`${p.delay}s`}} />))}
  </div>);
}

function Reel({ symbol, spinning, win }: { symbol: number; spinning: boolean; win: boolean }) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { if (!spinning) setAnimKey(k => k + 1); }, [spinning]);
  return (
    <div className={`arena-reel ${win ? "win" : ""}`} key={animKey}>
      {spinning ? <span className="arena-reel-spin text-2xl opacity-40">🎰</span>
        : <span className="arena-reel-spin" style={{color:SYM_COLORS[symbol%7]}}>{SYMBOLS[symbol%7]}</span>}
    </div>
  );
}

export function DuelPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [justSettled, setJustSettled] = useState(false);

  const { data: duel, isLoading } = useQuery({
    queryKey: ["duel", id],
    queryFn: () => fetch(`${API}/api/v1/duels/${id}`, { headers: auth() }).then(r => r.json()),
    refetchInterval: 1000,
  });

  const acceptM = useMutation({
    mutationFn: () => fetch(`${API}/api/v1/duels/${id}/accept`,{method:"POST",headers:auth()}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:["duel",id]}),
  });
  const spinM = useMutation({
    mutationFn: () => fetch(`${API}/api/v1/duels/${id}/spin`,{method:"POST",headers:auth()}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:["duel",id]}),
  });

  useEffect(() => {
    if (duel?.status === "settled") {
      const t = setTimeout(() => setJustSettled(true), 100);
      return () => { clearTimeout(t); };
    }
    setJustSettled(false);
    return;
  }, [duel?.status]);

  if (isLoading) return <div className="max-w-lg mx-auto"><div className="skeleton h-96 rounded-2xl" /></div>;
  if (!duel) return <div className="max-w-lg mx-auto text-center py-12"><p className="text-lose text-lg">Duel not found</p></div>;

  const isCreator = duel.creatorId === user?.id;
  const isAcceptor = duel.acceptorId === user?.id;
  const isParticipant = isCreator || isAcceptor;
  const mySpin = isCreator ? duel.creatorSpin : duel.acceptorSpin;
  const theirSpin = isCreator ? duel.acceptorSpin : duel.creatorSpin;
  const iWon = duel.winnerId === user?.id;
  const iLost = duel.status === "settled" && duel.winnerId && !iWon;
  const creatorName = ((duel.creatorEmail as string)||"").split("@")[0] || "Player 1";
  const acceptorName = duel.acceptorEmail ? (duel.acceptorEmail as string).split("@")[0] : "???";
  const myTurn = duel.status === "active" && isParticipant && !mySpin;

  const banner = () => {
    if (duel.status === "open") return {text:"⚔️ WAITING FOR OPPONENT",cls:"arena-status-open"};
    if (duel.status === "active" && !mySpin) return {text:"🎰 YOUR TURN — SPIN NOW!",cls:"arena-status-active"};
    if (duel.status === "active" && mySpin && !theirSpin) return {text:"⏳ OPPONENT SPINNING...",cls:"arena-status-active"};
    if (duel.status === "settled" && iWon) return {text:"🏆 VICTORY!",cls:"arena-status-victory"};
    if (duel.status === "settled" && iLost) return {text:"💀 DEFEAT",cls:"arena-status-defeat"};
    if (duel.status === "settled") return {text:"🤝 TIE",cls:"arena-status-open"};
    return {text:duel.status,cls:""};
  };
  const b = banner();
  const myReels = mySpin ? JSON.parse(mySpin as string).reels : null;
  const theirReels = theirSpin ? JSON.parse(theirSpin as string).reels : null;

  return (
    <div className="max-w-lg mx-auto animate-fade-in-up">
      <Confetti active={justSettled && iWon} />
      <Link to="/duels" className="arena-link text-xs">&larr; Arena</Link>

      <div className={`arena-status mt-2 mb-3 ${b.cls}`}>{b.text}</div>

      {/* VS Card */}
      <div className="arena-card-glass arena-card-glass p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className={`arena-avatar ${iWon&&isCreator?"arena-avatar-winner":iLost&&isCreator?"arena-avatar-loser":myTurn&&isCreator?"arena-avatar-turn":""}`}
              style={{background:isCreator?"linear-gradient(135deg,rgba(255,51,85,.2),rgba(255,51,85,.1))":"rgba(107,107,128,.1)"}}>
              {creatorName.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm font-semibold mt-1.5">{creatorName}</div>
            <div className="text-[9px] text-casino-muted uppercase tracking-wider">{isCreator?"You":"Creator"}</div>
            {duel.creatorMultiplier!=null&&<div className={`text-xs font-bold mt-1 ${iWon&&isCreator?"text-gold":iLost&&isCreator?"text-lose":"text-casino-muted"}`}>x{Number(duel.creatorMultiplier).toFixed(2)}</div>}
          </div>

          <div className="flex flex-col items-center mx-4">
            <div className={`arena-vs ${duel.status==="active"&&!mySpin?"arena-vs-active":""}`}>VS</div>
            <div className="text-lg font-bold text-gold mt-1">{duel.betAmount}</div>
            <div className="text-[8px] text-casino-muted uppercase tracking-wider mt-0.5">{duel.gameId}</div>
            {duel.pot&&<hr className="arena-divider w-12 my-1.5" />}
            {duel.pot&&<div className="text-[10px] text-casino-muted">Pot: {duel.pot}</div>}
          </div>

          <div className="flex-1 text-center">
            <div className={`arena-avatar ${iWon&&isAcceptor?"arena-avatar-winner":iLost&&isAcceptor?"arena-avatar-loser":myTurn&&isAcceptor?"arena-avatar-turn":""}`}
              style={{background:isAcceptor?"linear-gradient(135deg,rgba(255,51,85,.2),rgba(255,51,85,.1))":duel.acceptorId?"rgba(107,107,128,.1)":"rgba(107,107,128,.05)",border:duel.acceptorId?"2px solid rgba(107,107,128,.2)":"2px dashed rgba(107,107,128,.15)"}}>
              {duel.acceptorId?acceptorName.charAt(0).toUpperCase():"?"}
            </div>
            <div className="text-sm font-semibold mt-1.5">{acceptorName}</div>
            <div className="text-[9px] text-casino-muted uppercase tracking-wider">{isAcceptor?"You":acceptorName!=="???"?"Opponent":"Waiting"}</div>
            {duel.acceptorMultiplier!=null&&<div className={`text-xs font-bold mt-1 ${iWon&&isAcceptor?"text-gold":iLost&&isAcceptor?"text-lose":"text-casino-muted"}`}>x{Number(duel.acceptorMultiplier).toFixed(2)}</div>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3">
        {duel.status==="open"&&!isCreator&&<button className="arena-btn" onClick={()=>acceptM.mutate()} disabled={acceptM.isPending}>{acceptM.isPending?"ACCEPTING...":"⚔️ ACCEPT CHALLENGE"}</button>}
        {duel.status==="open"&&isCreator&&<div className="text-center text-sm text-casino-muted py-3 animate-pulse">Waiting for opponent to accept...</div>}
        {duel.status==="active"&&myTurn&&<button className="arena-btn" onClick={()=>spinM.mutate()} disabled={spinM.isPending}>{spinM.isPending?"SPINNING...":"🎰 SPIN TO BATTLE"}</button>}
        {duel.status==="active"&&mySpin&&!theirSpin&&<div className="text-center text-sm text-casino-muted py-3 animate-pulse">Opponent is spinning...</div>}
      </div>

      {/* Reels */}
      {(myReels||theirReels)&&<div className="grid grid-cols-2 gap-3 mt-3">
        <div className={`arena-card-glass p-4 text-center ${iWon?"border-gold/30":iLost?"opacity-50":""}`}>
          <div className="text-[9px] text-casino-muted uppercase tracking-wider mb-2">You</div>
          <div className="flex justify-center gap-1.5">
            {myReels?myReels.map((s:number,i:number)=><Reel key={i} symbol={s} spinning={false} win={iWon} />)
              :[0,1,2,3].map(i=><div key={i} className="arena-reel"><span className="arena-reel-spin opacity-30">🎰</span></div>)}
          </div>
        </div>
        <div className={`arena-card-glass p-4 text-center ${iLost?"border-gold/30":iWon?"opacity-50":""}`}>
          <div className="text-[9px] text-casino-muted uppercase tracking-wider mb-2">Opponent</div>
          <div className="flex justify-center gap-1.5">
            {theirReels?theirReels.map((s:number,i:number)=><Reel key={i} symbol={s} spinning={false} win={iLost} />)
              :[0,1,2,3].map(i=><div key={i} className="arena-reel"><span className="arena-reel-spin opacity-30">🎰</span></div>)}
          </div>
        </div>
      </div>}

      {/* Settlement */}
      {duel.status==="settled"&&<div className="arena-card-glass p-3 mt-3 text-center">
        <div className="text-[9px] text-casino-muted uppercase tracking-wider mb-1">Payout</div>
        <div className="text-xl font-bold text-gold">{Number(duel.pot)-Number(duel.houseFee)} coins</div>
        <div className="text-[9px] text-casino-muted mt-0.5">House fee: {duel.houseFee} (5%)</div>
      </div>}
    </div>
  );
}
