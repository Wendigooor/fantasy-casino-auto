import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function fetchGames() {
  const res = await fetch(`${API_URL}/api/v1/games`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const BANNER_GAMES = [
  { to: "/game/slot-basic", name: "Basic Slots", type: "slot", gradient: "from-purple-900 via-fuchsia-950 to-black", emoji: "🎰" },
  { to: "/roulette", name: "European Roulette", type: "table", gradient: "from-emerald-900 via-green-950 to-black", emoji: "🎡", badge: "FEATURED" },
  { to: "/game/slot-fruit", name: "Fruit Slots", type: "slot", gradient: "from-orange-900 via-red-950 to-black", emoji: "🍒" },
  { to: "/game/blackjack", name: "Blackjack", type: "table", gradient: "from-blue-900 via-indigo-950 to-black", emoji: "🃏" },
];

export function LobbyPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["games"], queryFn: fetchGames });

  const games = data?.games?.filter((g: { type: string; name: string }) =>
    (filter === "all" || g.type === filter) && (!search || g.name.toLowerCase().includes(search.toLowerCase()))
  ) || [];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-2">
      {/* Hero Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {BANNER_GAMES.map((g) => (
          <Link key={g.to} to={g.to}
            className={`relative h-44 sm:h-52 rounded-2xl overflow-hidden no-underline flex items-end p-5 group
              bg-gradient-to-b ${g.gradient} border border-casino-border hover:border-primary transition-all duration-300
              hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,51,85,.2)]`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute top-4 right-4 text-5xl opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">{g.emoji}</div>
            {g.badge && <div className="absolute top-3 left-3 px-2 py-0.5 bg-gold text-black text-[10px] font-bold rounded-full">{g.badge}</div>}
            <div className="relative z-10">
              <div className="text-white font-bold text-lg leading-tight">{g.name}</div>
              <div className="text-casino-muted text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Play Now →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-casino-card rounded-full p-0.5">
          {[
            { key: "all", label: "All Games" },
            { key: "slot", label: "Slots" },
            { key: "table", label: "Table" },
            { key: "crash", label: "Crash" },
          ].map((tab) => (
            <button key={tab.key}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                filter === tab.key ? "bg-primary text-white" : "text-casino-muted hover:text-casino-text"
              }`}
              onClick={() => setFilter(tab.key)}>{tab.label}</button>
          ))}
        </div>
        <input type="text" placeholder="Search games..." className="input w-48 !py-2 !text-xs ml-auto" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {Array.from({ length: 14 }).map((_, i) => <div key={i} className="skeleton h-[260px] rounded-2xl" />)}
        </div>
      )}

      {error && <p className="text-lose text-sm p-3 bg-lose/10 rounded-lg">Failed to load games</p>}

      {/* Game Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
        {games.map((g: { id: string; name: string; type: string; minBet: number; maxBet: number; provider: string }) => (
          <Link key={g.id} to={`/game/${g.id}`}
            className="card overflow-hidden no-underline text-casino-text hover:-translate-y-1 hover:border-primary
              transition-all duration-200 hover:shadow-[0_8px_32px_rgba(255,51,85,.15)] relative">
            <div className={`h-40 flex items-center justify-center text-5xl relative ${
              g.type === "slot" ? "game-thumb-slot" : g.type === "table" ? "game-thumb-table" : "game-thumb-crash"
            }`}>
              <span className="relative z-10 drop-shadow-lg">{g.type === "slot" ? "🎰" : g.type === "table" ? "🎲" : "📈"}</span>
              <div className="game-card-overlay"><div className="game-card-play">▶</div></div>
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-casino-card to-transparent" />
            </div>
            <div className="p-3">
              <h3 className="!text-sm !mb-0.5 !text-casino-text truncate">{g.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-casino-muted uppercase">{g.provider}</span>
                <span className="text-[10px] text-win font-medium">{Math.floor(Math.random() * 40) + 5} online</span>
              </div>
              <div className="text-[11px] text-casino-muted mt-1">Bet {g.minBet}–{g.maxBet}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
