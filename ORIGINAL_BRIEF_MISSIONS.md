# Fantasy Casino — Missions & Quests Feature Brief

## Document Purpose

This document describes a complete product feature for `fantasy-casino-auto`: a Missions & Quests system.

It is written as a development-ready feature brief. It should be usable by an autonomous agent, product manager, business analyst, system analyst, frontend engineer, backend engineer, QA engineer, or reviewer.

The goal is to build a feature that is:

- understandable as a product;
- valuable for player engagement;
- feasible inside the existing codebase;
- visually demonstrable;
- testable end-to-end;
- suitable for autonomous delivery with evidence.

This document intentionally does not depend on the PvP Arena experiment. It can be used as a standalone feature mission.

## Executive Summary

Missions & Quests give players short, clear goals inside the casino experience.

Instead of only playing isolated spins, duels, bonuses, and wallet actions, the player sees a structured set of objectives:

- play 5 spins;
- win 1 PvP duel;
- wager 1,000 coins;
- claim a bonus;
- complete a daily challenge;
- unlock a reward after progress reaches 100%.

The feature turns existing product activity into a progression loop:

```text
see mission -> perform game action -> progress updates -> claim reward -> see completion state
```

This is a strong autonomous-delivery candidate because the result is easy to demonstrate visually and functionally. A good implementation can show a full player journey in a few screenshots:

1. Missions dashboard.
2. Mission details.
3. Spin or duel action.
4. Progress update.
5. Completed mission.
6. Reward claim.
7. Wallet or profile reflecting reward.

## Why This Feature Matters

### Product Value

Missions create a reason to return and a reason to explore multiple parts of the product.

They can increase:

- session depth;
- game discovery;
- repeat visits;
- bonus engagement;
- PvP participation;
- player motivation after losses;
- perceived product richness.

### Business Value

Missions are a flexible engagement layer.

They can be used for:

- daily retention;
- onboarding;
- cross-sell between slots, roulette, duels, and bonuses;
- promotional campaigns;
- VIP progression;
- reactivation;
- controlled reward distribution.

### Demo Value

This is an excellent feature for an autonomous development experiment because it produces visible proof:

- mission cards;
- progress bars;
- completion states;
- reward states;
- wallet changes;
- evidence screenshots;
- deterministic E2E flow.

## Competitive Inspiration

This feature borrows common patterns from social casino, iGaming, mobile games, and consumer gamification products.

### Common Market Patterns

#### Daily Missions

Players receive a small set of goals that reset daily.

Examples:

- play 3 games;
- place 5 bets;
- win once;
- claim a bonus;
- complete a spin streak.

Value:

- creates habitual return behavior;
- keeps scope small;
- easy to understand.

#### Progression Quests

Longer quests guide players through multiple product areas.

Examples:

- complete first spin;
- make first deposit;
- try roulette;
- enter a duel;
- claim a reward.

Value:

- improves onboarding;
- encourages discovery;
- helps new users understand product breadth.

#### Event Missions

Time-limited missions tied to a campaign or season.

Examples:

- Weekend Spin Rush;
- Duel Week;
- Bonus Hunt;
- High Roller Challenge.

Value:

- creates urgency;
- easy to market;
- supports seasonal content.

#### Reward Claim Moment

The reward is not silently granted. The player clicks claim and sees a satisfying completion state.

Value:

- creates agency;
- gives a clear payoff;
- makes the feature more demoable.

## Current Codebase Context

The repository already has useful foundations:

- `game_rounds` for spin history;
- `duels` for PvP outcomes;
- `ledger_entries` for wallet and reward accounting;
- `bonus_wagering` for bonus progress;
- `achievement-routes.ts` for achievement-style derived progress;
- `AchievementsPage.tsx` for existing progress UI;
- `BonusPage.tsx` for bonus and wagering UI;
- `GamePage.tsx` for slot spins;
- `DuelPage.tsx` and `DuelsPage.tsx` for PvP flow;
- `WalletPage.tsx` for balance/ledger;
- `LeaderboardPage.tsx` for ranking/progression patterns.

This means Missions should not start from a blank slate. The feature should extend existing behavior and reuse existing product concepts.

## Product Goal

Build a Missions & Quests system that lets a player:

