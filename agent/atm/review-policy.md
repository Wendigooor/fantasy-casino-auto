# Hermes Reviewer Policy — Model Selection & Cost Optimization

## Core Principle

**Не жечь дорогие модели на том, что может сделать дешёвая.**  
**Не жечь vision на том, что можно проверить текстом.**

---

## Reviewer Assignment Matrix

| Feature Type | Text Reviewer | Vision Reviewer | Bundle |
|---|---|---|---|
| Backend/technical (no UI) | **DeepSeek Pro** (обязателен) | — | code + reports |
| Demo/user-facing (with UI) | **DeepSeek Pro** (обязателен) | **MiMo-V2.5-Pro** (дополнительно) | code + reports + screenshots |
| Internal/experiment (tiny) | **DeepSeek Pro** (если есть бюджет) или same-model fresh context | — | code + reports |

## Workflow

### Backend/Technical Feature (rekommended — cheapest)

```text
review-bundle-generator.py --id <run-id>
           ↓
    DeepSeek Pro (text only)
           ↓
    reviewer-verdict.md
    reviewer-quality-score.md
    reviewer-fix-contract.md
```

### Demo/User-Facing Feature (dual review)

```text
review-bundle-generator.py --id <run-id>
           ↓
    ┌─────────────────┬────────────────────┐
    │                 │                    │
    ▼                 ▼                    ▼
DeepSeek Pro        MiMo-V2.5-Pro
(text: code +       (vision: screenshots
 reports)            + demo artifacts)
    │                 │
    └────────┬────────┘
             ▼
      Cross-reference findings:
      - Если text review сказал "UI broken", а vision сказал "clean"
        → trust vision для UI, trust text для логики
      - Если оба нашли одинаковую проблему
        → CRITICAL, блокирует done
```

### No-Visual Feature (code only, simplest)

```text
review-bundle-generator.py --id <run-id>
           ↓
    DeepSeek Pro (text only)
           ↓
    reviewer-verdict.md
```

---

## Why These Models

### Text Reviewer: DeepSeek Pro

| Параметр | Значение |
|----------|----------|
| Provider | opencode-go или api.deepseek.com |
| Cost | Низкий (дешевле Claude/GLM) |
| Strengths | Ловит auth, build, contract violations, contradictions |
| Weaknesses | Не видит UI/screenshots |
| Когда использовать | **Всегда** — это базовый reviewer |

### Vision Reviewer: MiMo-V2.5-Pro

| Параметр | Значение |
|----------|----------|
| Provider | opencode-go |
| Cost | Средний (но только для screenshot pack) |
| Strengths | Видит broken UI, empty screens, cheap design, mobile issues |
| Weaknesses | Не читает код |
| Когда использовать | **Только** когда feature has `mode: demo` |

### Fallback: Same-Model Fresh Context

If DeepSeek Pro is unavailable (Insufficient Balance, API down):

```text
Используй kimi-k2.6 (текущий executor) но в fresh context
с полным review-bundle.
```

---

## Quality Gates for Review Bundle

Before starting review:

```yaml
gates:
  - id: bundle.active_profile_resolved
    condition: active-profile.yaml resolved from DB, not guessed
    severity: critical

  - id: bundle.audit_present
    condition: atm-audit.txt exists and is non-empty
    severity: critical

  - id: bundle.freshness
    condition: bundle generated after latest git commit
    severity: critical
```

If any gate fails: **bundle is invalid. Abort review.**

---

## Cost Optimization Rules

1. **DeepSeek Pro для text — всегда.** Он дешевле kimi, и для text-only review разницы нет.
2. **MiMo-V2.5-Pro для vision — только при screenshots.** Не жечь на backend фичах.
3. **Если нет DeepSeek баланса → same-model fresh context.** Дешевле чем не делать review.
4. **Если нет MiMo → пропустить vision.** Text review лучше, чем ничего.
5. **Cross-model > same-model > no review.** Но cross-model с плохим bundle < same-model с хорошим bundle.
