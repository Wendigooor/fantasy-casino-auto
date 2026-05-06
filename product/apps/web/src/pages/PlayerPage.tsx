import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../components/Layout";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

export function PlayerPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["duel-stats"],
    queryFn: () => fetch(`${API}/api/v1/players/me/duel-stats`, { headers: auth() }).then(r => r.json()),
  });
  const { data: mine } = useQuery({
    queryKey: ["duels-mine"],
    queryFn: () => fetch(`${API}/api/v1/duels/mine`, { headers: auth() }).then(r => r.json()),
  });

  if (isLoading) return <div className="max-w-lg mx-auto"><div className="skeleton h-64 rounded-2xl" /></div>;

  const duels = mine?.duels || [];
  const settled = duels.filter((d: any) => d.status === "settled");
  const s = stats || { totalDuels: 0, wins: 0, losses: 0, winRate: 0, biggestWin: 0, totalWagered: 0 };
  const email = user?.email || "Player";
  const name = email.split("@")[0];

  return (
    <div className="max-w-lg mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="arena-card-glass p-6 text-center mb-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-gold/20 flex items-center justify-center text-2xl font-bold mx-auto mb-2 shadow-lg shadow-primary/10">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="text-lg font-bold">{name}</div>
        <div className="text-[10px] text-casino-muted">{email}</div>
      </div>

      {/* Stats */}
      <div className="arena-card-glass p-5 mb-4">
        <h3 className="text-[11px] text-casino-muted uppercase tracking-wider font-semibold mb-4">DUEL RECORD</h3>

        <div className="flex justify-between items-center mb-4">
          <div className="text-center flex-1">
            <div className="stat-value text-win">{s.wins}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="text-center flex-1">
            <div className="stat-value">{s.totalDuels}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="text-center flex-1">
            <div className="stat-value text-lose">{s.losses}</div>
            <div className="stat-label">Losses</div>
          </div>
        </div>

        {/* Win Rate Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[9px] text-casino-muted mb-1.5">
            <span className="uppercase tracking-wider">Win Rate</span>
            <span className="font-bold text-gold">{s.winRate}%</span>
          </div>
          <div className="h-2.5 bg-[rgba(19,19,31,.6)] rounded-full overflow-hidden border border-[rgba(37,37,64,.3)]">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all duration-1000 shadow-sm shadow-gold/20"
              style={{ width: `${Math.min(s.winRate, 100)}%` }} />
          </div>
        </div>

        <hr className="arena-divider my-3" />

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[rgba(19,19,31,.4)] rounded-xl p-3 text-center border border-[rgba(37,37,64,.2)]">
            <div className="text-gold font-bold text-lg">{s.biggestWin}</div>
            <div className="stat-label">Biggest Win</div>
          </div>
          <div className="bg-[rgba(19,19,31,.4)] rounded-xl p-3 text-center border border-[rgba(37,37,64,.2)]">
            <div className="text-casino-text font-bold text-lg">{s.totalWagered}</div>
            <div className="stat-label">Total Wagered</div>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="arena-card-glass p-5">
        <h3 className="text-[11px] text-casino-muted uppercase tracking-wider font-semibold mb-3">RECENT DUELS</h3>
        {settled.length === 0 && <p className="text-xs text-casino-muted italic py-2">No duels played yet.</p>}
        <div className="space-y-1">
          {settled.slice(0, 10).map((d: any) => {
            const won = d.winnerId === user?.id;
            return (
              <Link key={d.id} to={`/duels/${d.id}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[rgba(19,19,31,.3)] hover:bg-[rgba(19,19,31,.6)] transition-colors arena-link">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{won ? "🏆" : "💀"}</span>
                  <div>
                    <div className="text-sm font-semibold">{d.betAmount} coins</div>
                    <div className="text-[9px] text-casino-muted">{new Date(d.createdAt as string).toLocaleDateString()}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-bold ${won ? "text-win" : "text-lose"}`}>{won ? "Won" : "Lost"}</span>
              </Link>
            );
          })}
        </div>
        {settled.length > 10 && <Link to="/duels" className="block text-center text-xs text-primary mt-3 arena-link">VIEW ALL &rarr;</Link>}
      </div>
    </div>
  );
}
