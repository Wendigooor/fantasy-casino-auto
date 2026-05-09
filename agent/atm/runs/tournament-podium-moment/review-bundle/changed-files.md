# Changed Files — Tournament Podium Moment

## New files

| File | Type | Purpose |
|------|------|---------|
| `product/apps/web/src/components/PodiumMomentModal.tsx` | React component | Premium podium modal with confetti, medal ring, glassmorphism, dismissal tracking |
| `product/scripts/e2e-tournament-podium-moment.mjs` | E2E script | Autonomous demo: register → join → spins → podium verification → screenshots |
| `agent/atm/profiles/demo-tournament-podium-moment.yaml` | ATM profile | Run-specific profile with 12 gates |

## Modified files

| File | Change |
|------|--------|
| `product/apps/web/src/pages/TournamentsPage.tsx` | Integrated PodiumMomentModal, added `data-podium-moment` attribute, useState for dismissal |
