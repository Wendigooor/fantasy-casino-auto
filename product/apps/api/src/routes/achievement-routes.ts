import { FastifyInstance, FastifyRequest } from "fastify";

const BADGES = {
  first_spin: { name: "First Spin", emoji: "🎰", desc: "Play your first game" },
  big_winner: { name: "Big Winner", emoji: "💰", desc: "Win 1000+ in a single spin" },
  high_roller: { name: "High Roller", emoji: "💎", desc: "Deposit 10000+ total" },
  spin_master: { name: "Spin Master", emoji: "🎯", desc: "100+ spins" },
  lucky_7: { name: "Lucky 7", emoji: "🍀", desc: "Hit 3 sevens" },
  duelist: { name: "Duelist", emoji: "⚔️", desc: "Win a PvP duel" },
  centurion: { name: "Centurion", emoji: "🏆", desc: "Balance over 100000" },
};

async function uid(r: FastifyRequest) { return (r.user as { id: string }).id; }

export async function achievementRoutes(app: FastifyInstance) {
  app.get("/achievements", async (request) => {
    const userId = await uid(request);
    const results = [];

    const spins = await app.pg.query("SELECT COUNT(*) as c FROM game_rounds WHERE user_id = $1", [userId]);
    if (parseInt(spins.rows[0].c) >= 1) results.push({ ...BADGES.first_spin, earned: true, progress: "1+" });

    const bigWin = await app.pg.query("SELECT MAX(win_amount) as m FROM game_rounds WHERE user_id = $1", [userId]);
    results.push({ ...BADGES.big_winner, earned: Number(bigWin.rows[0].m) >= 1000, progress: `${Number(bigWin.rows[0].m)}/1000` });

    const deposits = await app.pg.query("SELECT COALESCE(SUM(amount),0) as t FROM ledger_entries WHERE user_id = $1 AND type = 'deposit'", [userId]);
    results.push({ ...BADGES.high_roller, earned: Number(deposits.rows[0].t) >= 10000, progress: `${Number(deposits.rows[0].t)}/10000` });

    results.push({ ...BADGES.spin_master, earned: parseInt(spins.rows[0].c) >= 100, progress: `${spins.rows[0].c}/100` });

    const bal = await app.pg.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);
    results.push({ ...BADGES.centurion, earned: bal.rows.length > 0 && Number(bal.rows[0].balance) >= 100000, progress: bal.rows.length > 0 ? `${Number(bal.rows[0].balance)}/100000` : "0/100000" });

    const lucky7 = await app.pg.query("SELECT 1 FROM game_rounds WHERE user_id = $1 AND win_amount > bet_amount * 1.4 LIMIT 1", [userId]);
    results.push({ ...BADGES.lucky_7, earned: lucky7.rows.length > 0, progress: lucky7.rows.length > 0 ? "yes" : "no" });

    const duels = await app.pg.query("SELECT 1 FROM duels WHERE winner_id = $1 LIMIT 1", [userId]);
    results.push({ ...BADGES.duelist, earned: duels.rows.length > 0, progress: duels.rows.length > 0 ? "yes" : "no" });

    return { achievements: results, earned: results.filter(r => r.earned).length, total: results.length };
  });
}
