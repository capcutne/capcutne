/* ============================================================
   js/feedback.js — Phase 5.5  Feedback Center
   FeedbackManager · BugReport · FeatureRequest · CrashReporter
   ============================================================ */
(function () {
  'use strict';

  // ── CSS ─────────────────────────────────────────────────────
  const css = `
#feedback-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9500;display:flex;align-items:center;justify-content:center}
#feedback-modal{background:#1a1a1a;border:1px solid #333;border-radius:12px;width:460px;max-width:95vw;max-height:90vh;overflow-y:auto;padding:28px;color:#eee;font-family:system-ui,sans-serif}
#feedback-modal h3{margin:0 0 4px;font-size:18px;color:#D4A017}
#feedback-modal .fm-sub{color:#888;font-size:12px;margin-bottom:20px}
.fm-tabs{display:flex;gap:4px;margin-bottom:18px}
.fm-tab{flex:1;padding:7px;border:1px solid #333;background:#111;color:#888;border-radius:6px;cursor:pointer;font-size:12px}
.fm-tab.active{background:#D4A017;color:#000;border-color:#D4A017}
.fm-field{margin-bottom:12px}
.fm-field label{display:block;font-size:11px;color:#888;margin-bottom:4px}
.fm-field input,.fm-field textarea,.fm-field select{width:100%;box-sizing:border-box;padding:8px 10px;background:#111;border:1px solid #333;border-radius:6px;color:#eee;font-size:13px;outline:none;resize:vertical}
.fm-field input:focus,.fm-field textarea:focus,.fm-field select:focus{border-color:#D4A017}
.fm-field textarea{min-height:80px}
.fm-btn{padding:9px 18px;background:#D4A017;border:none;border-radius:6px;color:#000;font-weight:700;font-size:13px;cursor:pointer}
.fm-btn:hover{background:#c49010}
.fm-btn-sec{padding:9px 18px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#ccc;font-size:13px;cursor:pointer}
.fm-btn-sec:hover{background:#333}
.fm-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
.fm-success{text-align:center;padding:24px 0;color:#4caf50;font-size:15px}
/* Feature request list */
.fr-item{background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:12px;margin-bottom:8px}
.fr-item-title{font-size:14px;font-weight:600;margin-bottom:4px}
.fr-item-meta{font-size:11px;color:#666}
.fr-vote{display:flex;align-items:center;gap:6px;margin-top:8px}
.fr-vote button{padding:3px 12px;background:#1e1e1e;border:1px solid #333;border-radius:4px;color:#D4A017;cursor:pointer;font-size:12px}
.fr-vote button:hover{background:#D4A017;color:#000}
.fr-vote .fr-count{font-size:13px;font-weight:700;color:#D4A017}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Utilities ────────────────────────────────────────────────
  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
  }
  function apiGet(path) { return fetch(path).then(r => r.json()); }

  function currentUser() {
    try { return JSON.parse(localStorage.getItem('cc_beta_user') || 'null'); } catch { return null; }
  }

  function collectContext() {
    return {
      browser: navigator.userAgent,
      url: location.href,
      timestamp: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      activePanel: document.querySelector('.tb.on')?.textContent?.trim() || 'unknown',
      projectName: document.getElementById('project-name')?.textContent?.trim() || 'unknown',
      recentLogs: window._betaLastLogs?.slice(-5) || []
    };
  }

  // ── Log interceptor ──────────────────────────────────────────
  window._betaLastLogs = [];
  (function () {
    const orig = console.log.bind(console);
    console.log = function (...args) {
      window._betaLastLogs.push({ t: Date.now(), msg: args.join(' ') });
      if (window._betaLastLogs.length > 20) window._betaLastLogs.shift();
      orig(...args);
    };
  })();

  // ── Crash Reporter ───────────────────────────────────────────
  const CrashReporter = {
    init() {
      window.addEventListener('error', (e) => {
        this.report({
          module: 'global',
          error: e.message,
          stack: e.error?.stack || '',
          file: e.filename,
          line: e.lineno
        });
      });
      window.addEventListener('unhandledrejection', (e) => {
        this.report({
          module: 'promise',
          error: String(e.reason),
          stack: e.reason?.stack || ''
        });
      });
    },
    report(data) {
      const user = currentUser();
      api('/beta/crash', {
        userId: user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
        module: data.module || 'unknown',
        error: data.error || '',
        stack: data.stack || '',
        context: collectContext()
      }).catch(() => {});
    }
  };
  window.CrashReporter = CrashReporter;

  // ── Feedback Modal ───────────────────────────────────────────
  const FeedbackManager = {
    _activeTab: 'bug',

    open(tab = 'bug') {
      this._activeTab = tab;
      this._render();
    },

    _render() {
      document.getElementById('feedback-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'feedback-overlay';
      overlay.innerHTML = `
        <div id="feedback-modal">
          <h3>💬 Phản hồi Beta</h3>
          <p class="fm-sub">Giúp chúng tôi cải thiện sản phẩm</p>
          <div class="fm-tabs">
            <button class="fm-tab ${this._activeTab==='bug'?'active':''}" onclick="FeedbackManager._tab('bug',this)">🐛 Báo lỗi</button>
            <button class="fm-tab ${this._activeTab==='feature'?'active':''}" onclick="FeedbackManager._tab('feature',this)">💡 Yêu cầu</button>
            <button class="fm-tab ${this._activeTab==='general'?'active':''}" onclick="FeedbackManager._tab('general',this)">💬 Chung</button>
            <button class="fm-tab ${this._activeTab==='requests'?'active':''}" onclick="FeedbackManager._tab('requests',this)">📋 Danh sách</button>
          </div>
          <div id="fm-content">${this._renderTab(this._activeTab)}</div>
        </div>`;
      overlay.addEventListener('mousedown', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
    },

    _tab(tab, el) {
      this._activeTab = tab;
      document.querySelectorAll('.fm-tab').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('fm-content').innerHTML = this._renderTab(tab);
      if (tab === 'requests') this._loadRequests();
    },

    _renderTab(tab) {
      const ctx = collectContext();
      if (tab === 'bug') return `
        <div class="fm-field"><label>Mô tả lỗi *</label><textarea id="fm-bug-msg" placeholder="Lỗi xảy ra khi... Kết quả mong đợi là..."></textarea></div>
        <div class="fm-field"><label>Thông tin tự động (đính kèm)</label>
          <textarea readonly style="color:#666;font-size:11px;height:70px">${JSON.stringify(ctx, null, 2).slice(0,400)}...</textarea></div>
        <div class="fm-actions">
          <button class="fm-btn-sec" onclick="document.getElementById('feedback-overlay').remove()">Hủy</button>
          <button class="fm-btn" onclick="FeedbackManager._submitBug()">Gửi báo lỗi</button>
        </div>`;
      if (tab === 'feature') return `
        <div class="fm-field"><label>Tiêu đề tính năng *</label><input id="fm-feat-title" type="text" placeholder="Tôi muốn..."></div>
        <div class="fm-field"><label>Mô tả chi tiết</label><textarea id="fm-feat-desc" placeholder="Tính năng này sẽ giúp tôi..."></textarea></div>
        <div class="fm-actions">
          <button class="fm-btn-sec" onclick="document.getElementById('feedback-overlay').remove()">Hủy</button>
          <button class="fm-btn" onclick="FeedbackManager._submitFeature()">Gửi yêu cầu</button>
        </div>`;
      if (tab === 'general') return `
        <div class="fm-field"><label>Cảm nhận của bạn *</label><textarea id="fm-gen-msg" placeholder="Tôi thích... / Tôi không thích... / Câu hỏi..."></textarea></div>
        <div class="fm-field"><label>Mức độ hài lòng</label>
          <select id="fm-gen-rating">
            <option value="5">⭐⭐⭐⭐⭐ Rất hài lòng</option>
            <option value="4">⭐⭐⭐⭐ Hài lòng</option>
            <option value="3" selected>⭐⭐⭐ Bình thường</option>
            <option value="2">⭐⭐ Chưa hài lòng</option>
            <option value="1">⭐ Rất kém</option>
          </select></div>
        <div class="fm-actions">
          <button class="fm-btn-sec" onclick="document.getElementById('feedback-overlay').remove()">Hủy</button>
          <button class="fm-btn" onclick="FeedbackManager._submitGeneral()">Gửi phản hồi</button>
        </div>`;
      if (tab === 'requests') return `
        <div id="fm-requests-list" style="color:#888;font-size:13px;text-align:center;padding:20px">Đang tải...</div>`;
    },

    async _submitBug() {
      const msg = document.getElementById('fm-bug-msg')?.value?.trim();
      if (!msg) { alert('Vui lòng mô tả lỗi.'); return; }
      const user = currentUser();
      const res = await api('/beta/bug-report', {
        userId: user?.id || 'anonymous',
        message: msg,
        context: collectContext(),
        projectId: document.getElementById('project-name')?.textContent?.trim()
      });
      if (res.ok) this._showSuccess('Báo lỗi đã gửi! Cảm ơn bạn 🙏');
    },

    async _submitFeature() {
      const title = document.getElementById('fm-feat-title')?.value?.trim();
      const desc  = document.getElementById('fm-feat-desc')?.value?.trim();
      if (!title) { alert('Vui lòng nhập tiêu đề.'); return; }
      const user = currentUser();
      const res = await api('/beta/feature-request', {
        userId: user?.id || 'anonymous',
        title,
        description: desc || ''
      });
      if (res.ok) this._showSuccess('Yêu cầu đã gửi! Cảm ơn bạn 💡');
    },

    async _submitGeneral() {
      const msg    = document.getElementById('fm-gen-msg')?.value?.trim();
      const rating = parseInt(document.getElementById('fm-gen-rating')?.value || '3');
      if (!msg) { alert('Vui lòng nhập phản hồi.'); return; }
      const user = currentUser();
      const res = await api('/beta/feedback', {
        userId: user?.id || 'anonymous',
        type: 'general',
        message: msg,
        rating,
        projectId: document.getElementById('project-name')?.textContent?.trim()
      });
      if (res.ok) this._showSuccess('Phản hồi đã gửi! Cảm ơn bạn 💬');
    },

    async _loadRequests() {
      try {
        const data = await apiGet('/beta/feature-requests');
        const container = document.getElementById('fm-requests-list');
        if (!container) return;
        if (!data.requests?.length) {
          container.innerHTML = '<p style="color:#666;text-align:center">Chưa có yêu cầu nào. Hãy là người đầu tiên!</p>';
          return;
        }
        const user = currentUser();
        container.innerHTML = data.requests.map(r => `
          <div class="fr-item">
            <div class="fr-item-title">${r.title}</div>
            ${r.description ? `<div class="fr-item-meta">${r.description.slice(0,120)}</div>` : ''}
            <div class="fr-vote">
              <button onclick="FeedbackManager._vote('${r.id}', this)">▲ Bình chọn</button>
              <span class="fr-count">${r.votes || 0}</span>
              <span style="color:#555;font-size:11px">phiếu</span>
            </div>
          </div>`).join('');
      } catch (e) {
        document.getElementById('fm-requests-list').innerHTML = '<p style="color:#f55">Lỗi tải dữ liệu.</p>';
      }
    },

    async _vote(requestId, btn) {
      const user = currentUser();
      const res = await api('/beta/vote-feature', { requestId, userId: user?.id });
      if (res.ok) {
        const countEl = btn.parentElement.querySelector('.fr-count');
        if (countEl) countEl.textContent = res.votes;
        btn.disabled = true; btn.style.opacity = '0.5';
      }
    },

    _showSuccess(msg) {
      document.getElementById('fm-content').innerHTML =
        `<div class="fm-success">✅ ${msg}<br><br>
         <button class="fm-btn-sec" onclick="document.getElementById('feedback-overlay').remove()">Đóng</button></div>`;
    }
  };
  window.FeedbackManager = FeedbackManager;

  // ── Action Engine integration ────────────────────────────────
  document.addEventListener('cc:action', function (e) {
    const { type, params } = e.detail || {};
    if (type === 'submit_feedback') FeedbackManager.open('general');
    if (type === 'report_bug')      FeedbackManager.open('bug');
    if (type === 'request_feature') FeedbackManager.open('feature');
  });

  // ── Init ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    CrashReporter.init();
  });

  console.log('[FeedbackManager] Phase 5.5 loaded — Feedback Center + Crash Reporter');
})();
