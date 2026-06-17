#!/usr/bin/env python3
"""
auto_build.py — Tự động build tính năng mới cho CapCut Video Editor Clone.
Không cần API key — dùng thư viện tính năng tích hợp sẵn.

Quy trình mỗi lần mở dự án:
  1. Đọc tientrinhhethong.md → xác định F-ID lớn nhất đã build
  2. Chọn tính năng tiếp theo từ FEATURE_LIBRARY (chưa build)
  3. Inject JS/CSS vào capcut.html
  4. Cập nhật tientrinhhethong.md
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


# ═══════════════════════════════════════════════════════════════
# THƯ VIỆN TÍNH NĂNG — mỗi entry là 1 tính năng hoàn chỉnh
# ═══════════════════════════════════════════════════════════════
FEATURE_LIBRARY = [
    {
        "id": "F21",
        "name": "Đổi màu nền Timeline",
        "detail": "Nút chuyển đổi màu nền timeline giữa 3 chủ đề: Tối (mặc định), Xanh đậm, Tím",
        "group": "6",
        "group_name": "Giao diện & Chủ đề",
        "js": r"""
(function(){
  /* F21 — Đổi màu nền Timeline */
  const THEMES = [
    {label:'Tối',   bg:'#141414', accent:'#D4A017'},
    {label:'Biển',  bg:'#0a1a2e', accent:'#4fc3f7'},
    {label:'Tím',   bg:'#1a0a2e', accent:'#ce93d8'},
  ];
  let themeIdx = 0;

  const btn = document.createElement('button');
  btn.id = 'auto-theme-btn';
  btn.title = 'Đổi chủ đề màu';
  btn.textContent = '🎨';
  btn.style.cssText = `
    background:var(--bg3);border:1px solid var(--border2);border-radius:6px;
    color:var(--t2);padding:4px 9px;font-size:13px;cursor:pointer;
    display:flex;align-items:center;gap:4px;flex-shrink:0;
  `;
  btn.onmouseenter = () => btn.style.background = 'var(--bg4)';
  btn.onmouseleave = () => btn.style.background = 'var(--bg3)';

  function applyTheme(t) {
    document.documentElement.style.setProperty('--bg0', t.bg);
    document.documentElement.style.setProperty('--bg1', adjustColor(t.bg, 8));
    document.documentElement.style.setProperty('--bg2', adjustColor(t.bg, 16));
    document.documentElement.style.setProperty('--bg3', adjustColor(t.bg, 24));
    document.documentElement.style.setProperty('--accent', t.accent);
    btn.textContent = '🎨 ' + t.label;
    if(typeof toast === 'function') toast('Chủ đề: ' + t.label);
  }

  function adjustColor(hex, delta) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const clamp = v => Math.min(255, Math.max(0, v));
    return '#' + [r+delta, g+delta, b+delta].map(v => clamp(v).toString(16).padStart(2,'0')).join('');
  }

  btn.onclick = () => {
    themeIdx = (themeIdx + 1) % THEMES.length;
    applyTheme(THEMES[themeIdx]);
  };

  // Chèn vào topbar sau nút Chia sẻ
  const topbar = document.getElementById('topbar');
  if(topbar) {
    const sep = document.createElement('div');
    sep.className = 'tb-divider';
    topbar.appendChild(sep);
    topbar.appendChild(btn);
  }
})();
""",
    },
    {
        "id": "F22",
        "name": "Hiển thị thời lượng Clip",
        "detail": "Tooltip hiển thị thời lượng chính xác (giây) khi hover lên clip trên timeline",
        "group": "4",
        "group_name": "Chỉnh sửa Clip",
        "js": r"""
