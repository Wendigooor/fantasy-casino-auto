import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

function MissionCard({ m, onClaim, claiming }: { m: Mission; onClaim: (id: string) => void; claiming: boolean }) {
  const pct = m.progressPercent;
  const isComplete = m.status === "completed";
  const isClaimed = m.status === "claimed";
  const barColor = isComplete ? "var(--color-win)" : isClaimed ? "var(--color-casino-muted)" : "var(--color-primary)";

  return (
    <article
      className={`arena-card-glass p-4 ${isComplete ? "arena-card-glass-premium" : ""}`}
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

      {/* Progress bar */}
      <div className="arena-progress mb-2">
        <div
          className="arena-progress-fill"
          style={{ width: `${Math.max(pct, isClaimed ? 100 : 0)}%`, background: isClaimed ? "var(--color-casino-border)" : `linear-gradient(90deg, var(--color-primary), ${barColor})` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-casino-muted">
          {isClaimed ? "Reward claimed" : `${m.progress}/${m.target}`}
        </span>

        {isComplete && !isClaimed ? (
          <button
            className="arena-btn !w-auto !px-4 !py-1.5 !text-[10px]"
            onClick={() => onClaim(m.id)}
            disabled={claiming}
            data-testid="claim-button"
          >
            {claiming ? "CLAIMING..." : "CLAIM"}
          </button>
        ) : isClaimed ? (
          <span className="text-[10px] text-casino-muted">✓ {m.reward.amount > 0 ? `+${m.reward.amount}` : "Done"}</span>
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

  const { data, isLoading } = useQuery({
    queryKey: ["missions"],
    queryFn: () => fetch(`${API}/api/v1/missions`, { headers: auth() }).then(r => r.json()),
  });

  const claimM = useMutation({
    mutationFn: (missionId: string) =>
      fetch(`${API}/api/v1/missions/${missionId}/claim`, {
        method: "POST", headers: { ...auth(), "Content-Type": "application/json" },
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  const missions: Mission[] = data?.missions || [];
  const summary = data?.summary || { active: 0, completed: 0, claimed: 0 };

  const categories = ["onboarding", "daily", "pvp", "wager"] as const;
  const catLabels: Record<string, string> = { onboarding: "🌟 Onboarding", daily: "📅 Daily", pvp: "⚔️ PvP", wager: "💰 Wager" };

  return (
    <div className="max-w-2xl mx-auto" data-page="missions" data-ready="true">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="!mb-0">🎯 Missions</h2>
        <span className="text-[10px] text-casino-muted bg-[rgba(107,107,128,.1)] px-2.5 py-1 rounded-full border border-[rgba(107,107,128,.15)]">
          {summary.active} active · {summary.completed} ready
        </span>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="arena-card-glass px-4 py-2.5 flex-1 min-w-[100px] text-center">
          <div className="stat-value !text-lg">{summary.active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="arena-card-glass px-4 py-2.5 flex-1 min-w-[100px] text-center">
          <div className="stat-value !text-lg !text-gold">{summary.completed}</div>
          <div className="stat-label">Ready to claim</div>
        </div>
        <div className="arena-card-glass px-4 py-2.5 flex-1 min-w-[100px] text-center">
          <div className="stat-value !text-lg !text-win">{summary.claimed}</div>
          <div className="stat-label">Claimed</div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && missions.length === 0 && (
        <div className="arena-empty">
          <div className="arena-empty-icon">📋</div>
          <p className="arena-empty-text">No missions available right now.</p>
        </div>
      )}

      {/* Mission cards by category */}
      {!isLoading && missions.length > 0 && categories.map(cat => {
        const catMissions = missions.filter(m => m.category === cat);
        if (catMissions.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <h3 className="text-xs text-casino-muted uppercase tracking-wider font-semibold mb-2.5">{catLabels[cat] || cat}</h3>
            <div className="space-y-2.5">
              {catMissions.map(m => (
                <MissionCard
                  key={m.id}
                  m={m}
                  onClaim={(id) => claimM.mutate(id)}
                  claiming={claimM.isPending && claimM.variables === m.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
