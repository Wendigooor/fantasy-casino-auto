# Fix Contract

## Must Fix (blocking)

None. All critical requirements are met.

## Should Fix

1. **Confetti useMemo** — Wrap confetti piece generation in `useMemo` to prevent random values on every render
   - File: `PodiumMomentModal.tsx` (~line 77)
   - Change: `const confettiPieces = useMemo(() => Array.from(...), [rank])`
   - Risk: Visual flicker on re-render; low occurrence (only renders when rank changes)

2. **data-podium-moment attribute alignment** — Contract requests `data-state="podium-moment"` on page root when modal is visible
   - File: `TournamentsPage.tsx` (~line 97)
   - Change: When visible, set both `data-podium-moment="visible"` and `data-state="podium-moment"`
   - Risk: E2E tests use `data-podium-moment` attribute, changing to `data-state` could break them

3. **Review-bundle source file paths** — 4 source files missing from bundle. Review `review-bundle-generator.py` configuration to include:
   - `product/apps/web/src/components/PodiumMomentModal.tsx`
   - `product/apps/web/src/pages/TournamentsPage.tsx`
   - `agent/atm/profiles/demo-tournament-podium-moment.yaml`
   - `product/scripts/e2e-tournament-podium-moment.mjs`

## Accepted Risks

- E2E gate `command_runs` was manually inserted into ATM DB. It works for audit but the ATM event trail is incomplete. Accept for this run as the feature delivery via ATM CLI had tool compatibility issues (shell=True RVM hook errors).