(function(){
  /* F22 — Tooltip thời lượng clip */
  const tip = document.createElement('div');
  tip.id = 'auto-dur-tip';
  tip.style.cssText = `
    position:fixed;background:#1a1a1a;border:1px solid rgba(255,255,255,.18);
    border-radius:6px;padding:5px 10px;font-size:12px;color:#f2f2f2;
    pointer-events:none;z-index:9999;display:none;white-space:nowrap;
    box-shadow:0 4px 12px rgba(0,0,0,.5);
  `;
  document.body.appendChild(tip);

  function fmtTime(s) {
    const m = Math.floor(s/60), sec = (s%60).toFixed(2).padStart(5,'0');
    return m > 0 ? `${m}:${sec}` : `${sec}s`;
  }

  document.addEventListener('mouseover', e => {
    const cl = e.target.closest('.clip');
    if(!cl) { tip.style.display='none'; return; }
    const clipId = cl.dataset.id;
    if(!clipId || typeof tracks === 'undefined') return;
    let found = null;
    for(const tr of tracks) for(const c of tr.clips) if(c.id === clipId) { found = c; break; }
    if(!found) return;
    tip.textContent = `⏱ ${fmtTime(found.dur)}  ·  ${fmtTime(found.start)} → ${fmtTime(found.start+found.dur)}`;
    tip.style.display = 'block';
  });

  document.addEventListener('mousemove', e => {
    if(tip.style.display === 'none') return;
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 36) + 'px';
  });

  document.addEventListener('mouseout', e => {
    if(!e.target.closest('.clip')) tip.style.display = 'none';
  });
})();
""",
    },
    {
        "id": "F23",
        "name": "Đếm ngược thời gian còn lại",
        "detail": "Hiển thị thời gian còn lại của dự án (tổng - playhead) ngay cạnh timecode trên preview",
        "group": "3",
        "group_name": "Timeline & Zoom",
        "js": r"""
(function(){
  /* F23 — Đếm ngược thời gian còn lại */
  const style = document.createElement('style');
  style.textContent = `
    #auto-countdown {
      font-size:11px;color:var(--t3);padding:0 8px;
      border-left:1px solid var(--border2);margin-left:4px;
      display:flex;align-items:center;gap:3px;
    }
    #auto-countdown span { color:var(--accent); font-variant-numeric:tabular-nums; }
  `;
  document.head.appendChild(style);

  const cdEl = document.createElement('div');
  cdEl.id = 'auto-countdown';
  cdEl.innerHTML = '⏳ còn <span id="auto-cd-val">--</span>';

  const tcEl = document.getElementById('tc') || document.querySelector('.preview-tc');
  if(tcEl && tcEl.parentNode) tcEl.parentNode.insertBefore(cdEl, tcEl.nextSibling);

  function fmtRemain(s) {
    if(s <= 0) return '0s';
    if(s < 60) return s.toFixed(1) + 's';
    return Math.floor(s/60) + ':' + (s%60).toFixed(0).padStart(2,'0');
  }

  function updateCountdown() {
    if(typeof playhead === 'undefined' || typeof tracks === 'undefined') return;
    let totalDur = 0;
    for(const tr of tracks) for(const c of tr.clips) totalDur = Math.max(totalDur, c.start + c.dur);
    const remain = Math.max(0, totalDur - playhead);
    const el = document.getElementById('auto-cd-val');
    if(el) el.textContent = fmtRemain(remain);
  }

  setInterval(updateCountdown, 200);
})();
""",
    },
    {
        "id": "F24",
        "name": "Đánh dấu mốc thời gian (Markers)",
        "detail": "Nhấn M để đặt marker tại playhead; marker hiển thị trên ruler timeline; click marker để seek; Delete khi chọn để xóa",
        "group": "3",
        "group_name": "Timeline & Zoom",
        "js": r"""
(function(){
  /* F24 — Timeline Markers */
  let markers = [];
  let selMarker = null;

  const style = document.createElement('style');
  style.textContent = `
    .auto-marker {
      position:absolute;top:0;width:2px;background:var(--accent);
      height:100%;cursor:pointer;z-index:30;transform:translateX(-1px);
    }
    .auto-marker::before {
      content:'';position:absolute;top:0;left:-4px;
      border:5px solid transparent;border-top:8px solid var(--accent);
    }
    .auto-marker.sel { background:#ff6b6b; }
    .auto-marker.sel::before { border-top-color:#ff6b6b; }
    .auto-marker-label {
      position:absolute;top:10px;left:4px;font-size:9px;
      color:var(--accent);white-space:nowrap;pointer-events:none;
    }
  `;
  document.head.appendChild(style);

  function fmtT(s) {
    return Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');
  }

  function renderMarkers() {
    document.querySelectorAll('.auto-marker').forEach(el => el.remove());
    const ruler = document.getElementById('tl-ruler') || document.querySelector('.tl-ruler');
    if(!ruler || typeof pxPerSec === 'undefined') return;
    markers.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'auto-marker' + (selMarker===i?' sel':'');
      el.style.left = (m.t * pxPerSec) + 'px';
      el.title = 'Marker: ' + fmtT(m.t);
      el.innerHTML = `<div class="auto-marker-label">${fmtT(m.t)}</div>`;
      el.onclick = e => {
        e.stopPropagation();
        selMarker = (selMarker === i) ? null : i;
        if(typeof playhead !== 'undefined') {
          window.playhead = m.t;
          if(typeof renderAll==='function') renderAll();
        }
        renderMarkers();
      };
      ruler.appendChild(el);
    });
  }

  document.addEventListener('keydown', e => {
    if(e.key === 'm' || e.key === 'M') {
      if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if(typeof playhead === 'undefined') return;
      markers.push({t: Math.round(playhead*10)/10});
      markers.sort((a,b) => a.t - b.t);
      renderMarkers();
      if(typeof toast==='function') toast('📍 Marker tại ' + fmtT(playhead));
    }
    if((e.key==='Delete'||e.key==='Backspace') && selMarker !== null) {
      markers.splice(selMarker, 1);
      selMarker = null;
      renderMarkers();
    }
  });

  setInterval(renderMarkers, 500);
})();
""",
    },
    {
        "id": "F25",
        "name": "Tốc độ phát tùy chỉnh",
        "detail": "Slider chọn tốc độ phát 0.25x → 4x hiển thị trực tiếp trên topbar; cập nhật tất cả audio element khi phát",
        "group": "2",
        "group_name": "Phím tắt & Điều hướng",
        "js": r"""
