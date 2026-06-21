# CE-7: Professional Export Engine — Architecture Report
*Generated: 2026-06-21*

## Overview
CE-7 adds a professional export pipeline on top of the existing Phase 5.5B export system. It introduces platform presets, new formats (MOV, MP3), hardware acceleration, and a live render queue drawer with per-job retry/cancel/download controls.

## Components

### Backend (`server.py`)

#### New Globals
| Name | Purpose |
|------|---------|
| `PRESET_MAP` | Platform preset definitions: TikTok, YouTube, Instagram, Instagram Reels, Facebook, Podcast |
| `EXPORT_MIME` | Unified MIME map for all 5 supported formats |

#### Format Support
| Format | Container | Video Codec | Audio Codec | Notes |
|--------|-----------|-------------|-------------|-------|
| MP4 | MPEG-4 | libx264 fast | AAC 128k | Default; faststart |
| MOV | QuickTime | libx264 medium | AAC 192k | Higher quality preset |
| WebM | WebM | libvpx-vp9 | libopus 96k | Open format |
| GIF | GIF | palette-based | — | Max 15s, 480px wide |
| MP3 | MPEG Layer 3 | — | libmp3lame 320k | Audio-only fast path |

#### New Functions
- `_build_mp3_export_cmd()` — Builds audio-only FFmpeg command mixing all audio/video audio tracks via `adelay`+`amix` filter chain. Falls back to silent audio if no clips have disk files.
- Modified `_run_export()`:
  - Reads `settings.preset` → overrides `w/h/vbr` from `PRESET_MAP`
  - Reads `settings.hwaccel` → prepends `-hwaccel auto -threads 0` to FFmpeg command
  - MP3 fast path exits early before Phase 2 video processing
  - Preset-aware filename generation (e.g. `capcut_tiktok.mp4`)

#### New Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/export/queue` | GET | Returns all jobs (active + history) for live polling |
| `/export/retry` | POST | Clones a failed/cancelled job and re-queues it |

#### Modified Endpoints
- `/export/download` — MIME type now resolved via unified `EXPORT_MIME` dict (supports MOV, MP3)

### Frontend (`js/export_ce7.js`)

#### ExportEnginePro Object
Singleton that replaces `ExportEngine.open()` at runtime. Patches the existing export button to show the CE-7 drawer instead of the old modal.

#### Render Drawer (`#ce7-drawer`)
Full-height right-side panel with:
1. **Platform Presets** — 7 preset cards (TikTok, YouTube, Instagram, Reels, Facebook, Podcast, Custom); selecting one auto-sets format and preset key sent to server
2. **Format chips** — MP4 / MOV / WebM / GIF / MP3; selecting MP3 hides video quality/FPS and shows bitrate selector
3. **Quality + FPS** — Standard quality chips (480p→4K) and FPS chips (24/30/60); hidden for MP3
4. **MP3 Bitrate** — 128k / 192k / 256k / 320k; shown only for MP3
5. **Audio Mix** — Range sliders for Voice/Music/SFX levels; Burn-in subtitles checkbox
6. **Advanced** — Collapsible section with hardware acceleration toggle
7. **Start Export button** — POSTs to `/export/start` with all settings
8. **Render Queue** — Live list of all jobs; polls `/export/queue` every 800ms; per-job: progress bar, ETA, status badge, Download/Retry/Cancel buttons

#### Polling Architecture
- `setInterval(_pollQueue, 800)` runs while drawer is open
- Merges server-side job data into local `_queue` array (preserves local display state)
- Active job count shown as badge on toolbar export button
- Poll stops when drawer closes (`clearInterval`)

## Preset Dimension Map

| Preset | Resolution | Aspect | Default FPS | VBR |
|--------|-----------|--------|-------------|-----|
| TikTok | 1080×1920 | 9:16 | 30 | 6000k |
| YouTube | 1920×1080 | 16:9 | 30 | 8000k |
| Instagram | 1080×1080 | 1:1 | 30 | 4000k |
| Instagram Reels | 1080×1920 | 9:16 | 30 | 6000k |
| Facebook | 1920×1080 | 16:9 | 30 | 4000k |
| Podcast | — | — | — | MP3 only |
| Custom | from QUALITY_MAP | 16:9 | user-set | from QUALITY_MAP |

## Hardware Acceleration
When `hwaccel: true` is passed in settings, the FFmpeg command is patched post-build:
```python
cmd = cmd[:2] + ["-hwaccel", "auto", "-threads", "0"] + cmd[2:]
```
This enables hardware-accelerated decoding on NVIDIA/AMD/Intel GPUs when available. Falls back silently to CPU if no compatible GPU is detected. Does not change encoding codec (still libx264/libvpx-vp9).

## Quality Gating (Billing Integration)
Existing plan-based quality gating from CE-5.6 is preserved:
- Free users: max 720p
- Pro users: max 1080p  
- Business users: up to 4K
Preset dimensions are applied AFTER quality gating, so a free user selecting TikTok preset on 720p still gets the correct 1080×1920 aspect ratio at reduced bitrate.
