---
name: CE-7 Professional Export Engine
description: Platform presets, MOV/MP3 formats, HW acceleration, live render queue drawer
---

## Key facts
- `PRESET_MAP` and `EXPORT_MIME` added to server.py after `QUALITY_MAP`
- `_build_mp3_export_cmd()` — audio-only FFmpeg helper using `adelay+amix → libmp3lame`
- `_run_export()` patched: reads `settings.preset` to override w/h/vbr; `settings.hwaccel` prepends `-hwaccel auto -threads 0`; MP3 fast path returns early before Phase 2
- Job dict now stores `_project` and `_settings` for retry support (stripped from API responses)
- `/export/queue` GET — all jobs newest-first; `/export/retry` POST — clones job params
- Both endpoints use `/export/retry` added to ALLOWED_PATHS set in do_POST
- `js/export_ce7.js` — ExportEnginePro singleton; patches `ExportEngine.open()` at runtime; slides in right-side drawer; polls `/export/queue` every 800ms while open
- Script tag added after `audio_ce6.js` in capcut.html bottom CE module block
- CE-7 CSS added to capcut.html before the CE-5 effect stack styles

**Why:** CE-7 replaces the old centered modal with a drawer to show the live queue alongside settings.
**How to apply:** Any new export format must be added to `PRESET_MAP`/`EXPORT_MIME` in server.py and to `FORMATS` array in js/export_ce7.js.
