import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { PodiumMomentModal } from "../components/PodiumMomentModal";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

function Podium({ top3 }: { top3: any[] }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex items-end justify-center gap-3 mb-6">
      {top3.map((e: any, i: number) => (
        <div key={e.rank} className="flex flex-col items-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 mb-1 ${
            i === 0 ? "bg-gradient-to-br from-gold to-primary text-white border-gold shadow-[0_0_20px_rgba(255,176,32,.3)]" :
            i === 1 ? "bg-[rgba(19,19,31,.8)] text-casino-text border-[rgba(107,107,128,.3)]" :
            "bg-[rgba(19,19,31,.6)] text-casino-muted border-[rgba(107,107,128,.15)]"
          }`}>
            <span className="text-lg">{medals[i]}</span>
          </div>
          <div className="text-[10px] font-bold">{e.player}</div>
          <div className="text-[9px] text-gold font-bold">{e.points}</div>
        </div>
      ))}
    </div>
  );
}

export function TournamentsPage() {
  const qc = useQueryClient();
  const [podiumDismissed, setPodiumDismissed] = useState(false);
  const handlePodiumDismiss = useCallback(() => {
    setPodiumDismissed(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["tournament"],
    queryFn: () => fetch(`${API}/api/v1/tournaments/active`, { headers: auth() }).then(r => r.json()),
    refetchInterval: 5000,
  });

  const joinM = useMutation({
    mutationFn: (tid: string) =>
      fetch(`${API}/api/v1/tournaments/${tid}/join`, {
        method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: "{}",
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament"] }),
  });

  const boostM = useMutation({
    mutationFn: (tid: string) =>
      fetch(`${API}/api/v1/tournaments/${tid}/boost/activate`, {
        method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: "{}",
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament"] }),
  });

  const tournament = data?.tournament;
  const me = data?.me || {};
  const boost = data?.boost || { status: "locked", quests: [], questsCompleted: 0, questsTotal: 4 };
  const leaderboard = data?.leaderboard || [];
  const prizes = data?.prizes || [];
  const top3 = leaderboard.slice(0, 3);
  const isJoined = me?.joined;
  const userRank = me?.rank;
  const userPoints = me?.points;
  const rankImproved = me?.previousRank && me?.previousRank > me?.rank;

  let dataState = "not-joined";
  if (isJoined && userPoints === 0) dataState = "joined";
  else if (isJoined && userPoints > 0) dataState = "scored";
  if (boost?.status === "locked" && isJoined) dataState = "boost-locked";
  if (boost?.status === "ready") dataState = "boost-ready";
  if (boost?.status === "active") dataState = "boost-active";
  if (boost?.status === "consumed") dataState = "boost-consumed";

  const ready = !isLoading && !!data;

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto" data-page="tournaments" data-ready="false">
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    );
  }

  if (data?.error || !tournament) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12" data-page="tournaments" data-ready="true" data-state="empty">
        <div className="text-5xl mb-4">🏁</div>
        <p className="text-casino-muted">No active tournament right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" data-page="tournaments" data-ready="true" data-state={dataState} data-podium-moment={podiumDismissed ? "dismissed" : (userRank !== null && userRank <= 3 ? "visible" : "hidden")}>
      {/* Hero */}
      <div className="arena-card-glass-premium p-6 mb-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 600px 200px at 50% 0%, rgba(255,51,85,.08), transparent), radial-gradient(ellipse 400px 300px at 80% 100%, rgba(255,176,32,.05), transparent)"
        }} />
        <div className="relative">
          <div className="text-[10px] text-primary uppercase tracking-[3px] font-semibold mb-1">🏁 Live Event</div>
          <h2 className="text-2xl font-black !mb-1">{tournament.title}</h2>
          <p className="text-xs text-casino-muted mb-3">Climb the board before the timer ends</p>
          <div className="flex justify-center gap-4 text-center mb-3">
            <div><div className="text-lg font-bold text-gold">{leaderboard.length}</div><div className="text-[9px] text-casino-muted uppercase">Players</div></div>
            <div className="w-px bg-casino-border" />
            <div><div className="text-lg font-bold text-gold">{tournament.prizePool}</div><div className="text-[9px] text-casino-muted uppercase">Prize Pool</div></div>
            <div className="w-px bg-casino-border" />
            <div><div className="text-lg font-bold">{isJoined ? `#${userRank}` : "—"}</div><div className="text-[9px] text-casino-muted uppercase">Your Rank</div></div>
          </div>
          {!isJoined ? (
            <button className="arena-btn !w-auto !px-8 !inline-flex" onClick={() => joinM.mutate(tournament.id)} disabled={joinM.isPending} data-testid="join-tournament">
              {joinM.isPending ? "JOINING..." : "🏁 JOIN TOURNAMENT"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-win font-bold">✓ Joined</span>
              <a href="/game/slot-basic" className="arena-btn !w-auto !px-6 !inline-flex !text-[11px]" data-testid="tournament-play-cta">🎰 PLAY SLOTS</a>
            </div>
          )}
        </div>
      </div>

      {/* Sprint Pass Boost Panel */}
      {isJoined && (
        <div className="arena-card-glass-premium p-4 mb-5" data-testid="sprint-pass-panel">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold !mb-0">⚡ Sprint Pass</h3>
            <span className="text-[9px] text-casino-muted bg-[rgba(107,107,128,.1)] px-2 py-0.5 rounded-full" data-testid="boost-status">{boost.status === "active" ? "🔥 ACTIVE" : boost.status === "ready" ? "🎁 READY" : boost.status === "consumed" ? "✓ CONSUMED" : "🔒 LOCKED"}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 arena-progress"><div className="arena-progress-fill" style={{ width: `${(boost.questsCompleted / boost.questsTotal) * 100}%` }} /></div>
            <span className="text-[10px] text-casino-muted shrink-0">{boost.questsCompleted}/{boost.questsTotal}</span>
          </div>
          {boost.bonusPoints > 0 && <div className="text-[10px] text-gold font-bold mb-1" data-testid="boost-points">⚡ +{boost.bonusPoints} boost points</div>}
          <div className="space-y-1.5">
            {boost.quests?.map((q: any) => (
              <div key={q.code} className="flex items-center gap-2 text-[10px]" data-testid={`event-quest-${q.code}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 ${q.status === "completed" ? "bg-win text-white" : "bg-[rgba(19,19,31,.6)] text-casino-muted"}`}>{q.status === "completed" ? "✓" : q.progress > 0 ? "◐" : "○"}</span>
                <span className="flex-1 text-casino-text">{q.title}</span>
                <span className={q.status === "completed" ? "text-win" : "text-casino-muted"}>{q.progress}/{q.target}</span>
              </div>
            ))}
          </div>
          {boost.status === "ready" && (
            <button className="arena-btn !w-auto !px-6 !py-2 !text-[10px] mt-3" onClick={() => boostM.mutate(tournament.id)} disabled={boostM.isPending} data-testid="boost-activate">
              {boostM.isPending ? "ACTIVATING..." : "⚡ ACTIVATE BOOST"}
            </button>
          )}
          {boost.status === "active" && <div className="text-[9px] text-gold mt-2">🔥 Boost active — {boost.spinsRemaining} spins remaining</div>}
        </div>
      )}

      {/* Player Rank Card */}
      {isJoined && (
        <div className="arena-card-glass p-4 mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-casino-muted uppercase tracking-wider">Your Rank</div>
            <div className="text-2xl font-black text-gold">#{userRank}</div>
            <div className="text-xs text-casino-muted">{userPoints} points · {me?.spins || 0} spins</div>
          </div>
          <div className="text-right" data-testid="current-user-rank">
            <div className="text-[10px] text-casino-muted">Prize: {me?.prizeEligible ? "🏆 Eligible!" : `${me?.pointsToNextRank || "—"} pts to podium`}</div>
            {me?.nextRankPoints && (
              <div className="arena-progress mt-1.5 w-32">
                <div className="arena-progress-fill" style={{ width: `${Math.min(100, (userPoints / me.nextRankPoints) * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Podium */}
      {top3.length >= 3 && <Podium top3={top3} />}

      {/* Prize Ladder */}
      {prizes.length > 0 && (
        <div className="arena-card-glass p-4 mb-5" data-testid="prize-ladder">
          <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-2">Prize Ladder</h3>
          <div className="flex gap-2 flex-wrap">
            {prizes.map((p: any, i: number) => (
              <div key={i} className={`flex-1 min-w-[80px] text-center p-2 rounded-xl ${i < 3 ? "arena-card-glass-premium" : "arena-card-solid"}`}>
                <div className="text-sm font-bold text-gold">{p.amount > 0 ? `+${p.amount}` : "—"}</div>
                <div className="text-[8px] text-casino-muted uppercase">{p.label}</div>
                <div className="text-[8px] text-casino-muted">{p.rank} place</div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-casino-muted mt-2">Prize preview — paid when tournament ends</p>
        </div>
      )}

      {/* Leaderboard */}
      <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-2">Leaderboard</h3>
      <div className="space-y-1.5 mb-5">
        {leaderboard.map((e: any) => (
          <div key={e.rank} className={`arena-card-glass p-2.5 flex items-center gap-2.5 text-sm ${e.isCurrentUser ? "ring-1 ring-primary/40 bg-[rgba(255,51,85,.04)]" : ""}`} data-testid={`tournament-row-${e.rank}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${e.rank <= 3 ? "bg-gradient-to-br from-gold to-primary text-white" : "bg-[rgba(19,19,31,.6)] text-casino-muted"}`}>{e.rank}</span>
            <span className="flex-1 font-semibold text-xs">{e.player} {e.isCurrentUser ? "(you)" : ""}</span>
            <div className="text-right">
              <div className="text-xs font-bold text-gold">{e.points}pts</div>
              <div className="text-[8px] text-casino-muted">{e.spins || 0} spins</div>
            </div>
          </div>
        ))}
      </div>

      {/* Rules */}
      {tournament.rules?.length > 0 && (
        <div className="arena-card-solid p-4">
          <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-2">Rules</h3>
          <ul className="text-[11px] text-casino-muted space-y-1">
            {tournament.rules.map((r: string, i: number) => <li key={i}>• {r}</li>)}
          </ul>
          <p className="text-[9px] text-casino-muted mt-2 opacity-60">Scoring: points = wagered + won×2 + spins×10</p>
        </div>
      )}

      {/* Podium Moment Modal */}
      <PodiumMomentModal
        tournamentId={tournament.id}
        rank={userRank}
        points={userPoints || 0}
        prizes={prizes}
        onDismiss={handlePodiumDismiss}
      />
    </div>
  );
}
