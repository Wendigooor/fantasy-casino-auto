import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchBonuses() {
  const res = await fetch(`${API_URL}/api/v1/bonus/rules`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error("Failed to fetch bonuses");
  return res.json();
}

async function fetchWagering() {
  const res = await fetch(`${API_URL}/api/v1/bonus/wagering`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error("Failed to fetch wagering");
  return res.json();
}

export function BonusPage() {
  const { data: bonuses, isLoading: bonusLoading } = useQuery({
    queryKey: ["bonus-rules"],
    queryFn: fetchBonuses,
  });

  const { data: wagering, isLoading: wageringLoading } = useQuery({
    queryKey: ["bonus-wagering"],
    queryFn: fetchWagering,
  });

  return (
    <div className="page">
      <h2>Bonuses</h2>

      <h3>Available Bonuses</h3>
      {bonusLoading && <p className="loading">Loading bonuses...</p>}
      {bonuses?.rules && bonuses.rules.length === 0 && <p className="empty">No bonuses available.</p>}
      {bonuses?.rules?.map((rule: { id: string; name: string; type: string; active: boolean }) => (
        <div key={rule.id} className="bonus-card">
          <h4>{rule.name}</h4>
          <p>Type: {rule.type} | {rule.active ? "Active" : "Inactive"}</p>
        </div>
      ))}

      <h3>Wagering Progress</h3>
      {wageringLoading && <p className="loading">Loading wagering progress...</p>}
      {wagering?.progress?.length === 0 && <p className="empty">No active wagering requirements.</p>}
      {wagering?.progress?.map((w: { bonusId: string; progress: number; completed: boolean; requiredWager: number }) => (
        <div key={w.bonusId} className="progress-bar">
          <div className="progress-label">{w.bonusId}: {Math.round(w.progress * 100)}%</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${w.progress * 100}%` }} />
          </div>
          {w.completed && <span className="badge-ok">Completed</span>}
        </div>
      ))}
    </div>
  );
}