- see active missions;
- understand what action is required;
- perform the action in the product;
- see progress update;
- complete the mission;
- claim a reward;
- verify the reward in wallet or profile.

The MVP should feel like a real engagement layer, not a static achievement list.

## Target Users

### Primary User: Player

The player wants:

- clear goals;
- visible progress;
- simple rewards;
- a reason to keep playing;
- a feeling that actions matter.

### Secondary User: Operator/Admin

For MVP, admin authoring can be seeded/static. However, the system should be designed so future admin control is possible.

The operator eventually wants:

- create missions;
- define rewards;
- define eligibility;
- schedule campaigns;
- monitor completion.

Admin UI is not required for MVP unless the autonomous run has extra budget.

## MVP Scope

### In Scope

- Player-facing Missions page.
- Active missions list.
- Mission categories.
- Progress tracking.
- Completion state.
- Reward claim.
- Wallet credit for claimed coin reward.
- Basic mission definitions seeded in code or DB.
- API endpoints for reading missions and claiming rewards.
- Integration with at least two existing action types.
- Deterministic E2E demo.
- Evidence package with screenshots and summary.

### Recommended Action Types For MVP

Use these because the codebase already supports them:

- slot spins;
- PvP duel completion or win;
- deposit or wallet action;
- bonus claim or wagering progress.

### Out Of Scope

- complex admin campaign builder;
- segmentation by VIP tier;
- real-money compliance logic;
- abuse detection beyond basic idempotency;
- push notifications;
- email campaigns;
- multi-week battle pass;
- full tournament system;
- real external payment integration.

## MVP Missions

The MVP should include 4-6 missions.

### Mission 1: First Steps

Type: onboarding  
Goal: play 1 slot spin  
Progress: `spins_count >= 1`  
Reward: 100 coins  
Why: simple, deterministic, easy first completion.

### Mission 2: Spin Starter

Type: daily  
Goal: play 5 slot spins  
Progress: `spins_count_today / 5`  
Reward: 250 coins  
Why: demonstrates incremental progress.

### Mission 3: Duel Challenger

Type: PvP  
Goal: complete 1 duel  
Progress: `settled_duels_count >= 1`  
Reward: 500 coins  
Why: pushes player into PvP and shows cross-feature engagement.

### Mission 4: Bonus Explorer

Type: bonus  
Goal: claim any bonus  
Progress: `bonus_claimed_count >= 1`  
Reward: 150 coins or badge-only completion  
Why: connects to bonus system and makes bonus page more useful.

### Mission 5: High Roller Warmup

Type: wager  
Goal: wager 1,000 coins total  
Progress: `total_wagered / 1000`  
Reward: 750 coins  
Why: demonstrates cumulative numeric progress.

### Mission 6: Comeback Trail

Type: retention/demo  
Goal: open wallet after completing a mission or claim a reward  
Progress: `reward_claimed >= 1` and wallet visited, or claim-only if page tracking is too much  
Reward: optional badge/state only  
Why: closes the loop into wallet visibility.

For MVP, if six missions is too much, implement the first four.

## User Journey

### Journey A: New Player Completes First Mission

1. Player logs in.
2. Player opens Missions.
3. Player sees “First Steps: Play 1 spin”.
4. Player clicks mission CTA.
5. Player lands on slot game.
6. Player spins once.
7. Player returns to Missions.
8. Mission shows 100% complete.
9. Player clicks Claim.
10. Reward is credited to wallet.
11. Mission shows Claimed.

### Journey B: Player Progresses Daily Mission

1. Player opens Missions.
2. “Spin Starter” shows 0/5.
3. Player performs 2 spins.
4. Missions page shows 2/5.
5. Progress bar is partially filled.
6. Player understands what remains.

### Journey C: Player Completes Cross-Feature Mission

1. Player opens Missions.
2. Player sees “Duel Challenger”.
3. Player clicks CTA to PvP Arena.
4. Player completes a duel.
5. Mission progresses to complete.
6. Reward can be claimed.

## UX Requirements

### Missions Page

The Missions page should include:

- page title;
- active missions;
- completed/claimed section;
- progress summary;
- mission category tabs or filters;
- clear CTA per mission;
- visual distinction between active, completed, and claimed.

Recommended tabs:

- Active;
- Completed;
- Claimed;
- Daily.

