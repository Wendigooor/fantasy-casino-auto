// product/apps/api/src/services/wallet.ts
import { playerWithdrawalCompleted } from './events';;

interface WalletState {
  id: string;
  playerId: string;
  balance: number;
  currency: string;
  state: 'active' | 'frozen' | 'closed';
}

interface LedgerEntry {
  id: string;
  walletId: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'payout';
  amount: number;
  currency: string;
  timestamp: Date;
  idempotencyKey?: string;
}

// Mock database for demonstration
const wallets: Map<string, WalletState> = new Map();
const ledger: Map<string, LedgerEntry> = new Map();
const idempotencyKeys: Map<string, string> = new Map();

export class WalletService {
  async getWallet(walletId: string): Promise<WalletState | null> {
    return wallets.get(walletId) || null;
  }

  async withdrawal({
    walletId,
    amount,
    currency,
    idempotencyKey,
    destination,
    requestId,
  }: {
    walletId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    destination: string;
    requestId: string;
  }): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // 1. Check idempotency
    const existingTransactionId = idempotencyKeys.get(idempotencyKey);
    if (existingTransactionId) {
      return { success: true, transactionId: existingTransactionId };
    }

    const wallet = await this.getWallet(walletId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    // 2. Check wallet state
    if (wallet.state !== 'active') {
      return { success: false, error: `Wallet is ${wallet.state}, cannot withdraw` };
    }

    // 3. Check balance
    if (wallet.balance < amount) {
      return { success: false, error: 'Insufficient balance' };
    }

    // 4. Begin transaction
    try {
      // Update balance
      wallet.balance -= amount;
      wallets.set(walletId, wallet);

      // Create ledger entry
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const entry: LedgerEntry = {
        id: transactionId,
        walletId,
        type: 'withdrawal',
        amount,
        currency,
        timestamp: new Date(),
        idempotencyKey,
      };
      ledger.set(transactionId, entry);

      // Store idempotency key
      idempotencyKeys.set(idempotencyKey, transactionId);

      // Emit event
      playerWithdrawalCompleted({
        playerId: wallet.playerId,
        amount,
        currency,
        transactionId,
        requestId,
      });

      return { success: true, transactionId };
    } catch (error) {
      // Rollback logic would go here in a real DB
      return { success: false, error: 'Transaction failed' };
    }
  }
}
