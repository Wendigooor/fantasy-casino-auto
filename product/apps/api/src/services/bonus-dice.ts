import { Pool } from "pg";

export interface DiceRollResult {
  dice1: number;
  dice2: number;
  sum: number;
  rewardType: string;
  rewardValue: number;
  rewardLabel: string;
}

export interface DiceStatus {
  canRoll: boolean;
  cooldownHours: number;
  lastRoll: DiceRollResult | null;
}

const REWARD_TABLE: Record<number, { type: string; value: number; label: string }> = {
  2:  { type: "deposit_match", value: 200, label: "200% Deposit Match" },
  3:  { type: "deposit_match", value: 100, label: "100% Deposit Match" },
  4:  { type: "deposit_match", value: 100, label: "100% Deposit Match" },
  5:  { type: "deposit_match", value: 50,  label: "50% Deposit Match" },
  6:  { type: "deposit_match", value: 50,  label: "50% Deposit Match" },
  7:  { type: "deposit_match", value: 25,  label: "25% Deposit Match" },
  8:  { type: "deposit_match", value: 25,  label: "25% Deposit Match" },
  9:  { type: "free_spins",    value: 20,  label: "20 Free Spins" },
  10: { type: "free_spins",    value: 20,  label: "20 Free Spins" },
  11: { type: "free_spins",    value: 50,  label: "50 Free Spins" },
  12: { type: "deposit_match", value: 300, label: "300% Mega Match" },
};

export class BonusDiceService {
  constructor(private pool: Pool) {}

  async getStatus(userId: string): Promise<DiceStatus> {
    const res = await this.pool.query(
      `SELECT dice1, dice2, dice_sum, reward_type, reward_value, reward_label, created_at
       FROM bonus_dice_rolls
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return { canRoll: true, cooldownHours: 0, lastRoll: null };
    }

    const row = res.rows[0];
    const createdAt = new Date(row.created_at);
    const nextAllowed = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const cooldownMs = nextAllowed.getTime() - now.getTime();
    const canRoll = cooldownMs <= 0;
    const cooldownHours = canRoll ? 0 : Math.ceil(cooldownMs / (60 * 60 * 1000));

    return {
      canRoll,
      cooldownHours,
      lastRoll: {
        dice1: row.dice1,
        dice2: row.dice2,
        sum: row.dice_sum,
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
        rewardLabel: row.reward_label,
      },
    };
  }

  async roll(userId: string): Promise<DiceRollResult> {
    // Check cooldown
    const status = await this.getStatus(userId);
    if (!status.canRoll) {
      throw new Error(`Cooldown active. ${status.cooldownHours}h remaining.`);
    }

    // Roll the dice
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const sum = dice1 + dice2;
    const reward = REWARD_TABLE[sum];

    // Save to DB
    await this.pool.query(
      `INSERT INTO bonus_dice_rolls (user_id, dice1, dice2, dice_sum, reward_type, reward_value, reward_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, dice1, dice2, sum, reward.type, reward.value, reward.label]
    );

    return {
      dice1,
      dice2,
      sum,
      rewardType: reward.type,
      rewardValue: reward.value,
      rewardLabel: reward.label,
    };
  }
}
