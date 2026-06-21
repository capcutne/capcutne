---
name: CE-6 Audio Engine Pro
description: Audio DSP integration decisions — hook ordering, DSP chain, MediaElementSource reuse, fade/automation playback
---

## Hook in _loadClipToPanel
Order: cs→CE-4, ca→CE-6 (NEW), cv→CE-5, cx→effect panel, default.
CE-6 must come before CE-5 (not after) or audio clips would fall through to CE-5.

## MediaElementSource can only be created once per element
Web Audio API throws if you call createMediaElementSource on an already-connected element.
Fix: cache in WeakMap<el, MediaElementSourceNode>. On DSP chain rebuild (toggle comp/lim/NR), reuse the source and rewire only downstream nodes.

## audioTick patching pattern
CE-6 wraps window.audioTick (not replaces) at DOMContentLoaded.
Pattern: const _orig = window.audioTick; window.audioTick = function(){ _orig && _orig.call(window); /* CE-6 additions */ };
DOMContentLoaded is required because audioTick is defined inline in capcut.html after the script tags.

## Solo
_ce6SoloTrack = trackId | null. ce6_applySolo() sets el.muted per audioPlayers map.
Track head renders "S" button only for audio tracks; .solo-on CSS class highlights amber.
ce6_isSolo(trackId) queried inside renderTracks template literal.

## Fade/automation applied in audioTick (not Web Audio ScheduledNode)
Avoids drift with HTML video playhead. Direct el.volume write; gainOut.gain via setTargetAtTime(τ=10ms) for smooth ramping.

**Why:** Web Audio clock and video playhead clock diverge under seek/pause. Writing el.volume in the existing audioTick keeps everything in lockstep.
