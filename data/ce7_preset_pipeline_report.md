# CE-7: Platform Preset Pipeline — Technical Report
*Generated: 2026-06-21*

## Overview
The preset pipeline maps a user-chosen platform (TikTok, YouTube, etc.) to the precise FFmpeg encoding parameters required by that platform's spec. Presets can optionally override the user's chosen quality level.

## Preset Resolution Flow

```
Client: { settings: { preset: "tiktok" }, format: "mp4", quality: "1080p" }
    ↓
server.py _run_export():
    q = QUALITY_MAP.get("1080p") → w=1920, h=1080, vbr=4000k
    preset = PRESET_MAP.get("tiktok") → w=1080, h=1920, vbr=6000k
    IF preset.w > 0: override w, h, vbr ← preset values
    fps = preset.fps (30)  ← preset FPS
    → Final: 1080×1920 @ 30fps @ 6000k
```

## Preset Specifications

### TikTok
- Resolution: 1080×1920 (portrait 9:16)
- VBR: 6000k
- FPS: 30
- Filename suffix: `capcut_tiktok.mp4`
- Notes: Square/landscape clips will be scaled+padded with black bars via existing filter_complex

### YouTube
- Resolution: 1920×1080 (landscape 16:9)
- VBR: 8000k (highest video quality preset)
- FPS: 30
- Filename suffix: `capcut_youtube.mp4`

### Instagram Square
- Resolution: 1080×1080 (square 1:1)
- VBR: 4000k
- FPS: 30
- Filename suffix: `capcut_instagram.mp4`

### Instagram Reels
- Resolution: 1080×1920 (portrait 9:16, same as TikTok)
- VBR: 6000k
- FPS: 30
- Filename suffix: `capcut_instagram_reels.mp4`

### Facebook
- Resolution: 1920×1080 (landscape 16:9)
- VBR: 4000k
- FPS: 30
- Filename suffix: `capcut_facebook.mp4`

### Podcast (MP3)
- Resolution: N/A (audio only)
- Format: MP3 / libmp3lame
- Bitrate: 128k–320k (user selectable)
- FPS: N/A
- Filename suffix: `capcut_podcast_mp3.mp3`
- Implementation: `_build_mp3_export_cmd()` fast path; bypasses all video processing

## Filter Graph Behavior with Non-Standard Aspect Ratios
The existing `_build_real_export_cmd()` filter_complex uses `scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2` to fit clips into the target canvas. This works correctly for portrait presets (TikTok/Reels) — landscape source clips get letterboxed.

## Custom Preset (No Preset)
When no preset is selected (`preset=""`), the pipeline falls back to `QUALITY_MAP` dimensions as before CE-7.

## Retry Behavior
The `/export/retry` endpoint reads `_project` and `_settings` stored in the original job dict. These are stripped from all API responses (not included in `/export/queue` or `/export/history` output for bandwidth efficiency). The retry creates a new `exp_` job ID and queues it via the same `_run_export` thread.
