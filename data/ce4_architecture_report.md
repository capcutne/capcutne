# CE-4 — Text & Motion Graphics Architecture Report

## Template System

### Data Model
Each template is a plain object in the `CE4_TEMPLATES` array (defined in `js/text_ce4.js`):

```typescript
interface TextTemplate {
  id         : string;   // unique e.g. 'm1', 'b3', 'nw2'
  cat        : string;   // display category: 'Modern' | 'Bold' | 'Neon' | 'Cinema' | 'Minimal' | 'Social' | 'News'
  name       : string;   // human-readable name
  textType   : TextType;
  font       : string;   // CSS font-family
  fontSize   : number;   // px
  fontWeight : string;   // '400' | '700' | '900' etc.
  color      : string;   // hex
  shadow     : ShadowDef;
  outline    : OutlineDef;
  glow       : GlowDef;
  animIn     : AnimId;
  animOut    : AnimId;
  bg         : string;   // preview card background colour
}
```

### Template Categories & Counts

| Category | Count | Vibe                          |
|----------|-------|-------------------------------|
| Modern   | 8     | Clean, contemporary           |
| Bold     | 8     | High-impact, large text       |
| Neon     | 7     | Glowing, cyberpunk            |
| Cinema   | 8     | Film-style, dramatic          |
| Minimal  | 7     | Simple, whitespace-driven     |
| Social   | 7     | TikTok / IG / YT optimised   |
| News     | 5     | Broadcast lower-thirds        |
| **Total**| **50**|                               |

### Template Application Flow
```
User clicks template card
  → ce4_applyTemplate(id)
    → if active clip selected: merge template props into clip
    → else: ce4_addNewClipFromTemplate(tpl) → push clip to text track → renderAll()
  → ce4_closeTemplates()
  → toast confirmation
```

---

## Animation System

### Animation IDs
```typescript
type AnimId = 'none' | 'fade-in' | 'fade-out' | 'slide-up' | 'slide-left'
            | 'slide-right' | 'pop' | 'bounce' | 'zoom';
```

### CSS Keyframes (defined in capcut.html `<style>`)
| ID           | Keyframe name      | Description                           |
|--------------|--------------------|---------------------------------------|
| `fade-in`    | `ce4FadeIn`        | opacity 0→1                           |
| `fade-out`   | `ce4FadeOut`       | opacity 1→0                           |
| `slide-up`   | `ce4SlideUp`       | translateY(20px)+opacity 0→1         |
| `slide-left` | `ce4SlideLeft`     | translateX(-30px)+opacity 0→1        |
| `slide-right`| `ce4SlideRight`    | translateX(30px)+opacity 0→1         |
| `pop`        | `ce4Pop`           | scale(0.5)+opacity 0→1               |
| `bounce`     | `ce4Bounce`        | scale spring: 0.3→1.05→0.95→1        |
| `zoom`       | `ce4Zoom`          | scale(1.5)+opacity 0→1               |

Animations are stored as IDs on the clip object and would be applied by the preview renderer when generating the output video.

---

## Text Clip Schema

```typescript
type TextType = 'title' | 'subtitle' | 'callout' | 'lower-third' | 'quote';

interface ShadowDef  { on: boolean; c: string; b: number; x: number; y: number; }
interface OutlineDef { on: boolean; c: string; w: number; }
interface GlowDef    { on: boolean; c: string; b: number; }

interface TextClip extends Clip {
  // CE-4 added fields (merged on top of base clip)
  textContent : string;      // raw text content (multiline)
  textType    : TextType;
  font        : string;      // CSS font-family
  fontSize    : number;      // px, range 10–120
  fontWeight  : string;      // '400' | '700' | '900'
  fontStyle   : string;      // 'normal' | 'italic'
  textDecor   : string;      // 'none' | 'underline'
  textAlign   : string;      // 'left' | 'center' | 'right'
  color       : string;      // hex
  shadow      : ShadowDef;
  outline     : OutlineDef;
  glow        : GlowDef;
  animIn      : AnimId;      // entry animation ID
  animOut     : AnimId;      // exit animation ID
  animDur     : number;      // seconds, default 0.5
  template   ?: string;      // last applied template ID (for traceability)
}
```

---

## Text Inspector Integration

The inspector hooks into the existing right-panel system via a guard in `_loadClipToPanel()`:
```javascript
if (clip.cls === 'cs' && typeof ce4_handleTextClip === 'function') {
  ce4_handleTextClip(clip); return;
}
```
`ce4_handleTextClip(clip)` replaces `#rp-body` innerHTML with the full text inspector UI, pre-populated from the clip's stored values. All input handlers call focused updater functions (`ce4_setColor`, `ce4_setFont`, etc.) that write directly to the clip object and call `renderAll()`.

---

## Font Loading

Fonts are referenced by name. `Inter`, `Roboto`, `Open Sans`, `Montserrat`, `Poppins` are loaded via a Google Fonts `<link>` injected by `js/text_ce4.js` on first use. System fallbacks (`Arial`, `Georgia`, `Courier New`) require no external loading.

---

## Text Types — Visual Intent

| Type         | Typical position   | Typical use                        |
|--------------|--------------------|------------------------------------|
| `title`      | Center frame       | Main chapter / video title         |
| `subtitle`   | Bottom ~15%        | Translation, narration subtitle     |
| `callout`    | Any (bubble)       | Highlight a specific element        |
| `lower-third`| Bottom 25%         | Speaker name, broadcast credit      |
| `quote`      | Center/upper third | Pull quote, inspirational text      |
