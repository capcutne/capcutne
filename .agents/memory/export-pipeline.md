---
name: Real export pipeline
description: How the FFmpeg export works — real files vs. blank canvas fallback
---

When video clips have fileId + file on disk, _build_real_export_cmd() is called:
- Each video segment → -ss <clipStart> -t <dur> -i <diskPath>
- Scale+pad to output resolution, setpts to timeline position
- Overlay chain onto blank canvas at segment start/end times
- Audio segments delayed (adelay) to timeline position + amixed
- Subtitle burn-in via drawtext on top

**Why:** The original code used `color=c=#0d1117` blank canvas for all exports. Phase 5.5B replaced this with actual file rendering.

**How to apply:** _run_export() checks if video_segs have diskPath; only then calls _build_real_export_cmd(). Blank-canvas path remains as fallback for timeline-only projects with no uploaded files.