### Mission Card

Each card should show:

- mission title;
- short description;
- reward;
- progress bar;
- progress label;
- status badge;
- CTA.

Example statuses:

- Active;
- Ready to claim;
- Claimed;
- Expired.

### Mission Detail Optional

If budget allows, clicking a mission opens a detail panel.

It can show:

- objective;
- current progress;
- reward;
- expiration;
- activity history;
- CTA.

### Reward Claim Moment

The claim action should feel satisfying.

Minimum:

- button changes to claiming state;
- success message appears;
- card changes to claimed;
- wallet/balance updates or can be verified;
- optional small animation.

## Visual Direction

The visual style should match the existing casino UI but feel more like a progression layer.

Good direction:

- compact, game-like mission cards;
- strong progress bars;
- clear reward chips;
- category icons;
- completion glow;
- claimed state with subdued style;
- small celebratory moment on claim.

Avoid:

- generic admin-table feel;
- static achievement-only grid;
- huge empty dark pages;
- unclear CTAs;
- hidden reward state;
- completion without payoff.

## Information Architecture

Recommended route:

```text
/missions
```

Optional:

```text
/missions/:id
```

Navigation:

- add Missions link to main nav;
- optionally link from Achievements page;
- mission CTAs link to relevant pages: slots, duels, bonus, wallet.

## Backend Requirements

### Data Model

Prefer a simple relational model.

Recommended tables:

```text
missions
  id
  code
  title
  description
  category
  objective_type
  objective_target
  reward_type
  reward_amount
  active
  starts_at
  ends_at
  created_at

player_missions
  id
  user_id
  mission_id
  progress
  target
  status
  completed_at
  claimed_at
  created_at
  updated_at
```

Allowed statuses:

```text
active
completed
claimed
expired
```

Allowed objective types for MVP:

```text
spin_count
duel_completed
duel_won
bonus_claimed
total_wagered
deposit_count
```

Allowed reward types for MVP:

```text
coins
badge
none
```

### Progress Calculation Strategy

Two possible strategies:

#### Strategy A: Derived Progress

Calculate progress from existing tables each time missions are fetched.

Pros:

- simpler;
- less event plumbing;
- easier for MVP.

Cons:

- may become expensive later;
- harder to handle daily windows unless queries are careful.

#### Strategy B: Event-Driven Progress

Update `player_missions` when relevant actions happen.

Pros:

- scalable;
- explicit history;
- easier to animate realtime progress.

Cons:

- more code;
- more edge cases;
- requires stronger idempotency.

Recommendation for MVP:

Use derived progress for read model plus persisted claim state.

That means:

- mission progress can be calculated from `game_rounds`, `duels`, `ledger_entries`, and bonus tables;
- reward claim is persisted in `player_missions`;
- claimed status must be idempotent.

### API Endpoints

Recommended endpoints:

```text
GET /api/v1/missions
GET /api/v1/missions/:id
POST /api/v1/missions/:id/claim
```

Optional for demo/debug:

```text
POST /api/v1/missions/refresh
```

### GET /api/v1/missions Response

Example:

```json
{
  "missions": [
    {
      "id": "mission-first-spin",
      "code": "first_spin",
      "title": "First Steps",
      "description": "Play your first slot spin",
      "category": "onboarding",
      "objectiveType": "spin_count",
      "progress": 1,
      "target": 1,
      "progressPercent": 100,
      "status": "completed",
      "reward": {
        "type": "coins",
        "amount": 100
      },
      "cta": {
        "label": "Play Slots",
        "href": "/games/slot-basic"
      }
    }
  ],
  "summary": {
    "active": 3,
    "completed": 1,
    "claimed": 0,
    "totalClaimable": 100
  }
}
```

### POST /api/v1/missions/:id/claim Response

Example:

```json
{
  "missionId": "mission-first-spin",
  "status": "claimed",
  "reward": {
    "type": "coins",
    "amount": 100
  },
  "wallet": {
    "balance": 10100,
    "currency": "USD"
  }
}
```

### Claim Rules

- player can claim only completed mission;
- player cannot claim same mission twice;
- claim must be idempotent or safely rejected;
- reward ledger entry must be created for coin rewards;
- wallet balance must update transactionally with ledger entry;
- if reward is zero or badge-only, status still becomes claimed.

