import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentEventEmitter, SimulatedPaymentProvider, PaymentMethod, PaymentResult } from '../src/services/payment';
import { WalletService } from '../src/services/wallet';

describe('PaymentMethod Abstraction', () => {
  let eventEmitter: PaymentEventEmitter;
  let provider: SimulatedPaymentProvider;
  let walletService: WalletService;

  beforeEach(() => {
    eventEmitter = new PaymentEventEmitter();
    provider = new SimulatedPaymentProvider(eventEmitter);
    walletService = new WalletService({
      paymentProvider: provider,
      eventEmitter
    });
  });

  it('should implement PaymentMethod interface', () => {
    expect(provider.deposit).toBeDefined();
    expect(typeof provider.deposit).toBe('function');
  });

  it('should process a deposit successfully', async () => {
    const result = await provider.deposit('user123', 100, 'USD', 'idem-001');
    expect(result.success).toBe(true);
    expect(result.transactionId).toBeDefined();
    expect(result.message).toContain('simulated');
  });

  it('should respect idempotency key', async () => {
    const result1 = await provider.deposit('user123', 100, 'USD', 'idem-002');
    const result2 = await provider.deposit('user123', 100, 'USD', 'idem-002');
    
    expect(result1.transactionId).toBe(result2.transactionId);
  });

  it('should emit payment events', async () => {
    const events: any[] = [];
    eventEmitter.on('payment', (event: any) => {
      events.push(event);
    });

    await provider.deposit('user123', 100, 'USD', 'idem-003');
    
    expect(events.length).toBeGreaterThanOrEqual(2); // INITIATED and SUCCESS
    expect(events[0].type).toBe('DEPOSIT_INITIATED');
    expect(events[1].type).toBe('DEPOSIT_SUCCESS');
  });

  it('should emit idempotent event on duplicate key', async () => {
    const events: any[] = [];
    eventEmitter.on('payment', (event: any) => {
      events.push(event);
    });

    await provider.deposit('user123', 100, 'USD', 'idem-004');
    await provider.deposit('user123', 100, 'USD', 'idem-004');
    
    const idempotentEvents = events.filter(e => e.type === 'DEPOSIT_IDEMPOTENT');
    expect(idempotentEvents.length).toBe(1);
  });

  it('should allow swapping providers without changing route logic', () => {
    const mockProvider: PaymentMethod = {
      async deposit(userId: string, amount: number, currency: string, idempotencyKey: string) {
        return { success: true, transactionId: 'mock-123', message: 'Mock deposit' };
      }
    };

    const newWalletService = new WalletService({
      paymentProvider: mockProvider,
      eventEmitter
    });

    expect(newWalletService).toBeDefined();
  });
});
