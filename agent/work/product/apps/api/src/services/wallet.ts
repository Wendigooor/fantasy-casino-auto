import { PaymentMethod, PaymentResult, PaymentEventEmitter } from './payment';

export interface WalletServiceOptions {
  paymentProvider: PaymentMethod;
  eventEmitter: PaymentEventEmitter;
}

export class WalletService {
  private paymentProvider: PaymentMethod;
  private eventEmitter: PaymentEventEmitter;

  constructor(options: WalletServiceOptions) {
    this.paymentProvider = options.paymentProvider;
    this.eventEmitter = options.eventEmitter;
  }

  async deposit(userId: string, amount: number, currency: string, idempotencyKey: string): Promise<PaymentResult> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    const result = await this.paymentProvider.deposit(userId, amount, currency, idempotencyKey);

    if (!result.success) {
      throw new Error(result.message);
    }

    // In a real implementation, this would update the database ledger
    // For now, we just return the payment result
    return result;
  }
}
