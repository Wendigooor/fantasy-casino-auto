import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast, ToastContainer } from "../hooks/useToast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchW() { const r = await fetch(`${API_URL}/api/v1/wallet`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } }); if (!r.ok) throw new Error(""); return r.json(); }
async function fetchL() { const r = await fetch(`${API_URL}/api/v1/wallet/ledger`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } }); if (!r.ok) throw new Error(""); return r.json(); }
async function depositApi(d: { amount: number; idempotencyKey: string }) {
  const r = await fetch(`${API_URL}/api/v1/wallet/deposit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: JSON.stringify(d) }); if (!r.ok) throw new Error("Failed"); return r.json();
}
async function withdrawApi(d: { amount: number; currency: string; idempotencyKey: string; destination: string }) {
  const r = await fetch(`${API_URL}/api/v1/wallet/withdraw`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` }, body: JSON.stringify(d) }); if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); } return r.json();
}

export function WalletPage() {
  const qc = useQueryClient();
  const [dep, setDep] = useState("");
  const [wdAmt, setWdAmt] = useState("");
  const [wdDest, setWdDest] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const { toasts, toast } = useToast();
  const { data: wallet, isLoading: wl } = useQuery({ queryKey: ["wallet"], queryFn: fetchW });
  const { data: ledger, isLoading: ll } = useQuery({ queryKey: ["ledger"], queryFn: fetchL });

  const dm = useMutation({ mutationFn: depositApi,     onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet"] }); qc.invalidateQueries({ queryKey: ["ledger"] }); setMsg("Deposited!"); setDep(""); toast("Deposit confirmed", "success"); }, onError: (e: Error) => setMsg(e.message) });
  const wm = useMutation({ mutationFn: withdrawApi,     onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet"] }); qc.invalidateQueries({ queryKey: ["ledger"] }); setMsg("Withdrawn!"); setWdAmt(""); setWdDest(""); toast("Withdrawal submitted", "info"); }, onError: (e: Error) => setMsg(e.message) });

  useEffect(() => {
    const t = localStorage.getItem("token"); if (!t) return;
    const controller = new AbortController();

    fetch(`${API_URL}/api/v1/sse`, { headers: { Authorization: `Bearer ${t}` }, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          for (const chunk of buf.split("\n\n")) {
            const dataMatch = chunk.match(/^data: (.*)$/m);
            const eventMatch = chunk.match(/^event: (.*)$/m);
            if (dataMatch && eventMatch?.[1] === "wallet_update") {
              qc.setQueryData(["wallet"], (old: typeof wallet) => old ? { ...old, balance: JSON.parse(dataMatch[1]).balance } : old);
            }
          }
          buf = buf.includes("\n\n") ? buf.split("\n\n").pop() || "" : "";
        }
      }).catch(() => {});

    return () => controller.abort();
  }, [qc, wallet]);

  return (
    <div className="max-w-[700px] mx-auto animate-fade-in-up">
      <ToastContainer toasts={toasts} />
      <h2>Wallet</h2>
      {wl && <div className="skeleton h-24 rounded-2xl mb-4" />}
      {wallet && (
        <div className="card p-6 text-center mb-6 bg-casino-gradient">
          <div className="text-[11px] text-casino-muted uppercase tracking-[2px] mb-1">Balance</div>
          <div className="text-3xl font-black">{wallet.currency} {Number(wallet.balance).toFixed(2)}</div>
          {wallet.state !== "active" && <div className="mt-1 text-xs text-gold">{wallet.state}</div>}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["deposit", "withdraw"] as const).map(t => <button key={t} className={`filter-btn capitalize ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setMsg(null); }}>{t}</button>)}
      </div>

      {tab === "deposit" && (
        <form onSubmit={e => { e.preventDefault(); const n = parseFloat(dep); if (isNaN(n) || n < 100) { setMsg("Min 100"); return; } dm.mutate({ amount: n, idempotencyKey: crypto.randomUUID() }); }} className="card p-4 mb-4">
          <label className="block text-xs text-casino-muted mb-1">Amount (USD)</label>
          <div className="flex gap-2">
            <input type="number" className="input flex-1" value={dep} onChange={e => setDep(e.target.value)} placeholder="Min 100" min="100" />
            <button type="submit" className="btn-primary" disabled={dm.isPending}>{dm.isPending ? "..." : "Deposit"}</button>
          </div>
        </form>
      )}

      {tab === "withdraw" && (
        <form onSubmit={e => { e.preventDefault(); const n = parseFloat(wdAmt); if (isNaN(n) || n < 100) { setMsg("Min 100"); return; } if (!wdDest.trim()) { setMsg("Enter destination"); return; } wm.mutate({ amount: n, currency: "USD", idempotencyKey: crypto.randomUUID(), destination: wdDest.trim() }); }} className="card p-4 mb-4">
          <label className="block text-xs text-casino-muted mb-1">Amount (USD)</label>
          <input type="number" className="input w-full mb-3" value={wdAmt} onChange={e => setWdAmt(e.target.value)} placeholder="Min 100" min="100" />
          <label className="block text-xs text-casino-muted mb-1">Destination</label>
          <div className="flex gap-2">
            <input type="text" className="input flex-1" value={wdDest} onChange={e => setWdDest(e.target.value)} placeholder="Wallet address or IBAN" />
            <button type="submit" className="btn-primary" disabled={wm.isPending}>{wm.isPending ? "..." : "Withdraw"}</button>
          </div>
        </form>
      )}

      {msg && <p className="text-sm text-center mb-4">{msg}</p>}

      <h3>Transactions</h3>
      {ll && <p className="text-xs text-casino-muted py-2">Loading...</p>}
      {ledger?.entries?.length > 0 ? (
        <table className="table-casino"><thead><tr><th>Type</th><th>Amount</th><th>After</th><th>Date</th></tr></thead><tbody>{ledger.entries.map((e: { id: string; type: string; amount: number; balanceAfter: number; createdAt: string }) => <tr key={e.id}><td className="text-[11px]">{e.type}</td><td className={e.amount >= 0 ? "text-win" : "text-lose"}>{e.amount >= 0 ? "+" : ""}{e.amount}</td><td className="text-[11px]">{e.balanceAfter}</td><td className="text-[11px] text-casino-muted">{new Date(e.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
      ) : <p className="text-xs text-casino-muted italic py-2">No transactions</p>}
    </div>
  );
}
