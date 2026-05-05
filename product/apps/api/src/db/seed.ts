import { Pool } from "pg";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

async function seed() {
  console.log("Seeding database...");

  // Seed more games
  const games = [
    ["slot-basic", "Basic Slots", "slot", "internal", 10, 10000],
    ["slot-fruit", "Fruit Slots", "slot", "internal", 20, 20000],
    ["roulette-eu", "European Roulette", "table", "internal", 100, 50000],
    ["blackjack", "Blackjack Classic", "table", "internal", 50, 25000],
    ["crash", "Crash Game", "crash", "internal", 10, 10000],
  ];

  for (const [id, name, type, provider, minBet, maxBet] of games) {
    await pool.query(
      `INSERT INTO games (id, name, type, provider, min_bet, max_bet, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET is_active = true, min_bet = $5, max_bet = $6`,
      [id, name, type, provider, minBet, maxBet]
    );
  }
  console.log("Seeded 5 games.");

  // Seed bonus rules as games of type 'bonus'
  const bonusRules = [
    ["bonus-welcome", "Welcome Bonus", "bonus", "internal", 0, 0,
      JSON.stringify({ match_percent: 100, max_bonus: 50000, wagering_multiplier: 30 })],
    ["bonus-reload", "Reload Bonus", "bonus", "internal", 0, 0,
      JSON.stringify({ match_percent: 50, max_bonus: 25000, wagering_multiplier: 25 })],
    ["bonus-freespins", "Free Spins Weekend", "bonus", "internal", 0, 0,
      JSON.stringify({ match_percent: 0, max_bonus: 0, wagering_multiplier: 0, free_spins: 20 })],
  ];

  for (const [id, name, type, provider, minBet, maxBet, config] of bonusRules) {
    await pool.query(
      `INSERT INTO games (id, name, type, provider, min_bet, max_bet, is_active, config)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT (id) DO UPDATE SET config = $7, is_active = true`,
      [id, name, type, provider, minBet, maxBet, config]
    );
  }
  console.log("Seeded 3 bonus rules.");

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
