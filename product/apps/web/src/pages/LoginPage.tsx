import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/Layout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isReg, setIsReg] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      const ep = isReg ? "/api/v1/auth/register" : "/api/v1/auth/login";
      const res = await fetch(`${API_URL}${ep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      login(data.token, data.user);
      setMsg(isReg ? "Account created!" : "Welcome back!");
      setTimeout(() => navigate("/"), 500);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card p-8 w-full max-w-[420px] shadow-2xl">
        <div className="text-center text-2xl font-black bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent mb-1">Casino</div>
        <h2 className="text-center text-base font-medium text-casino-muted mb-6">{isReg ? "Create Account" : "Welcome Back"}</h2>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="e" className="block text-xs font-medium text-casino-muted mb-1">Email</label>
            <input id="e" type="email" className="input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@casino.io" required />
          </div>
          <div>
            <label htmlFor="p" className="block text-xs font-medium text-casino-muted mb-1">Password</label>
            <input id="p" type="password" className="input w-full" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={8} required />
          </div>
          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>{loading ? "..." : isReg ? "Register" : "Login"}</button>
        </form>
        {msg && <p className="mt-4 text-sm text-center text-casino-text">{msg}</p>}
        <p className="mt-4 text-xs text-center text-casino-muted">
          {isReg ? "Have an account?" : "New here?"}{" "}
          <button className="btn-ghost text-xs" onClick={() => { setIsReg(!isReg); setMsg(null); }}>{isReg ? "Login" : "Register"}</button>
        </p>
      </div>
    </div>
  );
}
