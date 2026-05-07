# Fantasy Casino — Tournament Mini-League Feature Contract

Version: 2026-05-07

Mode: Demo / Benchmark

Recommended run id: `tournament-mini-league`

Target repository: `/Users/iharzvezdzin/Documents/projects/hermes/test/puff/fantasy-casino-auto-main`

Recommended evidence path: `/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-mini-league`

Primary standard: `/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/pvp-arena-season-1/AUTONOMOUS_DELIVERY_GOLD_STANDARD.md`

---

## 1. Mission

Deliver `Tournament Mini-League` as a demo-ready product increment where a player can join a limited-time tournament, play slot rounds, climb a live leaderboard, see prize ladder progress, and produce evidence that the feature is functional, visually credible, and replayable without human clicking.

This is not a generic leaderboard page. It is a casino tournament experience.

---

## 2. Why This Feature

Tournament Mini-League is a strong next experiment because it tests a different autonomous-development profile than Missions and PvP:

- It has product spectacle: leaderboard, countdown, prize ladder, player rank, live movement.
- It has real backend state: tournament membership, points, rank, prize metadata.
- It has demo value: before/after screenshots naturally show progression.
- It reuses existing project primitives: `game_rounds`, wallet, leaderboard, slot spin, existing nav/layout/design system.
- It exposes common autonomous-agent failure modes: fake leaderboard, stale ranking, weak demo assertions, API-only gameplay, cheap visuals, and post-factum evidence.

The expected leadership demo should feel like:

> "A player joins a 10-minute mini tournament, plays several spins, jumps from rank 8 to rank 3, sees prize eligibility, and the demo proves the ranking changed."

---

## 3. Current Codebase Context

The repo already has relevant surfaces:

- `product/apps/web/src/pages/LeaderboardPage.tsx`: existing leaderboard page with balance/spins/wins/duels tabs.
- `product/apps/api/src/routes/leaderboard-routes.ts`: balance/spins/wins endpoints.
- `product/apps/api/src/routes/games.ts`: slot spin endpoint.
- `product/apps/api/src/services/game.ts`: game round creation and wallet side effects.
- `product/apps/api/migrations/001_initial_schema.sql`: `game_rounds`, `wallets`, `ledger_entries`.
- `product/apps/api/migrations/006_add_duels.sql`: duel tables and duel events.
- `product/scripts/e2e-screenshots.mjs`, `product/scripts/e2e-missions-casino-grade.mjs`, `product/scripts/e2e-scenarios.mjs`: examples of autonomous screenshot scripts.

The implementation should reuse existing styles where possible, but must raise the visual bar beyond the current generic leaderboard.

---

## 4. Product Experience Contract

Tournament Mini-League must feel like a live casino promo event, not like a database ranking table.

### Desired User Emotion

The user should feel:

- urgency: "this tournament is live now";
- competition: "I am chasing real positions";
- reward anticipation: "top ranks win something";
- momentum: "my spins move me up";
- clarity: "I know what to do next".

### First-Screen Composition Requirements

At 1440x900, the first screenshot must show:

- [ ] Tournament hero banner.
- [ ] Tournament name.
- [ ] Countdown or active event status.
- [ ] Prize pool / prize ladder summary.
- [ ] Player's current rank.
- [ ] Player's points.
- [ ] Primary CTA to play / boost score.
- [ ] Top 3 leaderboard podium or highlighted rank cards.
- [ ] At least 5 leaderboard rows or visible competitors.
- [ ] Clear tournament rules summary.

If the first screenshot looks like a normal leaderboard page with tabs, the run fails the product experience gate.

### Visual Direction

Recommended theme:

- "Neon Race Night" or "High Roller Sprint".
- Dark casino base is acceptable, but must be enhanced with event lighting, rank podium, prize chips, countdown pill, and movement indicators.
- Use existing project colors where possible, but introduce enough tournament-specific hierarchy to feel like a new product surface.

Required visual elements:

- [ ] Hero event card.
- [ ] Rank podium for top 3.
- [ ] Leaderboard table/cards with current user highlighted.
- [ ] Prize ladder.
- [ ] Progress-to-next-rank meter.
- [ ] Rank movement indicator after gameplay.
- [ ] Join state and joined state must be visually distinct.
- [ ] Mobile view must keep hero, rank, and CTA visible.

