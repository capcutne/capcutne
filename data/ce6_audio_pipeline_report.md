# CE-6 Audio Engine Pro — Audio Pipeline Report

## Overview
CE-6 adds a professional-grade audio processing pipeline to the CapCut clone. It intercepts `ca` (audio) clips in `_loadClipToPanel`, replaces the default right panel with a full Audio Inspector, and routes audio through a Web Audio API DSP chain during playback.

---

## Data Model

Each audio clip gains an `audioGrade` property:

```json
{
  "volume": 100,
  "fadeIn": 0.0,
  "fadeOut": 0.0,
  "normalize": false,
  "noiseReduction": { "enabled": false, "strength": 30 },
  "eq": { "low": 0, "lowMid": 0, "highMid": 0, "high": 0 },
  "compressor": { "enabled": false, "threshold": -24, "ratio": 4, "attack": 3, "release": 250, "knee": 30 },
  "limiter": { "enabled": false, "threshold": -3, "release": 100 },
  "automation": [ { "t": 2.0, "v": 80 }, { "t": 5.0, "v": 120 } ]
}
```

All values are persisted in the project JSON via the standard `saveState()` / project save system. `audioUrl` (blob) is stripped on project save (existing behavior).

---

## Panel Layout

When an audio clip is clicked, `ce6_handleAudioClip(clip)` replaces `#rp-body` with:

| Section | Controls |
|---------|----------|
| **Header** | Clip name + Normalize button |
| **Waveform Viewer** | Real waveform canvas (260×60px) with fade overlays + automation curve preview |
| **Volume** | Slider 0–200% with live update |
| **Fades** | Fade In + Fade Out sliders 0–10s, redraws waveform overlay |
| **EQ** | 4 vertical sliders (Low/LoMid/HiMid/High) each ±20dB |
| **Compressor** | Toggle + Threshold/Ratio/Attack/Release |
| **Limiter** | Toggle + Threshold/Release |
| **Noise Reduction** | Toggle + Strength 0–100% |
| **Volume Automation** | Click-to-add canvas, right-click to remove, clear button |

---

## Hook Ordering in `_loadClipToPanel`

```
cs (text)   → CE-4 ce4_handleTextClip  (return)
ca (audio)  → CE-6 ce6_handleAudioClip (return)  ← NEW
cv (video)  → CE-5 ce5_handleVideoClip (return)
cx (effect) → _loadEffectClipPanel     (return)
default     → original volume/speed/filter/adj panel
```

---

## Playback Integration

### Volume, Fade, Automation
CE-6 patches `window.audioTick` (wrapped, not replaced). Every tick:
1. Calculates `relT = playhead - clip.start`
2. Applies fade in/out envelope to `el.volume`
3. Evaluates automation curve (linear interpolation between points)
4. Multiplies all factors → final `el.volume` + Web Audio `gainOut.gain`

### Normalize
Reads peak data from `wfCache` (populated by `analyseAudioFile`). Sets `ag.volume = round(0.95/peak × 100)`, updates slider and live volume.

---

## Multi-Track Audio

### Solo
- `ce6_toggleSolo(trackId)` — sets `_ce6SoloTrack`
- `ce6_applySolo()` — mutes all `audioPlayers` elements whose track ≠ solo track
- Called from track head "S" button (audio tracks only)
- `renderTracks` shows "S" button highlighted (`.solo-on`) when track is soloed

### Audio Groups
- `ce6_createGroup(trackIds, label)` — creates named group with shared gain
- `ce6_setGroupGain(gid, val)` — applies proportional volume to all clips in group
- Groups are in-memory only (not persisted to project JSON yet)

---

## File Structure

| File | Role |
|------|------|
| `js/audio_ce6.js` | Main CE-6 module |
| `capcut.html` | CSS (~80 lines), hook in `_loadClipToPanel`, Solo button in `renderTracks`, `<script>` tag |
