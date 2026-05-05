# Secret Handling Policy

## Purpose

Define how secrets, tokens, credentials, and sensitive configuration are managed in the Fantasy Casino project.

This policy implements Rule 2 from the Agent Operating Manual: **No secret leakage**.

---

## Core Principle

**Secrets never leave the environment where they belong.**

- Secrets are never pasted into prompts, logs, chat messages, or code comments.
- Secrets are never committed to git.
- Secrets are never stored in plain text files tracked by git.

---

## Secret Classification

### Class 1: High-risk (never share, never log)

- Database passwords and connection strings
- API keys for external services (payment providers, SMS, email)
- JWT signing keys
- TLS/private keys
- Telegram bot tokens (when configured)

### Class 2: Medium-risk (document pattern, not value)

- AWS/GCP/Azure credentials
- Third-party service tokens
- Encryption keys
- OAuth client secrets

### Class 3: Low-risk (can be in code, but not hardcoded)

- Feature flag defaults
- Rate limiting thresholds
- Timeout values
- Retry counts

---

## Storage Rules

### Environment Variables (Primary)

All Class 1 and Class 2 secrets must be stored as environment variables.

```bash
# .env.local (NOT tracked by git)
export TELEGRAM_BOT_TOKEN="your-token-here"
export DATABASE_URL="postgres://user:pass@host/db"
export SECRET_KEY="random-string-here"
```

```python
# Access in code
import os
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
```

### .env.local File (Local Development Only)

- Must be in `.gitignore`
- Never committed
- Never shared in git diffs
- Only used for local development

### Git-ignored Patterns

```
# Secrets
.env
.env.local
.env.*.local
*.key
*.pem
*.secret
*.credentials
secrets/
```

---

## Agent Rules

### The agent MUST NOT:

1. Print secret values in logs, summaries, or Telegram messages
2. Paste secrets into prompts or chat
3. Write secrets to files tracked by git
4. Hardcode secrets in source code
5. Use the same secret across environments (dev, staging, prod)
6. Log full secret values (only log prefixes or masks)

### The agent MUST:

1. Read secrets from environment variables or secret manager
2. Mask secrets in logs (e.g., `sk-xxxx...1234` instead of full key)
3. Use `.env.local` for local development secrets
4. Document the secret names needed (not values)
5. Flag any hardcoded secret as a security finding
6. Quarantine files with leaked secrets immediately

### Secret Masking in Logs

When a secret must be referenced in logs:

```python
# BAD: logs the full key
log("Using API key: sk-1234567890abcdef...")

# GOOD: masks the key
log("Using API key: sk-****...1234")
```

---

## Secret Manager (Future)

When the project grows beyond local development:

- Use a secret manager (e.g., HashiCorp Vault, AWS Secrets Manager)
- Secrets injected at runtime, not baked into images or configs
- Access controlled by IAM/roles
- Audit logs for secret access

This is out of scope for the MVP but should be planned.

---

## Detection and Remediation

### How secrets leak (common patterns)

1. `git push` accidentally includes `.env` file
2. Copy-pasting a token into a chat prompt
3. Logging a full error that contains a connection string
4. Including a `.key` or `.pem` file in a commit

### What to do if a secret leaks

1. **Rotate the secret immediately** — the leaked secret is considered compromised
2. **Quarantine the leaked file** — `move_to_quarantine(file, "secret leak")`
3. **Log the incident** — record what leaked, where, when
4. **Add to security_findings table** — severity: critical
5. **Review the root cause** — why did the leak happen?

---

## Checklist for New Tasks

Before starting any task that involves configuration:

- [ ] Does this task need a secret?
- [ ] Is the secret stored in an environment variable?
- [ ] Is the secret name documented (not the value)?
- [ ] Are there any hardcoded secrets in the files being edited?
- [ ] Will any output reveal the secret value?

If any answer is "no" or "I don't know", pause and review.