Forbidden outcomes:

- [ ] No plain table as the main experience.
- [ ] No generic dark cards plus text as the whole design.
- [ ] No fake-looking rows with no relation to backend data.
- [ ] No hidden current player rank.
- [ ] No screenshots where the key rank movement is off-screen.
- [ ] No evidence that only proves API responses but not UI state.

---

## 5. MVP Scope

Build one active mini-league tournament.

Recommended name:

- `High Roller Sprint`

Alternative names:

- `Spin Sprint League`
- `Midnight Mini-League`
- `Jackpot Climb`

### Core Loop

1. Player opens `/tournaments` or `/leaderboard?tab=tournament`.
2. Player sees active mini-league event.
3. Player joins the tournament.
4. Player sees initial rank and points.
5. Player plays slot spins.
6. Tournament score updates.
7. Player climbs leaderboard.
8. Player sees prize eligibility / next rank target.
9. Evidence proves before and after states.

### Recommended Route

Preferred:

- [ ] New route: `/tournaments`

Acceptable if scope is constrained:

- [ ] Add tournament mode to `/leaderboard`, but the visible product must still feel like a tournament hub.

If choosing `/leaderboard`, do not bury the feature behind a small tab. The demo path must land directly on the tournament experience.

---

## 6. Functional Requirements

### Tournament State

Implement an active tournament that has:

- [ ] `id`
- [ ] `slug`
- [ ] `title`
- [ ] `status`: `upcoming | active | ended`
- [ ] `startsAt`
- [ ] `endsAt`
- [ ] `prizePool`
- [ ] `rules`
- [ ] `scoring`
- [ ] `prizes`

For MVP, one active tournament can be seeded or created automatically.

### Join Flow

The user must be able to join the tournament.

Required:

- [ ] `Join Tournament` CTA visible before joining.
- [ ] UI click joins tournament.
- [ ] Joined state visible after click.
- [ ] Join action is idempotent.
- [ ] Joining does not require wallet debit unless explicitly implemented and proven.

### Scoring

Recommended scoring formula:

```text
points = total_wagered + total_won * 2 + spin_count * 10
```

Alternative acceptable formula:

```text
points = total_wagered + total_won
```

Rules:

- [ ] Scoring must be deterministic and documented.
- [ ] Score must derive from real `game_rounds` for joined players.
- [ ] Demo must show score increase after spins.
- [ ] Player rank must update after score changes.
- [ ] Score calculation must be scoped to tournament window where practical.

### Leaderboard

Leaderboard must show:

- [ ] rank;
- [ ] player display name;
- [ ] points;
- [ ] spins;
- [ ] wagered;
- [ ] won;
- [ ] prize or prize tier if eligible;
- [ ] current user highlight;
- [ ] movement indicator when the current user climbs.

For demo richness, seed at least 8 competitor rows.

Competitor data can be deterministic demo seed data, but it must be clearly implemented as seed/demo fixtures, not random UI-only fake rows.

### Prize Ladder

Prize ladder must include at least:

- [ ] Rank 1 prize.
- [ ] Rank 2 prize.
- [ ] Rank 3 prize.
- [ ] Rank 4-10 consolation or badge.

Prizes can be display-only for MVP unless claim/settlement is in scope.

If payout is not implemented:

- [ ] UI copy must say "Prize preview" or "Paid when tournament ends".
- [ ] Evidence must not imply wallet payout happened.

### Statuses

Required statuses:

- [ ] Not joined.
- [ ] Joined, no points.
- [ ] Joined, scored.
- [ ] Rank improved.
- [ ] Prize eligible.

Optional:

- [ ] Ended / final standings.
- [ ] Prize claim.

---

## 7. Backend Requirements

### Recommended Data Model

Use migrations or safe initialization consistent with the project.

Recommended tables:

```sql
tournaments (
  id uuid primary key,
  slug text unique not null,
  title text not null,
  status text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prize_pool bigint not null,
  rules jsonb not null,
  prizes jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

```sql
tournament_entries (
  id uuid primary key,
  tournament_id uuid not null references tournaments(id),
  user_id uuid not null references users(id),
  joined_at timestamptz not null default now(),
  display_name text,
  seed_points bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, user_id)
)
```

For MVP, `seed_points` can support deterministic demo competitors and rank movement. Player score should still derive from actual gameplay where possible.

### API Endpoints

Required:

```text
GET /api/v1/tournaments/active
POST /api/v1/tournaments/:id/join
GET /api/v1/tournaments/:id/leaderboard
GET /api/v1/tournaments/:id/me
```

Acceptable combined endpoint:

```text
GET /api/v1/tournaments/active
```

returning:

```json
{
  "tournament": {},
  "me": {},
  "leaderboard": [],
  "prizes": [],
  "nextRankTarget": {}
}
```

### API Response Contract

`GET /api/v1/tournaments/active` should return:

```json
{
  "tournament": {
    "id": "uuid",
    "slug": "high-roller-sprint",
    "title": "High Roller Sprint",
    "status": "active",
    "startsAt": "2026-05-07T10:00:00.000Z",
    "endsAt": "2026-05-07T23:59:59.000Z",
    "prizePool": 5000,
    "rules": [
      "Play slots to earn points",
      "Wagered coins and wins increase your score",
      "Top 3 qualify for prizes"
    ]
  },
  "me": {
    "joined": true,
    "rank": 4,
    "previousRank": 8,
    "points": 1280,
    "spins": 6,
    "wagered": 500,
    "won": 340,
    "nextRankPoints": 1500,
    "pointsToNextRank": 220,
    "prizeEligible": false
  },
  "leaderboard": [
    {
      "rank": 1,
      "player": "nova77",
      "points": 3400,
      "spins": 14,
      "wagered": 1200,
      "won": 900,
      "prize": 2500,
      "isCurrentUser": false
    }
  ],
  "prizes": [
    { "rank": 1, "amount": 2500, "label": "Champion" },
    { "rank": 2, "amount": 1500, "label": "Runner-up" },
    { "rank": 3, "amount": 1000, "label": "Podium" }
  ]
}
```

Field names must be camelCase in API responses consumed by frontend.

### Side Effects

Joining tournament:

- [ ] creates one `tournament_entries` row;
- [ ] is idempotent;
- [ ] does not create duplicate entries.

Playing spins:

- [ ] creates `game_rounds` through existing game flow;
- [ ] tournament score updates from persisted game rounds;
- [ ] no fake frontend-only score increment.

Prize settlement:

- [ ] Optional for MVP.
- [ ] If implemented, must be transactional and ledger-backed.
- [ ] If not implemented, UI must not claim that prizes were paid.

---

## 8. Frontend Requirements

### Page

Create:

- [ ] `product/apps/web/src/pages/TournamentsPage.tsx`

Add:

- [ ] route `/tournaments`;
- [ ] nav link `Tournaments` or `🏁 Tournaments`;
- [ ] active AuthGuard;
- [ ] data hooks.

### Page State Hooks

Required:

- [ ] root has `data-page="tournaments"`.
- [ ] root has `data-ready="true"` only after tournament and leaderboard are visible.
- [ ] root has `data-state="not-joined|joined|scored|rank-improved|prize-eligible"` where practical.
- [ ] join button has `data-testid="join-tournament"`.
- [ ] play CTA has `data-testid="tournament-play-cta"`.
- [ ] current user row has `data-testid="current-user-rank"`.
- [ ] leaderboard rows have `data-testid="tournament-row-{rank}"`.
- [ ] prize ladder has `data-testid="prize-ladder"`.
- [ ] movement indicator has `data-testid="rank-movement"`.

### UI Sections

Required sections:

- [ ] Hero event banner.
- [ ] Join / joined state CTA.
- [ ] Player rank card.
- [ ] Progress to next rank.
- [ ] Prize ladder.
- [ ] Top 3 podium.
- [ ] Full leaderboard.
- [ ] Rules card.
- [ ] Recent action / last spin effect if available.

### Copy Guidelines

Use concise, product-like copy:

- `High Roller Sprint`
- `Climb the board before the timer ends`
- `Play slots to boost your score`
- `Rank #4`
- `220 points to podium`
- `Prize preview`
- `Joined`
- `Live now`

Avoid:

- raw database wording;
- "test user";
- "fixture";
- "undefined";
- "NaN";
- "Invalid Date";
- technical endpoint names.

---

## 9. Demo Scenario

The demo must be autonomous and replayable.

### Actors

Use one primary player and seeded competitors.