### Ledger Entry

For coin reward, create ledger entry.

Recommended type:

```text
mission_reward
```

If ledger type enum does not support it, either:

- add `mission_reward`; or
- use existing reward-compatible type with clear description.

Prefer adding explicit type if domain package and DB allow it safely.

## Frontend Requirements

### New Page

Create:

```text
product/apps/web/src/pages/MissionsPage.tsx
```

Route:

```text
/missions
```

Navigation:

- add to main nav as “Missions” or “Quests”;
- if space is limited, use “Missions”.

### Data Hooks

Use existing data-fetching pattern, likely TanStack Query.

Suggested query keys:

```text
["missions"]
["wallet"]
```

After claim:

- invalidate missions;
- invalidate wallet;
- optionally show toast.

### UI States

Must support:

- loading;
- empty;
- active;
- completed;
- claimed;
- claim pending;
- claim success;
- claim error.

### Demo/Test Hooks

Use the least intrusive reliable mechanism.

Recommended:

```html
<main data-page="missions" data-ready="true">
<article data-testid="mission-card" data-state="completed">
<button data-testid="claim-mission">
```

If project standards prefer accessibility selectors, use stable roles/names instead.

## System Analysis

### Data Sources By Mission Type

| Objective | Source |
|---|---|
| spin_count | `game_rounds` |
| total_wagered | `game_rounds.bet_amount` |
| duel_completed | `duels.status = settled` |
| duel_won | `duels.winner_id = user_id` |
| bonus_claimed | `ledger_entries.type = bonus_credit` or bonus table |
| deposit_count | `ledger_entries.type = deposit` |

### Important Risks

#### Double Claim

A player may click claim twice or retry after network failure.

Mitigation:

- transaction;
- unique constraint on `(user_id, mission_id)` for claimed state or claim record;
- lock row during claim;
- return current claimed state if already claimed.

#### Derived Progress Mismatch

Progress may be calculated differently across API and frontend.

Mitigation:

- API returns progress and target;
- frontend only displays API-calculated progress.

#### Reward Ledger Integrity

Wallet reward must not be credited without ledger entry.

Mitigation:

- update wallet and ledger in one transaction.

#### Time Windows

Daily missions need date boundaries.

Mitigation:

- MVP can include daily label without automatic reset, or use `created_at >= current_date`;
- document timezone assumption.

#### Abuse

Players could repeatedly create actions just for rewards.

Mitigation:

- small fantasy rewards;
- idempotent claim;
- future risk/anti-abuse out of MVP.

## Acceptance Criteria

### Functional

- player can open `/missions`;
- player sees active missions;
- player sees progress values;
- progress changes after relevant product action;
- completed mission can be claimed;
- claimed mission cannot be claimed twice;
- coin reward updates wallet/ledger;
- UI reflects claimed state.

### Product

- mission purpose is clear;
- CTA tells player what to do next;
- progress is readable;
- reward is visible before claim;
- claim moment is satisfying;
- completed/claimed states are visually distinct.

### Technical

- API validates auth;
- claim is transactional;
- claim is safe against duplicate clicks;
- progress calculation is server-owned;
- tests or E2E cover at least one completion and claim flow;
- no unrelated refactors.

### Demo

- deterministic user can complete first mission;
- screenshot sequence shows start, progress, completion, claim, wallet/result;
- evidence package includes summary and demo narrative;
- E2E waits on stable page/state signals.

## Suggested E2E Demo Path

### Demo Mode

Use a unique test user:

```text
missions-demo-<timestamp>@casino.test
```

### Steps

1. Register/login user.
2. Open `/missions`.
3. Verify `First Steps` is active and 0/1.
4. Capture `01-missions-start.png`.
5. Navigate to slot game through mission CTA or direct route.
6. Perform one spin.
7. Return to `/missions`.
8. Verify `First Steps` is completed and claimable.
9. Capture `02-mission-complete.png`.
10. Click Claim.
11. Verify mission status is claimed.
12. Verify wallet balance or ledger includes reward.
13. Capture `03-mission-claimed.png`.
14. Open wallet or profile.
15. Capture `04-wallet-reward.png`.

### Required Stable Signals

Use one of the following:

