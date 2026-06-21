# CE-7: Render Queue System — Technical Report
*Generated: 2026-06-21*

## Overview
CE-7 introduces a live render queue system — a persistent, polled list of all export jobs (past and present) visible directly in the export drawer. The queue replaces the old history-only view with a real-time dashboard.

## Architecture

### Server Side

#### Job Lifecycle
```
POST /export/start → job created (status: "queued") → background thread → _run_export()
                                                                                ↓
                                               status: "running" (progress 3→95) → "done" | "error"
                                               
POST /export/cancel → status: "cancelled" (if queued/running)
POST /export/retry  → new job cloned from original → back to "queued"
```

#### Job Data Model
```json
{
  "id":          "exp_abc123",
  "status":      "queued|running|done|error|cancelled",
  "progress":    0-100,
  "message":     "Encoding 45/120s · ETA 30s",
  "eta":         30,
  "format":      "mp4|mov|webm|gif|mp3",
  "quality":     "720p|1080p|...",
  "preset":      "tiktok|youtube|...",
  "fps":         30,
  "filename":    "capcut_tiktok.mp4",
  "filesize":    4823521,
  "completed_at": 1750512000.0,
  "created_at":   1750511950.0,
  "retry_of":    "exp_original123",
  "_project":    { ... },   // stripped from API responses
  "_settings":   { ... }    // stripped from API responses
}
```

**Note**: `_project` and `_settings` are stored for retry support but always stripped from `/export/queue` and `/export/history` responses to avoid sending large payloads.

#### `/export/queue` Endpoint
```
GET /export/queue
→ { "jobs": [ ...all jobs, newest first, max 100... ] }
```
Returns all jobs regardless of status. The frontend merges this with its local queue state (to avoid flickering when job data hasn't arrived yet).

#### `/export/retry` Endpoint
```
POST /export/retry
Body: { "job_id": "exp_abc123", "project": {...}, "settings": {...} }
→ { "ok": true, "job_id": "exp_new456" }
```
Creates a new job using the original job's format/quality/fps. Accepts optional `project`/`settings` from the request body (for when the frontend has fresher project state). Falls back to `_project`/`_settings` stored in the original job.

### Frontend Side (`js/export_ce7.js`)

#### Polling Loop
```javascript
// Starts when drawer opens
_pollTimer = setInterval(_pollQueue, 800); // 800ms interval

// Stops when drawer closes
clearInterval(_pollTimer);
```

The poll fetches `/export/queue`, then merges each server job into the local `_queue` array using `Object.assign()`. New jobs are prepended. The full queue is re-rendered after each merge.

#### Queue Rendering
Each job renders as a `<div class="ce7-job">` with:
- Status badge emoji (✅ done, ❌ error, ⛔ cancelled, ⏳ running, 🕒 queued)
- Project name + format/preset tag
- Animated progress bar (running jobs only)
- ETA display
- Action buttons (context-dependent):
  - **Download** (⬇) — done jobs only, direct `<a href="/export/download?id=...">` link
  - **Retry** (🔁) — error/cancelled jobs only, calls `ExportEnginePro._retry(jobId)`
  - **Cancel** (✕) — queued/running jobs only, calls `ExportEnginePro._cancel(jobId)`

#### Toolbar Badge
While renders are in progress, a red badge count appears on the export toolbar button (injected into nearest `.toolbar-export-btn` or `[data-panel="export"]` element). Disappears when all jobs finish.

#### Retry Flow
```javascript
ExportEnginePro._retry(jobId)
  → POST /export/retry { job_id }
  → Server creates new job
  → Next poll (≤800ms) picks up new job
  → Queue re-renders with new "queued" row
```

## Performance Notes
- 800ms polling is a balance between responsiveness and server load
- Poll only runs while the drawer is open (no background polling)
- Max 100 jobs returned from server; frontend shows all
- Job `_project` and `_settings` are never sent in list responses (only stored server-side for retry)
- Export threads are daemon threads — they terminate if server restarts
