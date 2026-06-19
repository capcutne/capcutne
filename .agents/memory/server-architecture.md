---
name: Server architecture
description: Core stack constraints — http.server, JSON persistence, MODEL constant
---

- Server: pure Python http.server (socketserver.TCPServer), no Flask/FastAPI
- Port: 5000 always
- AI model constant: MODEL = "gpt-5-mini" — do NOT change
- OpenAI key: read from AI_INTEGRATIONS_OPENAI_API_KEY then OPENAI_API_KEY
- All persistence: JSON files in data/ directory
  - data/users.json, data/asset_registry.json, data/jobs.json
  - data/projects/<pid>.json, data/versions/<pid>/<ts>.json
  - data/exports/<jobId>.mp4|webm|gif
  - data/uploads/<fileId><ext>
- Frontend: vanilla JS, localStorage for session state, objURL for media blobs
- FFmpeg: installed via replit.nix, used for transcription + export

**Why:** The codebase was built incrementally without a framework. Adding Flask would require a full rewrite; JSON files keep it simple for single-instance.

**How to apply:** New endpoints go in do_GET/do_POST. New persistence goes in data/. Always atomic-write JSON (write to temp then rename, or use the existing pattern of direct file write which is fine at this scale).
