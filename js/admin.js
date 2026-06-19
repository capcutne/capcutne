/* ============================================================
   js/admin.js — Phase 5.5  Beta Admin Dashboard
   Tổng user · Active users · Exports · Feedback · Crashes · Feature Flags
   ============================================================ */
(function () {
  'use strict';

  // ── CSS ─────────────────────────────────────────────────────
  const css = `
#admin-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9800;display:flex;align-items:center;justify-content:center}
#admin-modal{background:#111;border:1px solid #2a2a2a;border-radius:14px;width:820px;max-width:98vw;max-height:92vh;overflow-y:auto;color:#eee;font-family:system-ui,sans-serif}
.adm-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #222}
.adm-header h2{margin:0;font-size:18px;color:#D4A017}
.adm-close{background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:4px 8px}
.adm-close:hover{color:#fff}
.adm-nav{display:flex;gap:2px;padding:12px 24px;border-bottom:1px solid #1a1a1a;flex-wrap:wrap}
.adm-nav button{padding:6px 14px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;font-size:12px}
.adm-nav button.active{background:#D4A017;color:#000;border-color:#D4A017}
.adm-body{padding:20px 24px}
/* Stats */
.adm-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:20px}
.adm-stat{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px;text-align:center}
.adm-stat-val{font-size:28px;font-weight:700;color:#D4A017}
.adm-stat-lbl{font-size:11px;color:#666;margin-top:2px}
/* Table */
.adm-table{width:100%;border-collapse:collapse;font-size:12px}
.adm-table th{text-align:left;padding:8px 10px;color:#666;border-bottom:1px solid #2a2a2a;font-weight:600;font-size:11px;text-transform:uppercase}
.adm-table td{padding:8px 10px;border-bottom:1px solid #1a1a1a;color:#ccc}
.adm-table tr:hover td{background:#1a1a1a}
/* Feature flags */
.ff-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1a1a1a}
.ff-row:last-child{border:none}
.ff-name{font-size:14px;font-weight:600}
.ff-desc{font-size:11px;color:#666;margin-top:2px}
.ff-toggle{position:relative;width:44px;height:24px;cursor:pointer}
.ff-toggle input{opacity:0;width:0;height:0}
.ff-slider{position:absolute;inset:0;background:#333;border-radius:12px;transition:.2s}
.ff-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
.ff-toggle input:checked+.ff-slider{background:#D4A017}
.ff-toggle input:checked+.ff-slider:before{transform:translateX(20px)}
/* Retention */
.ret-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ret-bar-label{width:40px;font-size:11px;color:#888}
.ret-bar-track{flex:1;height:20px;background:#1a1a1a;border-radius:4px;overflow:hidden}
.ret-bar-fill{height:100%;background:#D4A017;border-radius:4px;display:flex;align-items:center;padding-left:6px;font-size:11px;color:#000;font-weight:700;transition:width .4s}
/* Section heading */
.adm-section-title{font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;border-bottom:1px solid #2a2a2a;padding-bottom:6px}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Utilities ────────────────────────────────────────────────
  function apiGet(path) { return fetch(path).then(r => r.json()); }
  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  // ── AdminDashboard ───────────────────────────────────────────
  const AdminDashboard = {
    _tab: 'overview',
    _data: null,

    async open() {
      this._tab = 'overview';
      document.getElementById('admin-overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'admin-overlay';
      overlay.innerHTML = `
        <div id="admin-modal">
          <div class="adm-header">
            <h2>⚙️ Admin Dashboard — Beta Program</h2>
            <button class="adm-close" onclick="document.getElementById('admin-overlay').remove()">✕</button>
          </div>
          <div class="adm-nav">
            <button class="active" onclick="AdminDashboard._switchTab('overview',this)">📊 Tổng quan</button>
            <button onclick="AdminDashboard._switchTab('users',this)">👥 Users</button>
            <button onclick="AdminDashboard._switchTab('feedback',this)">💬 Feedback</button>
            <button onclick="AdminDashboard._switchTab('crashes',this)">🐛 Crashes</button>
            <button onclick="AdminDashboard._switchTab('retention',this)">📈 Retention</button>
            <button onclick="AdminDashboard._switchTab('flags',this)">🚩 Feature Flags</button>
          </div>
          <div class="adm-body" id="adm-body">
            <div style="color:#666;text-align:center;padding:40px">Đang tải...</div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      await this._loadAndRender('overview');
    },

    async _switchTab(tab, el) {
      this._tab = tab;
      document.querySelectorAll('.adm-nav button').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      const body = document.getElementById('adm-body');
      if (body) body.innerHTML = '<div style="color:#666;text-align:center;padding:40px">Đang tải...</div>';
      await this._loadAndRender(tab);
    },

    async _loadAndRender(tab) {
      try {
        const data = await apiGet('/beta/admin/stats');
        this._data = data;
        const body = document.getElementById('adm-body');
        if (!body) return;
        if (tab === 'overview')   body.innerHTML = this._renderOverview(data);
        else if (tab === 'users') body.innerHTML = this._renderUsers(data);
        else if (tab === 'feedback') body.innerHTML = this._renderFeedback(data);
        else if (tab === 'crashes')  body.innerHTML = this._renderCrashes(data);
        else if (tab === 'retention') body.innerHTML = this._renderRetention(data);
        else if (tab === 'flags')    body.innerHTML = await this._renderFlags();
      } catch (e) {
        const body = document.getElementById('adm-body');
        if (body) body.innerHTML = `<div style="color:#f55;text-align:center;padding:40px">Lỗi tải dữ liệu: ${e.message}</div>`;
      }
    },

    _renderOverview(d) {
      const stats = d.stats || {};
      const journey = d.journeyFunnel || {};
      return `
        <p class="adm-section-title">Thống kê tổng hợp</p>
        <div class="adm-stats">
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalUsers||0}</div><div class="adm-stat-lbl">Tổng Users</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.activeToday||0}</div><div class="adm-stat-lbl">Active Hôm nay</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalExports||0}</div><div class="adm-stat-lbl">Exports</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalShorts||0}</div><div class="adm-stat-lbl">Shorts</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalSubtitles||0}</div><div class="adm-stat-lbl">Phụ đề</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalFeedback||0}</div><div class="adm-stat-lbl">Feedback</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalCrashes||0}</div><div class="adm-stat-lbl">Crashes</div></div>
          <div class="adm-stat"><div class="adm-stat-val">${stats.totalVoiceCommands||0}</div><div class="adm-stat-lbl">Voice Cmd</div></div>
        </div>
        <p class="adm-section-title">User Journey Funnel</p>
        ${['register','upload_video','generate_transcript','create_short','export'].map(s=>`
          <div class="ret-bar">
            <div class="ret-bar-label" style="width:130px">${s.replace(/_/g,' ')}</div>
            <div class="ret-bar-track"><div class="ret-bar-fill" style="width:${journey[s]||0}%">${journey[s]||0}%</div></div>
          </div>`).join('')}`;
    },

    _renderUsers(d) {
      const users = d.users || [];
      if (!users.length) return '<p style="color:#666;text-align:center;padding:20px">Chưa có user nào.</p>';
      return `
        <p class="adm-section-title">Danh sách Users (${users.length})</p>
        <table class="adm-table">
          <thead><tr><th>Tên</th><th>Email</th><th>Role</th><th>Ngày tạo</th><th>Sức khỏe</th></tr></thead>
          <tbody>${users.slice(0,50).map(u=>`
            <tr>
              <td>${u.displayName||'—'}</td>
              <td>${u.email}</td>
              <td><span style="color:${u.role==='admin'?'#D4A017':'#888'}">${u.role||'beta_user'}</span></td>
              <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi') : '—'}</td>
              <td><span style="color:#D4A017">${u.healthScore||0}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    },

    _renderFeedback(d) {
      const fb = d.feedback || [];
      if (!fb.length) return '<p style="color:#666;text-align:center;padding:20px">Chưa có feedback.</p>';
      return `
        <p class="adm-section-title">Feedback gần nhất (${fb.length})</p>
        <table class="adm-table">
          <thead><tr><th>Loại</th><th>Nội dung</th><th>User</th><th>Thời gian</th></tr></thead>
          <tbody>${fb.slice(0,30).map(f=>`
            <tr>
              <td><span style="color:${f.type==='bug'?'#f55':f.type==='feature'?'#4caf50':'#D4A017'}">${f.type||'general'}</span></td>
              <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.message||f.title||'—'}</td>
              <td>${f.userId?.slice(0,8)||'anon'}</td>
              <td>${f.createdAt ? new Date(f.createdAt).toLocaleString('vi') : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    },

    _renderCrashes(d) {
      const crashes = d.crashes || [];
      if (!crashes.length) return '<p style="color:#4caf50;text-align:center;padding:20px">✅ Không có crash nào!</p>';
      return `
        <p class="adm-section-title">Crash Reports (${crashes.length})</p>
        <table class="adm-table">
          <thead><tr><th>Module</th><th>Lỗi</th><th>User</th><th>Thời gian</th></tr></thead>
          <tbody>${crashes.slice(0,30).map(c=>`
            <tr>
              <td style="color:#f55">${c.module||'—'}</td>
              <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:monospace;font-size:11px">${c.error||'—'}</td>
              <td>${c.userId?.slice(0,8)||'anon'}</td>
              <td>${c.timestamp ? new Date(c.timestamp).toLocaleString('vi') : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    },

    _renderRetention(d) {
      const ret = d.retention || { d1: 0, d7: 0, d30: 0 };
      return `
        <p class="adm-section-title">Retention Rate</p>
        <div style="margin-bottom:24px">
          ${[['D1 (ngày 1)', ret.d1], ['D7 (tuần 1)', ret.d7], ['D30 (tháng 1)', ret.d30]].map(([lbl,val])=>`
            <div class="ret-bar">
              <div class="ret-bar-label" style="width:110px;font-size:12px">${lbl}</div>
              <div class="ret-bar-track"><div class="ret-bar-fill" style="width:${val}%">${val}%</div></div>
            </div>`).join('')}
        </div>
        <p class="adm-section-title">Analytics Events (24h gần nhất)</p>
        ${this._renderEventBreakdown(d.eventBreakdown||{})}`;
    },

    _renderEventBreakdown(breakdown) {
      const entries = Object.entries(breakdown);
      if (!entries.length) return '<p style="color:#666">Chưa có events.</p>';
      return `<table class="adm-table">
        <thead><tr><th>Event</th><th>Số lần</th></tr></thead>
        <tbody>${entries.sort((a,b)=>b[1]-a[1]).slice(0,20).map(([evt,cnt])=>`
          <tr><td>${evt}</td><td style="color:#D4A017">${cnt}</td></tr>`).join('')}
        </tbody></table>`;
    },

    async _renderFlags() {
      let flags = {};
      try { const d = await apiGet('/beta/feature-flags'); flags = d.flags || {}; } catch { }
      const FLAG_META = {
        voice_editing:       { name: 'Voice Editing Copilot', desc: 'Chỉnh sửa video bằng giọng nói' },
        content_agent:       { name: 'Content Agent',         desc: 'AI tự động lập kế hoạch nội dung' },
        brand_clone:         { name: 'Brand Clone System',    desc: 'Sao chép phong cách thương hiệu' },
        viral_intelligence:  { name: 'Viral Intelligence',    desc: 'Phân tích tiềm năng viral' }
      };
      return `
        <p class="adm-section-title">Feature Flags</p>
        <p style="font-size:12px;color:#666;margin-bottom:16px">Bật/tắt tính năng cho toàn bộ người dùng beta.</p>
        ${Object.entries(FLAG_META).map(([key, meta]) => `
          <div class="ff-row">
            <div>
              <div class="ff-name">${meta.name}</div>
              <div class="ff-desc">${meta.desc}</div>
            </div>
            <label class="ff-toggle">
              <input type="checkbox" ${flags[key]!==false?'checked':''} onchange="AdminDashboard._toggleFlag('${key}',this.checked)">
              <span class="ff-slider"></span>
            </label>
          </div>`).join('')}`;
    },

    async _toggleFlag(key, enabled) {
      await api('/beta/admin/feature-flags', { flag: key, enabled });
      window.FeatureFlags?._flags && (window.FeatureFlags._flags[key] = enabled);
    }
  };
  window.AdminDashboard = AdminDashboard;

  console.log('[AdminDashboard] Phase 5.5 loaded — Beta Admin Dashboard');
})();
