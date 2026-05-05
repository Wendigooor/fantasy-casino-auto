-- Migration 002: Add 'withdrawal' type to ledger_entries
-- This is needed for Phase 3: Wallet withdrawal flow

-- PostgreSQL requires dropping and recreating the constraint
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_type_check,
  ADD CONSTRAINT ledger_entries_type_check
    CHECK (type IN (
      'deposit', 'bet_reserve', 'bet_debit', 'win_credit',
      'bonus_credit', 'wager_contribution', 'reversal',
      'withdrawal'
    ));