Optional advanced demo:

- two real users competing against each other.

For first run, prefer one player plus seeded competitors to reduce flakiness.

### Required Demo Path

1. Register fresh player.
2. Open `/tournaments`.
3. Wait for `data-page="tournaments"` and `data-ready="true"`.
4. Screenshot initial tournament hub.
5. Click `Join Tournament` through UI.
6. Assert joined state.
7. Screenshot joined/no-score state.
8. Trigger several slot spins.
9. Return to `/tournaments`.
10. Assert points increased.
11. Assert current user row exists.
12. Assert rank changed or rank movement indicator exists.
13. Screenshot rank climb.
14. Trigger enough spins or seed score to reach prize eligibility.
15. Assert prize eligible or close-to-prize state.
16. Screenshot prize ladder/podium.
17. Capture mobile screenshot.
18. Write machine-readable E2E report.

### API Usage Policy

Allowed:

- register user via API;
- seed deterministic tournament/competitors if needed;
- trigger slot spins via API if slot UI is out of scope;
- verify backend state via API.

Forbidden:

- joining tournament via API instead of UI;
- faking rank movement only in frontend;
- editing DB directly during the visible demo path unless explicitly documented as fixture setup before screenshot 1;
- reporting pass if required selectors are missing.

---

## 10. Required Screenshots

Save screenshots to:

```text
evidence/tournament-mini-league/screenshots/
```

Required:

- [ ] `01-tournament-hub-start.png`: hero, countdown, prize pool, leaderboard, join CTA.
- [ ] `02-joined-state.png`: joined state, player rank card, zero/initial points.
- [ ] `03-after-spins-rank-climb.png`: points increased, rank movement visible.
- [ ] `04-podium-and-prize-ladder.png`: prize ladder and top 3 podium.
- [ ] `05-current-user-highlight.png`: current user row highlighted in leaderboard.
- [ ] `06-mobile-tournament-hub.png`: mobile responsive view.

Optional:

- [ ] `07-rules-and-scoring.png`
- [ ] `08-api-debug-state.png` only if useful and clearly marked non-product evidence.

Screenshot quality requirements:

- [ ] No screenshot is mostly empty.
- [ ] No screenshot shows login page.
- [ ] No screenshot shows loading skeleton as final proof.
- [ ] Current user rank is visible in at least two screenshots.
- [ ] At least one screenshot shows before/after score movement.
- [ ] At least one screenshot shows prize eligibility or next prize target.

---

## 11. E2E Requirements

Create:

```text
product/scripts/e2e-tournament-mini-league.mjs
```

The script must use hard assertions.

Required assertions:

- [ ] `data-page="tournaments"`.
- [ ] `data-ready="true"`.
- [ ] Join button exists before join.
- [ ] Join is clicked through UI.
- [ ] Joined state appears after click.
- [ ] Current user row exists.
- [ ] Initial points captured.
- [ ] Spins are performed.
- [ ] Updated points are greater than initial points.
- [ ] Leaderboard row count >= 8.
- [ ] Prize ladder exists.
- [ ] No `Invalid Date`, `undefined`, `NaN`.
- [ ] No page errors.
- [ ] Console errors fail unless classified.
- [ ] Required screenshot files exist and are non-empty.

Forbidden:

- [ ] No "if selector missing, continue".
- [ ] No "if UI join fails, call API join".
- [ ] No fixed waits as primary synchronization.
- [ ] No report status `passed` when any required assertion failed.

Use robust waits:

```text
wait for data-page
wait for data-ready
wait for response or DOM state
wait for data-state
assert visible text/state
capture screenshot
```

### E2E Report

Write:

```text
evidence/tournament-mini-league/e2e-report.json
```

Required fields:

```json
{
  "run": "tournament-mini-league",
  "status": "passed|failed",
  "startedAt": "...",
  "finishedAt": "...",
  "assertions": {},
  "screenshots": [],
  "initialPoints": 0,
  "finalPoints": 0,
  "initialRank": null,
  "finalRank": null,
  "rankImproved": true,
  "pageErrors": [],
  "consoleErrors": [],
  "notes": []
}
```

---

## 12. Evidence Package

Create:

```text
evidence/tournament-mini-league/
  summary.md
  verdict.md
  demo-narrative.md
  changed-files.md
  artifacts.json
  e2e-report.json
  visual-review.md
  screenshots/
  logs/
```

