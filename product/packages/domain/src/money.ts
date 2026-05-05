export const CURRENCY_CODES = ["USD", "EUR", "GBP", "UAH"] as const;
export type Currency = (typeof CURRENCY_CODES)[number];

export const MIN_DEPOSIT = 100;
export const MAX_DEPOSIT = 500000;
export const MIN_BET = 10;
export const MAX_BET = 100000;
export const PRECISION = 2;

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

export function createMoney(amount: number, currency: Currency): Money {
  return Object.freeze({ amount, currency });
}

export function formatMoney(money: Money): string {
  return `${money.currency} ${money.amount.toFixed(PRECISION)}`;
}