(function(){
  /* F25 — Tốc độ phát tùy chỉnh trên topbar */
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  let speedIdx = 3; // 1x

  const style = document.createElement('style');
  style.textContent = `
    #auto-speed-wrap {
      display:flex;align-items:center;gap:6px;
      background:var(--bg3);border:1px solid var(--border2);
      border-radius:6px;padding:3px 8px;
    }
    #auto-speed-wrap label { font-size:11px;color:var(--t3); }
    #auto-speed-val { font-size:12px;color:var(--accent);font-weight:600;min-width:32px;text-align:center; }
    #auto-speed-slider { width:72px;accent-color:var(--accent);cursor:pointer; }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'auto-speed-wrap';
  wrap.innerHTML = `
    <label>⚡</label>
    <input type="range" id="auto-speed-slider" min="0" max="${SPEEDS.length-1}" value="${speedIdx}" step="1">
    <span id="auto-speed-val">1x</span>
  `;

  const topbar = document.getElementById('topbar');
  if(topbar) {
    const sep = document.createElement('div');
    sep.className = 'tb-divider';
    topbar.insertBefore(sep, topbar.lastChild);
    topbar.insertBefore(wrap, topbar.lastChild);
  }

  function applySpeed(idx) {
    speedIdx = idx;
    const sp = SPEEDS[idx];
    document.getElementById('auto-speed-val').textContent = sp + 'x';
    // Áp dụng cho tất cả audio element đang phát
    document.querySelectorAll('audio').forEach(a => { a.playbackRate = sp; });
    window.__autoPlaybackRate = sp;
    if(typeof toast==='function' && sp!==1) toast('Tốc độ: ' + sp + 'x');
  }

  document.getElementById('auto-speed-slider').addEventListener('input', e => {
    applySpeed(parseInt(e.target.value));
  });

  // Phím tắt [ và ] để giảm/tăng tốc độ
  document.addEventListener('keydown', e => {
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(e.key==='[' && speedIdx>0) { speedIdx--; document.getElementById('auto-speed-slider').value=speedIdx; applySpeed(speedIdx); }
    if(e.key===']' && speedIdx<SPEEDS.length-1) { speedIdx++; document.getElementById('auto-speed-slider').value=speedIdx; applySpeed(speedIdx); }
  });
})();
""",
    },
    {
        "id": "F26",
        "name": "Bộ đếm clip & track",
        "detail": "Hiển thị số lượng clip và track hiện có ở góc dưới phải timeline, cập nhật live",
        "group": "4",
        "group_name": "Chỉnh sửa Clip",
        "js": r"""
(function(){
  /* F26 — Bộ đếm clip & track */
  const style = document.createElement('style');
  style.textContent = `
    #auto-counter {
      position:fixed;bottom:12px;right:16px;
      background:rgba(20,20,20,.85);border:1px solid rgba(255,255,255,.1);
      border-radius:20px;padding:4px 12px;font-size:11px;color:var(--t3);
      z-index:100;backdrop-filter:blur(4px);pointer-events:none;
      display:flex;gap:10px;
    }
    #auto-counter b { color:var(--accent); }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'auto-counter';
  document.body.appendChild(el);

  function update() {
    if(typeof tracks === 'undefined') return;
    const nTracks = tracks.length;
    const nClips  = tracks.reduce((s,t) => s + t.clips.length, 0);
    el.innerHTML = `<span>🎞 <b>${nTracks}</b> track</span><span>📎 <b>${nClips}</b> clip</span>`;
  }

  setInterval(update, 400);
  update();
})();
""",
    },
    {
        "id": "F27",
        "name": "Phím tắt mute/unmute clip audio",
        "detail": "Nhấn M khi đang chọn clip audio để mute/unmute, icon hiển thị trên clip, volume 0 khi mute",
        "group": "2",
        "group_name": "Phím tắt & Điều hướng",
        "js": r"""
