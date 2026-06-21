# CE-6 Audio Engine Pro — DSP Architecture Report

## Signal Chain

```
HTMLAudioElement
      │
      ▼
MediaElementSourceNode  ←── created once per el (WeakMap cache)
      │
      ▼
BiquadFilter[0]  type=lowshelf   freq=80Hz    (Low shelf EQ)
      │
      ▼
BiquadFilter[1]  type=peaking    freq=500Hz   Q=1.0  (Lo-Mid EQ)
      │
      ▼
BiquadFilter[2]  type=peaking    freq=3000Hz  Q=1.0  (Hi-Mid EQ)
      │
      ▼
BiquadFilter[3]  type=highshelf  freq=10kHz          (High shelf EQ)
      │
      ▼ (only when noiseReduction.enabled)
BiquadFilter     type=highpass   freq=60+(strength×1.4)Hz  Q=0.7
      │
      ▼ (only when compressor.enabled)
DynamicsCompressor
  threshold : -24 dB   (default)
  ratio     : 4:1
  attack    : 3 ms
  release   : 250 ms
  knee      : 30 dB
      │
      ▼ (only when limiter.enabled)
DynamicsCompressor  ← acts as brickwall limiter
  threshold : -3 dB
  ratio     : 20:1
  attack    : 1 ms
  release   : 100 ms
  knee      : 0 dB (hard knee)
      │
      ▼
GainNode  gain = volume/100  (0.0–2.0)
      │
      ▼
AudioContext.destination
```

---

## Web Audio API Design Decisions

### Single AudioContext
A shared `_ce6AC` is created lazily and reused. If suspended (browser autoplay policy), it is resumed on user interaction. This avoids the "too many AudioContexts" warning.

### MediaElementSource reuse
`createMediaElementSource(el)` can only be called **once** per HTMLAudioElement. CE-6 caches the node in a `WeakMap<el, MediaElementSourceNode>`. On subsequent DSP chain rebuilds (toggle compressor/limiter/NR), the source node is reused and only downstream nodes are replaced.

### Chain rebuild
`ce6_connectDSP(clip)` tears down and rewires the entire chain below the source whenever a toggle changes (compressor enable/disable, limiter on/off, NR on/off). This ensures nodes not in use don't consume CPU.

### Real-time parameter updates
For parameter changes that don't require chain rebuild (EQ gain, compressor threshold/ratio/etc.), CE-6 writes directly to the AudioParam via `.value`. This is sample-accurate and glitch-free.

---

## EQ Specification

| Band | Filter Type | Center Freq | Q | Range |
|------|-------------|-------------|---|-------|
| Low | lowshelf | 80 Hz | — | ±20 dB |
| Lo-Mid | peaking | 500 Hz | 1.0 | ±20 dB |
| Hi-Mid | peaking | 3 kHz | 1.0 | ±20 dB |
| High | highshelf | 10 kHz | — | ±20 dB |

---

## Dynamics Specification

### Compressor
| Param | Range | Default | Unit |
|-------|-------|---------|------|
| Threshold | -60 to 0 | -24 | dBFS |
| Ratio | 1 to 20 | 4 | :1 |
| Attack | 0 to 100 | 3 | ms |
| Release | 10 to 1000 | 250 | ms |
| Knee | 0 to 40 | 30 | dB |

### Limiter (brickwall)
| Param | Range | Default | Unit |
|-------|-------|---------|------|
| Threshold | -20 to 0 | -3 | dBFS |
| Release | 10 to 500 | 100 | ms |

---

## Noise Reduction

Implemented as a tunable high-pass BiquadFilter:
- `frequency = 60 + (strength × 1.4) Hz`  — range 60–200 Hz
- `Q = 0.7` (gentle slope, -12 dB/oct)
- At strength=0: 60Hz high-pass (removes sub-bass hum only)
- At strength=100: 200Hz high-pass (aggressive noise removal)

> Full spectral noise gating requires ScriptProcessorNode or AudioWorklet (planned CE-6.1).

---

## Fade Envelope Algorithm

Applied during `audioTick` — no Web Audio scheduled automation (avoids timing drift with HTML video playhead):

```
vol = clip.audioGrade.volume / 100

if fadeIn > 0 and relT < fadeIn:
    vol *= relT / fadeIn

if fadeOut > 0 and relT > (clip.dur - fadeOut):
    vol *= (clip.dur - relT) / fadeOut

if automation.length > 0:
    vol *= lerp(automation, relT) / 100

clip.el.volume = clamp(vol, 0, 1)
gainOut.gain   = clamp(vol × 2, 0, 2)  ← smoothed via setTargetAtTime(τ=10ms)
```

---

## Volume Automation

- Points stored as `[{t: seconds, v: 0-200}]` in `clip.audioGrade.automation`
- Evaluated with **linear interpolation** between adjacent points
- Canvas editor: 260×64px, click to add, right-click to remove
- Curve overlaid on waveform canvas (dashed amber line)
- Full real-time evaluation each audioTick (~60fps)

---

## Known Limitations & Future Work

| Issue | Resolution |
|-------|-----------|
| NR is high-pass only | CE-6.1: AudioWorklet spectral subtraction |
| Audio groups not persisted | CE-6.1: serialize to project JSON |
| No GR meter for compressor | CE-6.1: analyserNode → canvas meter |
| No stereo pan per clip | CE-6.1: StereoPannerNode |
| Automation only linear | CE-6.1: bezier curves (reuse keyframes.js spline) |
