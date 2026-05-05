// product/apps/api/src/routes/wallet.ts
import { Router } from 'express';
import { WalletService } from '../services/wallet';

const router = Router();
const walletService = new WalletService();

router.post('/wallet/withdraw', async (req, res) => {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}`;
  console.log(`[REQUEST] ${requestId} POST /wallet/withdraw`);

  try {
    const { walletId, amount, currency, idempotencyKey, destination } = req.body;

    if (!walletId || !amount || !currency || !idempotencyKey || !destination) {
      return res.status(400).json({ error: 'Missing required fields: walletId, amount, currency, idempotencyKey, destination' });
    }

    const result = await walletService.withdrawal({
      walletId,
      amount,
      currency,
      idempotencyKey,
      destination,
      requestId,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      transactionId: result.transactionId,
      requestId,
    });
  } catch (error) {
    console.error(`[ERROR] ${requestId}`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
