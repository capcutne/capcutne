/* ============================================================
   js/beta.js — Phase 5.5  User Account System
   UserManager · SessionManager · FeatureFlags · HealthScore · JourneyTracker
   ============================================================ */
(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────
  const SESSION_KEY  = 'cc_beta_session';
  const USER_KEY     = 'cc_beta_user';
  const JOURNEY_KEY  = 'cc_beta_journey';
  const HEALTH_KEY   = 'cc_beta_health';
  const FLAGS_KEY    = 'cc_beta_flags';

  // ── CSS ─────────────────────────────────────────────────────
  const css = `
#beta-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center}
#beta-modal{background:#1a1a1a;border:1px solid #333;border-radius:12px;width:380px;max-width:95vw;padding:32px;color:#eee;font-family:system-ui,sans-serif}
#beta-modal h2{margin:0 0 4px;font-size:22px;color:#D4A017}
#beta-modal .beta-sub{color:#888;font-size:13px;margin-bottom:24px}
.beta-tabs{display:flex;gap:4px;margin-bottom:20px}
.beta-tab{flex:1;padding:8px;border:1px solid #333;background:#111;color:#888;border-radius:6px;cursor:pointer;font-size:13px}
.beta-tab.active{background:#D4A017;color:#000;border-color:#D4A017}
.beta-field{margin-bottom:14px}
.beta-field label{display:block;font-size:12px;color:#888;margin-bottom:5px}
.beta-field input{width:100%;box-sizing:border-box;padding:9px 12px;background:#111;border:1px solid #333;border-radius:6px;color:#eee;font-size:14px;outline:none}
.beta-field input:focus{border-color:#D4A017}
.beta-btn-primary{width:100%;padding:11px;background:#D4A017;border:none;border-radius:6px;color:#000;font-weight:700;font-size:15px;cursor:pointer;margin-top:4px}
.beta-btn-primary:hover{background:#c49010}
.beta-error{color:#f55;font-size:12px;margin-top:-8px;margin-bottom:10px;display:none}
.beta-error.show{display:block}
/* User bar */
#beta-userbar{position:fixed;top:0;right:0;z-index:8000;display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(0,0,0,.6);border-bottom-left-radius:8px;font-size:12px;color:#ccc}
#beta-userbar .bu-name{color:#D4A017;font-weight:600}
#beta-userbar button{padding:3px 10px;background:#2a2a2a;border:1px solid #444;border-radius:4px;color:#ccc;cursor:pointer;font-size:11px}
#beta-userbar button:hover{background:#D4A017;color:#000;border-color:#D4A017}
/* Health badge */
#beta-health-badge{position:fixed;bottom:12px;right:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px 12px;font-size:12px;color:#ccc;z-index:7000;min-width:160px}
#beta-health-badge .bh-score{font-size:22px;font-weight:700;color:#D4A017}
#beta-health-badge .bh-label{color:#888;font-size:10px;margin-bottom:2px}
`;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Utilities ───────────────────────────────────────────────
  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
  }
  function apiGet(path) {
    return fetch(path).then(r => r.json());
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }
  function setUser(u) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }

  // ── Session Manager ─────────────────────────────────────────
  const SessionManager = {
    isLoggedIn() { return !!getSession(); },
    currentUser() { return getUser(); },
    async validate() {
      const sess = getSession();
      if (!sess) return false;
      // Check session timeout (24h)
      if (Date.now() - sess.loginAt > 86400000) {
        this.logout(true);
        return false;
      }
      return true;
    },
    logout(silent = false) {
      const sess = getSession();
      if (sess) api('/beta/logout', { token: sess.token }).catch(() => {});
      setSession(null);
      setUser(null);
      if (!silent) window.location.reload();
    }
  };

  // ── Feature Flags ────────────────────────────────────────────
  const FeatureFlags = {
    _flags: {},
    async load() {
      try {
        const data = await apiGet('/beta/feature-flags');
        this._flags = data.flags || {};
        localStorage.setItem(FLAGS_KEY, JSON.stringify(this._flags));
      } catch {
        try { this._flags = JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}'); } catch { }
      }
    },
    isEnabled(flag) {
      return this._flags[flag] !== false; // default on
    },
    applyAll() {
      // Hide disabled module buttons
      const map = {
        voice_editing: '#tb-voice, #voice-btn',
        content_agent: '#tb-agent',
        brand_clone: '#tb-brand',
        viral_intelligence: '#tb-shorts'
      };
      for (const [flag, sel] of Object.entries(map)) {
        if (!this.isEnabled(flag)) {
          document.querySelectorAll(sel).forEach(el => {
            el.style.display = 'none';
            el.title = `[Bị tắt bởi admin]`;
          });
        }
      }
    }
  };
  window.FeatureFlags = FeatureFlags;

  // ── User Journey Tracker ─────────────────────────────────────
  const JourneyTracker = {
    STEPS: ['register', 'upload_video', 'generate_transcript', 'create_short', 'export'],
    _journey: {},
    load() {
      try { this._journey = JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}'); } catch { this._journey = {}; }
    },
    complete(step) {
      if (this._journey[step]) return;
      this._journey[step] = Date.now();
      localStorage.setItem(JOURNEY_KEY, JSON.stringify(this._journey));
      this._syncServer(step);
      this._checkDropoff();
    },
    _syncServer(step) {
      const user = getUser();
      if (!user) return;
      api('/beta/analytics/event', {
        userId: user.id,
        event: 'journey_step',
        step,
        ts: Date.now()
      }).catch(() => {});
    },
    _checkDropoff() {
      const done = this.STEPS.filter(s => this._journey[s]);
      const pct  = Math.round(done.length / this.STEPS.length * 100);
      api('/beta/analytics/event', {
        userId: getUser()?.id,
        event: 'journey_progress',
        completedSteps: done,
        pct
      }).catch(() => {});
    },
    getCompleted() { return Object.keys(this._journey); }
  };
  window.JourneyTracker = JourneyTracker;

  // ── User Health Score ────────────────────────────────────────
  const HealthScore = {
    _data: {
      onboardingComplete: false,
      exportsCompleted: 0,
      projectsCreated: 0,
      shortCreated: 0,
      subtitleGenerated: 0,
      voiceCommands: 0,
      aiCommands: 0,
      engagementScore: 0
    },
    load() {
      try {
        const s = localStorage.getItem(HEALTH_KEY);
        if (s) Object.assign(this._data, JSON.parse(s));
      } catch { }
    },
    increment(field, by = 1) {
      if (this._data[field] !== undefined) {
        this._data[field] += by;
        this._save();
        this._recalc();
      }
    },
    setFlag(field, val) {
      this._data[field] = val;
      this._save();
      this._recalc();
    },
    _recalc() {
      const d = this._data;
      let score = 0;
      if (d.onboardingComplete) score += 20;
      score += Math.min(d.exportsCompleted * 10, 30);
      score += Math.min(d.projectsCreated * 5, 20);
      score += Math.min((d.shortCreated + d.subtitleGenerated) * 2, 15);
      score += Math.min((d.voiceCommands + d.aiCommands), 15);
      d.engagementScore = Math.min(Math.round(score), 100);
      this._save();
      this._renderBadge();
    },
    _save() {
      localStorage.setItem(HEALTH_KEY, JSON.stringify(this._data));
    },
    _renderBadge() {
      let badge = document.getElementById('beta-health-badge');
      if (!badge) return;
      const d = this._data;
      badge.innerHTML = `
        <div class="bh-label">Health Score</div>
        <div class="bh-score">${d.engagementScore}</div>
        <div style="font-size:10px;color:#666;margin-top:2px">
          📁${d.projectsCreated} 📤${d.exportsCompleted} ✂️${d.shortCreated}
        </div>`;
    },
    getData() { return { ...this._data }; }
  };
  window.HealthScore = HealthScore;

  // ── Analytics Tracker ────────────────────────────────────────
  const BetaAnalytics = {
    track(event, data = {}) {
      const user = getUser();
      const payload = {
        userId: user?.id || 'anonymous',
        event,
        data,
        ts: Date.now(),
        url: location.pathname
      };
      api('/beta/analytics/event', payload).catch(() => {});
    }
  };
  window.BetaAnalytics = BetaAnalytics;

  // ── Auth Modal ───────────────────────────────────────────────
  function showAuthModal(defaultTab = 'login') {
    const overlay = document.createElement('div');
    overlay.id = 'beta-overlay';
    overlay.innerHTML = `
      <div id="beta-modal">
        <h2>CapCut Clone Beta</h2>
        <p class="beta-sub">Chào mừng đến chương trình beta! Đăng ký để tiếp tục.</p>
        <div class="beta-tabs">
          <button class="beta-tab ${defaultTab==='login'?'active':''}" onclick="betaTab('login',this)">Đăng nhập</button>
          <button class="beta-tab ${defaultTab==='register'?'active':''}" onclick="betaTab('register',this)">Đăng ký</button>
        </div>
        <div id="beta-login-form">
          <div class="beta-field"><label>Email</label><input id="bl-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="beta-field"><label>Mật khẩu</label><input id="bl-pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
          <div class="beta-error" id="bl-err"></div>
          <button class="beta-btn-primary" onclick="betaLogin()">Đăng nhập</button>
        </div>
        <div id="beta-register-form" style="display:${defaultTab==='register'?'block':'none'}">
          <div class="beta-field"><label>Tên hiển thị</label><input id="br-name" type="text" placeholder="Nguyễn Văn A" autocomplete="name"></div>
          <div class="beta-field"><label>Email</label><input id="br-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
          <div class="beta-field"><label>Mật khẩu</label><input id="br-pass" type="password" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password"></div>
          <div class="beta-error" id="br-err"></div>
          <button class="beta-btn-primary" onclick="betaRegister()">Đăng ký Beta</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  window.betaTab = function (tab, el) {
    document.querySelectorAll('.beta-tab').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('beta-login-form').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('beta-register-form').style.display = tab === 'register' ? 'block' : 'none';
  };

  window.betaLogin = async function () {
    const email = document.getElementById('bl-email').value.trim();
    const pass  = document.getElementById('bl-pass').value;
    const err   = document.getElementById('bl-err');
    err.classList.remove('show');
    if (!email || !pass) { err.textContent = 'Vui lòng nhập đầy đủ.'; err.classList.add('show'); return; }
    const btn = document.querySelector('#beta-login-form .beta-btn-primary');
    btn.textContent = 'Đang đăng nhập...'; btn.disabled = true;
    try {
      const res = await api('/beta/login', { email, password: pass });
      if (res.error) { err.textContent = res.error; err.classList.add('show'); btn.textContent='Đăng nhập'; btn.disabled=false; return; }
      setSession({ token: res.token, loginAt: Date.now() });
      setUser(res.user);
      document.getElementById('beta-overlay')?.remove();
      initUserBar(res.user);
      JourneyTracker.load();
      HealthScore.load(); HealthScore._recalc();
      BetaAnalytics.track('login', { userId: res.user.id });
    } catch (e) {
      err.textContent = 'Lỗi kết nối.'; err.classList.add('show');
      btn.textContent = 'Đăng nhập'; btn.disabled = false;
    }
  };

  window.betaRegister = async function () {
    const name  = document.getElementById('br-name').value.trim();
    const email = document.getElementById('br-email').value.trim();
    const pass  = document.getElementById('br-pass').value;
    const err   = document.getElementById('br-err');
    err.classList.remove('show');
    if (!name || !email || !pass) { err.textContent = 'Vui lòng nhập đầy đủ.'; err.classList.add('show'); return; }
    if (pass.length < 6) { err.textContent = 'Mật khẩu tối thiểu 6 ký tự.'; err.classList.add('show'); return; }
    const btn = document.querySelector('#beta-register-form .beta-btn-primary');
    btn.textContent = 'Đang đăng ký...'; btn.disabled = true;
    try {
      const res = await api('/beta/register', { displayName: name, email, password: pass });
      if (res.error) { err.textContent = res.error; err.classList.add('show'); btn.textContent='Đăng ký Beta'; btn.disabled=false; return; }
      setSession({ token: res.token, loginAt: Date.now() });
      setUser(res.user);
      document.getElementById('beta-overlay')?.remove();
      initUserBar(res.user);
      JourneyTracker.load();
      JourneyTracker.complete('register');
      HealthScore.load();
      BetaAnalytics.track('register', { userId: res.user.id });
      // Trigger onboarding
      setTimeout(() => window.OnboardingFlow?.start(), 500);
    } catch (e) {
      err.textContent = 'Lỗi kết nối.'; err.classList.add('show');
      btn.textContent = 'Đăng ký Beta'; btn.disabled = false;
    }
  };

  // ── User Bar ─────────────────────────────────────────────────
  function initUserBar(user) {
    let bar = document.getElementById('beta-userbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'beta-userbar';
      document.body.appendChild(bar);
    }
    const isAdmin = user.role === 'admin' || user.email === (window._betaAdminEmail || '');
    bar.innerHTML = `
      <span>👤</span>
      <span class="bu-name">${user.displayName || user.email}</span>
      <span style="color:#555">·</span>
      <span style="color:#888;font-size:11px">Beta</span>
      ${isAdmin ? `<button onclick="window.AdminDashboard?.open()" title="Admin">⚙️ Admin</button>` : ''}
      <button onclick="window.FeedbackManager?.open('bug')" title="Báo lỗi">🐛 Báo lỗi</button>
      <button onclick="SessionManager.logout()">Đăng xuất</button>`;

    // Health badge
    let badge = document.getElementById('beta-health-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'beta-health-badge';
      document.body.appendChild(badge);
    }
    HealthScore._renderBadge();
  }

  // ── Action Engine integration ────────────────────────────────
  document.addEventListener('cc:action', function (e) {
    const { type } = e.detail || {};
    if (type === 'export_done')    { HealthScore.increment('exportsCompleted'); JourneyTracker.complete('export'); BetaAnalytics.track('export'); }
    if (type === 'project_saved')  { HealthScore.increment('projectsCreated'); BetaAnalytics.track('project_saved'); }
    if (type === 'short_created')  { HealthScore.increment('shortCreated'); JourneyTracker.complete('create_short'); BetaAnalytics.track('short_created'); }
    if (type === 'subtitle_done')  { HealthScore.increment('subtitleGenerated'); BetaAnalytics.track('subtitle_done'); }
    if (type === 'voice_command')  { HealthScore.increment('voiceCommands'); BetaAnalytics.track('voice_command'); }
    if (type === 'ai_command')     { HealthScore.increment('aiCommands'); BetaAnalytics.track('ai_command'); }
    if (type === 'video_uploaded') { JourneyTracker.complete('upload_video'); BetaAnalytics.track('video_uploaded'); }
    if (type === 'transcript_done'){ JourneyTracker.complete('generate_transcript'); BetaAnalytics.track('transcript_done'); }
  });

  // ── Boot ─────────────────────────────────────────────────────
  async function boot() {
    FeatureFlags.load().then(() => FeatureFlags.applyAll()).catch(() => {});

    const valid = await SessionManager.validate();
    if (!valid) {
      showAuthModal('login');
      return;
    }
    const user = getUser();
    if (user) {
      initUserBar(user);
      JourneyTracker.load();
      HealthScore.load();
      HealthScore._recalc();
      BetaAnalytics.track('app_open');
    }
  }

  window.SessionManager = SessionManager;
  window.BetaAnalytics  = BetaAnalytics;

  document.addEventListener('DOMContentLoaded', boot);

  console.log('[BetaProgram] Phase 5.5 loaded — User Account System');
})();
