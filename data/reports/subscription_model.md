# Subscription Model
**Phase 5.6 — CapCut Video Editor Clone SaaS**

## Plan Overview

| Plan | Monthly Price | Annual Price | Target User |
|------|--------------|--------------|-------------|
| Free | $0 | $0 | Individual creators, trial users |
| Pro | $19/mo | ~$190/yr (future) | Professional content creators |
| Business | $49/mo | ~$490/yr (future) | Teams, agencies, studios |

## Subscription States

```
free        → no Stripe subscription, default state
active      → paid, within billing period
trialing    → Stripe trial period
past_due    → payment failed, grace period
canceled    → subscription ended, downgraded to free
```

## State Machine

```
[free] → checkout → [active/pro or active/business]
                         ↓
                   cancel_at_period_end=true → [active] → period end → [free]
                         ↓
                   reactivate → cancel_at_period_end=false → [active]
                         ↓
                   payment fails → [past_due] → retry fails → [canceled] → [free]
```

## Upgrade / Downgrade Paths

**Upgrade (Free → Pro):**
1. User clicks "Upgrade to Pro" → `POST /billing/checkout { plan: "pro" }`
2. Server creates Stripe Checkout Session
3. User pays on Stripe's hosted page
4. Webhook `checkout.session.completed` fires
5. `subscriptions.json` updated: `plan: "pro", status: "active"`
6. Feature access unlocked immediately

**Downgrade (Pro → Free):**
1. User clicks "Manage Subscription" → `POST /billing/portal`
2. Stripe Customer Portal opens — user selects Cancel
3. Stripe fires `customer.subscription.updated` with `cancel_at_period_end: true`
4. At period end: Stripe fires `customer.subscription.deleted`
5. `subscriptions.json` updated: `plan: "free", status: "canceled"`

**Cross-grade (Pro → Business):**
1. User clicks "Upgrade to Business" → Stripe handles proration automatically

## MRR Calculation

```
MRR = Σ(active Pro users × $19) + Σ(active Business users × $49)
```

Tracked live in `/billing/admin` endpoint.

## Churn Rate

```
Churn = canceled_users / (active_users + canceled_users) × 100%
```

## Conversion Rate

```
Conversion = paying_users / total_users × 100%
```

## Stripe Integration Checklist

To go live:
1. Set `STRIPE_SECRET_KEY` = `sk_live_...`
2. Set `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from Stripe Dashboard → Webhooks)
3. Set `STRIPE_PRO_PRICE_ID` = `price_...` (from Stripe Dashboard → Products)
4. Set `STRIPE_BUSINESS_PRICE_ID` = `price_...`
5. Configure webhook endpoint: `https://your-domain.replit.app/billing/webhook`
6. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## Test Mode

When `STRIPE_SECRET_KEY` starts with `sk_test_`, all payments are simulated. Use Stripe's test card `4242 4242 4242 4242` for testing.

When no Stripe key is set, checkout/portal endpoints return an error asking for configuration, but all plan/limit/usage logic still works correctly.
