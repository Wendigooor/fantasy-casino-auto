export const WALLET_STATES = ["active", "frozen", "closed"] as const;
export type WalletState = (typeof WALLET_STATES)[number];

export const LEDGER_TYPES = [
  "deposit",
  "bet_reserve",
  "bet_debit",
  "win_credit",
  "bonus_credit",
  "wager_contribution",
  "reversal",
  "withdrawal",
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const ROUND_STATES = [
  "created",
  "debit_reserved",
  "settled",
  "failed",
  "voided",
] as const;
export type RoundState = (typeof ROUND_STATES)[number];

export const USER_ROLES = ["player", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Wallet {
  readonly id: string;
  readonly userId: string;
  readonly currency: string;
  readonly balance: number;
  readonly state: WalletState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LedgerEntry {
  readonly id: string;
  readonly walletId: string;
  readonly userId: string;
  readonly type: LedgerType;
  readonly amount: number;
  readonly currency: string;
  readonly balanceAfter: number;
  readonly referenceId?: string;
  readonly description?: string;
  readonly createdAt: Date;
}

export interface GameRound {
  readonly id: string;
  readonly userId: string;
  readonly gameId: string;
  readonly betAmount: number;
  readonly winAmount: number;
  readonly state: RoundState;
  readonly currency: string;
  readonly ledgerDebitId?: string;
  readonly ledgerCreditId?: string;
  readonly result?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly settledAt?: Date;
}

export interface IdempotencyKey {
  readonly key: string;
  readonly userId: string;
  readonly action: string;
  readonly result: Record<string, unknown>;
  readonly createdAt: Date;
}
