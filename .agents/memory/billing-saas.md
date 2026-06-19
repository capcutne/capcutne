---
name: Billing & SaaS Architecture
description: Phase 5.6 — Stripe checkout, 3 plan tiers, usage quotas, workspace teams wired into server.py
---

## Key decisions

- Stripe Python SDK (stripe>=10.0.0, installed in pyproject.toml) — not stripe-replit-sync (Node.js only)
- All billing state in JSON files: `data/subscriptions.json`, `data/usage.json`, `data/workspaces.json`
- Usage keys are `userId:YYYY-MM` — monthly buckets, no explicit reset needed
- Billing engine block lives in server.py just before the AI router in do_POST

## Required env vars (not yet set by user)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`
- Without them, checkout/portal return errors but all limit/usage logic still functions

## Plan limits
- Free: 3 proj / 30 transcript min / 10 exports / 50 AI req / 500 MB
- Pro ($19): 50 proj / 300 min / 100 exports / 500 AI / 5 GB + brand_clone + content_agent + workspace
- Business ($49): all unlimited + batch_factory + 4K export

## Feature gating in do_POST
- `/brand/train`, `/brand/compare` → requires `brand_clone` (Pro+)
- `/ai/plan-task` → requires `content_agent` (Pro+)
- `/cfactory/*` → requires `batch_factory` (Business)
- `/export/start` → checks export quota, silently downgrades quality for free users

**Why:** Gating is server-side only (JS is advisory); quota check happens before job is spawned so limits are hard.
