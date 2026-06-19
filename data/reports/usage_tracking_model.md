# Usage Tracking Model
**Phase 5.6 — CapCut Video Editor Clone SaaS**

## Overview

Usage is tracked per-user per-calendar-month in `data/usage.json`. Counters reset automatically at the start of each month (they are keyed by `userId:YYYY-MM`).

## Tracked Metrics

| Metric | Unit | How Tracked | When Incremented |
|--------|------|-------------|-----------------|
| `exports` | count | Integer | On /export/start (before job runs) |
| `transcript_minutes` | float minutes | Decimal | On /ai/transcribe-real (from body.durationMinutes) |
| `ai_requests` | count | Integer | On every AI endpoint call |
| `storage_mb` | float MB | Decimal | On /ai/upload-media (from file size) |
| `projects` | count | Integer | On /project/save (new project only) |

## Data Schema

```json
// data/usage.json
{
  "userId123:2026-06": {
    "projects": 2,
    "transcript_minutes": 14.5,
    "exports": 7,
    "ai_requests": 42,
    "storage_mb": 182.3
  },
  "userId456:2026-06": {
    "projects": 1,
    "transcript_minutes": 0,
    "exports": 0,
    "ai_requests": 8,
    "storage_mb": 0
  }
}
```

## Key Functions

```python
_usage_key(user_id)           # → "userId:2026-06"
_get_usage(user_id)           # → current month bucket
_increment_usage(uid, metric, amount)  # atomic JSON write
_check_limit(uid, metric, amount)     # → {ok, error, limit, used, plan}
```

## Limit Check Algorithm

```python
def _check_limit(user_id, metric, amount=1):
    plan  = _plan_for_user(user_id)  # free / pro / business
    cap   = PLANS[plan]["limits"][metric]
    if cap == -1:                    # unlimited
        return {"ok": True}
    used  = _get_usage(user_id)[metric]
    if used + amount > cap:
        return {"ok": False, "error": "...", "limit": cap, "used": used}
    return {"ok": True}
```

## Monthly Reset

Because usage keys are `userId:YYYY-MM` format, old months' data accumulates in the JSON file but is never read for limit checks. A cleanup job (future work) can prune keys older than 3 months.

## Billing Dashboard Aggregation

The admin billing dashboard (`/billing/admin`) aggregates all current-month usage across all users:

```python
month_prefix = "2026-06"
for key, bucket in all_usage.items():
    if month_prefix in key:
        agg["exports"] += bucket["exports"]
        agg["transcript_minutes"] += bucket["transcript_minutes"]
        agg["ai_requests"] += bucket["ai_requests"]
```
