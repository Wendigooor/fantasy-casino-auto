import { Pool } from "pg";

export interface BonusRule {
  id: string;
  name: string;
  type: "deposit_match" | "free_spins" | "cashback" | "wager_bonus";
  active: boolean;
  parameters: Record<string, unknown>;
}

export interface WageringRequirement {
  bonusId: string;
  playerId: string;
  totalWagered: number;
  requiredWager: number;
  wagerContribution: Record<string, number>;
  expiresAt: Date;
  lockedAmount: number;
}

export class BonusRuleEngine {
  private rules: BonusRule[] = [];
  private wagering: Map<string, WageringRequirement> = new Map();

  constructor(private pool: Pool) {}

  async loadRules(): Promise<BonusRule[]> {
    const res = await this.pool.query(
      "SELECT id, name, type, active, config FROM games WHERE type = 'bonus' ORDER BY id"
    );
    this.rules = res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as BonusRule["type"],
      active: row.active,
      parameters: row.config || {},
    }));
    return this.rules;
  }

  getActiveRules(): BonusRule[] {
    return this.rules.filter((r) => r.active);
  }

  async createWageringRequirement(
    bonusId: string,
    playerId: string,
    requiredWager: number
  ): Promise<WageringRequirement> {
    const requirement: WageringRequirement = {
      bonusId,
      playerId,
      totalWagered: 0,
      requiredWager,
      wagerContribution: {
        slot: 1.0,
        table: 0.2,
        live: 0.1,
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lockedAmount: 0,
    };
    this.wagering.set(this._key(bonusId, playerId), requirement);

    await this.pool.query(
      `INSERT INTO bonus_wagering (bonus_id, player_id, required_wager, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [bonusId, playerId, requiredWager, requirement.expiresAt]
    );
    return requirement;
  }

  async recordWager(
    playerId: string,
    gameId: string,
    wagerAmount: number
  ): Promise<{
    bonusId: string;
    progress: number;
    completed: boolean;
  } | null> {
    let completed = false;
    for (const [key, req] of this.wagering.entries()) {
      if (req.playerId !== playerId) continue;
      if (req.totalWagered >= req.requiredWager) {
        completed = true;
        continue;
      }
      if (new Date() > req.expiresAt) {
        this.wagering.delete(key);
        continue;
      }
      const contribution = req.wagerContribution[gameId] ?? 1.0;
      req.totalWagered += wagerAmount * contribution;
      const progress = Math.min(req.totalWagered / req.requiredWager, 1);
      completed = req.totalWagered >= req.requiredWager;
      if (completed) {
        await this.pool.query(
          `UPDATE bonus_wagering SET completed_at = NOW() WHERE bonus_id = $1 AND player_id = $2`,
          [req.bonusId, playerId]
        );
      }
      return { bonusId: req.bonusId, progress, completed };
    }
    return null;
  }

  async getWageringProgress(playerId: string): Promise<
    Array<{
      bonusId: string;
      progress: number;
      completed: boolean;
      requiredWager: number;
      totalWagered: number;
      expiresAt: Date;
    }>
  > {
    const res = await this.pool.query(
      `SELECT bonus_id, required_wager, total_wagered, expires_at, completed_at
       FROM bonus_wagering
       WHERE player_id = $1 AND expires_at > NOW()`,
      [playerId]
    );
    return res.rows.map((row) => ({
      bonusId: row.bonus_id,
      progress: row.total_wagered / row.required_wager,
      completed: !!row.completed_at,
      requiredWager: row.required_wager,
      totalWagered: row.total_wagered,
      expiresAt: new Date(row.expires_at),
    }));
  }

  applyBonus(
    rule: BonusRule,
    depositAmount: number
  ): { bonusAmount: number; currency: string; wageringRequired: number } {
    if (!rule.active) {
      throw new Error(`Bonus rule "${rule.id}" is not active`);
    }
    if (rule.type !== "deposit_match") {
      throw new Error(`Unsupported bonus type: ${rule.type}`);
    }
    const matchPct = (rule.parameters.match_percent as number) ?? 100;
    const maxBonus = (rule.parameters.max_bonus as number) ?? depositAmount;
    const wagerMult = (rule.parameters.wagering_multiplier as number) ?? 30;
    const bonusAmount = Math.min(
      (depositAmount * matchPct) / 100,
      maxBonus
    );
    return {
      bonusAmount: Math.round(bonusAmount),
      currency: "USD",
      wageringRequired: Math.round(bonusAmount * wagerMult),
    };
  }

  isEligible(_playerId: string, ruleId: string): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule?.active) return false;

    return true;
  }

  private _key(bonusId: string, playerId: string): string {
    return `${bonusId}:${playerId}`;
  }
}
