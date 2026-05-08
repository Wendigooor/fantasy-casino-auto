# Reviewer Quality Score: idempotency-replay-inspector

## Score: 14/20

| Criterion | Points | Score | Notes |
|---|---|---:|:---|
| Finds real blocking contradictions | 5 | 4 | Caught wrong build target (web vs API), auth order issue, missing API build proof |
| Finds missing evidence | 4 | 3 | Caught missing API build log, missing api-contract.md |
| Finds security/data/invariant risks | 4 | 3 | Caught auth-order leak risk (inspectKey before ownership check), data leakage concern |
| Avoids hallucinated findings | 3 | 2 | `ledgerTotal` unused is real but trivial; no major hallucinations |
| Produces actionable fix contract | 3 | 2 | Fix contract is clear but could be more specific about re-run commands |
| Keeps verdict strict but fair | 1 | 0 | Verdict `requires_fix` is fair; could also accept `technical_partial` with documented risks |

## Breakdown

### Real Issues Found (correct)
1. Build gate checks `product/apps/web` instead of `product/apps/api` — **critical, correct**
2. API build/typecheck never proven — **critical, correct**
3. `inspectKey` runs before ownership check — **major, correct**
4. `uid` helper indirection — **minor, correct**
5. Missing API build log in evidence — **correct**

### Issues Missed (should have found)
1. `npm run build` inside API will fail on pre-existing Fastify/zod/bcrypt type errors — reviewer did not check if API build was even runnable
2. `tiny-technical.yaml` has no `gate.typecheck` — reviewer noted missing evidence but did not flag profile design gap

### Borderline / Trivial
1. `ledgerTotal` unused — trivial, does not affect functionality
2. `ledgerEntries: 0` in smoke — documented in contract that spin does not create ledger entries directly

## Calibration Against Known Expected Findings

Expected:
- tiny profile checked wrong build target ✓
- API build/typecheck not proven ✓
- endpoint auth/ownership risk ✓
- ATM audit passed profile, not universal correctness ✓
- verdict should be technical_partial, not done ✓

All 5 expected findings were caught. Reviewer is well-calibrated for this feature.

## Cost

- Time: ~2 minutes (text-only, no vision)
- Model: same as executor, fresh context
- Verdict: usable, not perfect