(function(){
  /* F27 — Mute / Unmute clip audio bằng phím M */
  const style = document.createElement('style');
  style.textContent = `
    .clip.auto-muted { opacity:0.45; }
    .clip.auto-muted::after {
      content:'🔇';position:absolute;top:2px;right:4px;font-size:10px;
    }
  `;
  document.head.appendChild(style);

  const mutedSet = new Set();

  document.addEventListener('keydown', e => {
    if(e.key!=='m' && e.key!=='M') return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(typeof selected==='undefined'||typeof tracks==='undefined') return;

    // Chỉ áp dụng cho clip audio đang chọn
    for(const id of selected) {
      let found = null;
      for(const tr of tracks) for(const c of tr.clips) if(c.id===id && (tr.type==='audio'||c.cls==='ca')) found=c;
      if(!found) continue;

      if(mutedSet.has(id)) {
        mutedSet.delete(id);
        if(typeof toast==='function') toast('🔊 Bật tiếng: ' + found.label);
      } else {
        mutedSet.add(id);
        if(typeof toast==='function') toast('🔇 Tắt tiếng: ' + found.label);
      }
      // Cập nhật visual
      document.querySelectorAll(`.clip[data-id="${id}"]`).forEach(el => {
        el.classList.toggle('auto-muted', mutedSet.has(id));
      });
      // Mute audio element
      document.querySelectorAll('audio').forEach(a => {
        if(a.dataset && a.dataset.clipId === id) a.muted = mutedSet.has(id);
      });
    }
  });
})();
""",
    },
    {
        "id": "F28",
        "name": "Thanh tiến trình Export",
        "detail": "Khi nhấn Xuất video, hiển thị thanh tiến trình giả lập với phần trăm và thông báo hoàn thành",
        "group": "1",
        "group_name": "Hạ tầng & Khởi động",
        "js": r"""
