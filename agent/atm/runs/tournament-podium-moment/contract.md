# Feature Contract: Tournament Podium Moment

## Purpose

Validate the full autonomous delivery chain on a small user-facing feature with visual evidence, reviewer evidence, and ATM review-bundle evidence.

The feature is intentionally small:

> When the current player reaches a tournament prize position, especially top 3, show a premium "Podium Moment" popup that celebrates the rank, prize eligibility, and next action.

This is not a new tournament system. It is a visual/UX layer on top of the existing tournament page, leaderboard, rank, and prize ladder.

## Run Metadata

- Run id: `tournament-podium-moment`
- Mode: `demo`
- Product area: tournaments
- Primary page: `/tournaments`
- Existing page: `product/apps/web/src/pages/TournamentsPage.tsx`
- Expected ATM profile: `demo`
- Expected evidence path: `agent/atm/runs/tournament-podium-moment/evidence/`
- Expected review bundle path: `agent/atm/runs/tournament-podium-moment/review-bundle/`

## Why This Feature

This is a good end-to-end validation feature because it touches all weak spots discovered in previous runs:

- It is visual, so screenshots and vision review matter.
- It is small, so execution should not hide behind complexity.
- It depends on real state: current user rank, top 3, prize eligibility.
- It can be demoed with a clear story: join tournament, climb into prize zone, popup appears.
- It forces the review-bundle generator to include UI source, E2E source, screenshots, ATM export, audit, profile, and review outputs.

## User Story

As a player in a live tournament, when my rank enters a prize-winning position, I want a celebratory popup that clearly shows I reached the podium, what prize position I am in, and what I should do next.

## Product Requirements

### Trigger

Show the popup when all conditions are true:

- Current user is joined in the active tournament.
- Current user has `me.rank <= 3` or `me.prizeEligible === true`.
- Popup has not already been dismissed for this tournament/rank in the current browser session.

Preferred trigger:

- After data refresh/E2E action causes `me.rank` to become `1`, `2`, or `3`.

Acceptable fallback for MVP:

- If the user opens `/tournaments` and is already in top 3, show the popup once.

### Popup Content

The popup must include:

- Rank: `#1`, `#2`, or `#3`.
- Podium label: `Gold Podium`, `Silver Podium`, or `Bronze Podium`.
- Prize eligibility copy: "You are in the prize zone".
- Current points.
- Prize amount or prize label if available from `prizes`.
- CTA: `Keep Playing`.
- Secondary action: `Close`.

### Visual Quality

The popup should feel like a casino event moment, not a browser alert or admin modal.

Required visual cues:

- Premium modal overlay with dimmed background.
- Gold/podium gradient or medal motif.
- One strong focal element: medal/rank/spotlight.
- Light celebratory motion, but no excessive animation.
- Mobile-friendly layout.
- No layout shift that hides the tournament state behind a broken overlay.

### State / Persistence

Use browser session/local state only.

Suggested key:

```text
tournament-podium-moment:<tournamentId>:<rank>
```

Dismissal should prevent the same popup from appearing repeatedly for the same tournament/rank in the same browser session.

Do not add a DB migration unless absolutely necessary.

## Non-Goals

- No prize payout implementation.
- No tournament settlement implementation.
- No backend schema changes unless discovery proves they are already required.
- No new tournament scoring rules.
- No global notification system.
- No complex animation framework.

## Implementation Guidance

Likely files:

- `product/apps/web/src/pages/TournamentsPage.tsx`
- `product/apps/web/src/styles.css`
- New E2E script under `product/scripts/` or `scripts/`
- Evidence files under `agent/atm/runs/tournament-podium-moment/evidence/`

Expected UI implementation:

- Add a small `PodiumMomentModal` component near `TournamentsPage`.
- Compute `podiumPrize` from `prizes` and `me.rank`.
- Add `data-testid="podium-moment-modal"`.
- Add `data-state="podium-moment"` or `data-podium-moment="visible"` on page/root when modal is visible.
- Add `data-testid="podium-moment-rank"`.
- Add `data-testid="podium-moment-prize"`.
- Add `data-testid="podium-moment-close"`.
- Add `data-testid="podium-moment-keep-playing"`.

## Discovery Requirements

Before implementation, inspect and record:

- Existing tournament API response from `GET /api/v1/tournaments/active`.
- Existing tournament seed/join paths.
- Existing page data hooks and data attributes.
- Existing E2E/demo scripts for tournaments/lightning.
- Existing CSS conventions for premium tournament UI.

Discovery must answer:

- How can E2E reliably put the current user into top 3?
- Does API already return `me.rank`, `me.prizeEligible`, and `prizes`?
- Is a backend change needed, or can this be front-end only?
- What route/data hook proves the popup state without vision?

## Demo / E2E Requirements

Create an autonomous E2E demo that proves:

1. User can open `/tournaments`.
2. User can join the active tournament if not already joined.
3. Test setup or gameplay moves current user into top 3.
4. Popup appears.
5. Popup displays correct rank and prize-zone copy.
6. Close/dismiss works.
7. Popup does not immediately reappear after dismissal for the same rank.
8. Mobile screenshot is acceptable.

The E2E script must not rely on fixed sleeps as the primary wait mechanism.

