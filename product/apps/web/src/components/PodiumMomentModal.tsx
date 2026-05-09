import { useEffect, useState, useCallback } from "react";

const PODIUM_KEY_PREFIX = "tournament-podium-moment:";

interface PodiumMomentModalProps {
  tournamentId: string;
  rank: number | null;
  points: number;
  prizes: { rank: number | string; label: string; amount: number }[];
  onDismiss: () => void;
}

const medals: Record<number, { emoji: string; label: string; gradient: string; glow: string; color: string }> = {
  1: {
    emoji: "👑",
    label: "Gold Podium",
    gradient: "linear-gradient(135deg, #ffb020, #ff8c00, #ffb020)",
    glow: "rgba(255,176,32,.5)",
    color: "#ffb020",
  },
  2: {
    emoji: "🥈",
    label: "Silver Podium",
    gradient: "linear-gradient(135deg, #c0c0c0, #e8e8e8, #a0a0a0)",
    glow: "rgba(192,192,192,.4)",
    color: "#c0c0c0",
  },
  3: {
    emoji: "🥉",
    label: "Bronze Podium",
    gradient: "linear-gradient(135deg, #cd7f32, #e8a85a, #b8722a)",
    glow: "rgba(205,127,50,.4)",
    color: "#cd7f32",
  },
};

