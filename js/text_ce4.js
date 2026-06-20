/* ═══════════════════════════════════════════════════════════════
   CE-4: Text & Motion Graphics
   Types     : Title · Subtitle · Callout · Lower Third · Quote
   Animations: Fade · Slide · Pop · Bounce · Zoom
   Templates : 50+ presets grouped by category
   Inspector : Font · Size · Color · Shadow · Outline · Glow
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Active text clip reference ─────────────────────────────── */
let _ce4ActiveClipId = null;

/* ─── Text type definitions ──────────────────────────────────── */
const CE4_TEXT_TYPES = [
  { id:'title',       label:'Title',      icon:'T',   desc:'Tiêu đề lớn' },
  { id:'subtitle',    label:'Subtitle',   icon:'St',  desc:'Phụ đề' },
  { id:'callout',     label:'Callout',    icon:'💬',  desc:'Chú thích bong bóng' },
  { id:'lower-third', label:'Lower ⅓',    icon:'L3',  desc:'Lower third chuyên nghiệp' },
  { id:'quote',       label:'Quote',      icon:'❝',   desc:'Trích dẫn nổi bật' },
];

/* ─── Animation definitions ──────────────────────────────────── */
const CE4_ANIMS = [
  { id:'none',       label:'Không',     icon:'∅' },
  { id:'fade-in',    label:'Fade In',   icon:'◎' },
  { id:'fade-out',   label:'Fade Out',  icon:'◉' },
  { id:'slide-up',   label:'Slide Up',  icon:'↑' },
  { id:'slide-left', label:'Slide ←',   icon:'←' },
  { id:'slide-right',label:'Slide →',   icon:'→' },
  { id:'pop',        label:'Pop',       icon:'💥' },
  { id:'bounce',     label:'Bounce',    icon:'🏀' },
  { id:'zoom',       label:'Zoom',      icon:'🔍' },
];

/* ─── Font list ──────────────────────────────────────────────── */
const CE4_FONTS = [
  'Inter','Roboto','Open Sans','Montserrat','Lato','Poppins','Raleway',
  'Oswald','Merriweather','Playfair Display','Dancing Script','Pacifico',
  'Bebas Neue','Anton','Nunito','Ubuntu','Quicksand','Josefin Sans',
  'Cinzel','Righteous','Bangers','Permanent Marker',
  'Arial','Helvetica','Georgia','Times New Roman','Courier New',
];

/* ─── Color presets ──────────────────────────────────────────── */
const CE4_COLOR_PRESETS = [
  '#ffffff','#000000','#f59e0b','#ef4444','#3b82f6','#10b981',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#fbbf24','#a78bfa','#34d399','#fb7185',
];

