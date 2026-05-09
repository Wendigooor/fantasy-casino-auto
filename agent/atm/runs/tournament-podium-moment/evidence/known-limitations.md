# Known Limitations — Tournament Podium Moment

## 1. CORS/SSE Console Error in Dev Mode

**Issue:** E2E run logs a CORS error for `http://localhost:3001/api/v1/sse`. This is a browser console error, not a functional issue.

**Why:** SSE endpoint is registered on a separate route path that doesn't inherit the standard CORS middleware in dev mode. Production handles this via the `CORS_ORIGIN` env var.

**Impact:** None on feature functionality. The SSE connection is used for live tournament updates, not for the podium modal. The modal works correctly regardless of SSE state.

**Status:** Accepted. Does not affect demo quality or user experience.

## 2. Source Files Not in Bundle (Original Run)

**Issue:** `review-bundle-generator.py` did not strip backticks from markdown table paths, causing 4 source files to be silently excluded.

**Fix:** Generator patched (`.strip("`")` added). Bundle regenerated with all files included.

## 3. Vision Review Skipped (DeepSeek)

**Issue:** The original self-review loop used DeepSeek (text-only model) which could not analyze screenshots.

**Mitigation:** Codex vision review completed separately — see `codex-vision-review.md`.

## 4. Session-Based Dismissal

**Issue:** Dismissal state uses `sessionStorage`, which persists only for the current browser tab. If the user opens a new tab, the podium popup may reappear.

**Status:** By design — matches the standard pattern used throughout the app.
