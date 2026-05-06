import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, Layout } from "./components/Layout";
import { HealthPage } from "./pages/HealthPage";
import { LobbyPage } from "./pages/LobbyPage";
import { LoginPage } from "./pages/LoginPage";
import { WalletPage } from "./pages/WalletPage";
import { GamePage } from "./pages/GamePage";
import { BonusPage } from "./pages/BonusPage";
import { KycPage } from "./pages/KycPage";
import { AdminPage } from "./pages/AdminPage";
import { RoulettePage } from "./pages/RoulettePage";
import { DuelsPage } from "./pages/DuelsPage";
import { DuelPage } from "./pages/DuelPage";
import { MissionsPage } from "./pages/MissionsPage";
import { PlayerPage } from "./pages/PlayerPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { AchievementsPage } from "./pages/AchievementsPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <Layout>
      <Routes>
        <Route path="/game/:gameId" element={<AuthGuard><GamePage /></AuthGuard>} />
        <Route path="/roulette" element={<AuthGuard><RoulettePage /></AuthGuard>} />
        <Route path="/duels" element={<AuthGuard><DuelsPage /></AuthGuard>} />
        <Route path="/duels/:id" element={<AuthGuard><DuelPage /></AuthGuard>} />
        <Route path="/leaderboard" element={<AuthGuard><LeaderboardPage /></AuthGuard>} />
        <Route path="/achievements" element={<AuthGuard><AchievementsPage /></AuthGuard>} />
        <Route path="/missions" element={<AuthGuard><MissionsPage /></AuthGuard>} />
        <Route path="/player" element={<AuthGuard><PlayerPage /></AuthGuard>} />
        <Route path="/wallet" element={<AuthGuard><WalletPage /></AuthGuard>} />
        <Route path="/bonus" element={<AuthGuard><BonusPage /></AuthGuard>} />
        <Route path="/kyc" element={<AuthGuard><KycPage /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminPage /></AuthGuard>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/" element={isAuthenticated ? <LobbyPage /> : <Navigate to="/login" replace />} />
      </Routes>
    </Layout>
  );
}
