import { Pool } from "pg";

export interface FraudSignal {
  signalType: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  description: string;
}

export interface RiskScore {
  playerId: string;
  overallScore: number;
  signals: FraudSignal[];
  blocked: boolean;
  reasons: string[];
  scoredAt: Date;
}

export class RiskScorer {
  private thresholds = {
    block: 70,
    review: 50,
    warning: 30,
  };

  constructor(private pool: Pool) {}

  async scorePlayer(
    playerId: string,
    context: {
      recentBets?: number;
      recentWins?: number;
      depositAmount?: number;
      sessionDuration?: number;
      deviceFingerprint?: string;
    }
  ): Promise<RiskScore> {
    const signals: FraudSignal[] = [];

    const recentActivity = await this.getRecentActivity(playerId);
    const depositVelocity = await this.checkDepositVelocity(playerId);
    const bonusAbuse = await this.checkBonusAbuse(playerId);
    const patternAnomaly = await this.checkPatternAnomaly(playerId, context);

    if (depositVelocity.score > 0) {
      signals.push({
        signalType: "deposit_velocity",
        severity: depositVelocity.score > 60 ? "high" : "medium",
        score: depositVelocity.score,
        description: depositVelocity.description,
      });
    }

    if (bonusAbuse.score > 0) {
      signals.push({
        signalType: "bonus_abuse",
        severity: bonusAbuse.score > 60 ? "high" : "medium",
        score: bonusAbuse.score,
        description: bonusAbuse.description,
      });
    }

    if (patternAnomaly.score > 0) {
      signals.push({
        signalType: "pattern_anomaly",
        severity: patternAnomaly.score > 60 ? "high" : "medium",
        score: patternAnomaly.score,
        description: patternAnomaly.description,
      });
    }

    if (recentActivity.winRate > 0.8 && recentActivity.totalBets > 10) {
      signals.push({
        signalType: "high_win_rate",
        severity: "medium",
        score: 40,
        description: "Win rate above 80% with significant volume",
      });
    }

    const overallScore = this.calculateOverallScore(signals);
    const blocked = overallScore >= this.thresholds.block;
    const reasons = signals
      .filter((s) => s.score >= 30)
      .map((s) => s.description);

    await this.storeRiskScore({
      playerId,
      overallScore,
      signals,
      blocked,
      reasons,
      scoredAt: new Date(),
    });

    return {
      playerId,
      overallScore,
      signals,
      blocked,
      reasons,
      scoredAt: new Date(),
    };
  }

  async getRecentActivity(playerId: string): Promise<{
    totalBets: number;
    totalWins: number;
    winRate: number;
    totalWagered: number;
  }> {
    const res = await this.pool.query(
      `SELECT COUNT(*) as total_bets,
              SUM(CASE WHEN win_amount > 0 THEN 1 ELSE 0 END) as total_wins,
              COALESCE(SUM(bet_amount), 0) as total_wagered
       FROM game_rounds
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [playerId]
    );
    const row = res.rows[0];
    const totalBets = parseInt(row.total_bets, 10);
    const totalWins = parseInt(row.total_wins, 10);
    return {
      totalBets,
      totalWins,
      winRate: totalBets > 0 ? totalWins / totalBets : 0,
      totalWagered: parseInt(row.total_wagered, 10),
    };
  }

  async checkDepositVelocity(playerId: string): Promise<{
    score: number;
    description: string;
  }> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM ledger_entries
       WHERE user_id = $1 AND type = 'deposit'
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [playerId]
    );
    const row = res.rows[0];
    const count = parseInt(row.count, 10);
    const total = parseInt(row.total, 10);

    if (count > 10) {
      return { score: 80, description: `High deposit frequency: ${count} deposits in 1 hour` };
    }
    if (count > 5 && total > 10000) {
      return { score: 60, description: `Rapid large deposits: ${count} totaling ${total} in 1 hour` };
    }
    return { score: 0, description: "" };
  }

  async checkBonusAbuse(playerId: string): Promise<{
    score: number;
    description: string;
  }> {
    const res = await this.pool.query(
      `SELECT COUNT(DISTINCT bonus_credit.bonus_id) as bonus_count,
              COALESCE(SUM(bonus_credit.amount), 0) as total_bonus
       FROM ledger_entries bonus_credit
       WHERE bonus_credit.user_id = $1
       AND bonus_credit.type = 'bonus_credit'
       AND bonus_credit.created_at > NOW() - INTERVAL '24 hours'`,
      [playerId]
    );
    const row = res.rows[0];
    const bonusCount = parseInt(row.bonus_count, 10);

    if (bonusCount > 3) {
      return { score: 70, description: `Multiple bonuses used: ${bonusCount} in 24 hours` };
    }
    return { score: 0, description: "" };
  }

  async checkPatternAnomaly(
    _playerId: string,
    context: {
      recentBets?: number;
      recentWins?: number;
      depositAmount?: number;
      sessionDuration?: number;
      deviceFingerprint?: string;
    }
  ): Promise<{ score: number; description: string }> {
    if (context.recentBets && context.recentBets > 100) {
      return { score: 50, description: "Unusually high bet count" };
    }
    return { score: 0, description: "" };
  }

  private calculateOverallScore(signals: FraudSignal[]): number {
    if (signals.length === 0) return 0;
    const maxScore = Math.max(...signals.map((s) => s.score));
    const avgScore = signals.reduce((a, b) => a + b.score, 0) / signals.length;
    return Math.min(Math.round(maxScore * 0.7 + avgScore * 0.3), 100);
  }

  async storeRiskScore(riskScore: Omit<RiskScore, "scoredAt"> & { scoredAt: Date }): Promise<void> {
    await this.pool.query(
      `INSERT INTO risk_scores (player_id, overall_score, blocked, reasons)
       VALUES ($1, $2, $3, $4)`,
      [
        riskScore.playerId,
        riskScore.overallScore,
        riskScore.blocked,
        JSON.stringify(riskScore.reasons),
      ]
    );
  }

  async isBlocked(playerId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT blocked FROM risk_scores
       WHERE player_id = $1 AND scored_at > NOW() - INTERVAL '1 hour'
       ORDER BY scored_at DESC LIMIT 1`,
      [playerId]
    );
    return res.rows.length > 0 && res.rows[0].blocked;
  }
}