### Summary

Must include:

- [ ] what was built;
- [ ] routes added/changed;
- [ ] APIs added/changed;
- [ ] DB changes;
- [ ] demo command;
- [ ] build/test commands;
- [ ] screenshots list;
- [ ] honest limitations;
- [ ] score out of 100.

### Demo Narrative

Must explain:

- [ ] the player journey;
- [ ] why the tournament is compelling;
- [ ] what each screenshot proves;
- [ ] where real state changes happen;
- [ ] what is not implemented.

### Visual Review

Must answer:

- [ ] Does first screenshot look like a tournament event, not a table?
- [ ] Is current player rank obvious?
- [ ] Is the prize ladder obvious?
- [ ] Is rank movement obvious?
- [ ] Would this be acceptable in a leadership demo?
- [ ] What still looks cheap?

---

## 13. Acceptance Criteria

### Product

- [ ] Player can join tournament through UI.
- [ ] Player sees joined state.
- [ ] Player sees current rank.
- [ ] Player sees points.
- [ ] Player sees prize ladder.
- [ ] Player sees top competitors.
- [ ] Player can perform actions that increase score.
- [ ] Player sees rank/score change after actions.

### Engineering

- [ ] API responses use camelCase for frontend fields.
- [ ] Join is idempotent.
- [ ] Score derives from persisted game rounds and/or documented seed points.
- [ ] No duplicate tournament entry for same user.
- [ ] Build passes.
- [ ] Typecheck passes if available.
- [ ] E2E passes with hard assertions.

### Visual

- [ ] First screen has campaign/tournament energy.
- [ ] Top 3 podium is visually distinct.
- [ ] Current user is highlighted.
- [ ] Prize ladder is visible and legible.
- [ ] Mobile screenshot is usable.
- [ ] No visible trust breakers.

### Evidence

- [ ] Required screenshots exist.
- [ ] Screenshot story is clear.
- [ ] E2E report is machine-readable.
- [ ] Summary is honest.
- [ ] Verdict is `demo_done`, `partial`, or `failed`.

---

## 14. Scoring Rubric

Minimum acceptable score: 84/100.

### Product Value: 20

- 0-5: leaderboard only.
- 6-10: joinable tournament but weak loop.
- 11-15: join, score, rank, prizes visible.
- 16-20: compelling live event with clear competitive loop and reward motivation.

### Visual Quality: 25

- 0-8: generic table/admin.
- 9-15: clean but generic leaderboard.
- 16-21: polished tournament page with hero, podium, current-user highlight.
- 22-25: leadership-demo quality, strong event identity, rank movement, prize tension.

### Functional Completeness: 20

- 0-8: static page.
- 9-14: tournament data and join work.
- 15-18: full join → play → score/rank update loop.
- 19-20: full loop plus idempotency, edge cases, stable state.

### E2E Reliability: 15

- 0-5: flaky or soft assertions.
- 6-10: works but API shortcuts/fixed waits dominate.
- 11-13: stable hard assertions for key states.
- 14-15: robust, production-served where practical, debuggable report.

### Evidence Quality: 20

- 0-6: screenshots exist but weak.
- 7-12: screenshots prove page states.
- 13-17: screenshots prove product story and backend state.
- 18-20: evidence can be reviewed independently and trusted.

---

## 15. Known Risks And Required Mitigations

### Risk: Fake Leaderboard

Mitigation:

- [ ] Competitors may be seeded, but current user score/rank must be computed from backend state.
- [ ] Evidence must distinguish seeded competitors from current user gameplay.

### Risk: Generic Leaderboard UI

Mitigation:

- [ ] First screenshot must contain hero, podium, prize ladder, player rank, and CTA.
- [ ] Plain row list fails the visual gate.

### Risk: Rank Does Not Move

Mitigation:

- [ ] Seed competitors around thresholds so several spins can move the player.
- [ ] Record initial/final rank and points in E2E report.

### Risk: API-Only Demo

Mitigation:

- [ ] Join through UI.
- [ ] Gameplay can be API-triggered only if slot UI is out of scope.
- [ ] Tournament score/rank must be verified through UI and API.

### Risk: Balance/Date Trust Breakers

Mitigation:

- [ ] Any visible date/amount in tournament or wallet path must be valid.
- [ ] No contradictory balances in screenshots if wallet/topbar appears.

### Risk: Overbuilding Prize Settlement

Mitigation:

- [ ] Prize payout is optional.
- [ ] If not implemented, label prizes as preview/final standings reward.
- [ ] Do not imply wallet payout unless ledger proof exists.

---

## 16. Suggested Implementation Plan

### Phase 0: Discovery

- [ ] Probe `/api/v1/games/slot/spin` payload and response.
- [ ] Probe `/api/v1/leaderboard/spins`.
- [ ] Inspect `game_rounds` schema.
- [ ] Inspect auth/register flow and starting wallet balance.
- [ ] Inspect current leaderboard UI and routes.
- [ ] Inspect style utilities used by Missions/PvP for premium cards.
- [ ] Verify route/nav files.
- [ ] Identify stale source/build risks.
- [ ] Write plan before editing.

### Phase 1: Backend

- [ ] Add tournament migration or safe init.
- [ ] Add tournament service.
- [ ] Add tournament routes.
- [ ] Seed one active tournament and deterministic competitors.
- [ ] Implement join idempotency.
- [ ] Implement score/rank calculation.
- [ ] Register routes.

### Phase 2: Frontend

- [ ] Add `TournamentsPage`.
- [ ] Add route/nav.
- [ ] Add hero/podium/prize ladder/current-user card.
- [ ] Add join state.
- [ ] Add score/rank progress state.
- [ ] Add data hooks.
- [ ] Add mobile responsive layout.

### Phase 3: E2E

- [ ] Add `e2e-tournament-mini-league.mjs`.
- [ ] Use hard assertions.
- [ ] Generate required screenshots.
- [ ] Write report JSON.
- [ ] Fail on missing selectors/states.

### Phase 4: Visual Polish

- [ ] Open/review screenshots.
- [ ] If first screenshot looks like a table, redesign.
- [ ] Improve rank movement and prize ladder.
- [ ] Improve current user highlight.
- [ ] Recapture screenshots.

### Phase 5: Evidence

- [ ] Write summary.
- [ ] Write verdict.
- [ ] Write demo narrative.
- [ ] Write visual review.
- [ ] Score against rubric.

---

## 17. Final Prompt For Hermes

Use this as the launch prompt:

```text
You are working in:
/Users/iharzvezdzin/Documents/projects/hermes/test/puff/fantasy-casino-auto-main

Implement Tournament Mini-League using this contract:
/Users/iharzvezdzin/Downloads/fantasy-casino-tournament-mini-league-feature-contract.md

Use the updated Gold Standard:
/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/pvp-arena-season-1/AUTONOMOUS_DELIVERY_GOLD_STANDARD.md

This is Mode C Demo / Mode D Benchmark quality.

Do not build a generic leaderboard. Build a live casino tournament experience.

Critical requirements:
- Create a tournament hub, preferably /tournaments.
- Player joins through UI, not API fallback.
- Player score/rank changes after real slot spins.
- Current user rank is visible and highlighted.
- Prize ladder and top 3 podium are visible.
- E2E uses hard assertions and exits non-zero on missing required states.
- No API fallback for demo-critical UI actions.
- Evidence goes to /Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-mini-league.
- Required screenshots: hub start, joined state, rank climb, podium/prize ladder, current user highlight, mobile.
- Final verdict must classify result as demo_done, partial, or failed.
- Minimum acceptable score is 84/100.

Keep working autonomously until the result is visually credible, functionally proven, and evidence-backed. If it looks like a table/admin page, it is not done.
```

---

## 18. Owner Review Checklist

After Hermes returns, accept only if:

- [ ] First screenshot looks like a tournament event.
- [ ] Join happened through UI.
- [ ] Current user rank is visible.
- [ ] Points increased after gameplay.
- [ ] Rank changed or movement indicator is visible.
- [ ] Prize ladder is visible.
- [ ] Top 3 podium is visible.
- [ ] Mobile screenshot is acceptable.
- [ ] E2E report uses hard assertions.
- [ ] No API fallback for UI join.
- [ ] No `Invalid Date`, `undefined`, `NaN`, or contradictory key values.
- [ ] Final score is at least 84/100.

If any critical item fails, reject as `partial` and run another iteration with a narrower fix contract.
