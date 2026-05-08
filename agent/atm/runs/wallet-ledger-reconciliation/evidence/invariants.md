# Invariants

1. Balance Reconstruction: expectedBalance = sum(signed ledger amounts). drift = wallet.balance - expectedBalance.
2. Non-Negative Wallet: balance must be >= 0.
3. Ledger Entry Validity: entries must have type, amount, user_id, created_at.
4. Game Round Coverage: bet > 0 must have ledger_debit_id, win > 0 must have ledger_credit_id.
5. Known gap: wallet seeded with 100000 during registration without corresponding deposit ledger entry. Test creates deposit entry artificially.
