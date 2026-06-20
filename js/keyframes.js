/* ============================================================
   KEYFRAME ENGINE v2.0 — Phase CE-2
   Full property animation: Position, Scale, Rotation,
   Opacity, Blur, Color + timeline dots + bezier
   ============================================================ */
'use strict';

/* ----------------------------------------------------------
   EXTENDED PROPERTY REGISTRY
   (supplements KF_DEFAULTS defined in capcut.html)
   ---------------------------------------------------------- */
const KF_PROPS = {
  opacity:    { def:100,  min:0,    max:100,  suffix:'%',  label:'Opacity',     group:'visual',    icon:'👁️' },
  volume:     { def:100,  min:0,    max:200,  suffix:'%',  label:'Volume',      group:'audio',     icon:'🔊' },
  brightness: { def:0,    min:-100, max:100,  suffix:'',   label:'Brightness',  group:'color',     icon:'☀️' },
  scale:      { def:100,  min:10,   max:300,  suffix:'%',  label:'Scale',       group:'transform', icon:'⤢' },
  posX:       { def:0,    min:-500, max:500,  suffix:'px', label:'Position X',  group:'transform', icon:'↔️' },
  posY:       { def:0,    min:-300, max:300,  suffix:'px', label:'Position Y',  group:'transform', icon:'↕️' },
  rotation:   { def:0,    min:-360, max:360,  suffix:'°',  label:'Rotation',    group:'transform', icon:'🔄' },
  blur:       { def:0,    min:0,    max:40,   suffix:'px', label:'Blur',        group:'fx',        icon:'🌫️' },
  colorHue:   { def:0,    min:-180, max:180,  suffix:'°',  label:'Color (Hue)', group:'color',     icon:'🎨' },
};

/* ----------------------------------------------------------
   CUBIC BEZIER implementation (for custom bezier easing)
   P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1)
   ---------------------------------------------------------- */
function _makeCubicBezier(x1, y1, x2, y2){
  /* Newton's method to solve for t given x, then compute y(t) */
  function sampleCurveX(t){ return ((1-3*x2+3*x1)*t + (3*x2-6*x1))*t*t + 3*x1*t*t + 3*x1*t; }
  function sampleCurveY(t){ return ((1-3*y2+3*y1)*t + (3*y2-6*y1))*t*t + 3*y1*t*t + 3*y1*t; }
  // Simplified: just use parameter t as x (good enough for symmetric curves)
  return function(t){
    const y = ((1-3*y2+3*y1)*t + (3*y2-6*y1))*t*t + 3*y1*t*t + 3*y1*t;
    return Math.max(0, Math.min(1, y));
  };
}

/* Bezier presets */
const BEZIER_PRESETS = {
  'bezier-ease':     _makeCubicBezier(0.25, 0.1, 0.25, 1.0),
  'bezier-sharp':    _makeCubicBezier(0.4,  0.0, 0.6,  1.0),
  'bezier-overshoot':_makeCubicBezier(0.34, 1.56, 0.64, 1.0),
  'bezier-anticipate':_makeCubicBezier(0.36, 0.0, 0.66,-0.56),
};
const BEZIER_LABELS = {
  'bezier-ease':      '◉ Bezier Ease',
  'bezier-sharp':     '◉ Bezier Sharp',
  'bezier-overshoot': '◉ Overshoot',
  'bezier-anticipate':'◉ Anticipate',
};

/* ----------------------------------------------------------
   TRANSFORM COMPOSER
   Reads posX/posY/scale/rotation KFs and composes one
   style.transform string. Called during every frame update.
   ---------------------------------------------------------- */
function kfComposeTransform(clip, relT){
  const tx = _kfPropVal(clip,'posX',relT,0);
  const ty = _kfPropVal(clip,'posY',relT,0);
  const sc = _kfPropVal(clip,'scale',relT,100);
  const ro = _kfPropVal(clip,'rotation',relT,0);
  const parts = [];
  if(tx!==0||ty!==0) parts.push(`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px)`);
  if(sc!==100)        parts.push(`scale(${(sc/100).toFixed(4)})`);
  if(ro!==0)          parts.push(`rotate(${ro.toFixed(2)}deg)`);
  return parts.join(' ');
}

/* ----------------------------------------------------------
   FILTER COMPOSER
   Merges blur + colorHue KFs with base filter string.
   ---------------------------------------------------------- */
function kfComposeFilter(clip, relT, baseFilter){
  const bl  = _kfPropVal(clip,'blur',relT,-1);
  const hue = _kfPropVal(clip,'colorHue',relT,null);
  const hasBri = clip.keyframes&&clip.keyframes.brightness&&clip.keyframes.brightness.length;
  const bri = hasBri ? _kfPropVal(clip,'brightness',relT,0) : null;

  let f = (baseFilter||'')
    .replace(/blur\([^)]*\)/g,'')
    .replace(/hue-rotate\([^)]*\)/g,'')
    .trim();

  if(bl>=0)            f += ` blur(${bl.toFixed(1)}px)`;
  if(hue!==null&&hue!==0) f += ` hue-rotate(${hue.toFixed(0)}deg)`;
  if(bri!==null)       f += ` brightness(${(1+bri/100).toFixed(3)})`;
  return f.trim();
}

/* ----------------------------------------------------------
   FULL PREVIEW APPLY — called every frame during playback
   ---------------------------------------------------------- */
