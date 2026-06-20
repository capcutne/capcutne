# CE-5 — LUT Workflow Report

## What is a LUT?

A **Look-Up Table (LUT)** maps input colour values to output colour values. In professional video post-production:
- **1D LUTs** — map each R, G, B channel independently (tone curves equivalent)
- **3D LUTs** — map the full 3D RGB colour space, enabling complex looks impossible with per-channel adjustments

CE-5 ships with **30 preset LUTs** (CSS filter approximations) and supports **import of .cube files**.

---

## Preset LUT Library (30 presets)

| Category   | Count | Description                                  |
|------------|-------|----------------------------------------------|
| Cinematic  | 8     | Film looks: Teal & Orange, Bleach Bypass, Noir, Day for Night, etc. |
| Vintage    | 7     | Film stock emulation: Kodak Gold 200, Fuji Provia, Polaroid, etc. |
| Creative   | 8     | Stylised: Matrix Green, Infrared, Cyberpunk, Duotone, etc. |
| Social     | 7     | Platform-optimised: Instagram Warm, TikTok Bright, YouTube, etc. |

### How Presets Are Applied
Each preset is defined as a CSS `filter` string. Example:
```javascript
{ id:'c1', cat:'Cinematic', name:'Teal & Orange',
  css: 'saturate(1.25) hue-rotate(8deg) contrast(1.08)',
  preview: 'linear-gradient(135deg,#0d9488,#ea580c)' }
```
The CSS string is appended to the filter chain in `ce5_buildCSSFilter()` when `clip.colorGrade.lut` is set to the preset ID.

### Intensity Control
The intensity slider (0–100%) is stored in `clip.colorGrade.lutIntensity`. At 100%, the full LUT CSS is applied. At values below 100%, the system currently applies the LUT at full strength (CSS filters cannot be easily lerped); a future upgrade path is WebGL blending.

---

## .cube File Import

### File Format
The **Hald CLUT / .cube** format is an ASCII text format:
```
# Optional comments
TITLE "My LUT"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
# Data: R G B triplets for each node
0.000000 0.000000 0.000000
0.012207 0.000000 0.000000
...
```
A 33³ LUT has 35,937 triplets.

### Import Workflow
```
User clicks "Import .cube"
  → File picker opens (accept=".cube,.CUBE")
  → FileReader.readAsText()
  → _ce5ParseCube(text, filename)
    → Parse LUT_3D_SIZE
    → Read RGB triplets
    → Sample 5 diagonal points
    → Compute average brightness delta
    → Build CSS filter approximation
  → Push custom entry to CE5_LUTS array with cat:'Custom'
  → Apply to active clip immediately
  → Persist LUT ID in clip.colorGrade.lut
```

### Approximation Algorithm
Since CSS cannot apply a true 3D LUT, the import process:
1. Reads the .cube file's RGB table
2. Samples 5 evenly-spaced points along the neutral axis (R=G=B=t)
3. Computes the average output brightness ratio vs. expected neutral
4. Converts this to a CSS `brightness()` value as the primary approximation
5. Future: extract hue shift and saturation delta from diagonal samples

### Upgrade Path to True LUT
For a true 3D LUT engine:
1. Draw each video frame to a Canvas element
2. Read pixel data with `getImageData()`
3. For each pixel, look up the nearest 8 LUT nodes (trilinear interpolation)
4. Write modified pixels with `putImageData()`
5. This requires 60fps WebWorker processing for real-time preview

---

## LUT Storage & Persistence

LUTs are referenced by ID in `clip.colorGrade.lut`. Built-in preset IDs are short strings (e.g., `'c1'`, `'s3'`). Custom-imported LUTs get a timestamp-based ID (`'custom_1718123456789'`).

The preset library (`CE5_LUTS` array) is loaded fresh from `js/color_ce5.js` on each page load. Custom LUT entries must be re-imported if the page is reloaded (the CSS approximation string is not persisted in the project JSON in the current implementation).

---

## Integration with Existing Colour Pipeline

CE-5 stacks on top of the existing filter system, not alongside it:

```
Existing (clip.adj):   brightness · contrast · saturate · hue · sharpen
CE-5 (clip.colorGrade): exposure · contrast · saturation · temperature · tint
                         highlights · shadows · whites · blacks · curves · HSL · LUT
```

Both chains are additive at the CSS filter level. Setting all CE-5 params to default (zero) and LUT to null produces identical output to the pre-CE-5 system.

**Recommended workflow:**
1. Use CE-5 Basic for initial grade
2. Use CE-5 Advanced → Curves for fine tone shaping
3. Apply a LUT for the final "look"
4. Use CE-5 Scopes to verify (Histogram for exposure, Vectorscope for saturation)
5. CE-1 effect stack applies on top of all colour work
