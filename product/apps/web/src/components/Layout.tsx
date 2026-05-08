import { useContext, createContext, useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

interface User { id: string; email: string; role: string; balance?: number | null; }
interface AuthContextValue {
  user: User | null; token: string | null; isAuthenticated: boolean;
  login: (t: string, u: User) => void; logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : Promise.reject()).then(setUser)
      .catch(() => { localStorage.removeItem("token"); setToken(null); });
  }, [token]);
  const login = useCallback((t: string, u: User) => { localStorage.setItem("token", t); setToken(t); setUser(u); }, []);
  const logout = useCallback(() => { localStorage.removeItem("token"); setToken(null); setUser(null); }, []);
  return <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [liveBal, setLiveBal] = useState<number | null>(null);
  const show = loc.pathname !== "/login" && loc.pathname !== "/health";

  useEffect(() => {
    if (!isAuthenticated) return;
    const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
    const t = localStorage.getItem("token"); if (!t) return;
    const controller = new AbortController();

    fetch(`${API}/api/v1/sse`, { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data:") || line.startsWith("event:")) {
              try {
                const eventLine = line.startsWith("event:") ? line.slice(6).trim() : "";
                const dataLine = line.startsWith("data:") ? line.slice(5).trim() : lines.find(l => l.startsWith("data:"))?.slice(5).trim();
                if (dataLine && eventLine === "wallet_update") {
                  setLiveBal(JSON.parse(dataLine).balance);
                }
              } catch { /* skip */ }
            }
          }
        }
      }).catch(() => {});

    return () => controller.abort();
  }, [isAuthenticated]);

  const bal = liveBal ?? user?.balance ?? 0;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 h-16 flex items-center justify-between px-6 bg-casino-surface/80 backdrop-blur-xl border-b border-casino-border">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent no-underline">Casino</Link>
          {show && (
            <nav className="flex gap-1">
              {[{ to: "/", label: "Lobby" }, { to: "/lightning", label: "Lightning" }, { to: "/tournaments", label: "🏁 Tournaments" }, { to: "/missions", label: "🎯 Missions" }, { to: "/duels", label: "⚔️ Duels" }, { to: "/wallet", label: "Wallet" }, { to: "/bonus", label: "Bonuses" }].map(l => (
                <Link key={l.to} to={l.to} className="px-3 py-1.5 text-xs font-medium text-casino-muted hover:text-casino-text hover:bg-casino-card rounded-lg transition-colors no-underline">{l.label}</Link>
              ))}
            </nav>
          )}
        </div>
        {show && (
          <div className="relative">
            {isAuthenticated ? (
              <>
                <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-1.5 bg-casino-card border border-casino-border rounded-lg text-sm text-casino-text cursor-pointer">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">👤</span>
                  <span className="hidden sm:inline">{user?.email?.split("@")[0]}</span>
                  <span className="text-gold font-bold text-xs">${(bal / 100).toFixed(0)}</span>
                </button>
                {open && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-casino-card border border-casino-border rounded-xl overflow-hidden shadow-2xl z-50">
                    {[{ to: "/wallet", emoji: "💰", label: "Wallet" }, { to: "/kyc", emoji: "🛡", label: "KYC" }, { to: "/admin", emoji: "⚙", label: "Admin" }].map(l => (
                      <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-casino-text hover:bg-casino-surface transition-colors no-underline">{l.emoji} {l.label}</Link>
                    ))}
                    <button onClick={() => { logout(); navigate("/login"); setOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-casino-surface transition-colors border-t border-casino-border">🚪 Logout</button>
                  </div>
                )}
              </>
            ) : (
              <Link to="/login" className="px-3 py-1.5 text-xs font-medium text-casino-muted hover:text-casino-text rounded-lg transition-colors no-underline">Login</Link>
            )}
          </div>
        )}
      </header>

      {show && (
        <div className="vip-bar">
          <div className="vip-progress" style={{ width: `${Math.min(100, ((bal || 0) / 100000) * 100)}%` }} />
        </div>
      )}

      {show && (
        <div className="flex gap-8 px-6 py-1.5 bg-casino-card border-b border-casino-border text-[11px] text-casino-muted overflow-hidden">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-win animate-pulse"/> <b className="text-casino-text">2,847</b> online</span>
          <span>🎰 <b className="text-casino-text">52,341</b> spins today</span>
          <span>💰 Biggest: <b className="text-win">$14,200</b></span>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 w-full">{children}</main>
      <footer className="text-center py-3 text-[11px] text-casino-muted border-t border-casino-border">Casino v0.3 · Provably Fair · 18+</footer>
    </div>
  );
}
