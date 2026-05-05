// product/apps/api/src/services/payment.ts

export interface PaymentEvent {
  type: 'payment.created' | 'payment.success' | 'payment.failed' | 'payment.idempotent';
  userId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  timestamp: Date;
}

export interface PaymentMethod {
  deposit(
    userId: string,
    amount: number,
    currency: string,
    idempotencyKey: string
  ): Promise<{
    success: boolean;
    transactionId: string;
    message?: string;
  }>;
}

export class SimulatedPaymentProvider implements PaymentMethod {
  private idempotencyStore: Map<string, { success: boolean; transactionId: string }> = new Map();

  async deposit(
    userId: string,
    amount: number,
    currency: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; transactionId: string }> {
    // Check idempotency
    if (this.idempotencyStore.has(idempotencyKey)) {
      const existing = this.idempotencyStore.get(idempotencyKey)!;
      return existing;
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));

    const transactionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = { success: true, transactionId };

    // Store for idempotency
    this.idempotencyStore.set(idempotencyKey, result);

    // Emit payment event (simulated)
    this.emitPaymentEvent({
      type: 'payment.success',
      userId,
      amount,
      currency,
      idempotencyKey,
      timestamp: new Date(),
    });

    return result;
  }

  private emitPaymentEvent(event: PaymentEvent): void {
    // In a real implementation, this would publish to an event bus
    console.log('[PaymentEvent]', JSON.stringify(event));
  }
}