- `data-page="missions"`;
- `data-testid="mission-card-first-spin"`;
- `data-state="active|completed|claimed"`;
- visible text assertions;
- API response assertions.

### Screenshot Requirements

Required:

- missions start state;
- completed claimable state;
- claimed state;
- wallet/ledger reward state.

Optional:

- mission detail panel;
- progress after partial spin count;
- all missions dashboard.

## Evidence Package Requirements

For an autonomous run, create:

```text
evidence/missions-quests/
  summary.md
  verdict.md
  DEMO_NARRATIVE.md
  changed-files.md
  artifacts.json
  screenshots/
  logs/
```

If using a lighter feature mode, at minimum:

- summary;
- changed files;
- verification command;
- key screenshots.

## Demo Narrative Template

```markdown
# Demo: Missions & Quests

## User Journey
1. Player opens Missions and sees available goals.
2. Player completes a slot spin mission.
3. Mission becomes claimable.
4. Player claims reward.
5. Wallet reflects the reward.

## Artifact Map
| Artifact | What it shows | Why it matters |
|---|---|---|
| 01-missions-start.png | Missions page before progress | Shows player understands what to do |
| 02-mission-complete.png | Mission completed and claimable | Shows progress loop works |
| 03-mission-claimed.png | Claimed state | Shows reward lifecycle completes |
| 04-wallet-reward.png | Wallet/ledger reward | Shows economic side effect is real |
```

## Open Questions

These can be resolved by the implementing agent if local context makes the answer obvious.

1. Should missions be seeded in DB or defined in code?
2. Should daily missions actually reset by date in MVP?
3. Should `mission_reward` be a new ledger type or reuse an existing type?
4. Should Achievements and Missions share UI or stay separate?
5. Should claim reward be immediate or require explicit claim?

Recommended answers for MVP:

- seed missions in DB if migrations are easy, otherwise define in service code and persist claims;
- daily reset can be simulated or simple date-based;
- use explicit `mission_reward` if domain/DB changes are safe;
- keep Achievements and Missions separate;
- require explicit claim.

## Implementation Plan

### Phase 0: Discovery

- inspect wallet ledger types;
- inspect migrations;
- inspect `achievement-routes.ts`;
- inspect `bonus.ts`;
- inspect game spin route and response;
- inspect nav/router structure;
- decide DB vs service-defined mission definitions.

### Phase 1: Backend

- add mission data model or service definitions;
- add player mission claim persistence;
- implement progress calculation;
- implement `GET /missions`;
- implement `POST /missions/:id/claim`;
- add ledger entry for reward;
- ensure claim idempotency.

### Phase 2: Frontend

- add `/missions` route;
- add nav link;
- create Missions page;
- create MissionCard component if useful;
- implement claim mutation;
- update wallet/missions queries after claim;
- add stable selectors or demo state.

### Phase 3: Verification

- test mission list;
- test progress after spin;
- test claim reward;
- test double claim behavior;
- run typecheck/build;
- run deterministic E2E demo.

### Phase 4: Demo Polish

- improve mission cards;
- improve progress visualization;
- improve completion/claim state;
- capture screenshots;
- create demo narrative.

### Phase 5: Evidence

- write summary;
- write verdict;
- write changed files;
- save screenshots;
- document known limitations.

## Quality Bar

The feature is successful if:

- the player understands missions in under 10 seconds;
- at least one mission can be completed end-to-end;
- reward claim is real and verifiable;
- progress is not fake UI-only state;
- screenshots tell a coherent story;
- implementation is scoped and reviewable.

## Recommended Run Mode

Use the autonomous delivery standard mode:

```text
Mode C: Demo
```

Reason:

- feature is visual;
- stakeholder demo value is high;
- E2E path is clear;
- evidence quality matters.

If running 5 models in parallel:

```text
Mode D: Benchmark
```

Keep mission, scope, budget, demo path, and evidence schema identical across runs.

## Final Product Statement

Missions & Quests should make Fantasy Casino feel more alive.

The MVP is not about building a huge campaign engine. It is about proving a complete engagement loop:

```text
goal -> action -> progress -> completion -> reward -> proof
```

If the autonomous run delivers that loop clearly, with real backend state and a strong visual demo, the feature is a good candidate for further iteration.