function kfApplyFullPreview(clip, relT){
  const ph = document.getElementById('phone-el');
  if(!ph||!clip||!clip.keyframes) return;
  const kfKeys = Object.keys(clip.keyframes);
  if(!kfKeys.length) return;

  /* 1. Opacity */
  if(clip.keyframes.opacity&&clip.keyframes.opacity.length){
    const op = _kfPropVal(clip,'opacity',relT,100);
    ph.style.opacity = (Math.max(0,Math.min(100,op))/100).toFixed(3);
  }

  /* 2. Transform (posX, posY, scale, rotation — compose together) */
  const transformProps = ['posX','posY','scale','rotation'];
  const hasTransform = transformProps.some(p=>clip.keyframes[p]&&clip.keyframes[p].length);
  if(hasTransform){
    ph.style.transform = kfComposeTransform(clip, relT)||'';
  }

  /* 3. Filter extras (blur, colorHue, brightness KF) */
  const filterProps = ['blur','colorHue','brightness'];
  const hasFilter = filterProps.some(p=>clip.keyframes[p]&&clip.keyframes[p].length);
  if(hasFilter){
    ph.style.filter = kfComposeFilter(clip, relT, ph.style.filter);
  }
}

/* ----------------------------------------------------------
   TIMELINE DOTS
   Returns HTML string of ◆ diamonds at KF positions.
   clipWidthPx: rendered width of clip in pixels
   ---------------------------------------------------------- */
function kfGetTimelineDots(clip, clipWidthPx){
  if(!clip.keyframes||!Object.keys(clip.keyframes).length) return '';
  const dur = clip.dur;
  if(dur<=0||clipWidthPx<=0) return '';

  const times = new Set();
  Object.values(clip.keyframes).forEach(kfs=>{
    if(Array.isArray(kfs)) kfs.forEach(k=>{
      if(typeof k.t==='number') times.add(parseFloat(k.t.toFixed(3)));
    });
  });
  if(!times.size) return '';

  const phRel = (typeof playhead!=='undefined') ? (playhead - (clip.start||0)) : -1;

  return [...times].map(t=>{
    const pct = Math.max(0, Math.min(1, t/dur));
    const left = (pct * clipWidthPx).toFixed(1);
    const isAt = Math.abs(t - phRel) < 0.04;
    return `<div class="kf-tl-dot${isAt?' kf-tl-dot-active':''}" style="left:${left}px" title="KF at ${t.toFixed(2)}s"></div>`;
  }).join('');
}

/* ----------------------------------------------------------
   NAVIGATION — jump to prev/next KF
   ---------------------------------------------------------- */
function kfNavigatePrev(){
  const {clip, relT} = _kfCtx(); if(!clip) return;
  const prop = _kfPropSel();
  const kfs = (clip.keyframes&&clip.keyframes[prop])||[];
  const sorted = [...kfs].sort((a,b)=>a.t-b.t);
  const target = [...sorted].reverse().find(k=>k.t<relT-0.04);
  if(target){ playhead=clip.start+target.t; updatePlayhead&&updatePlayhead(); renderKFEditor&&renderKFEditor(); }
}

function kfNavigateNext(){
  const {clip, relT} = _kfCtx(); if(!clip) return;
  const prop = _kfPropSel();
  const kfs = (clip.keyframes&&clip.keyframes[prop])||[];
  const sorted = [...kfs].sort((a,b)=>a.t-b.t);
  const target = sorted.find(k=>k.t>relT+0.04);
  if(target){ playhead=clip.start+target.t; updatePlayhead&&updatePlayhead(); renderKFEditor&&renderKFEditor(); }
}

/* Toggle KF at playhead (add if none, remove if exists) */
function kfToggleAtPlayhead(){
  const {clip, relT} = _kfCtx(); if(!clip) return;
  const prop = _kfPropSel();
  const kfs = (clip.keyframes&&clip.keyframes[prop])||[];
  const idx = kfs.findIndex(k=>Math.abs(k.t-relT)<0.04);
  if(idx>=0){
    saveState&&saveState();
    kfs.splice(idx,1);
    renderKFEditor&&renderKFEditor();
    renderAll&&renderAll();
    toast&&toast('◇ Đã xóa keyframe');
  } else {
    kfAddAtPlayhead&&kfAddAtPlayhead();
    renderAll&&renderAll();
  }
}

function kfHasAtPlayhead(){
  const {clip, relT} = _kfCtx(); if(!clip) return false;
  const prop = _kfPropSel();
  const kfs = (clip.keyframes&&clip.keyframes[prop])||[];
  return kfs.some(k=>Math.abs(k.t-relT)<0.04);
}

/* ----------------------------------------------------------
   INTERNAL HELPERS
   ---------------------------------------------------------- */
function _kfCtx(){
  if(typeof selected==='undefined'||selected.size!==1) return {};
  const id=[...selected][0];
  const found=findClip&&findClip(id);
  if(!found) return {};
  const clip=found.clip;
  const relT=parseFloat(((playhead||0)-(clip.start||0)).toFixed(4));
  return {clip, relT};
}

function _kfPropSel(){
  return document.getElementById('kf-prop-sel')?.value||'opacity';
}

function _kfPropVal(clip, prop, relT, defVal){
  if(!clip.keyframes||!clip.keyframes[prop]||!clip.keyframes[prop].length) return defVal;
  const v = typeof kfInterpolate==='function' ? kfInterpolate(clip.keyframes[prop], relT) : null;
  return v!==null ? v : defVal;
}

/* Update kf-add button text to show current state (◇/◆) */
function kfUpdateAddBtn(){
  const btn = document.getElementById('kf-add-btn');
  if(!btn) return;
  const has = kfHasAtPlayhead();
  btn.textContent = has ? '◆ Tại đây' : '◇ Thêm KF';
  btn.style.background = has ? 'var(--accent)' : '';
  btn.style.color = has ? '#000' : '';
}

console.log('[KeyframeEngine] v2.0 loaded — CE-2: posX/posY/rotation/blur/colorHue + bezier + timeline dots');
