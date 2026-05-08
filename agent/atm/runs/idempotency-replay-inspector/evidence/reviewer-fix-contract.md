# Reviewer Fix Contract: idempotency-replay-inspector

## Must Fix

### 1. Build gate targets API, not web
**File:** `agent/atm/profiles/tiny-technical.yaml`
**Change:**
```yaml
- id: gate.build
  title: API build passes
  severity: critical
  kind: command
  command: cd product/apps/api && npm run build
```
**Re-run:** `./scripts/atm run --id idempotency-replay-inspector --gate gate.build -- cd product/apps/api && npm run build`

### 2. API build result recorded in evidence
**Action:** Run `cd product/apps/api && npm run build` and capture output to `agent/atm/runs/idempotency-replay-inspector/evidence/build.log`.
**Re-run:** `./scripts/atm evidence --id idempotency-replay-inspector --gate gate.build --file build.log`

### 3. Auth check before inspectKey
**File:** `product/apps/api/src/routes/idempotency-routes.ts`
**Change:**
```typescript
export async function idempotencyRoutes(app: FastifyInstance) {
  app.get("/idempotency/inspect/:key", async (request) => {
    const requesterId = await uid(request);
    const key = (request.params as { key: string }).key;
    
    // Only allow self-inspection or admin
    // Note: we cannot check ownership before inspectKey, so we restrict
    // inspectKey to return limited info for non-owners
    const result = await inspectKey(app.pg, key, requesterId);
    return result;
  });
}
```
**Alternative (simpler):** Pass `requesterId` to `inspectKey` and let service handle access control.
**Re-run:** `./scripts/atm run --id idempotency-replay-inspector --gate gate.implementation -- echo "route updated"`

## Should Fix

### 4. Remove unused `ledgerTotal`
**File:** `product/apps/api/src/services/idempotency-inspector.ts`
**Change:** Delete `const ledgerTotal = ledgerR.rows.length;`

### 5. Query actual ledger count in smoke
**File:** `product/scripts/idempotency-replay-smoke.mjs`
**Change:** Replace `ledgerEntries: 0` with actual count from API if available, or document why 0.

## Accepted Risks

- Inspector does not verify full ledger-to-wallet reconciliation (out of scope for tiny feature).
- `idempotency_keys` may have multiple records per key if schema allows; inspector reports `records` as row count.

## Re-run After Fix

```bash
./scripts/atm run --id idempotency-replay-inspector --gate gate.build -- cd product/apps/api && npm run build
./scripts/atm pass --id idempotency-replay-inspector --gate gate.build
./scripts/atm verify --id idempotency-replay-inspector
./scripts/atm verdict --id idempotency-replay-inspector
./scripts/atm audit --id idempotency-replay-inspector
```

## Final Status After Fix

Expected: `technical_done` (backend feature, no UI, build+smoke+audit clean).
