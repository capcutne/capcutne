# CE-3 — Advanced Multi-Track Timeline Architecture Report

## Timeline Architecture

### Track Container
- `#tracks` — flex column, `gap:1px`; rendered entirely by `renderTracks()` on every state change.
- `#tl-scroll` — horizontal scrollable wrapper; `HEAD_W` (120 px) is subtracted from all positional calculations.
- Playhead, ruler, snap-line, and minimap all reference the same `HEAD_W` constant for alignment.

### Rendering Pipeline
```
saveState() → renderAll() → renderRuler() + renderTracks() + updatePlayhead() + renderMinimap()
```
`renderTracks()` rebuilds the entire `#tracks` innerHTML on every call. This is intentional — it avoids diff/reconciliation complexity and keeps the code readable. For large projects (100+ clips) a virtualised renderer would be an upgrade path.

### Track Head (120 px)
```
┌──────────────────────────────────────┐
│ ▌ Color  │ 🎬 Icon  Label (editable) │
│  Strip   │ 🔒 Mute  👁  [right-click]│
└──────────────────────────────────────┘
```
- **Color strip** (4 px) — `tr.color`, visual track identification
- **Icon** — SVG from `ICONS[type]`
- **Label** — dblclick activates `contentEditable` rename (saves on blur/Enter)
- **Buttons** — `thb` class; toggled state classes `on`

---

## Track Schema

```typescript
interface Track {
  id      : string;       // 'tr1', 'tr2', ...
  type    : 'video' | 'overlay' | 'effect' | 'text' | 'audio';
  label   : string;       // user-editable display name
  icon    : string;       // SVG HTML string from ICONS map
  color   : string;       // CSS colour for the 4px left strip
  locked  : boolean;      // true → clips non-interactive + .tr-locked CSS class
  muted   : boolean;      // true → audio muted + .tr-muted CSS class
  hidden  : boolean;      // true → clips hidden in preview + .tr-hidden CSS class
  trans   : boolean;      // true → show transition diamonds (video/overlay)
  clips   : Clip[];
}
```

### Clip Schema Extensions (CE-3 additions)
```typescript
interface Clip {
  // ... existing fields (id, start, dur, label, cls, objUrl, wave, effects, keyframes, ...) ...
  group ?: string;        // group ID (set by ce3_groupSelected / ce3_ungroupSelected)
}
```

---

## Track Types & Capacity

| Type       | Max tracks | CSS class | Color   | Notes                         |
|------------|-----------|-----------|---------|-------------------------------|
| video      | 10        | `.cv`     | #3b82f6 | Main video, supports transitions |
| overlay    | 5         | `.cv`     | #8b5cf6 | Composited layer above video  |
| effect     | 3         | `.cx`     | #f59e0b | Global FX clips               |
| text       | 3         | `.cs`     | #10b981 | Text / motion graphics clips  |
| audio      | 20        | `.ca`     | #ef4444 | Music, SFX, voice-over        |

Track limits are soft — `ce3_addTrack(type)` will always add; UI may warn when approaching limits in a future phase.

---

## Clip Actions

| Action         | Function             | Shortcut    | Description                                  |
|----------------|----------------------|-------------|----------------------------------------------|
| Split          | `ce3_splitClip()`    | `S`         | Cuts clip at playhead; produces two clips     |
| Ripple Delete  | `ce3_rippleDelete()` | `⇧ ⌫`      | Deletes clip; slides subsequent clips left    |
| Duplicate      | `ce3_duplicateClip()`| `D`         | Clones clip immediately after original        |
| Group          | `ce3_groupSelected()`| ctx menu    | Tags selected clips with shared `group` ID    |
| Ungroup        | `ce3_ungroupSelected()`| ctx menu  | Removes `group` tag from selected clips       |

---

## Context Menus

- **Clip right-click** → `ce3_showCtxMenu(event, clipId, trackId)` → `#ce3-ctx-menu`
- **Track head right-click** → `ce3_showTrackCtx(event, trackId)` → `#ce3-track-ctx-menu`

Both menus are fixed-position, closed on click-away, scroll, or `Escape`.

---

## Undo / Redo Compatibility

All CE-3 mutations call `saveState()` before modifying `tracks`, maintaining full compatibility with the existing 50-frame history stack. New track/clip fields (`group`, `color`, `locked`, `muted`, `hidden`) are serialised automatically as part of the JSON snapshot.
