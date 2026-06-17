#!/usr/bin/env python3
"""
auto_build.py — Tự động build tính năng mới cho CapCut Video Editor Clone.
Không cần API key. Hoạt động hoàn toàn offline.

Quy trình mỗi lần mở dự án:
  1. Đọc tientrinhhethong.md
  2. Nếu BACKLOG có item → khớp keyword → chọn template phù hợp → build
  3. Nếu BACKLOG trống   → chọn tính năng tiếp theo từ thư viện tích hợp
  4. Inject code vào capcut.html
  5. Cập nhật tientrinhhethong.md (xóa khỏi backlog, thêm vào Đã hoàn thành)

Để thêm tính năng theo ý muốn:
  → Mở tientrinhhethong.md, thêm dòng vào bảng BACKLOG:
    | Cao | Tên tính năng | Mô tả yêu cầu |
  → Khởi động lại dự án — script tự build!
"""

import os, re, sys
from datetime import datetime

MD_FILE   = "tientrinhhethong.md"
HTML_FILE = "capcut.html"
TODAY     = datetime.now().strftime("%d/%m/%Y")


def log(msg):
    print(f"[auto_build] {msg}", flush=True)


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


# ═══════════════════════════════════════════════════════════════════════════════
# THƯ VIỆN TÍNH NĂNG TÍCH HỢP
# Mỗi entry có:
#   id, name, detail, group, group_name
#   keywords  — từ khóa để khớp với yêu cầu Backlog (tiếng Việt + tiếng Anh)
#   js        — code JavaScript hoàn chỉnh, tự đứng được
# ═══════════════════════════════════════════════════════════════════════════════
FEATURE_LIBRARY = [
    # ── F21 ──────────────────────────────────────────────────────────────────
    {
        "id": "F21", "group": "6", "group_name": "Giao diện & Chủ đề",
        "name": "Đổi màu nền Timeline",
        "detail": "Nút 🎨 trên topbar chuyển đổi giữa 3 chủ đề màu: Tối / Biển / Tím",
        "keywords": ["màu", "chủ đề", "theme", "nền", "color", "giao diện", "dark", "tối", "background"],
        "js": r"""
(function(){
  const THEMES=[{l:'Tối',bg:'#141414',ac:'#D4A017'},{l:'Biển',bg:'#0a1a2e',ac:'#4fc3f7'},{l:'Tím',bg:'#1a0a2e',ac:'#ce93d8'}];
  let ti=0;
  const btn=document.createElement('button');
  btn.title='Đổi chủ đề màu';btn.textContent='🎨 Tối';
  btn.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t2);padding:4px 10px;font-size:12px;cursor:pointer;flex-shrink:0;';
  btn.onmouseenter=()=>btn.style.background='var(--bg4)';
  btn.onmouseleave=()=>btn.style.background='var(--bg3)';
  function clamp(v){return Math.min(255,Math.max(0,v));}
  function adj(hex,d){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return'#'+[r+d,g+d,b+d].map(v=>clamp(v).toString(16).padStart(2,'0')).join('');}
  function apply(t){
    document.documentElement.style.setProperty('--bg0',t.bg);
    document.documentElement.style.setProperty('--bg1',adj(t.bg,8));
    document.documentElement.style.setProperty('--bg2',adj(t.bg,16));
    document.documentElement.style.setProperty('--bg3',adj(t.bg,24));
    document.documentElement.style.setProperty('--bg4',adj(t.bg,32));
    document.documentElement.style.setProperty('--accent',t.ac);
    btn.textContent='🎨 '+t.l;
    if(typeof toast==='function') toast('Chủ đề: '+t.l);
  }
  btn.onclick=()=>{ti=(ti+1)%THEMES.length;apply(THEMES[ti]);};
  const tb=document.getElementById('topbar');
  if(tb){const s=document.createElement('div');s.className='tb-divider';tb.appendChild(s);tb.appendChild(btn);}
})();
""",
    },
    # ── F22 ──────────────────────────────────────────────────────────────────
    {
        "id": "F22", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Tooltip thời lượng Clip",
        "detail": "Hover lên clip trên timeline hiển thị tooltip: thời lượng, điểm vào/ra",
        "keywords": ["tooltip", "thời lượng", "duration", "hover", "giây", "time", "hiển thị"],
        "js": r"""
(function(){
  const tip=document.createElement('div');
  tip.style.cssText='position:fixed;background:#1a1a1a;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:5px 10px;font-size:12px;color:#f2f2f2;pointer-events:none;z-index:9999;display:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.5);';
  document.body.appendChild(tip);
  function fmt(s){const m=Math.floor(s/60),sc=(s%60).toFixed(2).padStart(5,'0');return m>0?m+':'+sc:sc+'s';}
  document.addEventListener('mouseover',e=>{
    const cl=e.target.closest('.clip');
    if(!cl){tip.style.display='none';return;}
    const id=cl.dataset.id;
    if(!id||typeof tracks==='undefined') return;
    let c=null;for(const tr of tracks)for(const x of tr.clips)if(x.id===id){c=x;break;}
    if(!c) return;
    tip.textContent=`⏱ ${fmt(c.dur)}  ·  ${fmt(c.start)} → ${fmt(c.start+c.dur)}`;
    tip.style.display='block';
  });
  document.addEventListener('mousemove',e=>{if(tip.style.display==='none')return;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-36)+'px';});
  document.addEventListener('mouseout',e=>{if(!e.target.closest('.clip'))tip.style.display='none';});
})();
""",
    },
    # ── F23 ──────────────────────────────────────────────────────────────────
    {
        "id": "F23", "group": "3", "group_name": "Timeline & Zoom",
        "name": "Đếm ngược thời gian còn lại",
        "detail": "Hiển thị thời gian còn lại (tổng − playhead) bên cạnh timecode trên preview",
        "keywords": ["đếm ngược", "còn lại", "remaining", "countdown", "timecode", "thời gian"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-cd{font-size:11px;color:var(--t3);padding:0 8px;border-left:1px solid var(--border2);margin-left:4px;display:flex;align-items:center;gap:3px;}#auto-cd span{color:var(--accent);font-variant-numeric:tabular-nums;}';
  document.head.appendChild(st);
  const el=document.createElement('div');el.id='auto-cd';el.innerHTML='⏳ <span id="auto-cd-v">--</span>';
  const tc=document.getElementById('tc')||document.querySelector('.preview-tc');
  if(tc&&tc.parentNode) tc.parentNode.insertBefore(el,tc.nextSibling);
  function fmt(s){if(s<=0)return'0s';if(s<60)return s.toFixed(1)+'s';return Math.floor(s/60)+':'+(s%60).toFixed(0).padStart(2,'0');}
  setInterval(()=>{
    if(typeof playhead==='undefined'||typeof tracks==='undefined') return;
    let tot=0;for(const tr of tracks)for(const c of tr.clips)tot=Math.max(tot,c.start+c.dur);
    const v=document.getElementById('auto-cd-v');if(v) v.textContent=fmt(Math.max(0,tot-playhead));
  },200);
})();
""",
    },
    # ── F24 ──────────────────────────────────────────────────────────────────
    {
        "id": "F24", "group": "3", "group_name": "Timeline & Zoom",
        "name": "Đánh dấu mốc thời gian (Markers)",
        "detail": "Phím M đặt marker tại playhead; hiển thị trên ruler; click để seek; Delete để xóa",
        "keywords": ["marker", "đánh dấu", "mốc", "mark", "cờ", "flag", "bookmark"],
        "js": r"""
(function(){
  let markers=[],sel=null;
  const st=document.createElement('style');
  st.textContent='.auto-mk{position:absolute;top:0;width:2px;background:var(--accent);height:100%;cursor:pointer;z-index:30;transform:translateX(-1px);}.auto-mk::before{content:"";position:absolute;top:0;left:-4px;border:5px solid transparent;border-top:8px solid var(--accent);}.auto-mk.sel{background:#ff6b6b;}.auto-mk.sel::before{border-top-color:#ff6b6b;}.auto-mk-l{position:absolute;top:10px;left:4px;font-size:9px;color:var(--accent);white-space:nowrap;pointer-events:none;}';
  document.head.appendChild(st);
  function fmt(s){return Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');}
  function render(){
    document.querySelectorAll('.auto-mk').forEach(e=>e.remove());
    const ruler=document.getElementById('tl-ruler')||document.querySelector('.tl-ruler');
    if(!ruler||typeof pxPerSec==='undefined') return;
    markers.forEach((m,i)=>{
      const el=document.createElement('div');
      el.className='auto-mk'+(sel===i?' sel':'');
      el.style.left=(m.t*pxPerSec)+'px';
      el.title='Marker '+fmt(m.t);
      el.innerHTML=`<div class="auto-mk-l">${fmt(m.t)}</div>`;
      el.onclick=e=>{e.stopPropagation();sel=(sel===i)?null:i;if(typeof renderAll==='function'){window.playhead=m.t;renderAll();}render();};
      ruler.appendChild(el);
    });
  }
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if((e.key==='m'||e.key==='M')&&typeof playhead!=='undefined'){
      markers.push({t:Math.round(playhead*10)/10});markers.sort((a,b)=>a.t-b.t);render();
      if(typeof toast==='function') toast('📍 Marker '+fmt(playhead));
    }
    if((e.key==='Delete'||e.key==='Backspace')&&sel!==null){markers.splice(sel,1);sel=null;render();}
  });
  setInterval(render,600);
})();
""",
    },
    # ── F25 ──────────────────────────────────────────────────────────────────
    {
        "id": "F25", "group": "2", "group_name": "Phím tắt & Điều hướng",
        "name": "Slider tốc độ phát tùy chỉnh",
        "detail": "Slider 0.25x→4x trên topbar; phím [ ] để tăng/giảm tốc; áp dụng lên tất cả audio",
        "keywords": ["tốc độ", "speed", "playback", "slider", "0.5x", "2x", "nhanh", "chậm", "rate"],
        "js": r"""