Preferred waits:

- `data-page="tournaments"`
- `data-ready="true"`
- `data-testid="podium-moment-modal"`
- visible text assertions
- API response assertions where useful

## Required Screenshots

Capture at least five screenshots:

1. `01-tournament-before-podium.png` - joined/scored state before popup or before podium capture.
2. `02-podium-popup.png` - desktop popup visible.
3. `03-podium-popup-closeup.png` - modal details/rank/prize visible.
4. `04-after-dismissal.png` - popup closed, player remains visible in top 3.
5. `05-mobile-podium-popup.png` - mobile modal at 390x844 or similar.

Screenshots must tell a story. Do not accept screenshots that merely prove the page exists.

## Evidence Requirements

Write evidence to:

```text
agent/atm/runs/tournament-podium-moment/evidence/
```

Required evidence:

- `summary.md`
- `changed-files.md`
- `e2e-report.json`
- `visual-review.md`
- `reviewer-verdict.md`
- `reviewer-quality-score.md`
- `reviewer-fix-contract.md`
- `reviewer-fix-response.md`
- `vision-review.md`
- `atm-export.json`
- `screenshots/`

Required review bundle:

```text
agent/atm/runs/tournament-podium-moment/review-bundle/
```

It must include:

- `REVIEW_BUNDLE_MANIFEST.md`
- `contract.md`
- `summary.md`
- `changed-files.md`
- `atm-export.json`
- `active-profile.yaml`
- `atm-audit.txt`
- changed source files
- E2E script source
- screenshots or links to screenshot folder
- reports

## ATM Workflow

Run through ATM from the project root.

Suggested commands:

```bash
./scripts/atm init-run --id tournament-podium-moment --profile demo --contract agent/atm/runs/tournament-podium-moment/contract.md
./scripts/atm import-gates --id tournament-podium-moment --file agent/atm/profiles/demo.yaml
./scripts/atm status --id tournament-podium-moment
```

After implementation:

```bash
./scripts/atm verify --id tournament-podium-moment
./scripts/atm verdict --id tournament-podium-moment
./scripts/atm audit --id tournament-podium-moment
./scripts/atm export --id tournament-podium-moment --out agent/atm/runs/tournament-podium-moment/evidence
python3 scripts/review-bundle-generator.py --id tournament-podium-moment
```

If the current `demo.yaml` profile is too specific to Lightning, adjust it or create a run-specific profile before importing gates. Do not silently reuse Lightning commands for this feature.

## Review Requirements

This feature must exercise the full review loop.

### Text Review

Use a fresh-context reviewer with the generated review bundle.

Preferred:

- If available: a model from a different family than the executor.
- If not available: same-model fresh context is acceptable.

The reviewer must produce:

- `reviewer-verdict.md`
- `reviewer-quality-score.md`
- `reviewer-fix-contract.md`

### Vision Review

Because this is a visual/demo feature, run a vision review if an affordable vision-capable model is available.

If no vision reviewer is available, write `vision-review.md` with:

- reason vision review was skipped;
- manual screenshot inspection notes by the executor;
- screenshots reviewed;
- residual risk.

Vision review must check:

- popup looks like a premium casino event moment;
- modal is not cheap/admin-looking;
- rank/prize are visible and legible;
- mobile layout is not broken;
- screenshots tell a story;
- no visible `undefined`, `NaN`, `Invalid Date`, or contradictory balance/rank.

### Fix Response

If reviewer verdict is `requires_fix`, executor must write `reviewer-fix-response.md` before final verdict.

Every blocking finding must be one of:

- fixed with evidence;
- accepted risk with reason;
- out of scope with reason.

## Done Criteria

The feature is done only if:

- Popup appears for top-3/prize-eligible current user.
- Popup can be dismissed and does not immediately reappear.
- E2E report proves state and dismissal.
- Desktop and mobile screenshots exist.
- Visual review exists.
- Review bundle is valid.
- Text review exists.
- Vision review exists or is explicitly skipped with reason.
- ATM audit passes.
- Final status is not hand-written; it is based on ATM verdict plus reviewer status.

## Failure Conditions

Mark as `demo_partial` or `technical_partial`, not done, if:

- E2E passes but screenshots are weak or blank.
- Popup appears without proving current user is actually top 3.
- Popup reappears repeatedly after dismissal.
- Review bundle manifest is missing changed source files.
- `atm audit` fails.
- Reviewer says `requires_fix` and there is no `reviewer-fix-response.md`.
- Vision review is skipped without reason.

## Reviewer Calibration Notes

A good reviewer should catch:

- If the popup is only triggered by mock state and not actual tournament rank.
- If `demo.yaml` still runs Lightning E2E instead of tournament E2E.
- If screenshots prove only page existence, not podium moment.
- If modal dismissal is untested.
- If mobile screenshot is missing.
- If `review-bundle` omits changed UI/E2E files.
- If final summary says `done` while reviewer says `requires_fix`.

## Suggested Final Demo Story

```text
The player joins a live tournament.
They climb into the prize zone.
The interface celebrates the moment with a premium podium popup.
The popup shows rank, prize eligibility, and a keep-playing CTA.
After closing it, the tournament page still clearly shows the player in the top 3.
```