export function PodiumMomentModal({ tournamentId, rank, points, prizes, onDismiss }: PodiumMomentModalProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if popup was already dismissed for this tournament/rank in this session
  useEffect(() => {
    if (rank === null || rank === undefined || rank > 3) {
      setVisible(false);
      return;
    }
    const key = `${PODIUM_KEY_PREFIX}${tournamentId}:${rank}`;
    const alreadyDismissed = sessionStorage.getItem(key) === "true";
    if (alreadyDismissed) {
      setDismissed(true);
      setVisible(false);
      return;
    }
    setDismissed(false);
    // Small delay for animation effect
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, [tournamentId, rank]);

  const handleClose = useCallback(() => {
    const key = `${PODIUM_KEY_PREFIX}${tournamentId}:${rank}`;
    sessionStorage.setItem(key, "true");
    setVisible(false);
    setDismissed(true);
    onDismiss();
  }, [tournamentId, rank, onDismiss]);

  if (!visible || !rank || rank > 3) return null;

  const medal = medals[rank];
  const prizeInfo = prizes.find((p) => {
    if (typeof p.rank === "number") return p.rank === rank;
    return false;
  });

  // Generate confetti pieces
  const confettiPieces = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${4 + Math.random() * 6}px`,
    color: [medal.color, "#ff3355", "#ffb020", "#00e676", "#ffffff"][Math.floor(Math.random() * 5)],
  }));

  return (
    <>
      {/* Confetti */}
      {confettiPieces.map((c) => (
        <div
          key={c.id}
          className="podium-confetti-piece"
          style={{
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
            width: c.size,
            height: c.size,
            backgroundColor: c.color,
          }}
        />
      ))}

      {/* Overlay */}
      <div
        className="podium-overlay"
        onClick={handleClose}
        data-testid="podium-moment-overlay"
      />

      {/* Modal */}
      <div
        className="podium-modal"
        data-testid="podium-moment-modal"
        data-rank={rank}
        role="dialog"
        aria-modal="true"
      >
        <div className="podium-modal-inner">
          {/* Medal / Rank circle */}
          <div className="podium-medal-container" style={{ "--podium-glow": medal.glow } as React.CSSProperties}>
            <div
              className="podium-medal-ring"
              style={{ background: medal.gradient }}
            >
              <div className="podium-medal-inner">
                <span className="podium-medal-emoji">{medal.emoji}</span>
              </div>
            </div>
          </div>

          {/* Rank number */}
          <div className="podium-rank-number" data-testid="podium-moment-rank">
            #{rank}
          </div>

          {/* Podium label with gradient */}
          <div
            className="podium-label"
            style={{ background: medal.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            {medal.label}
          </div>

          {/* Prize zone badge */}
          <div className="podium-prize-badge">
            <span>🏆 You are in the prize zone</span>
          </div>

          {/* Points */}
          <div className="podium-points">
            <span className="podium-points-label">Your Points</span>
            <span className="podium-points-value" data-testid="podium-moment-points">
              {points.toLocaleString()}
            </span>
          </div>

          {/* Prize amount */}
          {prizeInfo && (
            <div className="podium-prize-row" data-testid="podium-moment-prize">
              <span className="podium-prize-label">{prizeInfo.label}</span>
              <span className="podium-prize-amount">+{prizeInfo.amount.toLocaleString()}</span>
            </div>
          )}

          {/* CTA */}
          <button
            className="podium-cta"
            onClick={handleClose}
            data-testid="podium-moment-keep-playing"
          >
            Keep Playing
          </button>

          {/* Close link */}
          <button
            className="podium-close-link"
            onClick={handleClose}
            data-testid="podium-moment-close"
          >
            Close
          </button>
        </div>
      </div>

      {/* Inline styles for this component — scoped via class names */}
      <style>{`
        .podium-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 999;
          animation: podiumFadeIn 0.3s ease;
        }
        @keyframes podiumFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .podium-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          animation: podiumScaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          max-width: 400px;
          width: 90vw;
        }
        @keyframes podiumScaleIn {
          from { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .podium-modal-inner {
          background: linear-gradient(145deg, rgba(30, 30, 55, 0.95), rgba(20, 20, 40, 0.9));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 2rem 1.5rem;
          text-align: center;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 40px var(--podium-glow, rgba(255, 176, 32, 0.15)),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
        }
        .podium-modal-inner::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 50% 0%, var(--podium-glow, rgba(255,176,32,0.08)), transparent 60%);
          pointer-events: none;
        }
        .podium-medal-container {
          margin-bottom: 1rem;
          position: relative;
          display: flex;
          justify-content: center;
        }
        .podium-medal-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: podiumGlowPulse 2s ease-in-out infinite;
          position: relative;
        }
        .podium-medal-ring::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: inherit;
          opacity: 0.3;
          filter: blur(8px);
          z-index: -1;
          animation: podiumGlowExpand 2s ease-in-out infinite;
        }
        @keyframes podiumGlowPulse {
          0%, 100% { box-shadow: 0 0 15px var(--podium-glow, rgba(255,176,32,0.3)); }
          50% { box-shadow: 0 0 35px var(--podium-glow, rgba(255,176,32,0.6)); }
        }
        @keyframes podiumGlowExpand {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.1; }
        }
        .podium-medal-inner {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: rgba(8, 8, 15, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .podium-medal-emoji {
          font-size: 32px;
          line-height: 1;
        }
        .podium-rank-number {
          font-size: 48px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          margin-bottom: 0.25rem;
          text-shadow: 0 0 30px var(--podium-glow, rgba(255,176,32,0.3));
        }
        .podium-label {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
          background-clip: text !important;
          -webkit-background-clip: text !important;
        }
        .podium-prize-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: linear-gradient(135deg, rgba(255, 176, 32, 0.12), rgba(255, 51, 85, 0.08));
          border: 1px solid rgba(255, 176, 32, 0.2);
          border-radius: 999px;
          padding: 0.35rem 1rem;
          margin-bottom: 1rem;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-gold, #ffb020);
        }
        .podium-points {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .podium-points-label {
          font-size: 10px;
          color: var(--color-casino-muted, #6b6b80);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.15rem;
        }
        .podium-points-value {
          font-size: 28px;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
        }
        .podium-prize-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .podium-prize-label {
          font-size: 12px;
          color: var(--color-casino-muted, #6b6b80);
        }
        .podium-prize-amount {
          font-size: 18px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--color-gold, #ffb020), #ff8c00);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .podium-cta {
          width: 100%;
          padding: 14px 0;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          background: linear-gradient(135deg, var(--color-primary, #ff3355), #ff1744);
          color: #fff;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }
        .podium-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 51, 85, 0.35);
        }
        .podium-cta:active {
          transform: translateY(0);
        }
        .podium-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .podium-cta:hover::before {
          opacity: 1;
        }
        .podium-close-link {
          background: none;
          border: none;
          color: var(--color-casino-muted, #6b6b80);
          font-size: 11px;
          cursor: pointer;
          padding: 0.5rem;
          transition: color 0.2s;
        }
        .podium-close-link:hover {
          color: var(--color-casino-text, #e8e8f0);
        }
        .podium-confetti-piece {
          position: fixed;
          top: -10px;
          border-radius: 2px;
          z-index: 1001;
          pointer-events: none;
          animation: podiumConfettiFall 3s ease-out forwards;
        }
        @keyframes podiumConfettiFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