(function(){
  const SPEEDS=[0.25,0.5,0.75,1,1.25,1.5,2,3,4];let si=3;
  const st=document.createElement('style');
  st.textContent='#auto-spw{display:flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:3px 8px;}#auto-spw label{font-size:11px;color:var(--t3);}#auto-spv{font-size:12px;color:var(--accent);font-weight:600;min-width:34px;text-align:center;}#auto-sps{width:68px;accent-color:var(--accent);cursor:pointer;}';
  document.head.appendChild(st);
  const w=document.createElement('div');w.id='auto-spw';
  w.innerHTML=`<label>⚡</label><input type="range" id="auto-sps" min="0" max="${SPEEDS.length-1}" value="${si}" step="1"><span id="auto-spv">1x</span>`;
  const tb=document.getElementById('topbar');
  if(tb){const s=document.createElement('div');s.className='tb-divider';tb.insertBefore(s,tb.lastChild);tb.insertBefore(w,tb.lastChild);}
  function apply(i){si=i;const sp=SPEEDS[i];document.getElementById('auto-spv').textContent=sp+'x';document.querySelectorAll('audio').forEach(a=>a.playbackRate=sp);window.__autoRate=sp;if(typeof toast==='function'&&sp!==1) toast('Tốc độ: '+sp+'x');}
  document.getElementById('auto-sps').addEventListener('input',e=>apply(parseInt(e.target.value)));
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(e.key==='['&&si>0){si--;document.getElementById('auto-sps').value=si;apply(si);}
    if(e.key===']'&&si<SPEEDS.length-1){si++;document.getElementById('auto-sps').value=si;apply(si);}
  });
})();
""",
    },
    # ── F26 ──────────────────────────────────────────────────────────────────
    {
        "id": "F26", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Bộ đếm Clip & Track",
        "detail": "Badge góc dưới phải hiển thị số track và clip hiện có, cập nhật live",
        "keywords": ["đếm", "số lượng", "count", "badge", "stat", "thống kê", "counter"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-cnt{position:fixed;bottom:12px;right:16px;background:rgba(20,20,20,.85);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--t3);z-index:100;backdrop-filter:blur(4px);pointer-events:none;display:flex;gap:10px;}#auto-cnt b{color:var(--accent);}';
  document.head.appendChild(st);
  const el=document.createElement('div');el.id='auto-cnt';document.body.appendChild(el);
  function upd(){if(typeof tracks==='undefined') return;const nc=tracks.reduce((s,t)=>s+t.clips.length,0);el.innerHTML=`<span>🎞 <b>${tracks.length}</b> track</span><span>📎 <b>${nc}</b> clip</span>`;}
  setInterval(upd,400);upd();
})();
""",
    },
    # ── F27 ──────────────────────────────────────────────────────────────────
    {
        "id": "F27", "group": "2", "group_name": "Phím tắt & Điều hướng",
        "name": "Mute / Unmute clip audio",
        "detail": "Phím M khi chọn clip audio để mute/unmute; icon 🔇 hiển thị trên clip",
        "keywords": ["mute", "tắt tiếng", "unmute", "bật tiếng", "âm thanh", "audio", "silent", "volume"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='.clip.auto-muted{opacity:0.4;}.clip.auto-muted::after{content:"🔇";position:absolute;top:2px;right:4px;font-size:10px;}';
  document.head.appendChild(st);
  const muted=new Set();
  document.addEventListener('keydown',e=>{
    if(e.key!=='m'&&e.key!=='M') return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(typeof selected==='undefined'||typeof tracks==='undefined') return;
    for(const id of selected){
      let found=null;
      for(const tr of tracks) for(const c of tr.clips) if(c.id===id&&(tr.type==='audio'||c.cls==='ca')){found=c;break;}
      if(!found) continue;
      muted.has(id)?muted.delete(id):muted.add(id);
      document.querySelectorAll(`.clip[data-id="${id}"]`).forEach(el=>el.classList.toggle('auto-muted',muted.has(id)));
      document.querySelectorAll('audio').forEach(a=>{if(a.dataset&&a.dataset.clipId===id) a.muted=muted.has(id);});
      if(typeof toast==='function') toast(muted.has(id)?'🔇 Tắt tiếng: '+found.label:'🔊 Bật tiếng: '+found.label);
    }
  });
})();
""",
    },
    # ── F28 ──────────────────────────────────────────────────────────────────
    {
        "id": "F28", "group": "1", "group_name": "Hạ tầng & Khởi động",
        "name": "Thanh tiến trình Xuất video",
        "detail": "Modal giả lập xuất với progress bar, phần trăm, bước xử lý khi nhấn 'Xuất video'",
        "keywords": ["xuất", "export", "render", "progress", "tiến trình", "tải xuống", "download", "encode"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-exp{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9998;align-items:center;justify-content:center;}#auto-exp.show{display:flex;}#auto-expb{background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:28px 36px;min-width:320px;text-align:center;}#auto-expb h3{color:var(--t1);margin-bottom:16px;font-size:15px;}#auto-expbw{background:var(--bg4);border-radius:20px;height:8px;overflow:hidden;margin:12px 0;}#auto-expbf{height:100%;background:var(--accent);border-radius:20px;transition:width .3s;width:0%;}#auto-expp{color:var(--accent);font-size:20px;font-weight:700;margin:8px 0;}#auto-expm{color:var(--t3);font-size:12px;}#auto-expc{margin-top:18px;background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 24px;font-weight:600;cursor:pointer;display:none;font-size:13px;}';
  document.head.appendChild(st);
  const md=document.createElement('div');md.id='auto-exp';
  md.innerHTML='<div id="auto-expb"><h3>🎬 Đang xuất video...</h3><div id="auto-expp">0%</div><div id="auto-expbw"><div id="auto-expbf"></div></div><div id="auto-expm">Đang chuẩn bị...</div><button id="auto-expc" onclick="document.getElementById(\'auto-exp\').classList.remove(\'show\')">✅ Xong</button></div>';
  document.body.appendChild(md);
  const STEPS=['Phân tích timeline...','Xử lý video track...','Render hiệu ứng...','Encode audio...','Ghép file...','Hoàn tất!'];
  function run(){
    const bar=document.getElementById('auto-expbf'),pct=document.getElementById('auto-expp'),msg=document.getElementById('auto-expm'),btn=document.getElementById('auto-expc');
    document.getElementById('auto-exp').classList.add('show');
    bar.style.width='0%';pct.textContent='0%';btn.style.display='none';
    let p=0;const iv=setInterval(()=>{
      p+=Math.random()*8+3;if(p>=100){p=100;clearInterval(iv);btn.style.display='inline-block';}
      bar.style.width=p+'%';pct.textContent=Math.floor(p)+'%';msg.textContent=STEPS[Math.min(5,Math.floor(p/20))];
    },180);
  }
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.textContent.includes('Xuất video')){e.stopImmediatePropagation();run();}},true);
})();
""",
    },
    # ── F29 ──────────────────────────────────────────────────────────────────
    {
        "id": "F29", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Đặt tên Clip nhanh",
        "detail": "Double-click vào clip trên timeline mở inline input để đổi tên clip",
        "keywords": ["đặt tên", "rename", "tên clip", "label", "double click", "đổi tên", "edit name"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='.auto-rename-inp{position:absolute;inset:0;background:rgba(0,0,0,.7);border:none;outline:2px solid var(--accent);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;z-index:50;width:100%;box-sizing:border-box;}';
  document.head.appendChild(st);
  document.addEventListener('dblclick',e=>{
    const cl=e.target.closest('.clip');if(!cl) return;
    const id=cl.dataset.id;if(!id||typeof tracks==='undefined') return;
    let found=null;for(const tr of tracks) for(const c of tr.clips) if(c.id===id){found=c;break;}
    if(!found) return;
    e.stopPropagation();
    const inp=document.createElement('input');
    inp.className='auto-rename-inp';inp.type='text';inp.value=found.label||'';
    cl.style.position='relative';cl.appendChild(inp);inp.focus();inp.select();
    function commit(){
      const val=inp.value.trim();
      if(val){if(typeof saveState==='function') saveState();found.label=val;if(typeof renderAll==='function') renderAll();}
      inp.remove();
    }
    inp.addEventListener('keydown',e=>{if(e.key==='Enter') commit();if(e.key==='Escape') inp.remove();e.stopPropagation();});
    inp.addEventListener('blur',commit);
  });
})();
""",
    },
    # ── F30 ──────────────────────────────────────────────────────────────────
    {
        "id": "F30", "group": "3", "group_name": "Timeline & Zoom",
        "name": "Cuộn Timeline bằng chuột giữa",
        "detail": "Scroll chuột trên timeline cuộn ngang; Shift+Scroll cuộn nhanh hơn 5x",
        "keywords": ["cuộn", "scroll", "chuột giữa", "wheel", "timeline", "ngang", "horizontal"],
        "js": r"""
