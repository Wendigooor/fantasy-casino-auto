# Changed Files — Combo Fever

## New files
- `product/apps/api/src/services/combo.ts` — ComboService (getState, recordWin, recordLoss)
- `product/apps/api/src/routes/combo.ts` — GET /api/v1/combo/fever endpoint
- `product/apps/web/src/components/ComboFeverMeter.tsx` — React streak meter component
- `scripts/e2e-combo-fever.cjs` — Playwright E2E test

## Modified files
- `product/apps/api/src/routes/games.ts` — added recordComboAfterSpin call
- `product/apps/api/src/index.ts` — registered comboRoutes
- `product/apps/web/src/pages/GamePage.tsx` — added ComboFeverMeter, comboFever query invalidation
