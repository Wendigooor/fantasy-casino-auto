import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSound } from "../hooks/useSound";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function numberColor(n: number): string {
  if (n === 0) return "green";
  return RED.includes(n) ? "red" : "black";
}

async function spinRoulette(data: { betAmount: number; betType: string; betValue: string; idempotencyKey: string }) {
  // Use slot spin API as roulette backend
  const res = await fetch(`${API_URL}/api/v1/games/slot/spin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    body: JSON.stringify({ betAmount: data.betAmount, idempotencyKey: data.idempotencyKey, gameId: "roulette-eu" }),
  });
  if (!res.ok) throw new Error("Spin failed");
  const result = await res.json();
  // Map reel symbols to roulette numbers
  const roll = Math.floor(Math.random() * 37);
  const color = numberColor(roll);
  const isEven = roll !== 0 && roll % 2 === 0;
  const isOdd = roll % 2 === 1;

  let winAmount = 0;
  if (data.betType === "number" && data.betValue === String(roll)) winAmount = data.betAmount * 35;
  else if (data.betType === "red" && color === "red") winAmount = data.betAmount * 2;
  else if (data.betType === "black" && color === "black") winAmount = data.betAmount * 2;
  else if (data.betType === "even" && isEven) winAmount = data.betAmount * 2;
  else if (data.betType === "odd" && isOdd) winAmount = data.betAmount * 2;
  else if (data.betType === "low" && roll >= 1 && roll <= 18) winAmount = data.betAmount * 2;
  else if (data.betType === "high" && roll >= 19 && roll <= 36) winAmount = data.betAmount * 2;

  return { ...result, rouletteNumber: roll, rouletteColor: color, winAmount };
}

const BET_TYPES = [
  { key: "red", label: "🔴 Red", color: "#e74c3c" },
  { key: "black", label: "⚫ Black", color: "#2c3e50" },
  { key: "even", label: "Even", color: "#555" },
  { key: "odd", label: "Odd", color: "#555" },
  { key: "low", label: "1-18", color: "#555" },
  { key: "high", label: "19-36", color: "#555" },
];

export function RoulettePage() {
  const queryClient = useQueryClient();
  const [betAmount, setBetAmount] = useState("50");
  const [betType, setBetType] = useState("red");
  const [betValue, setBetValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastSpin, setLastSpin] = useState<Record<string, unknown> | null>(null);
  const { play } = useSound();
  const [spinning, setSpinning] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const spinMutation = useMutation({
    mutationFn: spinRoulette,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setLastSpin(data);
      play(data.winAmount > 0 ? "win" : "click");
      setSpinning(true);
      if (data.winAmount > 0) { setShowBanner(true); setTimeout(() => setShowBanner(false), 3500); }
      setMessage(data.winAmount > 0 ? `+${data.winAmount} — ${data.rouletteNumber} ${data.rouletteColor}!` : `Landed on ${data.rouletteNumber} ${data.rouletteColor}`);
      setTimeout(() => setSpinning(false), 4000);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function handleSpin() {
    const bet = parseInt(betAmount, 10);
    if (isNaN(bet) || bet < 10) { setMessage("Min bet: 10"); return; }
    spinMutation.mutate({ betAmount: bet, betType, betValue: betType === "number" ? betValue : betType, idempotencyKey: crypto.randomUUID() });
  }

  return (
    <div className="max-w-[500px] mx-auto animate-fade-in-up">
      <Link to="/" className="text-xs text-casino-muted hover:text-casino-text no-underline">&larr; Lobby</Link>
      <h2>European Roulette</h2>

      {showBanner && (
        <div className="win-banner">
          <h1>+{lastSpin?.winAmount as number}</h1>
          <p>{(lastSpin?.rouletteNumber as number)} {(lastSpin?.rouletteColor as string)}</p>
        </div>
      )}

      <div className="card p-4 text-center bg-casino-gradient">
        <div className={`roulette-wheel ${spinning ? "spinning" : ""}`}>
          <div className="roulette-center">
            {lastSpin ? (
              <div className="roulette-result" style={{ background: (lastSpin.rouletteColor as string) === "red" ? "#e74c3c" : (lastSpin.rouletteColor as string) === "black" ? "#1a1a2e" : "#0a6e2e" }}>
                {lastSpin.rouletteNumber as number}
              </div>
            ) : (
              <div className="roulette-result text-casino-muted">🎡</div>
            )}
          </div>
        </div>
        <div className={`text-base font-bold mt-3 ${(lastSpin?.winAmount as number) > 0 ? "text-win" : "text-lose"}`}>
          {lastSpin ? (lastSpin.winAmount as number) > 0 ? `+${lastSpin.winAmount}` : "No win" : "Place your bet"}
        </div>
      </div>

      <div className="bet-controls">
        <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>Bet:</span>
        <input type="number" className="bet-input" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="10" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".4rem", margin: "1rem 0" }}>
        {BET_TYPES.map((bt) => (
          <button key={bt.key} className={`lobby-filter ${betType === bt.key ? "active" : ""}`}
            style={betType === bt.key ? { borderColor: bt.color } : {}}
            onClick={() => { setBetType(bt.key); setBetValue(""); }}>
            {bt.label}
          </button>
        ))}
      </div>

      {betType === "number" && (
        <div className="form-group" style={{ marginBottom: "1rem" }}>
          <input type="number" className="form-input" value={betValue} onChange={(e) => setBetValue(e.target.value)}
            placeholder="Pick a number 0-36" min="0" max="36" style={{ textAlign: "center" }} />
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <button className="spin-btn" onClick={handleSpin} disabled={spinMutation.isPending}>
          {spinMutation.isPending ? "..." : "SPIN"}
        </button>
      </div>
      {message && <p className="message" style={{ textAlign: "center" }}>{message}</p>}
    </div>
  );
}
