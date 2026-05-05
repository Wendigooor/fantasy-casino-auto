import { Pool } from "pg";
import { EventEmitter } from "./events.js";

export class Analytics {
  private static _instance: Analytics | null = null;
  private emitter: EventEmitter;

  constructor(pool: Pool) {
    this.emitter = new EventEmitter(pool);
    Analytics._instance = this;
  }

  static get(): Analytics {
    if (!Analytics._instance) throw new Error("Analytics not initialized");
    return Analytics._instance;
  }

  trackRegister(playerId: string, email: string): void {
    this.emitter.emit("user_registered", playerId, {
      email,
      ip: "0.0.0.0",
      source: "web",
    });
  }

  trackLogin(playerId: string): void {
    this.emitter.emit("user_login", playerId, {
      ip: "0.0.0.0",
      success: true,
    });
  }

  trackDeposit(playerId: string, amount: number, currency: string): void {
    this.emitter.emit("wallet_funded", playerId, {
      amount,
      currency,
      method: "simulation",
      tx_id: `dep_${Date.now()}`,
    });
  }

  trackWithdrawal(playerId: string, amount: number, currency: string, _destination: string): void {
    this.emitter.emit("wallet_withdrawn", playerId, {
      amount,
      currency,
      method: "bank_transfer",
      tx_id: `wd_${Date.now()}`,
    });
  }

  trackSpin(playerId: string, gameId: string, betAmount: number, winAmount: number): void {
    this.emitter.emit("round_completed", playerId, {
      game_id: gameId,
      round_id: `round_${Date.now()}`,
      stake_amount: betAmount,
      win_amount: winAmount,
      multiplier: betAmount > 0 ? winAmount / betAmount : 0,
    });
  }

  trackBonusClaimed(playerId: string, bonusId: string, amount: number): void {
    this.emitter.emit("bonus_claimed", playerId, {
      amount,
      bonus_id: bonusId,
      bonus_type: "deposit_match",
    });
  }

  async getEvents(playerId: string, limit?: number) {
    return this.emitter.getEvents(playerId, { limit: limit || 20 });
  }
}
