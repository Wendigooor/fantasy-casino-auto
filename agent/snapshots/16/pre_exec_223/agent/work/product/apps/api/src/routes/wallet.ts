import { Router, Request, Response } from 'express';
import { WalletService } from '../services/wallet';
import { PaymentEventEmitter, SimulatedPaymentProvider } from '../services/payment';

const router = Router();

// Initialize payment infrastructure
const eventEmitter = new PaymentEventEmitter();
const paymentProvider = new SimulatedPaymentProvider(eventEmitter);
const walletService = new WalletService({
  paymentProvider,
  eventEmitter
});

// Listen for payment events (for logging/monitoring)
eventEmitter.on('payment', (event) => {
  console.log('[PaymentEvent]', JSON.stringify(event));
});

router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { userId, amount, currency, idempotencyKey } = req.body;

    if (!userId || !amount || !currency || !idempotencyKey) {
      res.status(400).json({
        error: 'Missing required fields: userId, amount, currency, idempotencyKey'
      });
      return;
    }

    const result = await walletService.deposit(userId, amount, currency, idempotencyKey);

    res.status(200).json({
      success: true,
      transactionId: result.transactionId,
      message: result.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

export { router };