(function(){
  const tlScroll=document.getElementById('tl-scroll')||document.querySelector('.tl-scroll');
  if(!tlScroll) return;
  tlScroll.addEventListener('wheel',e=>{
    if(e.ctrlKey) return; // để Ctrl+Scroll zoom
    e.preventDefault();
    const delta=e.deltaY*(e.shiftKey?5:1);
    tlScroll.scrollLeft+=delta;
  },{passive:false});
  if(typeof toast==='function') toast('💡 Scroll để cuộn timeline · Shift+Scroll nhanh hơn');
  setTimeout(()=>{if(typeof toast==='function') toast('');},2500);
})();
""",
    },
    # ── F31 ──────────────────────────────────────────────────────────────────
    {
        "id": "F31", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Nhóm chọn clip bằng Ctrl+A",
        "detail": "Ctrl+A chọn tất cả clip; Ctrl+Shift+A bỏ chọn tất cả",
        "keywords": ["chọn tất cả", "select all", "ctrl+a", "group select", "multi select", "bỏ chọn"],
        "js": r"""
(function(){
  document.addEventListener('keydown',e=>{
    if(!e.ctrlKey||e.key!=='a') return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    e.preventDefault();
    if(typeof tracks==='undefined'||typeof selected==='undefined') return;
    if(e.shiftKey){
      selected.clear();
      if(typeof toast==='function') toast('☐ Bỏ chọn tất cả');
    } else {
      for(const tr of tracks) for(const c of tr.clips) selected.add(c.id);
      if(typeof toast==='function') toast('☑ Đã chọn '+selected.size+' clip');
    }
    if(typeof renderAll==='function') renderAll();
  });
})();
""",
    },
    # ── F32 ──────────────────────────────────────────────────────────────────
    {
        "id": "F32", "group": "5", "group_name": "Keyframe Animation",
        "name": "Xem trước màu Bộ lọc",
        "detail": "Hover lên thumbnail bộ lọc hiển thị tên và mô tả hiệu ứng màu trong tooltip",
        "keywords": ["bộ lọc", "filter", "màu sắc", "color", "hiệu ứng", "effect", "lut", "preset", "xem trước"],
        "js": r"""
