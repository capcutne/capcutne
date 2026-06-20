---
name: CE-5 Color Grading & LUT Engine
description: Color correction integration decisions — data model, filter pipeline, hook ordering, and bug fixes
---

## Data stored in clip.colorGrade (separate from clip.adj)
Basic: exposure(-3..+3 EV), contrast, saturation, temperature, tint (-100..+100)
Advanced: highlights, shadows, whites, blacks + curves{master,r,g,b} + hsl{8 ranges × h,s,l}
LUT: lut (preset ID or null), lutIntensity (0-100)

## Filter pipeline integration
`_applyClipFilter` in capcut.html is monkey-patched in color_ce5.js — CE-5 filters are appended to the existing filter string. Setting all CE-5 values to defaults produces no visible change.

## _loadClipToPanel hook ordering (matters — do not swap)
1. CE-4 guard: cls==='cs' → ce4_handleTextClip
2. CE-5 guard: cls==='cv' → ce5_handleVideoClip  ← replaces full #rp-body
3. CE-1 effect: cls==='cx' → _loadEffectClipPanel
4. Default panel (audio, overlay clips)

**Why:** CV hook must come after CS hook and before cx. Wrong order breaks the panel for text or effect clips.

## LUT presets
30 presets (ids: c1-c8, v1-v7, cr1-cr8, s1-s7) stored in CE5_LUTS array in color_ce5.js.
Custom imported .cube files get id='custom_<timestamp>' and are prepended to CE5_LUTS. They are lost on page reload (not persisted in project JSON).

## Curves
Catmull-Rom spline interpolation. Points sorted by x. Corners (index 0 and last) protected from right-click removal. Canvas: 220×180px.

## Critical bug fix: effects broken after CE-5 integration
Two bugs introduced when CE-5 intercepted cv clips:

1. `_applyClipFilter(clip)` was not called — preview filter didn't update on clip select.
   Fix: call `_applyClipFilter(clip)` at the top of `ce5_handleVideoClip` before rebuilding the panel.

2. Effect Stack (`renderEffectStackInspector`) was hidden — CE-5 replaced `#rp-body` entirely.
   Fix: appended `#ce5-fx-wrap` div at the bottom of the CE-5 panel template (always visible below tabs).

**Why:** The original `_loadClipToPanel` for cv clips called `_applyClipFilter` at line 4757 and appended the effect stack at line 4760. CE-5's early `return` skipped both. Any future CE panel intercepting cv/cs clips must replicate both behaviours.
