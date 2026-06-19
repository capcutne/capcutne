# Billing Architecture
**Phase 5.6 — CapCut Video Editor Clone SaaS**

## Overview

The billing system is built on Stripe with a Python http.server backend. It supports three subscription tiers (Free / Pro / Business) with per-user monthly usage quotas enforced server-side.

## Stack

| Layer | Technology |
|-------|-----------|
| Payment processor | Stripe (Python SDK v15) |
| Checkout flow | Stripe Checkout (hosted) |
| Subscription management | Stripe Customer Portal |
| Webhook processing | Python handler in server.py |
| Data store | `data/subscriptions.json` (JSON file) |
| Usage store | `data/usage.json` (JSON file) |

## Plans

| Plan | Price | Projects | Transcript | Exports | AI Requests | Storage |
|------|-------|----------|-----------|---------|-------------|---------|
| Free | $0 | 3 | 30 min/mo | 10/mo | 50/mo | 500 MB |
| Pro | $19/mo | 50 | 300 min/mo | 100/mo | 500/mo | 5 GB |
| Business | $49/mo | Unlimited | Unlimited | Unlimited | Unlimited | 50 GB |

## Subscription Lifecycle

```
User clicks "Upgrade"
  → POST /billing/checkout { plan: "pro" }
    → Create Stripe Customer (or reuse existing)
    → Create Checkout Session with price_id
    → Redirect to Stripe Checkout URL
      → User enters card on Stripe's hosted page
        → Stripe fires checkout.session.completed webhook
          → POST /billing/webhook
            → Update subscriptions.json { userId, plan, status: "active" }
              → User now has Pro access
```

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set plan = pro/business, status = active |
| `customer.subscription.created` | Record sub_id, period_end |
| `customer.subscription.updated` | Update status, cancel_at_period_end |
| `customer.subscription.deleted` | Downgrade to free |

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_... or sk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (whsec_...) |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe Price ID for Business plan |

## Data Schema

### subscriptions.json
```json
{
  "<userId>": {
    "plan": "pro",
    "status": "active",
    "stripe_customer_id": "cus_xxx",
    "stripe_sub_id": "sub_xxx",
    "current_period_end": 1720000000,
    "cancel_at_period_end": false,
    "updated_at": 1718000000
  }
}
```

## API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/plans` | None | Plan definitions (no price IDs) |
| GET | `/billing/status` | Session | Current plan, usage, limits |
| GET | `/billing/usage` | Session | Usage meters for current month |
| GET | `/billing/admin` | Admin | MRR, churn, conversion |
| POST | `/billing/checkout` | Session | Create Stripe Checkout Session |
| POST | `/billing/portal` | Session | Create Stripe Customer Portal session |
| POST | `/billing/cancel` | Session | Cancel at period end |
| POST | `/billing/reactivate` | Session | Remove cancel_at_period_end |
| POST | `/billing/webhook` | Stripe sig | Receive Stripe events |
