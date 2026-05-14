# Combo Fever — Progressive Win Streak Multiplier

## Mission
Increase ARPU by creating a streak-chasing mechanic: consecutive wins build a multiplier that boosts payouts. Players extend sessions to "keep the streak alive."

## Acceptance Criteria
- Backend tracks consecutive wins per user (Redis)
- Multiplier tiers: 2→1.5×, 3→2×, 5→3×, 7→5×, 10→10×
- Streak resets on any loss
- Frontend shows streak meter on GamePage with current streak, active multiplier, next threshold
- Streak increase triggers pulse animation
- Streak break triggers shatter animation
- Mobile responsive
- E2E verifies streak increments on win, resets on loss, 5 screenshots
- No API shortcuts — E2E through Playwright UI clicks

## Evidence Path
- 5 screenshots: streak starting, streak at 2, streak at 5 (fever), streak broken, mobile view
- E2E report with assertions
- ATM audit pass

## Demo
Self-contained HTML with streak meter mock, multiplier table, screenshots.