/* ─── 50+ Templates ──────────────────────────────────────────── */
const CE4_TEMPLATES = [
  /* ── Modern ─ */
  { id:'m1',cat:'Modern',name:'Clean White',       textType:'title',       font:'Inter',          fontSize:56, fontWeight:'700', color:'#ffffff', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in',  animOut:'fade-out', bg:'#1a1a2e' },
  { id:'m2',cat:'Modern',name:'Blue Gradient',     textType:'title',       font:'Montserrat',     fontSize:52, fontWeight:'800', color:'#60a5fa', shadow:{on:true,c:'#1e40af',b:12,x:0,y:4}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#0f172a' },
  { id:'m3',cat:'Modern',name:'Minimal Dark',      textType:'subtitle',    font:'Poppins',        fontSize:28, fontWeight:'400', color:'#e2e8f0', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in',  animOut:'fade-out', bg:'#0f172a' },
  { id:'m4',cat:'Modern',name:'Tech Lines',        textType:'callout',     font:'Roboto',         fontSize:32, fontWeight:'700', color:'#00d4ff', shadow:{on:false}, outline:{on:true,c:'#0891b2',w:1.5}, glow:{on:true,c:'#06b6d4',b:20}, animIn:'slide-left',bg:'#0a0a0f' },
  { id:'m5',cat:'Modern',name:'Soft Pastel',       textType:'lower-third', font:'Nunito',         fontSize:26, fontWeight:'600', color:'#fde68a', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#312e81' },
  { id:'m6',cat:'Modern',name:'Glass Panel',       textType:'lower-third', font:'Inter',          fontSize:22, fontWeight:'500', color:'#f1f5f9', shadow:{on:true,c:'#000',b:8,x:0,y:2}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#1e293b' },
  { id:'m7',cat:'Modern',name:'Purple Haze',       textType:'title',       font:'Raleway',        fontSize:60, fontWeight:'900', color:'#c084fc', shadow:{on:true,c:'#7e22ce',b:16,x:2,y:4}, outline:{on:false}, glow:{on:true,c:'#a855f7',b:24}, animIn:'zoom', animOut:'fade-out', bg:'#1a0533' },
  { id:'m8',cat:'Modern',name:'Emerald Impact',    textType:'title',       font:'Oswald',         fontSize:64, fontWeight:'700', color:'#34d399', shadow:{on:true,c:'#065f46',b:10,x:0,y:3}, outline:{on:false}, glow:{on:false}, animIn:'pop', animOut:'fade-out', bg:'#052e16' },
  /* ── Bold ─ */
  { id:'b1',cat:'Bold',  name:'Fire Red',          textType:'title',       font:'Anton',          fontSize:72, fontWeight:'400', color:'#ef4444', shadow:{on:true,c:'#7f1d1d',b:8,x:3,y:6}, outline:{on:false}, glow:{on:true,c:'#dc2626',b:20}, animIn:'bounce', animOut:'fade-out', bg:'#0c0a09' },
  { id:'b2',cat:'Bold',  name:'Black & Gold',      textType:'title',       font:'Bebas Neue',     fontSize:80, fontWeight:'400', color:'#fbbf24', shadow:{on:true,c:'#000',b:4,x:2,y:4}, outline:{on:true,c:'#92400e',w:2}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#000000' },
  { id:'b3',cat:'Bold',  name:'White Impact',      textType:'title',       font:'Impact',         fontSize:76, fontWeight:'400', color:'#ffffff', shadow:{on:true,c:'#000',b:6,x:3,y:3}, outline:{on:true,c:'#000',w:3}, glow:{on:false}, animIn:'zoom', animOut:'fade-out', bg:'#18181b' },
  { id:'b4',cat:'Bold',  name:'Orange Crush',      textType:'callout',     font:'Bangers',        fontSize:54, fontWeight:'400', color:'#fb923c', shadow:{on:true,c:'#7c2d12',b:8,x:2,y:4}, outline:{on:true,c:'#c2410c',w:2}, glow:{on:false}, animIn:'bounce', animOut:'fade-out', bg:'#1c1917' },
  { id:'b5',cat:'Bold',  name:'Purple Storm',      textType:'title',       font:'Righteous',      fontSize:68, fontWeight:'400', color:'#e879f9', shadow:{on:true,c:'#701a75',b:12,x:2,y:4}, outline:{on:false}, glow:{on:true,c:'#d946ef',b:24}, animIn:'zoom', animOut:'fade-out', bg:'#0f0318' },
  { id:'b6',cat:'Bold',  name:'Neon Green',        textType:'title',       font:'Bebas Neue',     fontSize:72, fontWeight:'400', color:'#4ade80', shadow:{on:true,c:'#14532d',b:8,x:0,y:4}, outline:{on:false}, glow:{on:true,c:'#22c55e',b:30}, animIn:'pop', animOut:'fade-out', bg:'#000000' },
  { id:'b7',cat:'Bold',  name:'Retro Wave',        textType:'title',       font:'Pacifico',       fontSize:58, fontWeight:'400', color:'#f0abfc', shadow:{on:true,c:'#6b21a8',b:10,x:3,y:5}, outline:{on:false}, glow:{on:true,c:'#c026d3',b:20}, animIn:'slide-right', animOut:'fade-out', bg:'#0f0033' },
  { id:'b8',cat:'Bold',  name:'Gold Standard',     textType:'lower-third', font:'Cinzel',         fontSize:30, fontWeight:'700', color:'#fcd34d', shadow:{on:true,c:'#78350f',b:6,x:1,y:2}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#1c1403' },
  /* ── Neon ─ */
  { id:'n1',cat:'Neon',  name:'Cyber Blue',        textType:'title',       font:'Rajdhani',       fontSize:64, fontWeight:'700', color:'#00d4ff', shadow:{on:false}, outline:{on:true,c:'#0284c7',w:1}, glow:{on:true,c:'#0ea5e9',b:30}, animIn:'fade-in', animOut:'fade-out', bg:'#000000' },
  { id:'n2',cat:'Neon',  name:'Neon Pink',         textType:'title',       font:'Orbitron',       fontSize:56, fontWeight:'900', color:'#f472b6', shadow:{on:false}, outline:{on:false}, glow:{on:true,c:'#ec4899',b:35}, animIn:'pop', animOut:'fade-out', bg:'#09000f' },
  { id:'n3',cat:'Neon',  name:'Green Matrix',      textType:'subtitle',    font:'Courier New',    fontSize:24, fontWeight:'700', color:'#4ade80', shadow:{on:false}, outline:{on:false}, glow:{on:true,c:'#16a34a',b:20}, animIn:'fade-in', animOut:'fade-out', bg:'#000000' },
  { id:'n4',cat:'Neon',  name:'Hot Magenta',       textType:'callout',     font:'Bebas Neue',     fontSize:52, fontWeight:'400', color:'#f0abfc', shadow:{on:false}, outline:{on:true,c:'#a21caf',w:1}, glow:{on:true,c:'#d946ef',b:28}, animIn:'slide-left', animOut:'fade-out', bg:'#09000f' },
  { id:'n5',cat:'Neon',  name:'Electric Yellow',   textType:'title',       font:'Anton',          fontSize:70, fontWeight:'400', color:'#fef08a', shadow:{on:false}, outline:{on:false}, glow:{on:true,c:'#eab308',b:28}, animIn:'bounce', animOut:'fade-out', bg:'#1a1000' },
  { id:'n6',cat:'Neon',  name:'Violet Dream',      textType:'quote',       font:'Dancing Script',  fontSize:40, fontWeight:'700', color:'#a78bfa', shadow:{on:false}, outline:{on:false}, glow:{on:true,c:'#7c3aed',b:20}, animIn:'zoom', animOut:'fade-out', bg:'#0d0520' },
  { id:'n7',cat:'Neon',  name:'Teal Circuit',      textType:'lower-third', font:'Roboto',         fontSize:22, fontWeight:'700', color:'#2dd4bf', shadow:{on:false}, outline:{on:true,c:'#0d9488',w:1}, glow:{on:true,c:'#14b8a6',b:18}, animIn:'slide-up', animOut:'fade-out', bg:'#000000' },
  /* ── Cinematic ─ */
  { id:'c1',cat:'Cinema',name:'Film Title',        textType:'title',       font:'Cinzel',         fontSize:60, fontWeight:'700', color:'#f5f5f4', shadow:{on:true,c:'#000',b:12,x:0,y:4}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#000000' },
  { id:'c2',cat:'Cinema',name:'Epic Intro',        textType:'title',       font:'Trajan Pro',     fontSize:64, fontWeight:'400', color:'#d97706', shadow:{on:true,c:'#000',b:16,x:0,y:6}, outline:{on:false}, glow:{on:false}, animIn:'zoom', animOut:'fade-out', bg:'#000000' },
  { id:'c3',cat:'Cinema',name:'Drama Quote',       textType:'quote',       font:'Merriweather',   fontSize:32, fontWeight:'300', color:'#e7e5e4', shadow:{on:true,c:'#000',b:8,x:1,y:2}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#1c1917' },
  { id:'c4',cat:'Cinema',name:'Documentary',       textType:'lower-third', font:'Open Sans',      fontSize:20, fontWeight:'400', color:'#fafaf9', shadow:{on:true,c:'#000',b:6,x:0,y:2}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#000000' },
  { id:'c5',cat:'Cinema',name:'Thriller Dark',     textType:'title',       font:'Oswald',         fontSize:72, fontWeight:'700', color:'#ffffff', shadow:{on:true,c:'#000',b:0,x:4,y:4}, outline:{on:true,c:'#000',w:2}, glow:{on:false}, animIn:'slide-left', animOut:'fade-out', bg:'#09090b' },
  { id:'c6',cat:'Cinema',name:'Sepia Classic',     textType:'subtitle',    font:'Playfair Display',fontSize:28,fontWeight:'400', color:'#d4a463', shadow:{on:true,c:'#292524',b:6,x:1,y:2}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#1c1917' },
  { id:'c7',cat:'Cinema',name:'Action Credit',     textType:'title',       font:'Bebas Neue',     fontSize:80, fontWeight:'400', color:'#ffffff', shadow:{on:true,c:'#000',b:4,x:2,y:2}, outline:{on:false}, glow:{on:false}, animIn:'bounce', animOut:'fade-out', bg:'#000000' },
  { id:'c8',cat:'Cinema',name:'Noir Shadow',       textType:'callout',     font:'Courier New',    fontSize:24, fontWeight:'700', color:'#e7e5e4', shadow:{on:true,c:'#000',b:20,x:4,y:8}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#09090b' },
  /* ── Minimal ─ */
  { id:'mn1',cat:'Minimal',name:'Pure White',      textType:'title',       font:'Inter',          fontSize:48, fontWeight:'300', color:'#ffffff', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#000000' },
  { id:'mn2',cat:'Minimal',name:'Thin Grey',       textType:'subtitle',    font:'Lato',           fontSize:22, fontWeight:'300', color:'#94a3b8', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#0f172a' },
  { id:'mn3',cat:'Minimal',name:'Monochrome',      textType:'quote',       font:'Playfair Display',fontSize:30,fontWeight:'400', color:'#e2e8f0', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#1e293b' },
  { id:'mn4',cat:'Minimal',name:'Line Break',      textType:'lower-third', font:'Inter',          fontSize:18, fontWeight:'600', color:'#f8fafc', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#000000' },
  { id:'mn5',cat:'Minimal',name:'Dot Leader',      textType:'callout',     font:'Poppins',        fontSize:26, fontWeight:'500', color:'#cbd5e1', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#0f172a' },
  { id:'mn6',cat:'Minimal',name:'Lowercase Clean', textType:'subtitle',    font:'Nunito',         fontSize:24, fontWeight:'400', color:'#e2e8f0', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#1a1a2e' },
  { id:'mn7',cat:'Minimal',name:'Italic Whisper',  textType:'quote',       font:'Merriweather',   fontSize:28, fontWeight:'300', color:'#a1a1aa', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#18181b' },
  /* ── Social ─ */
  { id:'s1',cat:'Social', name:'TikTok Bold',      textType:'title',       font:'Montserrat',     fontSize:62, fontWeight:'900', color:'#ffffff', shadow:{on:true,c:'#000',b:8,x:2,y:4}, outline:{on:false}, glow:{on:false}, animIn:'bounce', animOut:'fade-out', bg:'#000000' },
  { id:'s2',cat:'Social', name:'Instagram Vibe',   textType:'subtitle',    font:'Dancing Script',  fontSize:36,fontWeight:'700', color:'#fcd34d', shadow:{on:true,c:'#92400e',b:6,x:1,y:2}, outline:{on:false}, glow:{on:false}, animIn:'pop', animOut:'fade-out', bg:'#312e81' },
  { id:'s3',cat:'Social', name:'YouTube Thumb',    textType:'title',       font:'Oswald',         fontSize:70, fontWeight:'700', color:'#ffffff', shadow:{on:true,c:'#000',b:6,x:3,y:3}, outline:{on:true,c:'#dc2626',w:3}, glow:{on:false}, animIn:'zoom', animOut:'fade-out', bg:'#000000' },
  { id:'s4',cat:'Social', name:'Story Sticker',    textType:'callout',     font:'Nunito',         fontSize:32, fontWeight:'800', color:'#000000', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'pop', animOut:'fade-out', bg:'#fbbf24' },
  { id:'s5',cat:'Social', name:'Reels Caption',    textType:'subtitle',    font:'Inter',          fontSize:24, fontWeight:'600', color:'#ffffff', shadow:{on:true,c:'#000',b:10,x:0,y:2}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#000000' },
  { id:'s6',cat:'Social', name:'Twitter Thread',   textType:'quote',       font:'Lato',           fontSize:26, fontWeight:'400', color:'#f8fafc', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'fade-in', animOut:'fade-out', bg:'#0f172a' },
  { id:'s7',cat:'Social', name:'Meme Caption',     textType:'title',       font:'Impact',         fontSize:64, fontWeight:'400', color:'#ffffff', shadow:{on:true,c:'#000',b:0,x:3,y:3}, outline:{on:true,c:'#000',w:3}, glow:{on:false}, animIn:'pop', animOut:'fade-out', bg:'#18181b' },
  /* ── News ─ */
  { id:'nw1',cat:'News',  name:'Breaking News',    textType:'lower-third', font:'Roboto',         fontSize:22, fontWeight:'700', color:'#ffffff', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'slide-left', animOut:'slide-right', bg:'#dc2626' },
  { id:'nw2',cat:'News',  name:'News Ticker',      textType:'subtitle',    font:'Open Sans',      fontSize:18, fontWeight:'600', color:'#ffffff', shadow:{on:false}, outline:{on:false}, glow:{on:false}, animIn:'slide-right', animOut:'fade-out', bg:'#1d4ed8' },
  { id:'nw3',cat:'News',  name:'Interview Tag',    textType:'lower-third', font:'Inter',          fontSize:20, fontWeight:'600', color:'#f8fafc', shadow:{on:true,c:'#000',b:4,x:0,y:1}, outline:{on:false}, glow:{on:false}, animIn:'slide-up', animOut:'fade-out', bg:'#1e293b' },
  { id:'nw4',cat:'News',  name:'Sports Score',     textType:'callout',     font:'Oswald',         fontSize:36, fontWeight:'700', color:'#fbbf24', shadow:{on:true,c:'#000',b:6,x:1,y:2}, outline:{on:false}, glow:{on:false}, animIn:'bounce', animOut:'fade-out', bg:'#0f172a' },
  { id:'nw5',cat:'News',  name:'Weather Alert',    textType:'callout',     font:'Roboto',         fontSize:30, fontWeight:'700', color:'#fef08a', shadow:{on:false}, outline:{on:false}, glow:{on:true,c:'#eab308',b:16}, animIn:'fade-in', animOut:'fade-out', bg:'#dc2626' },
];

/* ─── Clip default text props ─────────────────────────────────── */
function ce4_defaults() {
  return {
    textContent : '',
    textType    : 'title',
    font        : 'Inter',
    fontSize    : 48,
    fontWeight  : '700',
    fontStyle   : 'normal',
    textDecor   : 'none',
    textAlign   : 'center',
    color       : '#ffffff',
    shadow      : { on:false, c:'#000000', b:8, x:2, y:4 },
    outline     : { on:false, c:'#000000', w:2 },
    glow        : { on:false, c:'#ffffff', b:16 },
    animIn      : 'fade-in',
    animOut     : 'fade-out',
    animDur     : 0.5,
    template    : null,
  };
}

/* ─── CE-4 Text Inspector (called by _loadClipToPanel hook) ───── */
function ce4_handleTextClip(clip) {
  _ce4ActiveClipId = clip.id;
  // Merge defaults
  if (!clip.textContent) clip.textContent = clip.label || '';
  const d = ce4_defaults();
  Object.keys(d).forEach(k => { if (clip[k] === undefined) clip[k] = d[k]; });

  const body = document.getElementById('rp-body');
  if (!body) return;

  const fontsOpts = CE4_FONTS.map(f => `<option value="${f}" ${clip.font===f?'selected':''}>${f}</option>`).join('');
  const typeButtons = CE4_TEXT_TYPES.map(t =>
    `<button class="ce4-type-btn${clip.textType===t.id?' on':''}" data-type="${t.id}" onclick="ce4_setType('${t.id}',this)">${t.label}</button>`
  ).join('');
  const animInBtns = CE4_ANIMS.map(a =>
    `<button class="ce4-anim-btn${clip.animIn===a.id?' on':''}" data-anim="${a.id}" onclick="ce4_setAnimIn('${a.id}',this)">${a.label}</button>`
  ).join('');
  const animOutBtns = CE4_ANIMS.map(a =>
    `<button class="ce4-anim-btn${clip.animOut===a.id?' on':''}" data-anim="${a.id}" onclick="ce4_setAnimOut('${a.id}',this)">${a.label}</button>`
  ).join('');
  const colorPresets = CE4_COLOR_PRESETS.map(c =>
    `<div class="ce4-color-preset" style="background:${c}" title="${c}" onclick="ce4_setColor('${c}')"></div>`
  ).join('');

  body.innerHTML = `<div id="ce4-text-panel">
    <!-- Content -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Nội dung</div>
      <textarea class="ce4-textarea" id="ce4-content" placeholder="Nhập văn bản..."
        oninput="ce4_updateContent(this.value)">${ce4_esc(clip.textContent)}</textarea>
    </div>
    <!-- Type -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Loại văn bản</div>
      <div class="ce4-type-row">${typeButtons}</div>
    </div>
    <!-- Anim -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Hiệu ứng</div>
      <div class="ce4-anim-label">Vào</div>
      <div class="ce4-anim-row" id="ce4-anim-in-row">${animInBtns}</div>
      <div class="ce4-anim-label" style="margin-top:6px">Ra</div>
      <div class="ce4-anim-row" id="ce4-anim-out-row">${animOutBtns}</div>
    </div>
    <!-- Font -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Font</div>
      <div class="ce4-font-row">
        <select class="ce4-font-sel" id="ce4-font" onchange="ce4_setFont(this.value)">${fontsOpts}</select>
      </div>
      <div class="ce4-size-row" style="margin-top:6px">
        <span class="ce4-sub-lbl">Cỡ</span>
        <input type="range" class="ce4-size-sl" id="ce4-size" min="10" max="120" value="${clip.fontSize}"
          oninput="ce4_setSize(this.value);document.getElementById('ce4-size-lbl').textContent=this.value">
        <span class="ce4-size-lbl" id="ce4-size-lbl">${clip.fontSize}</span>
      </div>
      <div class="ce4-style-row" style="margin-top:6px">
        <button class="ce4-style-btn${clip.fontWeight==='700'||clip.fontWeight==='bold'?' on':''}" id="ce4-bold"
          onclick="ce4_toggleBold(this)"><b>B</b></button>
        <button class="ce4-style-btn${clip.fontStyle==='italic'?' on':''}" id="ce4-italic"
          onclick="ce4_toggleItalic(this)"><i>I</i></button>
        <button class="ce4-style-btn${clip.textDecor==='underline'?' on':''}" id="ce4-underline"
          onclick="ce4_toggleUnderline(this)"><u>U</u></button>
        <span style="flex:1"></span>
        <button class="ce4-style-btn${clip.textAlign==='left'?' on':''}"   onclick="ce4_setAlign('left',this)">⬅</button>
        <button class="ce4-style-btn${clip.textAlign==='center'?' on':''}" onclick="ce4_setAlign('center',this)">▮</button>
        <button class="ce4-style-btn${clip.textAlign==='right'?' on':''}"  onclick="ce4_setAlign('right',this)">➡</button>
      </div>
    </div>
    <!-- Color -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Màu chữ</div>
      <div class="ce4-color-row">
        <input type="color" class="ce4-color-swatch" id="ce4-color" value="${clip.color}"
          oninput="ce4_setColor(this.value)">
        <div class="ce4-color-presets">${colorPresets}</div>
      </div>
    </div>
    <!-- Shadow -->
    <div class="ce4-section">
      <div class="ce4-toggle-row">
        <span class="ce4-sec-title" style="margin:0">Shadow</span>
        <label class="ce4-toggle"><input type="checkbox" id="ce4-shadow-on" ${clip.shadow.on?'checked':''}
          onchange="ce4_setShadowOn(this.checked)"><span class="ce4-toggle-slider"></span></label>
      </div>
      <div id="ce4-shadow-opts" style="${clip.shadow.on?'':'display:none'}">
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Màu</span>
          <input type="color" class="ce4-color-swatch" style="width:22px;height:22px" value="${clip.shadow.c}"
            oninput="ce4_setShadow('c',this.value)"></div>
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Mờ</span>
          <input type="range" class="ce4-size-sl" min="0" max="30" value="${clip.shadow.b}"
            oninput="ce4_setShadow('b',+this.value)">
          <span class="ce4-size-lbl">${clip.shadow.b}</span></div>
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">X / Y</span>
          <input type="range" class="ce4-size-sl" style="width:60px" min="-20" max="20" value="${clip.shadow.x}"
            oninput="ce4_setShadow('x',+this.value)">
          <input type="range" class="ce4-size-sl" style="width:60px" min="-20" max="20" value="${clip.shadow.y}"
            oninput="ce4_setShadow('y',+this.value)"></div>
      </div>
    </div>
    <!-- Outline -->
    <div class="ce4-section">
      <div class="ce4-toggle-row">
        <span class="ce4-sec-title" style="margin:0">Outline</span>
        <label class="ce4-toggle"><input type="checkbox" id="ce4-outline-on" ${clip.outline.on?'checked':''}
          onchange="ce4_setOutlineOn(this.checked)"><span class="ce4-toggle-slider"></span></label>
      </div>
      <div id="ce4-outline-opts" style="${clip.outline.on?'':'display:none'}">
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Màu</span>
          <input type="color" class="ce4-color-swatch" style="width:22px;height:22px" value="${clip.outline.c}"
            oninput="ce4_setOutline('c',this.value)"></div>
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Dày</span>
          <input type="range" class="ce4-size-sl" min="1" max="8" value="${clip.outline.w}"
            oninput="ce4_setOutline('w',+this.value)">
          <span class="ce4-size-lbl">${clip.outline.w}</span></div>
      </div>
    </div>
    <!-- Glow -->
    <div class="ce4-section">
      <div class="ce4-toggle-row">
        <span class="ce4-sec-title" style="margin:0">Glow</span>
        <label class="ce4-toggle"><input type="checkbox" id="ce4-glow-on" ${clip.glow.on?'checked':''}
          onchange="ce4_setGlowOn(this.checked)"><span class="ce4-toggle-slider"></span></label>
      </div>
      <div id="ce4-glow-opts" style="${clip.glow.on?'':'display:none'}">
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Màu</span>
          <input type="color" class="ce4-color-swatch" style="width:22px;height:22px" value="${clip.glow.c}"
            oninput="ce4_setGlow('c',this.value)"></div>
        <div class="ce4-sub-row"><span class="ce4-sub-lbl">Mờ</span>
          <input type="range" class="ce4-size-sl" min="4" max="60" value="${clip.glow.b}"
            oninput="ce4_setGlow('b',+this.value)">
          <span class="ce4-size-lbl">${clip.glow.b}</span></div>
      </div>
    </div>
    <!-- Templates -->
    <div class="ce4-section">
      <div class="ce4-sec-title">Templates</div>
      <button class="ce4-tpl-open-btn" onclick="ce4_openTemplates()">📋 Duyệt 50+ Templates</button>
    </div>
  </div>`;
}

/* ─── Inspector update helpers ───────────────────────────────── */
function _ce4clip() {
  if (!_ce4ActiveClipId) return null;
  const f = findClip(_ce4ActiveClipId);
  return f ? f.clip : null;
}

function ce4_updateContent(val) {
  const c = _ce4clip(); if (!c) return;
  c.textContent = val;
  c.label = val.split('\n')[0].slice(0, 40) || 'Text';
  renderAll();
}
function ce4_setType(type, el) {
  const c = _ce4clip(); if (!c) return;
  c.textType = type;
  document.querySelectorAll('.ce4-type-btn').forEach(b => b.classList.toggle('on', b.dataset.type === type));
  renderAll();
}
function ce4_setAnimIn(anim, el) {
  const c = _ce4clip(); if (!c) return;
  c.animIn = anim;
  document.querySelectorAll('#ce4-anim-in-row .ce4-anim-btn').forEach(b => b.classList.toggle('on', b.dataset.anim === anim));
}
function ce4_setAnimOut(anim, el) {
  const c = _ce4clip(); if (!c) return;
  c.animOut = anim;
  document.querySelectorAll('#ce4-anim-out-row .ce4-anim-btn').forEach(b => b.classList.toggle('on', b.dataset.anim === anim));
}
function ce4_setFont(val) {
  const c = _ce4clip(); if (!c) return;
  c.font = val; renderAll();
}
function ce4_setSize(val) {
  const c = _ce4clip(); if (!c) return;
  c.fontSize = +val; renderAll();
}
function ce4_toggleBold(el) {
  const c = _ce4clip(); if (!c) return;
  c.fontWeight = (c.fontWeight === '700' || c.fontWeight === 'bold') ? '400' : '700';
  el.classList.toggle('on', c.fontWeight === '700');
  renderAll();
}
function ce4_toggleItalic(el) {
  const c = _ce4clip(); if (!c) return;
  c.fontStyle = c.fontStyle === 'italic' ? 'normal' : 'italic';
  el.classList.toggle('on', c.fontStyle === 'italic');
  renderAll();
}
function ce4_toggleUnderline(el) {
  const c = _ce4clip(); if (!c) return;
  c.textDecor = c.textDecor === 'underline' ? 'none' : 'underline';
  el.classList.toggle('on', c.textDecor === 'underline');
  renderAll();
}
function ce4_setAlign(align, el) {
  const c = _ce4clip(); if (!c) return;
  c.textAlign = align;
  document.querySelectorAll('.ce4-style-row .ce4-style-btn').forEach(b => {
    if (['⬅','▮','➡'].includes(b.textContent)) b.classList.remove('on');
  });
  if (el) el.classList.add('on');
  renderAll();
}
function ce4_setColor(val) {
  const c = _ce4clip(); if (!c) return;
  c.color = val;
  const sw = document.getElementById('ce4-color');
  if (sw) sw.value = val;
  renderAll();
}
function ce4_setShadowOn(val) {
  const c = _ce4clip(); if (!c) return;
  c.shadow.on = val;
  const opts = document.getElementById('ce4-shadow-opts');
  if (opts) opts.style.display = val ? '' : 'none';
  renderAll();
}
function ce4_setShadow(key, val) {
  const c = _ce4clip(); if (!c) return;
  c.shadow[key] = val; renderAll();
}
function ce4_setOutlineOn(val) {
  const c = _ce4clip(); if (!c) return;
  c.outline.on = val;
  const opts = document.getElementById('ce4-outline-opts');
  if (opts) opts.style.display = val ? '' : 'none';
  renderAll();
}
function ce4_setOutline(key, val) {
  const c = _ce4clip(); if (!c) return;
  c.outline[key] = val; renderAll();
}
function ce4_setGlowOn(val) {
  const c = _ce4clip(); if (!c) return;
  c.glow.on = val;
  const opts = document.getElementById('ce4-glow-opts');
  if (opts) opts.style.display = val ? '' : 'none';
  renderAll();
}
function ce4_setGlow(key, val) {
  const c = _ce4clip(); if (!c) return;
  c.glow[key] = val; renderAll();
}

/* ─── Template system ────────────────────────────────────────── */
let _ce4TplActiveCat = 'All';

function ce4_openTemplates() {
  const modal = document.getElementById('ce4-tpl-modal');
  if (!modal) return;
  ce4_renderTemplates(_ce4TplActiveCat);
  modal.classList.add('open');
}
function ce4_closeTemplates() {
  const modal = document.getElementById('ce4-tpl-modal');
  if (modal) modal.classList.remove('open');
}
function ce4_renderTemplates(cat) {
  _ce4TplActiveCat = cat;
  const cats = ['All', ...new Set(CE4_TEMPLATES.map(t => t.cat))];

  const catHtml = cats.map(c =>
    `<button class="ce4-tpl-cat${c===cat?' on':''}" onclick="ce4_renderTemplates('${c}')">${c}</button>`
  ).join('');

  const filtered = cat === 'All' ? CE4_TEMPLATES : CE4_TEMPLATES.filter(t => t.cat === cat);
  const gridHtml = filtered.map(t => {
    const shadow  = t.shadow && t.shadow.on
      ? `text-shadow:${t.shadow.x||0}px ${t.shadow.y||0}px ${t.shadow.b||0}px ${t.shadow.c||'#000'}` : '';
    const outline  = t.outline && t.outline.on
      ? `-webkit-text-stroke:${t.outline.w||1}px ${t.outline.c||'#000'}` : '';
    const glow    = t.glow && t.glow.on
      ? `filter:drop-shadow(0 0 ${t.glow.b||12}px ${t.glow.c||'#fff'})` : '';
    return `<div class="ce4-tpl-card" onclick="ce4_applyTemplate('${t.id}')">
      <div class="ce4-tpl-preview" style="background:${t.bg||'#1a1a2e'}">
        <span style="font-family:${t.font};font-size:${Math.max(11,Math.round(t.fontSize/4))}px;
          font-weight:${t.fontWeight||'400'};color:${t.color};${shadow};${outline};${glow}">
          ${t.name}
        </span>
      </div>
      <div class="ce4-tpl-name">${t.name}</div>
    </div>`;
  }).join('');

  const box = document.getElementById('ce4-tpl-box');
  if (!box) return;
  box.querySelector('.ce4-tpl-cats').innerHTML = catHtml;
  box.querySelector('.ce4-tpl-grid').innerHTML = gridHtml;
}

function ce4_applyTemplate(tplId) {
  const tpl = CE4_TEMPLATES.find(t => t.id === tplId);
  if (!tpl) return;
  const c = _ce4clip();
  if (!c) {
    // Add a new text clip to the text track
    _ce4AddNewClipFromTemplate(tpl);
    ce4_closeTemplates();
    return;
  }
  // Apply to existing selected clip
  Object.assign(c, {
    textType  : tpl.textType,
    font      : tpl.font,
    fontSize  : tpl.fontSize,
    fontWeight: tpl.fontWeight || '400',
    color     : tpl.color,
    shadow    : { ...ce4_defaults().shadow, ...(tpl.shadow || {}) },
    outline   : { ...ce4_defaults().outline, ...(tpl.outline || {}) },
    glow      : { ...ce4_defaults().glow, ...(tpl.glow || {}) },
    animIn    : tpl.animIn || 'fade-in',
    animOut   : tpl.animOut || 'fade-out',
    template  : tplId,
  });
  ce4_closeTemplates();
  ce4_handleTextClip(c);
  renderAll();
  toast('✅ Áp dụng template: ' + tpl.name);
}

function _ce4AddNewClipFromTemplate(tpl) {
  let textTrack = tracks.find(t => t.type === 'text');
  if (!textTrack) {
    textTrack = { id:'tr'+(nextId++), type:'text', label:'Văn bản', icon:ICONS.text,
      color:'#10b981', locked:false, muted:false, hidden:false, clips:[] };
    tracks.push(textTrack);
  }
  const d = ce4_defaults();
  const clip = {
    id: 'c' + Date.now(),
    start: playhead,
    dur: 5,
    label: tpl.name,
    cls: 'cs',
    textContent: tpl.name,
    textType  : tpl.textType,
    font      : tpl.font,
    fontSize  : tpl.fontSize,
    fontWeight: tpl.fontWeight || '400',
    color     : tpl.color,
    shadow    : { ...d.shadow, ...(tpl.shadow || {}) },
    outline   : { ...d.outline, ...(tpl.outline || {}) },
    glow      : { ...d.glow, ...(tpl.glow || {}) },
    animIn    : tpl.animIn || 'fade-in',
    animOut   : tpl.animOut || 'fade-out',
    template  : tpl.id,
  };
  textTrack.clips.push(clip);
  selected.clear();
  selected.add(clip.id);
  saveState();
  renderAll();
  toast('✅ Đã thêm clip từ template: ' + tpl.name);
}

/* ─── Quick add text clip ────────────────────────────────────── */
function ce4_addTextClip(type) {
  const LABELS = { title:'Title', subtitle:'Subtitle', callout:'Callout',
    'lower-third':'Lower Third', quote:'Quote' };
  let textTrack = tracks.find(t => t.type === 'text');
  if (!textTrack) {
    textTrack = { id:'tr'+(nextId++), type:'text', label:'Văn bản', icon:ICONS.text,
      color:'#10b981', locked:false, muted:false, hidden:false, clips:[] };
    tracks.push(textTrack);
  }
  const d = ce4_defaults();
  const clip = {
    id: 'c' + Date.now(), start: playhead, dur: 5,
    label: LABELS[type] || 'Text', cls: 'cs',
    textContent: LABELS[type] || 'Text',
    textType: type || 'title',
    ...d,
    textContent: LABELS[type] || 'Text',
  };
  delete clip.textContent; // will be added back below
  clip.textContent = LABELS[type] || 'Text';
  textTrack.clips.push(clip);
  selected.clear();
  selected.add(clip.id);
  saveState();
  renderAll();
  toast('📝 Đã thêm ' + (LABELS[type] || 'Text'));
}

/* ─── Utility ────────────────────────────────────────────────── */
function ce4_esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Close modal on backdrop click ─────────────────────────── */
document.addEventListener('click', e => {
  const modal = document.getElementById('ce4-tpl-modal');
  if (modal && e.target === modal) ce4_closeTemplates();
});

console.log('[CE-4] Text & Motion Graphics loaded — ' + CE4_TEMPLATES.length + ' templates · 9 animations');
