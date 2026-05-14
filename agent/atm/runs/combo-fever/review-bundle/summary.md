# Combo Fever — Feature Summary

## What was built
Progressive win streak multiplier for the slot game. Tracks consecutive wins, applies multiplier tiers (2→1.5×, 3→2×, 5→3×, 7→5×, 10→10×). Loss resets streak to 0.

## Files
- `apps/api/src/services/combo.ts` — ComboService with ensureTable, getState, recordWin, recordLoss
- `apps/api/src/routes/combo.ts` — GET /api/v1/combo/fever
- `apps/api/src/routes/games.ts` — integrated recordComboAfterSpin
- `apps/api/src/index.ts` — comboRoutes registered
- `apps/web/src/components/ComboFeverMeter.tsx` — React component with progress bar + pulse animation
- `apps/web/src/pages/GamePage.tsx` — ComboFeverMeter + query invalidation
- `scripts/e2e-combo-fever.cjs` — Playwright E2E

## API
- `GET /api/v1/combo/fever` → `{ userId, streak, multiplier, nextThreshold, maxStreakToday }`
- Auto-tracked after each spin: win → increment, loss → reset

## Evidence
- e2e-report.json (combo API verified, meter renders)
- demo-combo-fever.html (self-contained product demo)
- screenshots (combo meter idle state)
