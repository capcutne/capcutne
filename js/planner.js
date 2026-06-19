/* ============================================================
   NATURAL LANGUAGE VIDEO EDITING — js/planner.js
   Phase 5.4: User Request → Intent → Task Plan → Preview → Execute

   Architecture:
     User Natural Language Request
       ↓
     Intent Analysis  (/ai/plan-task)
       ↓
     Task Planning  (multi-step)
       ↓
     Preview Panel  (user confirms)
       ↓
     Action Engine  (executeActions)
       ↓
     Timeline / Editor

   Public API:
     TaskPlanner.open()
     TaskPlanner.close()
     TaskPlanner.submit(text)
     TaskPlanner.getHistory()
     TaskPlanner.clearHistory()
   ============================================================ */

(function () {

/* ══════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════ */

const LS_HISTORY    = 'cc_planner_history';
const LS_MEMORY     = 'cc_planner_memory';
const MAX_HISTORY   = 30;

const INTENTS = {
  EDIT_VIDEO:         'EDIT_VIDEO',
  CREATE_SHORTS:      'CREATE_SHORTS',
  GENERATE_SUBTITLE:  'GENERATE_SUBTITLE',
  EXPORT:             'EXPORT',
  ANALYZE:            'ANALYZE',
  PUBLISH_PREP:       'PUBLISH_PREP',
};

const INTENT_LABELS = {
  EDIT_VIDEO:         '✂️ Chỉnh sửa video',
  CREATE_SHORTS:      '⚡ Tạo Shorts',
  GENERATE_SUBTITLE:  '💬 Tạo phụ đề',
  EXPORT:             '📦 Xuất video',
  ANALYZE:            '📊 Phân tích',
  PUBLISH_PREP:       '🚀 Chuẩn bị đăng',
};

const SAFE_INTENTS = new Set([INTENTS.EDIT_VIDEO, INTENTS.GENERATE_SUBTITLE, INTENTS.ANALYZE]);

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */

let _open          = false;
let _pending       = null;   // { request, plan } waiting for user confirm
let _executing     = false;
let _history       = _loadHistory();
let _convMemory    = _loadMemory();  // conversation memory within session

/* ══════════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════════ */

const _style = document.createElement('style');
_style.textContent = `
/* ── Planner Toggle Button ────────────────────────── */
#planner-toggle {
  display:flex;align-items:center;gap:5px;
  background:linear-gradient(135deg,#0f2a1a,#1a4030);
  border:1px solid rgba(60,200,100,.35);
  border-radius:7px;color:#50c878;
  padding:0 12px;height:34px;font-size:12px;
  cursor:pointer;white-space:nowrap;flex-shrink:0;
  transition:background .15s,border-color .15s;
}
#planner-toggle:hover{background:linear-gradient(135deg,#153520,#2a5040);border-color:rgba(80,200,120,.6);color:#70e090}
#planner-toggle.on{background:linear-gradient(135deg,#1a4028,#286040);border-color:rgba(80,220,120,.8);color:#80f0a0}

/* ── Panel container ──────────────────────────────── */
#planner-panel {
  position:fixed;right:0;top:0;bottom:0;
  width:0;overflow:hidden;
  background:var(--bg1,#141414);
  border-left:1px solid var(--border,#222);
  display:flex;flex-direction:column;
  transition:width .22s cubic-bezier(.4,0,.2,1);
  z-index:500;
}
#planner-panel.open { width:340px; }

/* ── Header ──────────────────────────────────────── */
.planner-header {
  height:44px;display:flex;align-items:center;padding:0 14px;
  border-bottom:1px solid var(--border,#222);flex-shrink:0;gap:8px;
}
.planner-header-icon { font-size:16px; }
.planner-header-title {
  font-size:11px;font-weight:700;letter-spacing:.6px;
  text-transform:uppercase;color:#50c878;flex:1;
}
.planner-close {
  background:none;border:none;color:var(--t3,#666);cursor:pointer;
  width:24px;height:24px;display:flex;align-items:center;justify-content:center;
  border-radius:5px;font-size:15px;
}
.planner-close:hover{background:var(--bg3,#222);color:var(--t1,#eee)}

/* ── Body ────────────────────────────────────────── */
.planner-body {
  flex:1;overflow-y:auto;display:flex;flex-direction:column;
  padding:12px;gap:10px;min-height:0;
}
.planner-body::-webkit-scrollbar{width:4px}
.planner-body::-webkit-scrollbar-thumb{background:var(--bg4,#333);border-radius:2px}

/* ── Context badge ───────────────────────────────── */
.planner-ctx {
  background:var(--bg2,#1a1a1a);border:1px solid var(--border2,#2a2a2a);
  border-radius:7px;padding:8px 10px;font-size:10px;color:var(--t3,#666);
  display:flex;flex-wrap:wrap;gap:5px;
}
.planner-ctx-badge {
  background:var(--bg3,#222);border-radius:4px;padding:2px 7px;
  color:var(--t2,#aaa);font-size:10px;white-space:nowrap;
}

/* ── Examples ────────────────────────────────────── */
.planner-examples { display:flex;flex-direction:column;gap:4px; }
.planner-ex-title {
  font-size:10px;color:var(--t3,#666);text-transform:uppercase;
  letter-spacing:.5px;margin-bottom:2px;
}
.planner-ex-chip {
  background:var(--bg2,#1a1a1a);border:1px solid var(--border2,#2a2a2a);
  border-radius:6px;padding:6px 10px;font-size:11px;color:var(--t2,#aaa);
  cursor:pointer;transition:background .1s,color .1s;text-align:left;
}
.planner-ex-chip:hover{background:var(--bg3,#222);color:var(--t1,#eee)}

/* ── Input area ──────────────────────────────────── */
.planner-input-wrap { display:flex;flex-direction:column;gap:7px; }
.planner-textarea {
  background:var(--bg2,#1a1a1a);border:1px solid var(--border2,#2a2a2a);
  border-radius:8px;color:var(--t1,#eee);font-size:12px;
  padding:9px 11px;resize:none;height:72px;outline:none;
  font-family:inherit;line-height:1.5;transition:border-color .15s;
}
.planner-textarea:focus{border-color:#50c878}
.planner-send-btn {
  background:linear-gradient(135deg,#1a4028,#286040);
  border:1px solid rgba(80,200,120,.5);color:#70e090;
  border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;
  transition:background .15s;
}
.planner-send-btn:hover{background:linear-gradient(135deg,#204830,#306848)}
.planner-send-btn:disabled{opacity:.5;cursor:not-allowed}

/* ── Status / thinking ───────────────────────────── */
.planner-thinking {
  display:none;align-items:center;gap:8px;
  background:var(--bg2,#1a1a1a);border:1px solid var(--border2,#2a2a2a);
  border-radius:8px;padding:10px 12px;font-size:12px;color:var(--t3,#666);
}
.planner-thinking.show{display:flex}
.planner-dots span {
  display:inline-block;width:5px;height:5px;border-radius:50%;
  background:#50c878;margin:0 1px;
  animation:pdot 1.2s infinite;
}
.planner-dots span:nth-child(2){animation-delay:.2s}
.planner-dots span:nth-child(3){animation-delay:.4s}
@keyframes pdot{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}

/* ── Preview card ────────────────────────────────── */
.planner-preview {
  display:none;background:var(--bg2,#1a1a1a);
  border:1px solid rgba(80,200,120,.35);border-radius:10px;
  padding:14px;flex-direction:column;gap:10px;
}
.planner-preview.show{display:flex}
.planner-preview-title {
  font-size:11px;font-weight:700;color:#50c878;
  text-transform:uppercase;letter-spacing:.5px;
}
.planner-intent-badge {
  display:inline-flex;align-items:center;gap:5px;
  background:rgba(80,200,120,.12);border:1px solid rgba(80,200,120,.3);
  border-radius:20px;padding:3px 10px;font-size:11px;color:#70e090;
  width:fit-content;
}
.planner-conf {
  font-size:10px;color:var(--t3,#666);margin-left:6px;
}
.planner-plan-list {
  display:flex;flex-direction:column;gap:5px;margin:0;padding:0;list-style:none;
}
.planner-plan-item {
  display:flex;align-items:flex-start;gap:8px;
  background:var(--bg3,#222);border-radius:6px;
  padding:7px 10px;font-size:11px;color:var(--t2,#aaa);
}
.planner-plan-num {
  color:#50c878;font-weight:700;font-size:11px;min-width:16px;
}
.planner-preview-actions {
  display:flex;gap:7px;margin-top:2px;
}
.planner-confirm-btn {
  flex:1;background:linear-gradient(135deg,#1a4028,#2a6040);
  border:1px solid rgba(80,200,120,.5);color:#70e090;
  border-radius:7px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;
}
.planner-confirm-btn:hover{background:linear-gradient(135deg,#204830,#306848)}
.planner-cancel-btn {
  background:var(--bg3,#222);border:1px solid var(--border2,#2a2a2a);
  color:var(--t3,#666);border-radius:7px;padding:8px 12px;
  font-size:12px;cursor:pointer;
}
.planner-cancel-btn:hover{background:var(--bg4,#2a2a2a);color:var(--t1,#eee)}

/* ── Execution progress ──────────────────────────── */
.planner-exec {
  display:none;background:var(--bg2,#1a1a1a);
  border:1px solid var(--border2,#2a2a2a);border-radius:10px;
  padding:12px;flex-direction:column;gap:8px;
}
.planner-exec.show{display:flex}
.planner-exec-title{font-size:11px;color:var(--t3,#666);font-weight:600}
.planner-exec-step {
  display:flex;align-items:center;gap:8px;
  font-size:11px;color:var(--t2,#aaa);padding:5px 0;
}
.planner-step-icon{font-size:13px;min-width:18px}
.planner-step-done{color:#50c878}
.planner-step-running{color:#f5a623;animation:pfade 1s infinite alternate}
.planner-step-pending{color:var(--t3,#666)}
@keyframes pfade{from{opacity:.5}to{opacity:1}}

/* ── History ─────────────────────────────────────── */
.planner-history { display:flex;flex-direction:column;gap:4px; }
.planner-hist-title {
  font-size:10px;color:var(--t3,#666);text-transform:uppercase;
  letter-spacing:.5px;display:flex;align-items:center;gap:6px;
}
.planner-hist-clear {
  background:none;border:none;color:var(--t3,#666);font-size:10px;
  cursor:pointer;padding:0;margin-left:auto;
}
.planner-hist-clear:hover{color:var(--t1,#eee)}
.planner-hist-item {
  background:var(--bg2,#1a1a1a);border:1px solid var(--border2,#2a2a2a);
  border-radius:6px;padding:6px 9px;font-size:11px;
  display:flex;flex-direction:column;gap:2px;cursor:pointer;
  transition:background .1s;
}
.planner-hist-item:hover{background:var(--bg3,#222)}
.planner-hist-req{color:var(--t1,#eee);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.planner-hist-meta{color:var(--t3,#666);font-size:10px;display:flex;gap:6px}
`;
document.head.appendChild(_style);

/* ══════════════════════════════════════════════════════════
   DOM
   ══════════════════════════════════════════════════════════ */

function _buildUI() {
  // Toggle button in topbar
  const topbar = document.getElementById('topbar');
  if (topbar) {
    const div = document.createElement('div');
    div.className = 'tb-divider';
    const btn = document.createElement('button');
    btn.id = 'planner-toggle';
    btn.title = 'AI Command Center — ra lệnh bằng ngôn ngữ tự nhiên';
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> NL Edit`;
    btn.onclick = () => TaskPlanner.open();
    topbar.appendChild(div);
    topbar.appendChild(btn);
  }

  // Panel
  const panel = document.createElement('div');
  panel.id = 'planner-panel';
  panel.innerHTML = `
<div class="planner-header">
  <span class="planner-header-icon">🧠</span>
  <span class="planner-header-title">AI Command Center</span>
  <button class="planner-close" onclick="TaskPlanner.close()">✕</button>
</div>
<div class="planner-body" id="planner-body">

  <!-- Context -->
  <div class="planner-ctx" id="planner-ctx-row">
    <span style="color:var(--t3,#666);font-size:10px;width:100%">🎯 Ngữ cảnh hiện tại:</span>
    <span class="planner-ctx-badge" id="pctx-clips">0 clip</span>
    <span class="planner-ctx-badge" id="pctx-subs">0 phụ đề</span>
    <span class="planner-ctx-badge" id="pctx-dur">0s</span>
    <span class="planner-ctx-badge" id="pctx-selected">Chưa chọn clip</span>
  </div>

  <!-- Examples -->
  <div class="planner-examples">
    <div class="planner-ex-title">💡 Thử ngay</div>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Video này hơi dài, cắt bớt các đoạn lan man"</button>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Tạo 5 shorts viral nhất và thêm phụ đề TikTok"</button>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Làm video này giống phong cách của tôi"</button>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Tạo phiên bản TikTok nhanh hơn 30 giây"</button>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Dịch phụ đề sang tiếng Anh và đổi style MrBeast"</button>
    <button class="planner-ex-chip" onclick="TaskPlanner.submit(this.textContent)">"Phân tích video và chuẩn bị đăng TikTok + YouTube"</button>
  </div>

  <!-- Input -->
  <div class="planner-input-wrap">
    <textarea class="planner-textarea" id="planner-input"
      placeholder="Mô tả điều bạn muốn làm với video...&#10;Ví dụ: Tạo 10 shorts viral nhất từ video này"></textarea>
    <button class="planner-send-btn" id="planner-send-btn" onclick="TaskPlanner._sendInput()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Lên kế hoạch
    </button>
  </div>

  <!-- Thinking indicator -->
  <div class="planner-thinking" id="planner-thinking">
    <span>🧠 AI đang phân tích yêu cầu</span>
    <div class="planner-dots"><span></span><span></span><span></span></div>
  </div>

  <!-- Preview / Confirmation card -->
  <div class="planner-preview" id="planner-preview">
    <div class="planner-preview-title">📋 Kế hoạch thực thi</div>
    <div id="planner-intent-row"></div>
    <div style="font-size:11px;color:var(--t2,#aaa);font-style:italic" id="planner-explanation"></div>
    <ul class="planner-plan-list" id="planner-plan-list"></ul>
    <div class="planner-preview-actions">
      <button class="planner-confirm-btn" onclick="TaskPlanner._confirm()">✅ Thực hiện ngay</button>
      <button class="planner-cancel-btn" onclick="TaskPlanner._cancel()">Hủy</button>
    </div>
  </div>

  <!-- Execution progress -->
  <div class="planner-exec" id="planner-exec">
    <div class="planner-exec-title">⚙️ Đang thực thi...</div>
    <div id="planner-exec-steps"></div>
  </div>

  <!-- History -->
  <div class="planner-history" id="planner-history-section">
    <div class="planner-hist-title">
      🕘 Lịch sử lệnh
      <button class="planner-hist-clear" onclick="TaskPlanner.clearHistory()">Xóa tất cả</button>
    </div>
    <div id="planner-hist-list"></div>
  </div>

</div>
  `;
  document.body.appendChild(panel);
  _renderHistory();
  _updateContext();
  setInterval(_updateContext, 2000);
}

/* ══════════════════════════════════════════════════════════
   CONTEXT AWARENESS
   ══════════════════════════════════════════════════════════ */

function _getEditorContext() {
  const ctx = {
    clips: [], subtitles: [], totalDuration: 0,
    playhead: 0, selectedClips: [], transcriptSegments: [],
    activePanel: '', projectName: '',
  };
  try {
    if (typeof tracks !== 'undefined') {
      tracks.forEach(tr => tr.clips.forEach(c => ctx.clips.push(c)));
      ctx.totalDuration = ctx.clips.reduce((m, c) => Math.max(m, c.start + c.dur), 0);
    }
    if (typeof subtitles !== 'undefined') ctx.subtitles = subtitles;
    if (typeof playhead  !== 'undefined') ctx.playhead  = playhead;
    if (typeof selected  !== 'undefined') {
      ctx.selectedClips = ctx.clips.filter(c => selected.has(c.id));
    }
    if (typeof transcriptSegments !== 'undefined') ctx.transcriptSegments = transcriptSegments;
    const active = document.querySelector('.tb.on');
    if (active) ctx.activePanel = active.textContent.trim();
    const titleEl = document.querySelector('#topbar-title, .project-title');
    if (titleEl) ctx.projectName = titleEl.textContent.trim();
  } catch (_) {}
  return ctx;
}

function _updateContext() {
  const ctx = _getEditorContext();
  const clipCount = ctx.clips.length;
  const subCount  = ctx.subtitles.length;
  const dur       = ctx.totalDuration;
  const sel       = ctx.selectedClips.length;

  const fmt = s => s < 60 ? s.toFixed(0) + 's' : Math.floor(s/60) + 'm' + (s%60).toFixed(0) + 's';

  const el = id => document.getElementById(id);
  if (el('pctx-clips'))    el('pctx-clips').textContent    = clipCount + ' clip';
  if (el('pctx-subs'))     el('pctx-subs').textContent     = subCount + ' phụ đề';
  if (el('pctx-dur'))      el('pctx-dur').textContent      = fmt(dur);
  if (el('pctx-selected')) el('pctx-selected').textContent = sel > 0 ? sel + ' đang chọn' : 'Chưa chọn clip';
}

/* ══════════════════════════════════════════════════════════
   CONVERSATION MEMORY
   ══════════════════════════════════════════════════════════ */

function _resolveWithMemory(request) {
  // Replace context references with actual entities
  let resolved = request;
  if (_convMemory.lastShorts && _convMemory.lastShorts.length) {
    const shortsRef = /\b(tất cả|all|chúng|them|đó|that)\b/i;
    if (shortsRef.test(resolved) && /xuất|export|render/i.test(resolved)) {
      resolved += ` (${_convMemory.lastShorts.length} shorts vừa tạo)`;
    }
  }
  if (_convMemory.lastPlan) {
    if (/tiếp tục|continue|thực hiện tiếp/i.test(resolved)) {
      resolved = 'Tiếp tục kế hoạch: ' + _convMemory.lastPlan;
    }
  }
  return resolved;
}

function _updateMemory(request, plan, intent) {
  _convMemory.lastRequest = request;
  _convMemory.lastPlan    = plan.map(t => t.label).join(' → ');
  _convMemory.lastIntent  = intent;
  if (intent === INTENTS.CREATE_SHORTS) {
    const shortTask = plan.find(t => t.action === 'generate_shorts' || t.action === 'generate_batch');
    if (shortTask) _convMemory.lastShorts = ['pending'];
  }
  _saveMemory();
}

/* ══════════════════════════════════════════════════════════
   SERVER CALL
   ══════════════════════════════════════════════════════════ */

async function _callPlanTask(request) {
  const ctx = _getEditorContext();
  const resolved = _resolveWithMemory(request);

  const payload = {
    request: resolved,
    editorState: {
      clips:              ctx.clips.slice(0, 30),
      subtitles:          ctx.subtitles.slice(0, 20),
      totalDuration:      ctx.totalDuration,
      playhead:           ctx.playhead,
      selectedClips:      ctx.selectedClips,
      transcriptSegments: ctx.transcriptSegments.slice(0, 40),
      activePanel:        ctx.activePanel,
      projectName:        ctx.projectName,
    },
    conversationMemory: {
      lastRequest: _convMemory.lastRequest || '',
      lastPlan:    _convMemory.lastPlan    || '',
      lastIntent:  _convMemory.lastIntent  || '',
    },
  };

  const resp = await fetch('/ai/plan-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error('Server error: ' + resp.status);
  return resp.json();
}

/* ══════════════════════════════════════════════════════════
   SUBMIT & PLAN
   ══════════════════════════════════════════════════════════ */

async function _submit(request) {
  if (!request || !request.trim()) return;
  request = request.trim();

  _setThinking(true);
  _setPreview(false);
  _setExec(false);

  const sendBtn = document.getElementById('planner-send-btn');
  const input   = document.getElementById('planner-input');
  if (sendBtn) sendBtn.disabled = true;
  if (input)   input.value = '';

  try {
    const result = await _callPlanTask(request);

    _setThinking(false);
    if (!result.tasks || result.tasks.length === 0) {
      _showToast('⚠️ Không thể lập kế hoạch cho yêu cầu này');
      if (sendBtn) sendBtn.disabled = false;
      return;
    }

    _pending = { request, plan: result };
    _updateMemory(request, result.tasks, result.intent);
    _renderPreview(result);
    _setPreview(true);

  } catch (err) {
    _setThinking(false);
    _showToast('❌ Lỗi: ' + err.message);
    console.error('[TaskPlanner]', err);
  }

  if (sendBtn) sendBtn.disabled = false;
}

/* ══════════════════════════════════════════════════════════
   RENDER PREVIEW
   ══════════════════════════════════════════════════════════ */

function _renderPreview(result) {
  const intentRow  = document.getElementById('planner-intent-row');
  const explEl     = document.getElementById('planner-explanation');
  const planList   = document.getElementById('planner-plan-list');

  const label = INTENT_LABELS[result.intent] || result.intent;
  const conf  = result.confidence ? Math.round(result.confidence * 100) : '?';

  if (intentRow) intentRow.innerHTML = `
    <div class="planner-intent-badge">
      ${label}
      <span class="planner-conf">${conf}% tin cậy</span>
    </div>
  `;

  if (explEl) explEl.textContent = result.explanation || '';

  if (planList) {
    planList.innerHTML = result.tasks.map((t, i) => `
      <li class="planner-plan-item">
        <span class="planner-plan-num">${i + 1}.</span>
        <span>${t.label}</span>
      </li>
    `).join('');
  }
}

/* ══════════════════════════════════════════════════════════
   CONFIRM & EXECUTE
   ══════════════════════════════════════════════════════════ */

async function _confirm() {
  if (!_pending) return;
  _setPreview(false);
  _executing = true;

  const { request, plan } = _pending;
  _pending = null;

  const tasks   = plan.tasks || [];
  const actions = plan.actions || [];

  _renderExecSteps(tasks);
  _setExec(true);

  // Add to history
  _addHistory({ request, intent: plan.intent, taskCount: tasks.length, ts: Date.now() });

  // Execute via Action Engine
  try {
    for (let i = 0; i < tasks.length; i++) {
      _updateExecStep(i, 'running');
      await _sleep(220);  // visual pacing

      // Find actions for this step
      const stepActions = actions.filter(a => a.stepIndex === i);
      if (stepActions.length > 0 && typeof executeActions === 'function') {
        executeActions(stepActions.map(a => ({ type: a.type, params: a.params || {} })));
      }
      _updateExecStep(i, 'done');
    }

    // Final bulk actions that aren't step-indexed
    const globalActions = actions.filter(a => a.stepIndex === undefined || a.stepIndex === null);
    if (globalActions.length > 0 && typeof executeActions === 'function') {
      executeActions(globalActions.map(a => ({ type: a.type, params: a.params || {} })));
    }

    _showToast('✅ Đã hoàn thành: ' + tasks.length + ' bước');
    setTimeout(() => _setExec(false), 3000);

  } catch (err) {
    _showToast('❌ Lỗi thực thi: ' + err.message);
    _setExec(false);
  }

  _executing = false;
  _renderHistory();
}

function _cancel() {
  _pending = null;
  _setPreview(false);
  _showToast('↩️ Đã hủy kế hoạch');
}

/* ══════════════════════════════════════════════════════════
   EXECUTION STEPS UI
   ══════════════════════════════════════════════════════════ */

function _renderExecSteps(tasks) {
  const el = document.getElementById('planner-exec-steps');
  if (!el) return;
  el.innerHTML = tasks.map((t, i) => `
    <div class="planner-exec-step" id="pstep-${i}">
      <span class="planner-step-icon planner-step-pending" id="pstep-icon-${i}">○</span>
      <span>${t.label}</span>
    </div>
  `).join('');
}

function _updateExecStep(i, state) {
  const icon = document.getElementById(`pstep-icon-${i}`);
  if (!icon) return;
  icon.className = 'planner-step-icon planner-step-' + state;
  icon.textContent = state === 'done' ? '✓' : state === 'running' ? '⟳' : '○';
}

/* ══════════════════════════════════════════════════════════
   HISTORY
   ══════════════════════════════════════════════════════════ */

function _addHistory(entry) {
  _history.unshift(entry);
  if (_history.length > MAX_HISTORY) _history.pop();
  _saveHistory();
  _renderHistory();
}

function _renderHistory() {
  const el = document.getElementById('planner-hist-list');
  if (!el) return;
  if (_history.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--t3,#666);padding:4px 0">Chưa có lịch sử</div>';
    return;
  }
  el.innerHTML = _history.slice(0, 8).map(h => {
    const d = new Date(h.ts);
    const time = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    const label = INTENT_LABELS[h.intent] || h.intent || '';
    return `
      <div class="planner-hist-item" onclick="TaskPlanner.submit('${h.request.replace(/'/g, "\\'")}')">
        <div class="planner-hist-req">${h.request}</div>
        <div class="planner-hist-meta">
          <span>${label}</span>
          <span>${h.taskCount} bước</span>
          <span>${time}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════════════ */

function _setThinking(on) {
  const el = document.getElementById('planner-thinking');
  if (el) el.classList.toggle('show', on);
}

function _setPreview(on) {
  const el = document.getElementById('planner-preview');
  if (el) el.classList.toggle('show', on);
}

function _setExec(on) {
  const el = document.getElementById('planner-exec');
  if (el) el.classList.toggle('show', on);
}

function _showToast(msg) {
  if (typeof toast === 'function') { toast(msg); return; }
  console.log('[TaskPlanner]', msg);
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ══════════════════════════════════════════════════════════
   PERSISTENCE
   ══════════════════════════════════════════════════════════ */

function _loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); } catch { return []; }
}
function _saveHistory() {
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(_history)); } catch (_) {}
}
function _loadMemory() {
  try { return JSON.parse(sessionStorage.getItem(LS_MEMORY) || '{}'); } catch { return {}; }
}
function _saveMemory() {
  try { sessionStorage.setItem(LS_MEMORY, JSON.stringify(_convMemory)); } catch (_) {}
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════ */

window.TaskPlanner = {
  open() {
    _open = true;
    const panel = document.getElementById('planner-panel');
    const btn   = document.getElementById('planner-toggle');
    if (panel) panel.classList.add('open');
    if (btn)   btn.classList.add('on');
    _updateContext();
  },

  close() {
    _open = false;
    const panel = document.getElementById('planner-panel');
    const btn   = document.getElementById('planner-toggle');
    if (panel) panel.classList.remove('open');
    if (btn)   btn.classList.remove('on');
  },

  submit(text) {
    if (typeof text === 'string' && text.startsWith('"')) {
      text = text.slice(1, -1);
    }
    const input = document.getElementById('planner-input');
    if (input) input.value = text;
    if (!_open) this.open();
    _submit(text);
  },

  _sendInput() {
    const input = document.getElementById('planner-input');
    const text  = input ? input.value.trim() : '';
    if (text) _submit(text);
  },

  _confirm: _confirm,
  _cancel:  _cancel,

  getHistory()   { return [..._history]; },
  clearHistory() {
    _history = [];
    _saveHistory();
    _renderHistory();
    _showToast('🗑️ Đã xóa lịch sử');
  },
};

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _buildUI);
} else {
  _buildUI();
}

// Enter key in textarea
document.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'planner-input') {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      TaskPlanner._sendInput();
    }
  }
});

console.log('[TaskPlanner] Phase 5.4 loaded — Natural Language Video Editing');

})();
