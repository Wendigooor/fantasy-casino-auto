import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../components/Layout";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

type Mission = {
  id: string; code: string; title: string; description: string;
  category: string; objectiveType: string;
  progress: number; target: number; progressPercent: number;
  status: "active" | "completed" | "claimed";
  reward: { type: string; amount: number };
  cta: { label: string; href: string };
};

type Group = {
  id: string; title: string; progress: number; target: number;
  completionReward: { type: string; amount: number };
  missions: Mission[];
};

function RewardModal({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="arena-card-glass-premium p-8 max-w-sm w-full mx-4 text-center animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="text-6xl mb-4 animate-bounce">🎉</div>
        <h3 className="text-xl font-bold mb-1">{mission.title}</h3>
        <p className="text-sm text-casino-muted mb-4">Reward claimed!</p>
        <div className="text-3xl font-black text-gold mb-2">+{mission.reward.amount}</div>
        <div className="text-[10px] text-casino-muted uppercase tracking-wider mb-4">Coins credited</div>
        <button className="arena-btn !w-auto !px-8" onClick={onClose}>AWESOME</button>
      </div>
    </div>
  );
}

function MissionCard({ m, onClaim, claiming }: { m: Mission; onClaim: (id: string) => void; claiming: boolean }) {
  const isComplete = m.status === "completed";
  const isClaimed = m.status === "claimed";
  const isLocked = m.status === "active" && m.code === "comeback_trail";

  if (isLocked) {
    return (
      <article className="arena-card-solid p-4 opacity-50" data-testid={`mission-card-${m.code}`} data-state="locked">
        <div className="flex items-center justify-between">
          <div><h4 className="text-sm font-bold !mb-0">{m.title}</h4><p className="text-[11px] text-casino-muted mt-0.5">{m.description}</p></div>
          <div className="text-right"><span className="text-sm font-bold text-muted">🔒</span></div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`arena-card-glass p-4 transition-all duration-300 ${isComplete ? "arena-card-glass-premium" : ""}`}
      data-testid={`mission-card-${m.code}`}
      data-state={m.status}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="!mb-0 text-sm font-bold">{m.title}</h4>
            {isClaimed && <span className="arena-badge arena-badge-tie">✓ Claimed</span>}
            {isComplete && !isClaimed && <span className="arena-badge arena-badge-won">Claim</span>}
          </div>
          <p className="text-[11px] text-casino-muted mt-0.5">{m.description}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-sm font-bold text-gold">{m.reward.amount > 0 ? `+${m.reward.amount}` : ""}</div>
          <div className="text-[8px] text-casino-muted uppercase tracking-wider">{m.reward.type}</div>
        </div>
      </div>
      <div className="arena-progress mb-2">
        <div className="arena-progress-fill" style={{ width: `${Math.max(isClaimed ? 100 : m.progressPercent, 0)}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-casino-muted">{isClaimed ? "Reward claimed" : `${m.progress}/${m.target}`}</span>
        {isComplete && !isClaimed ? (
          <button className="arena-btn !w-auto !px-4 !py-1.5 !text-[10px]" onClick={() => onClaim(m.id)} disabled={claiming} data-testid="claim-button">
            {claiming ? "CLAIMING..." : "🎁 CLAIM"}
          </button>
        ) : isClaimed ? (
          <span className="text-[10px] text-gold">✓ +{m.reward.amount}</span>
        ) : (
          <a href={m.cta.href} className="arena-link text-[10px] font-semibold text-primary">{m.cta.label} →</a>
        )}
      </div>
    </article>
  );
}

export function MissionsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [rewardMission, setRewardMission] = useState<Mission | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => fetch(`${API}/api/v1/missions`, { headers: auth() }).then(r => r.json()),
    refetchInterval: 5000,
  });

  const claimM = useMutation({
    mutationFn: (missionId: string) =>
      fetch(`${API}/api/v1/missions/${missionId}/claim`, {
        method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: "{}",
      }).then(r => r.json()),
    onSuccess: (data, missionId) => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      // Show reward modal
      const mission = allMissions.find(m => m.id === missionId);
      if (mission && !data.error) {
        setRewardMission(mission);
      }
    },
    onSettled: () => setClaimingId(null),
  });

  const campaign = data?.campaign;
  const groups: Group[] = data?.groups || [];
  const allMissions: Mission[] = data?.missions || [];
  const summary = data?.summary || {};

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto" data-page="missions" data-ready="false">
        <div className="skeleton h-48 rounded-2xl mb-6" />
        <div className="skeleton h-28 rounded-2xl mb-3" />
        <div className="skeleton h-28 rounded-2xl mb-3" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto" data-page="missions" data-ready="true">
      {/* Reward Modal */}
      {rewardMission && <RewardModal mission={rewardMission} onClose={() => setRewardMission(null)} />}

      {/* Campaign Hero */}
      <div className="arena-card-glass-premium p-6 mb-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 500px 200px at 50% 0%, rgba(255,51,85,.1), transparent), radial-gradient(ellipse 300px 300px at 80% 100%, rgba(255,176,32,.06), transparent)"
        }} />
        <div className="relative">
          <div className="text-[10px] text-primary uppercase tracking-[3px] font-semibold mb-1">⚡ Limited Time Event</div>
          <h2 className="text-2xl font-black !mb-1">{campaign?.title || "Quest Rush"}</h2>
          <p className="text-xs text-casino-muted mb-3">{campaign?.subtitle}</p>
          <div className="flex justify-center gap-4 text-center">
            <div><div className="text-lg font-bold text-gold">{summary.totalEarned || 0}</div><div className="text-[9px] text-casino-muted uppercase">Earned</div></div>
            <div className="w-px bg-casino-border" />
            <div><div className="text-lg font-bold">{campaign?.rewardPool || 0}</div><div className="text-[9px] text-casino-muted uppercase">Prize Pool</div></div>
            <div className="w-px bg-casino-border" />
            <div><div className="text-lg font-bold text-primary">{summary.active || 0}</div><div className="text-[9px] text-casino-muted uppercase">Active</div></div>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex gap-3 mb-5">
        <a href={summary.nextBestAction?.href || "/"} className="arena-btn !w-auto !flex-1 !py-2.5 text-center no-underline">
          {summary.nextBestAction?.label || "Play Now"} →
        </a>
        <div className="arena-card-glass px-3 py-2 text-center min-w-[80px]">
          <div className="text-xs font-bold">{summary.completed || 0}</div>
          <div className="text-[8px] text-casino-muted uppercase">Claim</div>
        </div>
      </div>

      {/* Daily Rush Group */}
      {groups.filter(g => g.id === "daily-rush").map(group => (
        <div key={group.id} className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold !mb-0">{group.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-casino-muted">{group.progress}/{group.target}</span>
              <span className="arena-badge arena-badge-gold">Chest +{group.completionReward.amount}</span>
            </div>
          </div>
          <div className="arena-progress mb-3">
            <div className="arena-progress-fill" style={{ width: `${(group.progress / group.target) * 100}%` }} />
          </div>
          <div className="space-y-2.5">
            {group.missions.map(m => (
              <MissionCard key={m.id} m={m} onClaim={(id) => { setClaimingId(id); claimM.mutate(id); }} claiming={claimingId === m.id} />
            ))}
          </div>
        </div>
      ))}

      {/* Weekly Path */}
      <div className="arena-card-glass p-5 mb-6">
        <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-3">Weekly Path</h3>
        <div className="flex gap-2 justify-between">
          {["1st Spin", "5 Spins", "Duel", "Wager", "All Done"].map((step, i) => (
            <div key={i} className={`flex-1 text-center p-2 rounded-xl ${i === 0 ? "arena-card-glass-premium" : "arena-card-solid opacity-50"}`}>
              <div className={`text-xl mb-1 ${i === 0 ? "" : "grayscale"}`}>{["🎰", "🎰", "⚔️", "💰", "🏆"][i]}</div>
              <div className="text-[9px] font-semibold">{step}</div>
              <div className="text-[8px] text-casino-muted mt-0.5">{i === 0 ? "Done!" : "Locked"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {allMissions.length === 0 && (
        <div className="arena-empty"><div className="arena-empty-icon">📋</div><p className="arena-empty-text">No missions available.</p></div>
      )}
    </div>
  );
}
