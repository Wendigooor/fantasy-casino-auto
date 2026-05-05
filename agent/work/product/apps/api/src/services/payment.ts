import { EventEmitter } from 'events';

export interface PaymentMethod {
  deposit(userId: string, amount: number, currency: string, idempotencyKey: string): Promise<PaymentResult>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  message: string;
}

export interface PaymentEvent {
  type: 'DEPOSIT_INITIATED' | 'DEPOSIT_SUCCESS' | 'DEPOSIT_FAILED' | 'DEPOSIT_IDEMPOTENT';
  userId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  transactionId?: string;
  timestamp: string;
}

export class PaymentEventEmitter extends EventEmitter {
  emitPaymentEvent(event: PaymentEvent): void {
    this.emit('payment', event);
  }
}

export class SimulatedPaymentProvider implements PaymentMethod {
  private eventEmitter: PaymentEventEmitter;
  private completedTransactions: Map<string, PaymentResult>;

  constructor(eventEmitter: PaymentEventEmitter) {
    this.eventEmitter = eventEmitter;
    this.completedTransactions = new Map();
  }

  async deposit(userId: string, amount: number, currency: string, idempotencyKey: string): Promise<PaymentResult> {
    // Emit deposit initiated event
    this.eventEmitter.emitPaymentEvent({
      type: 'DEPOSIT_INITIATED',
      userId,
      amount,
      currency,
      idempotencyKey,
      timestamp: new Date().toISOString()
    });

    // Check idempotency
    if (this.completedTransactions.has(idempotencyKey)) {
      const existing = this.completedTransactions.get(idempotencyKey)!;
      this.eventEmitter.emitPaymentEvent({
        type: 'DEPOSIT_IDEMPOTENT',
        userId,
        amount,
        currency,
        idempotencyKey,
        transactionId: existing.transactionId,
        timestamp: new Date().toISOString()
      });
      return existing;
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const transactionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result: PaymentResult = {
      success: true,
      transactionId,
      message: 'Deposit simulated successfully'
    };

    // Store for idempotency
    this.completedTransactions.set(idempotencyKey, result);

    // Emit success event
    this.eventEmitter.emitPaymentEvent({
      type: 'DEPOSIT_SUCCESS',
      userId,
      amount,
      currency,
      idempotencyKey,
      transactionId,
      timestamp: new Date().toISOString()
    });

    return result;
  }
}
