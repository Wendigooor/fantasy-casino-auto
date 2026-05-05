import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchDashboard() {
  const res = await fetch(`${API_URL}/api/v1/dashboard/ops`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

async function fetchPendingKyc() {
  const res = await fetch(`${API_URL}/api/v1/admin/kyc/pending`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error("Failed to fetch KYC");
  return res.json();
}

export function AdminPage() {
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
  });

  const { data: kyc, isLoading: kycLoading } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: fetchPendingKyc,
  });

  return (
    <div className="page">
      <h2>Admin Dashboard</h2>

      {dashLoading && <p className="loading">Loading...</p>}
      {dash && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Players</h4>
              <p>{dash.players?.total || 0} total, {dash.players?.active24h || 0} active (24h)</p>
            </div>
            <div className="stat-card">
              <h4>Revenue (NGR)</h4>
              <p>${((dash.revenue?.ngr || 0) / 100).toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h4>RTP</h4>
              <p>{dash.revenue?.rtp || 0}%</p>
            </div>
            <div className="stat-card">
              <h4>Total Wagered</h4>
              <p>${((dash.gaming?.totalWagered || 0) / 100).toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h4>Total Wins</h4>
              <p>${((dash.gaming?.totalWins || 0) / 100).toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h4>Blocked Players (24h)</h4>
              <p>{dash.risk?.blockedPlayers24h || 0}</p>
            </div>
          </div>

          {dash.gaming?.topGames?.length > 0 && (
            <>
              <h3>Top Games</h3>
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Rounds</th>
                    <th>Total Bets</th>
                    <th>Total Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.gaming.topGames.map((g: { gameId: string; rounds: number; totalWins: number; totalBets: number }) => (
                    <tr key={g.gameId}>
                      <td>{g.gameId}</td>
                      <td>{g.rounds}</td>
                      <td>${(g.totalBets / 100).toFixed(2)}</td>
                      <td>${(g.totalWins / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      <h3>Pending KYC</h3>
      {kycLoading && <p className="loading">Loading...</p>}
      {kyc?.verifications?.length === 0 && <p className="empty">No pending verifications.</p>}
      {kyc?.verifications?.map((v: { id: string; userId: string; documentType: string; status: string; submittedAt: string }) => (
        <div key={v.id} className="kyc-card">
          <p>User: {v.userId}</p>
          <p>Document: {v.documentType}</p>
          <p>Status: {v.status}</p>
          <p>Submitted: {new Date(v.submittedAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