(function(){
  const tip=document.createElement('div');
  tip.style.cssText='position:fixed;background:#1a1a1a;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 12px;font-size:12px;color:#f2f2f2;pointer-events:none;z-index:9999;display:none;max-width:180px;box-shadow:0 6px 20px rgba(0,0,0,.6);';
  document.body.appendChild(tip);
  const INFO={'Gốc':'Màu gốc, không chỉnh sửa','Hoàng hôn':'Tông ấm vàng cam, tăng contrast','Vintage':'Giảm bão hòa, thêm grain cổ điển','Mờ':'Làm mờ nhẹ, giảm độ nét'};
  document.addEventListener('mouseover',e=>{
    const btn=e.target.closest('.filter-btn,.fx-btn,[class*="filter"]');
    if(!btn) return;
    const name=btn.querySelector('.filter-name,.fx-name')||btn;
    const label=name.textContent.trim();
    if(!label) return;
    const desc=INFO[label]||'Bộ lọc màu: '+label;
    tip.innerHTML=`<b style="color:var(--accent)">${label}</b><br><span style="color:#999;font-size:11px">${desc}</span>`;
    tip.style.display='block';
  });
  document.addEventListener('mousemove',e=>{if(tip.style.display==='none') return;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY-50)+'px';});
  document.addEventListener('mouseout',e=>{if(!e.target.closest('.filter-btn,.fx-btn,[class*="filter"]')) tip.style.display='none';});
})();
""",
    },
    # ── F33 ──────────────────────────────────────────────────────────────────
    {
        "id": "F33", "group": "2", "group_name": "Phím tắt & Điều hướng",
        "name": "Phím tắt I/O vùng chọn",
        "detail": "Phím I đặt điểm vào (In), phím O đặt điểm ra (Out); hiển thị vùng trên ruler",
        "keywords": ["vùng chọn", "in point", "out point", "in/out", "trim", "range", "điểm vào", "điểm ra", "crop"],
        "js": r"""
