import { Pool } from "pg";

export interface ComboState {
  userId: string;
  streak: number;
  multiplier: number;
  nextThreshold: number;
  maxStreakToday: number;
}

const MULTIPLIER_TIERS: Array<{ streak: number; multiplier: number }> = [
  { streak: 2, multiplier: 1.5 },
  { streak: 3, multiplier: 2.0 },
  { streak: 5, multiplier: 3.0 },
  { streak: 7, multiplier: 5.0 },
  { streak: 10, multiplier: 10.0 },
];

export function getMultiplier(streak: number): number {
  let m = 1.0;
  for (const t of MULTIPLIER_TIERS) {
    if (streak >= t.streak) m = t.multiplier;
  }
  return m;
}

export function getNextThreshold(streak: number): number {
  for (const t of MULTIPLIER_TIERS) {
    if (streak < t.streak) return t.streak;
  }
  return MULTIPLIER_TIERS[MULTIPLIER_TIERS.length - 1].streak;
}

export class ComboService {
  constructor(private pool: Pool) {}

  async ensureTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS combo_streaks (
        user_id TEXT PRIMARY KEY,
        streak INTEGER NOT NULL DEFAULT 0,
        max_streak_today INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async getState(userId: string): Promise<ComboState> {
    const r = await this.pool.query(
      "SELECT streak, max_streak_today FROM combo_streaks WHERE user_id = $1",
      [userId]
    );
    if (r.rows.length === 0) {
      return { userId, streak: 0, multiplier: 1.0, nextThreshold: 2, maxStreakToday: 0 };
    }
    const streak = r.rows[0].streak as number;
    const maxToday = r.rows[0].max_streak_today as number;
    return {
      userId,
      streak,
      multiplier: getMultiplier(streak),
      nextThreshold: getNextThreshold(streak),
      maxStreakToday: maxToday,
    };
  }

  async recordWin(userId: string): Promise<ComboState> {
    const before = await this.getState(userId);
    const newStreak = before.streak + 1;
    const newMax = Math.max(before.maxStreakToday, newStreak);
    await this.pool.query(
      `INSERT INTO combo_streaks (user_id, streak, max_streak_today, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         streak = EXCLUDED.streak,
         max_streak_today = GREATEST(combo_streaks.max_streak_today, EXCLUDED.max_streak_today),
         updated_at = NOW()`,
      [userId, newStreak, newMax]
    );
    return {
      userId,
      streak: newStreak,
      multiplier: getMultiplier(newStreak),
      nextThreshold: getNextThreshold(newStreak),
      maxStreakToday: newMax,
    };
  }

  async recordLoss(userId: string): Promise<ComboState> {
    const before = await this.getState(userId);
    await this.pool.query(
      `INSERT INTO combo_streaks (user_id, streak, max_streak_today, updated_at)
       VALUES ($1, 0, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         streak = 0,
         updated_at = NOW()`,
      [userId, before.maxStreakToday]
    );
    return {
      userId,
      streak: 0,
      multiplier: 1.0,
      nextThreshold: 2,
      maxStreakToday: before.maxStreakToday,
    };
  }
}
