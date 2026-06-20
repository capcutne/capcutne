# CE-5 — Color Grading & LUT Engine: Architecture Report

## Color Data Model

CE-5 stores all color correction data in a `colorGrade` object attached to each video clip. This is separate from the existing `clip.adj` system (which handles legacy brightness/contrast/saturation/sharpen) to avoid conflicts.

```typescript
interface ColorGrade {
  // Basic corrections
  exposure    : number;   // -3.0 to +3.0 EV stops; mapped to brightness(2^exposure)
  contrast    : number;   // -100 to +100; mapped to contrast(1 + v/100)
  saturation  : number;   // -100 to +100; mapped to saturate(1 + v/100)
  temperature : number;   // -100 to +100; warm→sepia blend, cool→hue-rotate
  tint        : number;   // -100 to +100; green↔magenta via hue-rotate

  // Advanced tone controls
  highlights  : number;   // -100 to +100; high-luma brightness
  shadows     : number;   // -100 to +100; low-luma brightness + contrast
  whites      : number;   // -100 to +100; upper clip point
  blacks      : number;   // -100 to +100; lower clip point (contrast)

  // Curves (per-channel, arbitrary control points, sorted by x)
  curves: {
    master : [number, number][];  // [x,y] pairs normalised 0-1
    r      : [number, number][];
    g      : [number, number][];
    b      : [number, number][];
  };

  // HSL (8 colour ranges × 3 adjustments)
  hsl: {
    [range: 'red'|'orange'|'yellow'|'green'|'cyan'|'blue'|'purple'|'magenta']: {
      h: number;   // hue shift -180..+180
      s: number;   // saturation -100..+100
      l: number;   // luminance  -100..+100
    };
  };

  // LUT
  lut         : string | null;  // LUT preset ID or null
  lutIntensity: number;         // 0-100%
}
```

---

## Filter Pipeline

The filter chain applied to `#phone-el` (preview):

```
[FILTER_DEFS base filter (legacy preset)]
  + [adj brightness/contrast/saturate/sharpen (legacy sliders)]
  + [composeEffectStack (CE-1 effect stack)]
  + [ce5_buildCSSFilter (CE-5 color grade)]    ← appended by monkey-patch
```

`_applyClipFilter` in `capcut.html` is monkey-patched by `color_ce5.js` so CE-5 filters are always appended to the existing filter string. All parameters are additive — setting CE-5 values to zero produces no change to the existing filter output.

### CSS Filter Mapping

| Parameter       | CSS implementation                                      |
|-----------------|---------------------------------------------------------|
| Exposure ±3 EV  | `brightness(2^exposure)`                                |
| Contrast        | `contrast(1 + v/100)`                                   |
| Saturation      | `saturate(1 + v/100)`                                   |
| Temperature +   | `sepia(v/100*0.35) brightness(1+v/100*0.06)`           |
| Temperature -   | `hue-rotate(v/100*22deg) saturate(...)`                 |
| Tint            | `hue-rotate(v/100*18deg)`                               |
| Highlights      | `brightness(1 ± hi/100*0.25)`                           |
| Shadows         | `brightness(...) contrast(...)` compound                |
| Whites          | `brightness(1 + v/100*0.15)`                            |
| Blacks          | `contrast(1 ± v/100*0.10)`                              |
| LUT             | LUT preset's CSS filter string                          |

**Note:** CSS filters are a best-effort approximation of professional colour grading. True per-pixel colour transforms (e.g., real 3D LUT look-up) would require WebGL or Canvas pixel manipulation. The CSS approach is chosen for zero-dependency browser compatibility in this editor shell.

---

## Curves Engine

### Control Points
- Each channel (`master`, `r`, `g`, `b`) stores an array of `[x, y]` pairs, normalised to [0, 1].
- Minimum 2 points (anchors at 0 and 1). No maximum.
- Corner anchors (index 0 and last) cannot be deleted via right-click.

### Interpolation
Catmull-Rom spline (`_ce5CatmullRom`) interpolated along the sorted control point array. Input X maps to output Y, clamped to [0, 1].

### Interaction
| Action | Result |
|--------|--------|
| Click empty area | Add control point |
| Drag point | Move it (x and y constrained to [0,1]) |
| Right-click point | Remove it (corners protected) |
| "Reset" button | Restore linear identity `[0,0],[0.33,0.33],[0.67,0.67],[1,1]` |

---

## HSL System

8 colour ranges (Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta) × 3 adjustments each (Hue shift, Saturation, Luminance). Stored in `clip.colorGrade.hsl`. Applied to preview via CSS `hue-rotate` and `saturate` approximation on the combined filter.

---

## Scopes

Three video scopes rendered on a 260×170 canvas:

| Scope | Algorithm | Data source |
|-------|-----------|-------------|
| Histogram | Luminance + RGB frequency distribution | Phone-el pixel data if available; else synthetic gaussian based on exposure/contrast |
| RGB Parade | 3-column per-channel distribution | Same as histogram |
| Vectorscope | Polar hue/saturation scatter plot | Synthetic points scaled by saturation setting |

Scopes update when the Scopes tab is active and `ce5_drawScope()` is called.

---

## Panel Architecture

The CE-5 panel replaces `#rp-body` content (same pattern as CE-4 text inspector) when a video clip (`cls='cv'`) is selected. It renders:
1. Clip name + duration
2. Compact volume + speed controls (preserves existing clip.volume and clip.speed)
3. Tab bar: Basic | Advanced | LUT | Scopes
4. Active tab content

The hook is placed in `_loadClipToPanel` before the video clip's existing panel rendering:
```javascript
if (clip.cls==='cv' && typeof ce5_handleVideoClip==='function') { ce5_handleVideoClip(clip); return; }
```