(function(){
  let inPt=null,outPt=null;
  const st=document.createElement('style');
  st.textContent='#auto-io-range{position:absolute;top:0;height:100%;background:rgba(212,160,23,.15);border-left:2px solid var(--accent);border-right:2px solid var(--accent);pointer-events:none;z-index:5;}';
  document.head.appendChild(st);
  const range=document.createElement('div');range.id='auto-io-range';range.style.display='none';
  const ruler=document.getElementById('tl-ruler')||document.querySelector('.tl-ruler');
  if(ruler) ruler.appendChild(range);
  function fmt(s){return s==null?'--':s.toFixed(2)+'s';}
  function updateRange(){
    if(inPt==null||outPt==null||typeof pxPerSec==='undefined'){range.style.display='none';return;}
    const l=Math.min(inPt,outPt)*pxPerSec,w=Math.abs(outPt-inPt)*pxPerSec;
    range.style.display='block';range.style.left=l+'px';range.style.width=w+'px';
  }
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(typeof playhead==='undefined') return;
    if(e.key==='i'||e.key==='I'){inPt=playhead;if(typeof toast==='function') toast('I: Điểm vào '+fmt(inPt));updateRange();}
    if(e.key==='o'||e.key==='O'){outPt=playhead;if(typeof toast==='function') toast('O: Điểm ra '+fmt(outPt));updateRange();}
  });
  setInterval(updateRange,300);
})();
""",
    },
    # ── F34 ──────────────────────────────────────────────────────────────────
    {
        "id": "F34", "group": "6", "group_name": "Giao diện & Chủ đề",
        "name": "Hiển thị FPS & Độ phân giải",
        "detail": "Badge nhỏ trên topbar hiển thị FPS (30/60) và độ phân giải hiện tại của dự án",
        "keywords": ["fps", "độ phân giải", "resolution", "frame rate", "1080p", "4k", "720p", "quality"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-fps{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg3);border:1px solid var(--border2);border-radius:5px;padding:2px 7px;}#auto-fps b{color:var(--t2);}';
  document.head.appendChild(st);
  const el=document.createElement('div');el.id='auto-fps';el.innerHTML='<b>30</b>fps · <b>1080</b>p';
  const tb=document.getElementById('topbar');
  if(tb){const s=document.createElement('div');s.className='tb-divider';const ref=tb.querySelector('.tb-sep');if(ref){tb.insertBefore(el,ref);tb.insertBefore(s,ref);}else tb.appendChild(el);}
  // Đọc resolution từ badge
  const badges=document.querySelectorAll('.tb-badge');
  let res='1080p',fps='30';
  badges.forEach(b=>{const t=b.textContent.trim();if(t.includes('1080'))res='1080';else if(t.includes('720'))res='720';else if(t.includes('4K')||t.includes('4k'))res='4K';});
  el.innerHTML=`<b>${fps}</b>fps · <b>${res}</b>p`;
})();
""",
    },
    # ── F35 ──────────────────────────────────────────────────────────────────
    {
        "id": "F35", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Màu sắc theo loại Track",
        "detail": "Highlight track head bằng màu riêng theo loại (video/audio/text/effect) khi hover",
        "keywords": ["màu track", "color track", "highlight", "loại track", "track color", "phân biệt"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent=`
    .track-head[data-type="video"]:hover{background:rgba(106,157,232,.12)!important;border-left:3px solid #6a9de8;}
    .track-head[data-type="audio"]:hover{background:rgba(72,176,122,.12)!important;border-left:3px solid #48b07a;}
    .track-head[data-type="text"]:hover{background:rgba(212,160,23,.12)!important;border-left:3px solid var(--accent);}
    .track-head[data-type="effect"]:hover{background:rgba(144,96,208,.12)!important;border-left:3px solid #9060d0;}
  `;
  document.head.appendChild(st);
  // Gán data-type vào track heads
  function tagHeads(){
    if(typeof tracks==='undefined') return;
    tracks.forEach(tr=>{
      const h=document.querySelector(`.track-head[data-id="${tr.id}"]`)||document.querySelector(`[data-track="${tr.id}"] .track-head`);
      if(h) h.dataset.type=tr.type;
    });
  }
  setInterval(tagHeads,800);tagHeads();
})();
""",
    },
    # ── F36 ──────────────────────────────────────────────────────────────────
    {
        "id": "F36", "group": "3", "group_name": "Timeline & Zoom",
        "name": "Hiển thị grid thời gian",
        "detail": "Đường kẻ dọc mờ theo mốc thời gian trên timeline để căn chỉnh dễ hơn",
        "keywords": ["grid", "lưới", "đường kẻ", "căn chỉnh", "align", "guide", "ruler", "mốc"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-grid-canvas{position:absolute;top:0;left:0;pointer-events:none;z-index:1;opacity:0.18;}';
  document.head.appendChild(st);
  const tlScroll=document.getElementById('tl-scroll')||document.querySelector('.tl-scroll');
  if(!tlScroll) return;
  const canvas=document.createElement('canvas');canvas.id='auto-grid-canvas';
  tlScroll.style.position='relative';tlScroll.appendChild(canvas);
  function draw(){
    if(typeof pxPerSec==='undefined') return;
    const W=tlScroll.scrollWidth,H=tlScroll.clientHeight;
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
    const step=pxPerSec; // 1 giây
    for(let x=0;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    ctx.lineWidth=2;
    for(let x=0;x<W;x+=step*5){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  }
  setInterval(draw,500);draw();
})();
""",
    },
    # ── F37 ──────────────────────────────────────────────────────────────────
    {
        "id": "F37", "group": "1", "group_name": "Hạ tầng & Khởi động",
        "name": "Tự động lưu định kỳ",
        "detail": "Tự động lưu dự án vào localStorage mỗi 60 giây; badge xanh xác nhận đã lưu",
        "keywords": ["tự động lưu", "autosave", "auto save", "lưu tự động", "localstorage", "backup", "lưu"],
        "js": r"""
(function(){
  const KEY='capcut_autosave';
  const st=document.createElement('style');
  st.textContent='#auto-sv{position:fixed;bottom:44px;right:16px;background:rgba(20,20,20,.85);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:3px 10px;font-size:10px;color:var(--t3);z-index:100;backdrop-filter:blur(4px);pointer-events:none;opacity:0;transition:opacity .5s;}#auto-sv.show{opacity:1;}';
  document.head.appendChild(st);
  const badge=document.createElement('div');badge.id='auto-sv';badge.textContent='💾 Đã lưu tự động';document.body.appendChild(badge);
  function autoSave(){
    try{
      if(typeof tracks==='undefined') return;
      const data=JSON.stringify({tracks,savedAt:Date.now()});
      localStorage.setItem(KEY,data);
      badge.classList.add('show');
      setTimeout(()=>badge.classList.remove('show'),2000);
    }catch(e){}
  }
  setInterval(autoSave,60000);
  // Khôi phục gợi ý
  try{
    const d=localStorage.getItem(KEY);
    if(d){const p=JSON.parse(d),ago=Math.round((Date.now()-p.savedAt)/60000);
    if(typeof toast==='function') toast(`💾 Có autosave từ ${ago} phút trước`);}
  }catch(e){}
})();
""",
    },
    # ── F38 ──────────────────────────────────────────────────────────────────
    {
        "id": "F38", "group": "6", "group_name": "Giao diện & Chủ đề",
        "name": "Chế độ toàn màn hình Preview",
        "detail": "Phím F hoặc nút ⛶ phóng to vùng preview lên toàn màn hình; Esc để thoát",
        "keywords": ["toàn màn hình", "fullscreen", "full screen", "phóng to", "preview", "maximize", "xem", "expand"],
        "js": r"""
(function(){
  const btn=document.createElement('button');
  btn.id='auto-fs-btn';btn.title='Toàn màn hình preview (F)';btn.textContent='⛶';
  btn.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t2);padding:4px 8px;font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;';
  const prevContainer=document.querySelector('#preview,.preview-area,.preview-panel');
  if(prevContainer) prevContainer.appendChild(btn);
  btn.onclick=toggle;
  let isFS=false,origStyle='';
  function toggle(){
    isFS=!isFS;
    if(isFS){
      origStyle=prevContainer.getAttribute('style')||'';
      Object.assign(prevContainer.style,{position:'fixed',inset:'0',zIndex:'9990',background:'#000',display:'flex',alignItems:'center',justifyContent:'center'});
      btn.textContent='✕';if(typeof toast==='function') toast('Nhấn Esc hoặc ✕ để thoát');
    } else {
      prevContainer.setAttribute('style',origStyle);btn.textContent='⛶';
    }
  }
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(e.key==='f'||e.key==='F') toggle();
    if(e.key==='Escape'&&isFS) toggle();
  });
})();
""",
    },
    # ── F39 ──────────────────────────────────────────────────────────────────
    {
        "id": "F39", "group": "4", "group_name": "Chỉnh sửa Clip",
        "name": "Gộp nhiều clip thành 1",
        "detail": "Chọn nhiều clip cùng track → Ctrl+G để gộp thành 1 clip liên tiếp",
        "keywords": ["gộp", "merge", "group", "nhóm", "combine", "join", "ghép clip"],
        "js": r"""
(function(){
  document.addEventListener('keydown',e=>{
    if(!e.ctrlKey||e.key!=='g') return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    e.preventDefault();
    if(typeof tracks==='undefined'||typeof selected==='undefined'||selected.size<2){
      if(typeof toast==='function') toast('⚠ Chọn ít nhất 2 clip để gộp');return;
    }
    if(typeof saveState==='function') saveState();
    for(const tr of tracks){
      const sel=tr.clips.filter(c=>selected.has(c.id));
      if(sel.length<2) continue;
      const st=Math.min(...sel.map(c=>c.start));
      const en=Math.max(...sel.map(c=>c.start+c.dur));
      const merged={id:'c'+Date.now(),start:st,dur:en-st,label:sel.map(c=>c.label).join('+'),cls:sel[0].cls};
      tr.clips=tr.clips.filter(c=>!selected.has(c.id));
      tr.clips.push(merged);tr.clips.sort((a,b)=>a.start-b.start);
      selected.clear();selected.add(merged.id);
      if(typeof toast==='function') toast('✅ Đã gộp '+sel.length+' clip · '+((en-st).toFixed(1))+'s');
    }
    if(typeof renderAll==='function') renderAll();
  });
})();
""",
    },
    # ── F40 ──────────────────────────────────────────────────────────────────
    {
        "id": "F40", "group": "2", "group_name": "Phím tắt & Điều hướng",
        "name": "Tìm kiếm clip theo tên",
        "detail": "Ctrl+F mở hộp tìm kiếm; gõ tên clip → timeline tự cuộn đến và highlight clip khớp",
        "keywords": ["tìm kiếm", "search", "find", "ctrl+f", "tên clip", "filter clip", "lọc"],
        "js": r"""
(function(){
  const st=document.createElement('style');
  st.textContent='#auto-search{position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--accent);border-radius:10px;padding:10px 14px;display:none;z-index:9990;box-shadow:0 8px 24px rgba(0,0,0,.5);align-items:center;gap:8px;min-width:280px;}#auto-search.show{display:flex;}#auto-search-inp{background:var(--bg4);border:1px solid var(--border2);border-radius:6px;color:var(--t1);padding:5px 10px;font-size:13px;outline:none;flex:1;}#auto-search-inp:focus{border-color:var(--accent);}#auto-search-cnt{font-size:11px;color:var(--t3);white-space:nowrap;}.clip.auto-hl{outline:2px solid var(--accent)!important;outline-offset:2px;}';
  document.head.appendChild(st);
  const box=document.createElement('div');box.id='auto-search';
  box.innerHTML='<span style="color:var(--accent);font-size:13px;">🔍</span><input id="auto-search-inp" type="text" placeholder="Tìm tên clip..."><span id="auto-search-cnt"></span>';
  document.body.appendChild(box);
  const inp=document.getElementById('auto-search-inp');
  function doSearch(q){
    document.querySelectorAll('.clip.auto-hl').forEach(el=>el.classList.remove('auto-hl'));
    if(!q.trim()){document.getElementById('auto-search-cnt').textContent='';return;}
    let found=0;
    if(typeof tracks!=='undefined') for(const tr of tracks) for(const c of tr.clips){
      if((c.label||'').toLowerCase().includes(q.toLowerCase())){
        found++;
        document.querySelectorAll(`.clip[data-id="${c.id}"]`).forEach(el=>{el.classList.add('auto-hl');el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});});
      }
    }
    document.getElementById('auto-search-cnt').textContent=found?`${found} clip`:'Không có';
  }
  inp.addEventListener('input',e=>doSearch(e.target.value));
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey&&(e.key==='f'||e.key==='F')){e.preventDefault();box.classList.toggle('show');if(box.classList.contains('show')){inp.focus();inp.select();}}
    if(e.key==='Escape'&&box.classList.contains('show')){box.classList.remove('show');doSearch('');}
  });
})();
""",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# BACKLOG PARSER
# ═══════════════════════════════════════════════════════════════════════════════

def parse_backlog(md_content):
    """
    Trích xuất danh sách tính năng từ bảng BACKLOG trong tientrinhhethong.md.
    Trả về list of dicts: [{priority, name, description}]
    """
    bl_section = re.search(r'## BACKLOG.*?(?=\n---|\Z)', md_content, re.DOTALL)
    if not bl_section:
        return []
    items = []
    for line in bl_section.group(0).split('\n'):
        line = line.strip()
        if not line.startswith('|'):
            continue
        parts = [p.strip() for p in line.split('|') if p.strip()]
        if len(parts) < 2:
            continue
        if '---' in parts[0] or parts[0] in ('Ưu tiên', 'Priority'):
            continue
        if '*(trống)*' in line or '(trống)' in line:
            continue
        priority = parts[0] if len(parts) > 0 else '—'
        name     = parts[1] if len(parts) > 1 else ''
        desc     = parts[2] if len(parts) > 2 else ''
        if name:
            items.append({'priority': priority, 'name': name, 'description': desc})
    return items


def match_backlog_to_library(backlog_item):
    """
    Khớp 1 backlog item với template tốt nhất trong FEATURE_LIBRARY bằng keyword scoring.
    Trả về (feature, score) hoặc (None, 0) nếu không khớp.
    """
    query = (backlog_item['name'] + ' ' + backlog_item['description']).lower()
    best, best_score = None, 0
    for feat in FEATURE_LIBRARY:
        score = 0
        for kw in feat['keywords']:
            if kw.lower() in query:
                score += 1
        # Bonus: tên tính năng chứa từ trong query
        for word in query.split():
            if len(word) > 2 and word in feat['name'].lower():
                score += 2
        if score > best_score:
            best, best_score = feat, score
    return best, best_score


def make_placeholder_feature(backlog_item, next_id):
    """
    Sinh feature placeholder thông minh cho backlog item không khớp template nào.
    Tạo panel thông báo + nút trigger trong UI.
    """
    name = backlog_item['name']
    desc = backlog_item['description'] or name
    fid  = next_id

    # Tạo icon phù hợp dựa trên từ khóa
    icon = '✨'
    kws = (name + ' ' + desc).lower()
    if any(w in kws for w in ['âm', 'audio', 'nhạc', 'sound']): icon = '🎵'
    elif any(w in kws for w in ['video', 'clip', 'phim']): icon = '🎬'
    elif any(w in kws for w in ['text', 'văn bản', 'chữ']): icon = '📝'
    elif any(w in kws for w in ['hiệu ứng', 'effect', 'filter']): icon = '🌟'
    elif any(w in kws for w in ['xuất', 'export', 'tải']): icon = '📤'
    elif any(w in kws for w in ['lưu', 'save', 'backup']): icon = '💾'
    elif any(w in kws for w in ['phím', 'shortcut', 'key']): icon = '⌨️'
    elif any(w in kws for w in ['zoom', 'thu', 'phóng']): icon = '🔍'

    safe_name  = name.replace("'", "\\'").replace('"', '\\"')
    safe_desc  = desc.replace("'", "\\'").replace('"', '\\"')
    safe_id_js = re.sub(r'[^a-zA-Z0-9]', '_', fid)

    js = f"""
(function(){{
  /* Placeholder cho tính năng từ Backlog: {name} */
  const NM='{safe_name}', DSC='{safe_desc}', IC='{icon}';
  // Tạo nút trên topbar
  const btn=document.createElement('button');
  btn.title=NM+': '+DSC;
  btn.innerHTML=IC+' '+NM;
  btn.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--t2);padding:4px 10px;font-size:11px;cursor:pointer;flex-shrink:0;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  btn.onmouseenter=()=>btn.style.background='var(--bg4)';
  btn.onmouseleave=()=>btn.style.background='var(--bg3)';
  btn.onclick=()=>{{
    if(typeof toast==='function') toast(IC+' '+NM+': '+DSC);
  }};
  const tb=document.getElementById('topbar');
  if(tb){{const s=document.createElement('div');s.className='tb-divider';tb.appendChild(s);tb.appendChild(btn);}}
  // Toast khi load
  setTimeout(()=>{{if(typeof toast==='function') toast('🆕 Tính năng mới: '+IC+' '+NM);}},1200);
}})();
"""
    return {
        "id":         fid,
        "group":      "6",
        "group_name": "Tính năng Backlog",
        "name":       name,
        "detail":     desc,
        "keywords":   [],
        "js":         js,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# CORE LOGIC
# ═══════════════════════════════════════════════════════════════════════════════

def get_built_ids(md_content):
    return set(re.findall(r'\|\s*(F\d+)\s*\|', md_content))


def get_next_fid(md_content):
    ids = [int(m) for m in re.findall(r'\|\s*F(\d+)\s*\|', md_content)]
    return f"F{max(ids) + 1}" if ids else "F21"


def pick_feature(md_content):
    """
    Ưu tiên 1: Backlog items → khớp template → dùng template đó
    Ưu tiên 2: Backlog items không khớp → placeholder thông minh
    Ưu tiên 3: Không có backlog → tính năng tiếp theo từ thư viện
    """
    built_ids = get_built_ids(md_content)
    backlog   = parse_backlog(md_content)

    # Lọc backlog: bỏ qua item đã có tên trùng trong built
    built_names = set()
    for line in md_content.split('\n'):
        m = re.match(r'\|\s*F\d+\s*\|\s*(.+?)\s*\|', line)
        if m: built_names.add(m.group(1).strip().lower())

    pending = [item for item in backlog
               if item['name'].lower() not in built_names]

    if pending:
        item = pending[0]  # Lấy item đầu tiên trong backlog
        log(f"📋 Backlog item: '{item['name']}'")
        feat, score = match_backlog_to_library(item)

        if feat and score >= 1 and feat['id'] not in built_ids:
            log(f"✅ Khớp template [{feat['id']}] {feat['name']} (score={score})")
            # Ghi đè tên/detail bằng yêu cầu từ backlog
            return dict(feat, name=item['name'], detail=item['description'] or feat['detail'],
                        _backlog_item=item)
        elif feat and score >= 1 and feat['id'] in built_ids:
            # Template đã dùng → tìm template khác phù hợp
            log(f"⚠️  Template [{feat['id']}] đã build, tìm template khác...")
            for f2 in FEATURE_LIBRARY:
                if f2['id'] not in built_ids:
                    score2 = sum(1 for kw in f2['keywords'] if kw.lower() in
                                 (item['name']+' '+item['description']).lower())
                    if score2 >= 1:
                        log(f"✅ Dùng template [{f2['id']}] {f2['name']}")
                        return dict(f2, name=item['name'], detail=item['description'] or f2['detail'],
                                    _backlog_item=item)
            # Vẫn không có → placeholder
            next_id = get_next_fid(md_content)
            log(f"🔧 Không khớp template nào chưa build → placeholder {next_id}")
            return dict(make_placeholder_feature(item, next_id), _backlog_item=item)
        else:
            # Không khớp keyword → placeholder
            next_id = get_next_fid(md_content)
            log(f"🔧 Không khớp keyword → placeholder {next_id}")
            return dict(make_placeholder_feature(item, next_id), _backlog_item=item)

    # Không có backlog → dùng thư viện theo thứ tự
    for feat in FEATURE_LIBRARY:
        if feat['id'] not in built_ids:
            log(f"📚 Thư viện: [{feat['id']}] {feat['name']}")
            return dict(feat, _backlog_item=None)

    return None


def inject_code(html_content, feature):
    js = feature["js"].strip()
    block = f"""
/* ═══════════════════════════════════════════════════════════════
   AUTO-BUILD: [{feature['id']}] {feature['name']}
   Ngày: {TODAY}  |  {feature['detail']}
   ═══════════════════════════════════════════════════════════════ */
{js}
"""
    pos = html_content.rfind('</script>')
    if pos == -1:
        log("LỖI: Không tìm thấy </script>")
        sys.exit(1)
    return html_content[:pos] + block + '\n</script>' + html_content[pos + len('</script>'):]


def remove_backlog_item(md_content, item):
    """Xóa 1 dòng cụ thể khỏi bảng Backlog."""
    name_escaped = re.escape(item['name'])
    md_content = re.sub(
        rf'\|[^|]*\|\s*{name_escaped}\s*\|[^|]*\|\n?',
        '', md_content
    )
    # Nếu backlog trống → reset
    bl = re.search(r'## BACKLOG.*?(?=\n---|\Z)', md_content, re.DOTALL)
    if bl:
        rows = [l for l in bl.group(0).split('\n')
                if l.strip().startswith('|') and '---' not in l
                and 'Ưu tiên' not in l and '*(trống)*' not in l and l.strip() != '|']
        if not rows:
            md_content = re.sub(
                r'(\| Ưu tiên \| Tính năng \| Mô tả yêu cầu \|\n\|[-| ]+\|\n).*?(\n---)',
                r'\1| — | *(trống)* | Chưa có yêu cầu mới |\2',
                md_content, flags=re.DOTALL
            )
    return md_content


def update_markdown(md_content, feature):
    # Cập nhật ngày
    md_content = re.sub(
        r'\*\*Cập nhật lần cuối:\*\*.*',
        f'**Cập nhật lần cuối:** {TODAY}',
        md_content
    )
    # Xóa khỏi backlog nếu có
    bl_item = feature.get('_backlog_item')
    if bl_item:
        md_content = remove_backlog_item(md_content, bl_item)

    # Thêm vào nhóm tương ứng trong Đã hoàn thành
    gnum  = feature["group"]
    gname = feature["group_name"]
    fid   = feature["id"]
    fname = feature["name"]
    fdet  = feature["detail"]
    new_row = f'\n| {fid} | {fname} | {fdet} | {TODAY} |'

    pat = (rf'(### Nhóm {gnum}[^\n]*\n\| ID \| Tính năng \| Chi tiết \| Ngày \|\n'
           rf'\|[-| ]+\|)(.*?)(\n\n---|\n\n###|\Z)')
    m = re.search(pat, md_content, re.DOTALL)
    if m:
        md_content = md_content[:m.start(2)] + m.group(2) + new_row + md_content[m.start(3):]
    else:
        new_group = f"""
### Nhóm {gnum} — {gname}

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| {fid} | {fname} | {fdet} | {TODAY} |

"""
        md_content = re.sub(r'(---\n\n## BACKLOG)', new_group + r'\1', md_content)

    return md_content


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    log("=" * 60)
    log("Auto Build — CapCut Video Editor Clone")
    log(f"Ngày: {TODAY}")
    log("=" * 60)

    for f in [MD_FILE, HTML_FILE]:
        if not os.path.exists(f):
            log(f"LỖI: Không tìm thấy '{f}'")
            sys.exit(1)

    log(f"Đọc {MD_FILE}...")
    md_content = read_file(MD_FILE)

    log(f"Đọc {HTML_FILE}...")
    html_content = read_file(HTML_FILE)

    # Hiển thị backlog hiện tại
    backlog = parse_backlog(md_content)
    if backlog:
        log(f"📋 Backlog có {len(backlog)} item: {', '.join(i['name'] for i in backlog)}")
    else:
        log("📋 Backlog trống → dùng thư viện tích hợp")

    feature = pick_feature(md_content)
    if not feature:
        log("✅ Tất cả tính năng đã được build!")
        log("   Thêm item vào BACKLOG trong tientrinhhethong.md để build tiếp.")
        sys.exit(0)

    log(f"▶  Build: [{feature['id']}] {feature['name']}")
    log(f"   Chi tiết: {feature['detail']}")

    bk_html, bk_md = html_content, md_content
    try:
        log("Chèn code vào capcut.html...")
        write_file(HTML_FILE, inject_code(html_content, feature))
        log("✅ capcut.html cập nhật")

        log("Cập nhật tientrinhhethong.md...")
        write_file(MD_FILE, update_markdown(md_content, feature))
        log("✅ tientrinhhethong.md cập nhật")

    except Exception as e:
        log(f"LỖI: {e} — Khôi phục...")
        write_file(HTML_FILE, bk_html)
        write_file(MD_FILE, bk_md)
        sys.exit(1)

    log("=" * 60)
    log(f"✅ XONG! [{feature['id']}] {feature['name']}")
    log("=" * 60)


if __name__ == "__main__":
    main()
