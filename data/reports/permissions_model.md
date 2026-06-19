# Permissions Model
**Phase 5.6 — CapCut Video Editor Clone SaaS**

## Authentication

All write operations require a valid session cookie (`session=<token>`). Sessions are created on login and expire after 24 hours. Stored in `data/sessions.json`.

## Authorization Layers

### 1. System Role (from users.json)
- `admin` — full access to all endpoints including `/billing/admin`, `/beta/admin/*`
- `beta_user` — standard authenticated user

### 2. Plan-based Feature Access

Features gated by subscription plan:

| Feature | Free | Pro | Business |
|---------|------|-----|----------|
| Brand Clone | ❌ | ✅ | ✅ |
| Batch Shorts Factory | ❌ | ❌ | ✅ |
| Content Agent | ❌ | ✅ | ✅ |
| Team Workspaces | ❌ | ✅ | ✅ |
| 1080p Export | ❌* | ✅ | ✅ |
| 4K Export | ❌ | ❌ | ✅ |
| Viral Analysis | ✅ | ✅ | ✅ |

*Free users are silently downgraded to 720p.

### 3. Workspace Role (per-workspace)
- `owner` — full control of workspace
- `editor` — can read/edit projects, cannot manage members
- `viewer` — read-only access to projects

### 4. Usage Quotas (per-user, per-month)

Hard limits enforced server-side before processing:
- Export start → 402 if monthly export quota exceeded
- Transcribe real → 402 if transcript_minutes quota exceeded
- AI requests → tracked per call (soft limit enforcement)

## Permission Check Flow

```
Request arrives
  → Check session cookie → 401 if missing/expired
  → Check system role for admin endpoints
  → Check plan for feature-gated endpoints → 402 + upgrade:true
  → Check usage quota → 402 if over limit
  → Check workspace role for /workspace/* endpoints
  → Process request
```

## Error Response Format (Gating)

```json
{
  "ok": false,
  "error": "'Brand Clone' requires the Pro plan.",
  "feature": "brand_clone",
  "plan": "free",
  "requires": "pro",
  "upgrade": true
}
```

The `upgrade: true` flag triggers the billing panel to open in the frontend.

## Limit Exceeded Response (402)

```json
{
  "ok": false,
  "error": "Limit reached: exports (10/10 used this month).",
  "metric": "exports",
  "limit": 10,
  "used": 10,
  "plan": "free",
  "upgrade": true
}
```
