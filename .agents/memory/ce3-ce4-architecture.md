---
name: CE-3 & CE-4 architecture
description: Multi-track timeline (CE-3) and text inspector (CE-4) integration decisions for capcut.html
---

## CE-3 Track Head (HEAD_W = 120)
- Changed from 74px to 120px. All coordinate calculations use the JS `HEAD_W` constant — never hardcode 74 again.
- Track head structure: color strip (4px) + icon + label (dblclick = rename) + lock/mute/hide buttons.
- New track schema fields: `color`, `locked`, `muted`, `hidden` (all required; default false/color from CE3_TRACK_COLORS).
- `CE3_TRACK_COLORS` defined in capcut.html just after ICONS object.

## CE-4 Text Inspector Hook
- `_loadClipToPanel(clip)` in capcut.html has a guard at the top: `if(clip.cls==='cs' && typeof ce4_handleTextClip==='function') { ce4_handleTextClip(clip); return; }`
- Text clips (cls='cs') get a full inspector panel replacing `#rp-body` innerHTML.
- Text clip schema additions: textContent, textType, font, fontSize, fontWeight, fontStyle, textDecor, textAlign, color, shadow, outline, glow, animIn, animOut, animDur, template.

## Module loading
- Both modules loaded as plain `<script src="...">` tags before `</body>` — they are NOT ES modules.
- Functions are global; `typeof ce3_addTrack !== 'undefined'` guards used in HTML onclick handlers.
- Clip context menu: `#ce3-ctx-menu`; Track context menu: `#ce3-track-ctx-menu`; Template modal: `#ce4-tpl-modal`.

**Why:** renderTracks() rebuilds full innerHTML on every state change (intentional — avoids reconciliation complexity). All CE-3 mutations call saveState() before modifying tracks.
