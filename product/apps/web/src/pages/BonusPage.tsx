import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "";

// --- API ---

async function apiGet(path: string) {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path: string) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (res.status === 429) throw new Error("Cooldown active");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- Dice face map ---
const DICE_FACES: Record<number, string> = {
  1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅",
};

// --- Confetti component ---
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ["#ff3355", "#ffb020", "#00e676", "#38bdf8", "#a855f7"][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
    drift: (Math.random() - 0.5) * 100,
  }));
  return (
    <div className="confetti-overlay">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece-custom"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// --- Main Component ---
export function BonusPage() {
  const queryClient = useQueryClient();
  const [rolling, setRolling] = useState(false);
  const [die1, setDie1] = useState<number>(1);
  const [die2, setDie2] = useState<number>(6);
  const [showResult, setShowResult] = useState(false);
  const [diceClasses, setDiceClasses] = useState("die die-idle");
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch status
  const { data: status, isLoading } = useQuery({
    queryKey: ["dice-status"],
    queryFn: () => apiGet("/bonus/dice/status"),
    refetchInterval: 30_000,
  });

  // Roll mutation
  const rollMutation = useMutation({
    mutationFn: () => apiPost("/bonus/dice/roll"),
    onSuccess: (data) => {
      setLastResult(data);
      animateDice(data.dice1, data.dice2);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function animateDice(target1: number, target2: number) {
    setRolling(true);
    setShowResult(false);
    setDiceClasses("die die-rolling");

    // Rapid random changes during animation
    let ticks = 0;
    const maxTicks = 14;
    const interval = setInterval(() => {
      setDie1(Math.floor(Math.random() * 6) + 1);
      setDie2(Math.floor(Math.random() * 6) + 1);
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setDie1(target1);
        setDie2(target2);
        setDiceClasses("die die-landed");
        setTimeout(() => {
          setRolling(false);
          setShowResult(true);
          setDiceClasses("die die-idle");
          queryClient.invalidateQueries({ queryKey: ["dice-status"] });
        }, 600);
      }
    }, 100 + ticks * 15);
  }

  const canRoll = status?.canRoll;
  const cooldownH = status?.cooldownHours || 0;

  // Format cooldown time
  function formatCooldown(hours: number) {
    if (hours <= 0) return null;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="bonus-page">
      <Confetti active={showResult} />

      {/* Hero section */}
      <div className="dice-hero">
        <div className="dice-hero-glow" />
        <h1 className="dice-title">🎲 Daily Bonus Dice</h1>
        <p className="dice-subtitle">Roll once every 24 hours for a chance to win big!</p>
      </div>

      {/* Dice display */}
      <div className="dice-area">
        <div className={`dice-container ${rolling ? "dice-shaking" : ""}`}>
          <div className={diceClasses} data-face={die1}>
            <div className="die-face">{DICE_FACES[die1]}</div>
          </div>
          <div className="dice-vs">+</div>
          <div className={diceClasses} data-face={die2}>
            <div className="die-face">{DICE_FACES[die2]}</div>
          </div>
        </div>
      </div>

      {/* Roll button or cooldown */}
      <div className="dice-actions">
        {isLoading ? (
          <div className="dice-loading">Loading...</div>
        ) : canRoll ? (
          <button
            className="dice-roll-btn"
            disabled={rollMutation.isPending}
            onClick={() => rollMutation.mutate()}
          >
            {rollMutation.isPending ? "🎲 Rolling..." : "🎲 Roll the Dice!"}
          </button>
        ) : (
          <div className="dice-cooldown">
            <div className="cooldown-icon">⏳</div>
            <div className="cooldown-text">Next roll available in</div>
            <div className="cooldown-timer">{formatCooldown(cooldownH)}</div>
          </div>
        )}
        {error && <div className="dice-error">{error}</div>}
      </div>

      {/* Reward table */}
      <div className="dice-rewards">
        <h3>Possible Rewards</h3>
        <div className="rewards-grid">
          {[
            { sum: 2, label: "200% Match", emoji: "🌟", rare: true },
            { sum: 3, label: "100% Match", emoji: "💎" },
            { sum: 4, label: "100% Match", emoji: "💎" },
            { sum: 5, label: "50% Match", emoji: "🥈" },
            { sum: 6, label: "50% Match", emoji: "🥈" },
            { sum: 7, label: "25% Match", emoji: "🪙" },
            { sum: 8, label: "25% Match", emoji: "🪙" },
            { sum: 9, label: "20 Free Spins", emoji: "🎰" },
            { sum: 10, label: "20 Free Spins", emoji: "🎰" },
            { sum: 11, label: "50 Free Spins", emoji: "🔥" },
            { sum: 12, label: "300% Mega", emoji: "👑", rare: true },
          ].map((r) => (
            <div key={r.sum} className={`reward-cell ${r.rare ? "reward-rare" : ""} ${lastResult?.sum === r.sum ? "reward-hit" : ""}`}>
              <span className="reward-emoji">{r.emoji}</span>
              <span className="reward-sum">{r.sum}</span>
              <span className="reward-label">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bonus rules (existing) */}
      <div className="bonus-rules-section">
        <h3>Available Bonuses</h3>
        <ExistingBonusRules />
      </div>

      {/* Result Modal */}
      {showResult && lastResult && (
        <div className="modal-overlay" onClick={() => setShowResult(false)}>
          <div className="result-modal" onClick={(e) => e.stopPropagation()}>
            <div className="result-glow" />
            <div className="result-dice-display">
              <span className="result-die">{DICE_FACES[lastResult.dice1]}</span>
              <span className="result-plus">+</span>
              <span className="result-die">{DICE_FACES[lastResult.dice2]}</span>
              <span className="result-eq">=</span>
              <span className="result-sum">{lastResult.sum}</span>
            </div>
            <h2 className="result-title">You Won!</h2>
            <div className="result-reward-badge">{lastResult.rewardLabel}</div>
            <p className="result-desc">
              {lastResult.rewardType === "deposit_match"
                ? `Get a ${lastResult.rewardValue}% match on your next deposit!`
                : `Enjoy ${lastResult.rewardValue} free spins!`}
            </p>
            <button className="btn-primary result-close" onClick={() => setShowResult(false)}>
              Nice!
            </button>
          </div>
        </div>
      )}

      {/* Existing bonuses */}
      <div className="bonus-rules-section">
        <h3>Wagering Progress</h3>
        <ExistingWagering />
      </div>
    </div>
  );
}

// --- Existing sub-components ---

function ExistingBonusRules() {
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["bonus-rules"],
    queryFn: () =>
      fetch(`${API}/api/v1/bonus/rules`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      }).then((r) => r.json()),
  });

  if (isLoading) return <p className="loading">Loading bonuses...</p>;
  if (!bonuses?.rules?.length) return <p className="empty">No bonuses available.</p>;

  return (
    <div className="bonus-cards">
      {bonuses.rules.map((rule: any) => (
        <div key={rule.id} className="card bonus-card-item">
          <h4>{rule.name}</h4>
          <p className="text-casino-muted text-xs">{rule.type} · {rule.active ? "Active" : "Inactive"}</p>
        </div>
      ))}
    </div>
  );
}

function ExistingWagering() {
  const { data: wagering, isLoading } = useQuery({
    queryKey: ["bonus-wagering"],
    queryFn: () =>
      fetch(`${API}/api/v1/bonus/wagering`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      }).then((r) => r.json()),
  });

  if (isLoading) return <p className="loading">Loading wagering...</p>;
  if (!wagering?.progress?.length) return <p className="empty">No active wagering requirements.</p>;

  return (
    <div className="wagering-list">
      {wagering.progress.map((w: any) => (
        <div key={w.bonusId} className="wagering-item">
          <div className="wagering-header">
            <span className="text-sm font-semibold">{w.bonusId}</span>
            {w.completed && <span className="badge badge-green">Completed</span>}
          </div>
          <div className="wagering-bar">
            <div className="wagering-fill" style={{ width: `${Math.round(w.progress * 100)}%` }} />
          </div>
          <span className="text-xs text-casino-muted">{Math.round(w.progress * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