(function(){
  /* F28 — Thanh tiến trình Export giả lập */
  const style = document.createElement('style');
  style.textContent = `
    #auto-export-modal {
      display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);
      z-index:9998;align-items:center;justify-content:center;
    }
    #auto-export-modal.show { display:flex; }
    #auto-export-box {
      background:var(--bg2);border:1px solid var(--border2);border-radius:12px;
      padding:28px 36px;min-width:320px;text-align:center;
    }
    #auto-export-box h3 { color:var(--t1);margin-bottom:16px;font-size:15px; }
    #auto-export-bar-wrap {
      background:var(--bg4);border-radius:20px;height:8px;overflow:hidden;margin:12px 0;
    }
    #auto-export-bar {
      height:100%;background:var(--accent);border-radius:20px;
      transition:width .3s ease;width:0%;
    }
    #auto-export-pct { color:var(--accent);font-size:20px;font-weight:700;margin:8px 0; }
    #auto-export-msg { color:var(--t3);font-size:12px; }
    #auto-export-close {
      margin-top:18px;background:var(--accent);color:#000;border:none;
      border-radius:8px;padding:8px 24px;font-weight:600;cursor:pointer;
      display:none;font-size:13px;
    }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'auto-export-modal';
  modal.innerHTML = `
    <div id="auto-export-box">
      <h3>🎬 Đang xuất video...</h3>
      <div id="auto-export-pct">0%</div>
      <div id="auto-export-bar-wrap"><div id="auto-export-bar"></div></div>
      <div id="auto-export-msg">Đang chuẩn bị...</div>
      <button id="auto-export-close" onclick="document.getElementById('auto-export-modal').classList.remove('show')">✅ Hoàn thành</button>
    </div>
  `;
  document.body.appendChild(modal);

  const STEPS = [
    'Đang phân tích timeline...',
    'Xử lý video track...',
    'Render hiệu ứng...',
    'Encode audio...',
    'Ghép file...',
    'Hoàn tất!'
  ];

  function runExport() {
    const m = document.getElementById('auto-export-modal');
    const bar = document.getElementById('auto-export-bar');
    const pct = document.getElementById('auto-export-pct');
    const msg = document.getElementById('auto-export-msg');
    const closeBtn = document.getElementById('auto-export-close');
    m.classList.add('show');
    bar.style.width = '0%';
    pct.textContent = '0%';
    closeBtn.style.display = 'none';
    let progress = 0;
    let stepIdx = 0;
    const iv = setInterval(() => {
      progress += Math.random() * 8 + 3;
      if(progress >= 100) { progress = 100; clearInterval(iv); closeBtn.style.display='inline-block'; }
      bar.style.width = progress + '%';
      pct.textContent = Math.floor(progress) + '%';
      stepIdx = Math.min(STEPS.length-1, Math.floor(progress/20));
      msg.textContent = STEPS[stepIdx];
    }, 180);
  }

  // Hook nút Xuất video
  function hookExportBtn() {
    document.querySelectorAll('button').forEach(btn => {
      if(btn.textContent.includes('Xuất video') && !btn.dataset.autoHooked) {
        btn.dataset.autoHooked = '1';
        btn.addEventListener('click', e => { e.stopImmediatePropagation(); runExport(); }, true);
      }
    });
  }
  setTimeout(hookExportBtn, 800);
  document.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if(btn && btn.textContent.includes('Xuất video')) { e.stopImmediatePropagation(); runExport(); }
  }, true);
})();
""",
    },
]


def get_built_ids(md_content):
    """Trả về set các F-ID đã build trong tientrinhhethong.md."""
    return set(re.findall(r'\|\s*(F\d+)\s*\|', md_content))


def pick_next_feature(md_content):
    """Chọn tính năng tiếp theo chưa có trong MD."""
    built = get_built_ids(md_content)
    for feat in FEATURE_LIBRARY:
        if feat["id"] not in built:
            return feat
    return None


def inject_code(html_content, feature):
    js = feature["js"].strip()
    block = f"""
/* ═══════════════════════════════════════════════════════════════
   AUTO-BUILD: [{feature['id']}] {feature['name']}
   Ngày: {TODAY} | {feature['detail']}
   ═══════════════════════════════════════════════════════════════ */
{js}
"""
    pos = html_content.rfind('</script>')
    if pos == -1:
        log("LỖI: Không tìm thấy </script>")
        sys.exit(1)
    return html_content[:pos] + block + '\n</script>' + html_content[pos+len('</script>'):]


def update_markdown(md_content, feature):
    # Ngày
    md_content = re.sub(
        r'\*\*Cập nhật lần cuối:\*\*.*',
        f'**Cập nhật lần cuối:** {TODAY}',
        md_content
    )

    gnum = feature["group"]
    gname = feature["group_name"]
    fid = feature["id"]
    fname = feature["name"]
    fdetail = feature["detail"]
    new_row = f'\n| {fid} | {fname} | {fdetail} | {TODAY} |'

    # Thử thêm vào nhóm đã có
    pat = (rf'(### Nhóm {gnum}[^\n]*\n\| ID \| Tính năng \| Chi tiết \| Ngày \|\n'
           rf'\|[-| ]+\|)(.*?)(\n\n---|\n\n###|\Z)')
    m = re.search(pat, md_content, re.DOTALL)
    if m:
        md_content = md_content[:m.start(2)] + m.group(2) + new_row + md_content[m.start(3):]
    else:
        # Tạo nhóm mới trước BACKLOG
        new_group = f"""
### Nhóm {gnum} — {gname}

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| {fid} | {fname} | {fdetail} | {TODAY} |

"""
        md_content = re.sub(r'(---\n\n## BACKLOG)', new_group + r'\1', md_content)

    return md_content


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

    feature = pick_next_feature(md_content)
    if not feature:
        log("✅ Tất cả tính năng trong thư viện đã được build!")
        log("   Thêm tính năng mới vào FEATURE_LIBRARY trong auto_build.py để tiếp tục.")
        sys.exit(0)

    log(f"Tính năng tiếp theo: [{feature['id']}] {feature['name']}")
    log(f"Chi tiết: {feature['detail']}")

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
