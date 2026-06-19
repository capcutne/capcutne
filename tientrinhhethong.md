# TIẾN TRÌNH DỰ ÁN — CapCut Video Editor Clone

**Cập nhật lần cuối:** 19/06/2026  
**Trạng thái:** Đang phát triển tích cực  
**File chính:** `capcut.html` · **Server:** Python HTTP cổng 5000 · **UI:** Tiếng Việt

---

## ✅ CHECKLIST HOÀN THÀNH — TẤT CẢ CHỨC NĂNG ĐÃ BUILD

> Cập nhật mỗi khi hoàn thành một tính năng. Chức năng mới nhất ở **đầu danh sách**.

### Phase 5.4 — Natural Language Video Editing ✅
- [x] F123 — Conversation Memory: nhớ ngữ cảnh trong cùng phiên ("tất cả" = shorts vừa tạo, "tiếp tục" = kế hoạch trước)
- [x] F122 — Agent Collaboration: Task Planner điều phối Viral Intelligence, Subtitle Pro, Export Engine, Brand Clone, Content Agent
- [x] F121 — Context Awareness: AI hiểu "video này", "clip này", "đoạn đang chọn" từ trạng thái editor thực tế
- [x] F120 — Safe Execution: yêu cầu xác nhận trước khi xóa project, export hàng loạt, ghi đè
- [x] F119 — Preview Before Execute: hiển thị kế hoạch từng bước, người dùng xác nhận trước khi chạy
- [x] F118 — Multi-step Planning: "Tạo 10 shorts" → [transcript → viral → generate → subtitle → export]
- [x] F117 — Intent Understanding: 6 intent (EDIT_VIDEO, CREATE_SHORTS, GENERATE_SUBTITLE, EXPORT, ANALYZE, PUBLISH_PREP)
- [x] F116b — AI Command Center Dashboard: panel NL Edit với context badge, examples, history, exec progress
- [x] F116a — TaskPlanner (`js/planner.js`): Natural Language → `/ai/plan-task` → Action Engine → Timeline

### Phase 5.3 — Voice Editing Copilot ✅
- [x] F116 — Hotword Activation: "Hey Editor" / "Này AI" kích hoạt nghe tự động
- [x] F115 — Push-to-Talk: giữ nút mic để ra lệnh, thả để xử lý
- [x] F114 — Destructive Action Confirmation: các lệnh nguy hiểm (xóa clip, export...) yêu cầu xác nhận trước khi thực hiện
- [x] F113 — Voice History: lưu lịch sử 50 lệnh giọng nói vào localStorage `cc_voice_history`
- [x] F112b — VoiceCopilot Panel: UI nổi với waveform, transcript, history, nút PTT, hotword toggle
- [x] F112a — Voice → STT → AI Copilot → Action Engine: pipeline hoàn chỉnh Web Speech API → `/ai/editor-command` → `executeActions()` → Timeline

### Phase 4.0 — Auto Content Factory ✅
- [x] F112 — AI Copilot Commands: "Chạy factory", "Tạo toàn bộ nội dung", "Xuất factory package"
- [x] F111 — Export Package JSON: cấu trúc /youtube /shorts /tiktok /reels /blog /newsletter /social
- [x] F110 — Publishing Manager Integration: tự động push các outputs vào PublishingManager sau khi tạo xong
- [x] F109 — Bulk Export: manifest JSON đầy đủ theo platform structure
- [x] F108 — Social Posts Generator: `/cfactory/social` → 20 posts, 20 captions, 30 hashtags từ transcript thật
- [x] F107 — Newsletter Generator: `/cfactory/newsletter` → subject, preheader, body, CTA tiếng Việt
- [x] F106 — Blog Generator: `/cfactory/blog` → Markdown, summary từ transcript thật
- [x] F105 — Title/Hook/CTA Generator: `/cfactory/titles` → 5 tiêu đề + 5 hooks + 5 CTAs mỗi content piece
- [x] F104 — AI Content Planner: `/cfactory/plan` → contentPlan array từ transcript + viral + brand
- [x] F103 — Factory Pipeline: Transcript → Viral → Brand → Plan → Generate → Publishing → Export
- [x] F102 — Factory Dashboard (`js/content_factory.js`): tab Pipeline/Kết quả/Loại nội dung/Lịch sử
- [x] F101 — Content Types: 12 loại (youtube_long, youtube_short, tiktok, instagram_reel, facebook_reel, linkedin, x_post, blog_md, newsletter, social_post, caption, hashtags)
- [x] F100 — ContentFactoryManager: CRUD runs + outputs, localStorage cc_cfactory_runs + cc_cfactory_current
- [x] F99 — Server Endpoints: /cfactory/plan · /cfactory/titles · /cfactory/blog · /cfactory/newsletter · /cfactory/social
- [x] F98 — Action Engine Phase 4.0: `generate_content_factory`, `export_factory`

### Phase 4.1 — AI Publishing System ✅
- [x] F97 — AI Copilot Commands: "Tối ưu cho TikTok/YouTube", "Lên lịch tuần tới", "Kiểm tra lỗi publish", "Xuất package"
- [x] F96 — Export Package System: xuất manifest JSON với cấu trúc /youtube /tiktok /instagram /facebook /linkedin /x
- [x] F95 — Approval Workflow: Draft → Review → Approved → Scheduled → Published/Failed
- [x] F94 — Bulk Operations: validate hàng loạt, AI tối ưu hàng loạt, lên lịch hàng loạt, export package
- [x] F93 — Schedule System: chọn ngày giờ đăng, cancel lịch, hiển thị lịch đã lên
- [x] F92 — Publish Queue: 6 trạng thái Draft/Review/Approved/Scheduled/Published/Failed với badge màu
- [x] F91 — AI Platform Optimizer: tự động tối ưu title/description/hashtag theo YouTube/TikTok/Instagram/Facebook/LinkedIn/X
- [x] F90 — Content Validator: kiểm tra title length, hashtag count, thumbnail, CTA, aspect ratio
- [x] F89 — Publishing Dashboard: tab Queue/Lịch/Platforms/Bulk với stats row và action buttons
- [x] F88 — Platform Profiles: 6 nền tảng với maxTitle, maxDesc, ratio, hashtagLimit, posting tips
- [x] F87 — PublishingManager (`js/publishing.js`): CRUD packages, localStorage cc_publish_packages/schedules/settings, Action Engine 4 actions mới

### Phase 5.1 — System Health Monitor & Logger ✅
- [x] F86 — System Logger (`js/logger.js`): Ring buffer structured logging, bắt lỗi JS toàn cục
- [x] F85 — Health Score tự động: tính điểm 0–100 trừ điểm theo từng vấn đề
- [x] F84 — System Health Dashboard (`js/health.js`): RAM heap, localStorage breakdown, module status, error log, auto-refresh 12s

### Phase 5.0 — Autonomous Content Agent ✅
- [x] F83 — Content Calendar Generator: tạo lịch đăng nội dung theo ngày/tuần
- [x] F82 — Task Queue Manager: tạo/cập nhật task tự động từ opportunities
- [x] F81 — AI Idea Generator: tạo ý tưởng video theo hook type, platform, format
- [x] F80 — Content Opportunity Detector: phát hiện 10 cơ hội nội dung từ dữ liệu thực
- [x] F79 — Unified Memory Layer: tổng hợp Analytics + Brand + StyleMemory + Timeline vào 1 snapshot
- [x] F78 — Agent Center Dashboard (`js/agent.js`): panel 🤖 Agent Center trên sidebar trái
- [x] F77 — AI Recommendations Engine: phân tích memory → đề xuất hook/subtitle/CTA/platform tối ưu
- [x] F76 — Action Engine Phase 5.0: `run_agent`, `generate_ideas`, `generate_calendar`, `act_generate_content_plan`

### Phase 4.2 — Content Performance Analytics ✅
- [x] F75 — Import CSV/JSON Analytics: import dữ liệu thực từ YouTube Studio / TikTok Analytics
- [x] F74 — Viral Score Calibration: so sánh predicted vs actual score, tính avgAbsError
- [x] F73 — AI Insights Engine: `POST /ai/viral-analysis` → phân tích top hooks, CTA ranking, subtitle CTR
- [x] F72 — Performance Record CRUD: thêm/sửa/xóa record thủ công, tự tính composite score
- [x] F71 — Analytics Dashboard (`js/analytics.js`): 3 tab (Analytics, Insights, Performance), top/worst ranking, sample data

### Phase 3.1 — Brand Clone System ✅
- [x] F64 — Action Engine Phase 3.1: `train_brand`, `apply_brand`, `compare_brand`, `generate_brand_cta`, `generate_brand_short`
- [x] F63 — Brand Dashboard UI: Tab 🗄 Brand trên sidebar trái, 8 cards
- [x] F62 — Brand Recommendations Banner: banner nổi sau 5s, 1-click áp dụng
- [x] F61 — Export / Import JSON Brand Profile: backup/chuyển thiết bị
- [x] F60 — Generate Brand Short: gọi ShortsGen với brandStyle params
- [x] F59 — Generate Brand CTA + Hook: GPT tạo CTA + hook theo phong cách brand
- [x] F58 — Brand Comparison: `POST /brand/compare` → similarity 0–100
- [x] F57 — Apply Brand Style: áp template qua SubEngine, thông báo áp dụng
- [x] F56 — Brand Score 4 chiều: consistency, subtitleConsistency, hookConsistency, editingConsistency
- [x] F55 — Brand Profile CRUD: tạo/xóa/chuyển đổi tối đa 5 profile
- [x] F54 — Train từ nhiều nguồn: `trainFromCurrentEditor()`, `trainFromProjects()`, merge patterns
- [x] F53 — Training Pipeline: `POST /brand/train` GPT phân tích transcripts + subtitles + timeline
- [x] F52 — BrandCloneManager (`js/brand.js`): localStorage `cc_brand_profiles` + `cc_brand_active`

### Phase 3.0 — Personal Editing Memory ✅
- [x] F51 — Action Engine Phase 3.0: `apply_my_style`, `save_style_snapshot`, `restore_style`
- [x] F50 — Gợi ý tự động (Suggestion Banner): banner nổi sau 3s, tự đóng sau 9s
- [x] F49 — Dashboard "My Style": Tab ⭐ My Style, thống kê + presets + hoạt động
- [x] F48 — Style Presets (Snapshots): tối đa 10 preset, đặt tên, áp dụng/xóa
- [x] F47 — Áp dụng phong cách (Apply My Style): 1-click áp toàn bộ phong cách
- [x] F46 — Style Score Confidence: 3 chiều 0–1, progress bar visualization
- [x] F45 — Học từ hành động người dùng: auto-hook SubEngine, ProjectManager, click listener
- [x] F44 — StyleMemoryManager (`js/memory.js`): localStorage `cc_style_profile` + `cc_style_snaps`

### Phase 2.3 — Batch Shorts Factory ✅
- [x] F70 — Batch Export Dashboard: chọn nhiều short, export hàng loạt qua ExportEngine
- [x] F69 — Preview Short trên timeline: previewShort() gọi ShortsGen áp lên editor
- [x] F68 — Metadata Generation: AI tạo 3 variant tiêu đề, description, CTA, hashtag, thumbnail text
- [x] F67 — Viral Scoring 4 chiều: hook_score, retention_score, emotional_score, overall_score
- [x] F66 — Batch Shorts Factory (`js/factory.js`): `POST /factory/run` → pipeline 2 bước AI, polling status

### Phase 2.2 — Export Engine v2.2 ✅
- [x] F65 — Lịch sử Export: lưu/load 50 record gần nhất, hiển thị filesize + thời gian
- [x] F64b — Timeline Compiler → RenderPlan: compile tracks/clips/subtitles trước khi render
- [x] F63b — Server-side Cancel: `POST /export/cancel` dừng FFmpeg mid-encode
- [x] F62b — Stage Indicator: 5 bước trực quan (Compile → Filter → Encode → Mux → Done)
- [x] F61b — ETA tracking: ước tính thời gian còn lại dựa trên elapsed/progress
- [x] F60b — Export Engine v2 (`js/export.js`): modal xuất đầy đủ, MP4/WebM/GIF, 480p→4K, lịch sử

### Phase 2 — Viral Intelligence System ✅
- [x] F59b — Hook Detector: phát hiện segment hook tốt nhất trong video
- [x] F58b — Boring Segment Detector: đánh dấu vùng giữ chân kém trên timeline
- [x] F57b — Timeline Heatmap Overlay: overlay màu xanh/vàng/đỏ trực tiếp trên timeline
- [x] F56b — Viral Score 0–100: speech_pace + scene_activity + subtitle_density − silence_penalty
- [x] F55b — Viral Intelligence Panel (`js/viral.js`): `POST /ai/viral-analysis`, ViralEngine v2.1

### Phase 1.7 — Transcript Intelligence ✅
- [x] F54b — Multi-asset Transcript: chuyển đổi giữa nhiều asset, lưu `cc_transcripts`
- [x] F53b — Transcript Search: tìm kiếm từ khóa trong transcript, highlight kết quả
- [x] F52b — Jump-to-segment: click segment → seek playhead đến đúng thời điểm
- [x] F51b — Confidence Score per word: hiển thị màu theo độ tin cậy từng từ
- [x] F50b — Word-level Timestamps: hiển thị từng từ với timestamp chính xác
- [x] F49b — Real Whisper STT (`js/transcript.js`): upload file → FFmpeg → Whisper API → segment + stats

### Phase 1.4 — Media Asset Manager ✅
- [x] F48b — Drag-to-Timeline: kéo asset từ thư viện thả vào timeline
- [x] F47b — Audio Waveform Preview: decode Web Audio API, hiển thị trực tiếp trong card
- [x] F46b — Asset Library Grid: phân loại video/image/audio, thumbnail, duration, size
- [x] F45b — Xử lý Video/Image/Audio: tạo thumbnail, đọc duration, tạo objectURL
- [x] F44b — Media Asset Manager (`js/media.js`): upload file, metadata localStorage `cc_assets`

### Phase 1.2 — AI Shorts Generator ✅
- [x] F43b — Apply Short to Timeline: 1-click cắt timeline theo vùng short đã chọn
- [x] F42b — Short Result Cards: tiêu đề, thời gian, score, hook text, nút áp dụng
- [x] F41b — AI Shorts Generator (`js/shorts.js`): `POST /ai/generate-shorts`, top 10 segments theo viral score

### Phase 1.3 — Project Save System ✅
- [x] F40b — Backend API Sync: `POST /project/save`, `GET /project/list`, `GET /project/{id}`
- [x] F39b — Version History: lưu tối đa 10 snapshot, browse + restore
- [x] F38b — Session Restore: auto-load khi mở lại trình duyệt
- [x] F37b — Auto-save 30s: `cc_autosave` localStorage + beforeunload
- [x] F36b — Project Manager (`js/project.js`): lưu/mở dự án `.capcut` JSON, Ctrl+S

### Hạ tầng & Migration ✅
- [x] F43 — Server xác nhận khởi động: 9 module JS load đúng, cổng 5000
- [x] F42 — Cấu hình OPENAI_API_KEY: Replit AI Integrations, không cần key thủ công
- [x] F41 — Migrate sang Replit Environment: package openai + ffmpeg Nix

### Tính năng Cơ bản (F01–F40) ✅
- [x] F40 — Tìm kiếm clip theo tên
- [x] F39 — Gộp nhiều clip Ctrl+G
- [x] F38 — Chế độ toàn màn hình Preview
- [x] F37 — Tự động lưu 60s + badge xanh
- [x] F36 — Grid thời gian trên timeline
- [x] F35 — Màu sắc theo loại Track khi hover
- [x] F34 — Badge FPS & Độ phân giải
- [x] F33 — Phím tắt I/O vùng chọn
- [x] F32 — Xem trước màu Bộ lọc (tooltip)
- [x] F31 — Ctrl+A chọn tất cả / Ctrl+Shift+A bỏ chọn
- [x] F30 — Cuộn ngang bằng chuột giữa + Shift×5
- [x] F29 — Double-click đổi tên clip inline
- [x] F28 — Thanh tiến trình Xuất video (modal)
- [x] F27 — Mute/Unmute clip audio (phím M + icon 🔇)
- [x] F26 — Bộ đếm Clip & Track badge live
- [x] F25 — Slider tốc độ phát 0.25×→4× + phím [/]
- [x] F24 — Markers thời gian (phím M → đặt/xóa/seek)
- [x] F23 — Đếm ngược thời gian còn lại trên preview
- [x] F22 — Tooltip thời lượng clip khi hover
- [x] F21 — 3 chủ đề màu nền Timeline
- [x] F20 — Lưu/Mở dự án .capcut + Ctrl+S
- [x] F19 — Playback âm thanh thực (HTMLAudioElement pool)
- [x] F18 — Audio Waveform thực (Web Audio API)
- [x] F17 — Easing Curves 6 loại (Linear/EaseIn/Out/Bounce/Elastic)
- [x] F16 — Keyframe Editor 4 thuộc tính (Opacity/Volume/Brightness/Scale)
- [x] F15 — Copy/Paste Ctrl+C/V
- [x] F14 — Chọn nhiều clip (Shift+Click + rubber-band)
- [x] F13 — Undo/Redo stack thực 50 bước
- [x] F12 — Minimap Timeline (tổng quan + drag scroll)
- [x] F11 — Snap to Grid nâng cao (1s/5s, Alt tắt tạm)
- [x] F10 — Zoom chuột Ctrl+Scroll tại con trỏ
- [x] F09 — Zoom phím Ctrl++/−
- [x] F08 — Xuất phím tắt PDF
- [x] F07 — Tab chuyển clip kế tiếp + auto-scroll
- [x] F06 — Phím ↑/↓ điều chỉnh volume
- [x] F05 — Bảng phím tắt (phím ? / Esc)
- [x] F04 — Phím tắt chỉnh sửa S/Delete/Ctrl+D/Ctrl+Z
- [x] F03 — Di chuyển playhead ←/→ / Shift±5s / ,/.
- [x] F02 — Phím tắt phát lại Space/K/J/L/Home/End
- [x] F01 — Khởi chạy dự án Python HTTP Server cổng 5000

---

## TỔNG QUAN DỰ ÁN

Ứng dụng chỉnh sửa video trên trình duyệt theo phong cách CapCut, xây dựng bằng HTML/CSS/JS thuần. Phục vụ qua Python HTTP Server + AI backend, triển khai trên Replit.

| Thông số | Giá trị |
|----------|---------|
| Kiến trúc | Single-file SPA (HTML + CSS + JS) + 18 module JS |
| Runtime | Python 3.11 HTTP Server |
| Cổng | 5000 |
| Triển khai | Replit |
| Ngôn ngữ UI | Tiếng Việt |
| Hệ thống Undo | Stack thực, tối đa 50 bước |
| AI Backend | Replit OpenAI Integration (không cần API key) |
| Module JS | 20 files (actions, ai, agent, analytics, brand, content_factory, export, factory, health, logger, media, memory, project, publishing, shorts, subtitle_pro, subtitles, transcript, viral) |

---

## CHI TIẾT TÍNH NĂNG ĐÃ HOÀN THÀNH

### Nhóm 9 — Phase 5.1: System Health Monitor & Logger

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F84 | System Health Dashboard | Module `js/health.js` — Panel 🏥 Health trên sidebar · Theo dõi: JS heap RAM, localStorage theo module, số lượng asset/project/transcript/export, danh sách lỗi gần nhất · Auto-refresh mỗi 12s khi panel mở · Nút "Xoá cache" xóa toàn bộ cc_* · Health Score 0–100 | 19/06/2026 |
| F85 | Health Score Tự Động | Tính điểm 0–100: trừ điểm theo RAM > 80%, localStorage > 4MB, lỗi > 5, module missing · Badge màu xanh/vàng/đỏ theo ngưỡng | 19/06/2026 |
| F86 | System Logger | Module `js/logger.js` — Ring buffer tối đa 500 entry trong localStorage · 5 level: DEBUG/INFO/WARN/ERROR · Bắt window.onerror và unhandledrejection tự động · Dispatch event cc:log cho HealthMonitor | 19/06/2026 |

### Nhóm 10 — Phase 5.0: Autonomous Content Agent

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F76 | Agent Center Dashboard | Module `js/agent.js` — Panel 🤖 Agent Center trên sidebar trái · 4 tab: Dashboard, Ý tưởng, Lịch đăng, Tasks · Agent không tự đăng — mọi action cần xác nhận người dùng | 19/06/2026 |
| F77 | Unified Memory Layer | `buildMemory()` — tổng hợp live data từ AnalyticsManager + BrandClone + StyleMemory + tracks thành 1 snapshot JSON · Lưu vào `cc_agent_state` | 19/06/2026 |
| F78 | Content Opportunity Detector | `detectOpportunities(mem)` — phát hiện tối đa 10 cơ hội: platform chưa khai thác, hook type thiếu, short-form gap, subtitle CTR, brand consistency, viral calibration, content velocity | 19/06/2026 |
| F79 | AI Recommendations Engine | `_buildRecommendations()` — đề xuất hook/subtitle/CTA/platform tối ưu dựa trên memory · Hiển thị dưới dạng card với priority (high/medium/low) và expectedGain | 19/06/2026 |
| F80 | AI Idea Generator | `generateIdeas(mem, count)` — tạo N ý tưởng video với: tiêu đề, hook type, platform, format, hashtag, predict_score, CTR, retention · Dựa trên data thực từ analytics + brand | 19/06/2026 |
| F81 | Content Calendar | `generateCalendar(days, mem)` — lịch đăng nội dung theo ngày, phân bổ platform đều, spacing hợp lý · Lưu `cc_agent_calendar` | 19/06/2026 |
| F82 | Task Queue Manager | `createTask()` / `updateTask()` — queue task theo priority · `_autoGenerateTasks()` tự tạo task từ opportunities · Hiển thị dạng kanban card | 19/06/2026 |
| F83 | Action Engine Phase 5.0 | `run_agent`, `generate_ideas`, `generate_calendar`, `act_generate_content_plan` · AI Copilot gọi bằng tiếng Việt: "Chạy agent", "Tạo 5 ý tưởng", "Lên lịch tuần này" | 19/06/2026 |

### Nhóm 11 — Phase 4.2: Content Performance Analytics

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F71 | Analytics Dashboard | Module `js/analytics.js` — Panel 📊 Analytics trên sidebar · 3 tab: Analytics (ranking), Insights (AI), Performance (calibration) · Top/Worst N filter · Sample data để demo | 19/06/2026 |
| F72 | Performance Record CRUD | `addRecord()` / `updateRecord()` / `deleteRecord()` — record lưu `cc_analytics_records` · Schema: views, likes, comments, shares, watchTimeSec, CTR%, retention%, followersGained, hookType, ctaType, subtitleStyle | 19/06/2026 |
| F73 | Composite Score Engine | `_computeScore(metrics)` — tính điểm 0–100: nViews×0.35 + nEngagement×0.25 + nCTR×0.20 + nRetention×0.15 + nFollowers×0.05 · Chuẩn hóa log10 | 19/06/2026 |
| F74 | AI Insights Engine | `generateInsights()` — gọi `POST /ai/viral-analysis` → top hooks, CTA ranking, subtitle CTR · Cache vào `cc_analytics_insights` · Invalidate tự động khi data thay đổi | 19/06/2026 |
| F75 | Viral Score Calibration | `viralCalibration()` — so sánh predicted vs actual score · Tính avgAbsError · Hiển thị bảng delta cho từng video | 19/06/2026 |
| F76b | Import CSV/JSON | Parser tự động nhận diện format (CSV/JSON) · Import từ YouTube Studio export, TikTok Analytics · Map column thông minh | 19/06/2026 |

### Nhóm 7 — Phase 3.0: Personal Editing Memory

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F44 | StyleMemoryManager | Module `js/memory.js` — hồ sơ phong cách người dùng lưu trong localStorage (`cc_style_profile`, `cc_style_snaps`) · Schema đầy đủ: subtitleStyle, exportSettings, favoriteTemplates, preferredAspectRatio, editingPatterns, confidence | 18/06/2026 — 17:45 |
| F45 | Học từ hành động người dùng | Auto-hook vào SubEngine.applyTemplate, ProjectManager.quickSave, SubtitlePro.setAnimation · Click listener trên ratio-btn, sub-tpl-item, exp-start-btn, factory-run-btn · Ghi lại: template, animation, export quality/format, aspect ratio | 18/06/2026 — 17:45 |
| F46 | Style Score Confidence | Tính độ tin cậy 0–1 cho 3 chiều: subtitleStyleConfidence, exportConfidence, templateConfidence · Dùng tỉ lệ top/total · Progress bar visualization | 18/06/2026 — 17:45 |
| F47 | Áp dụng phong cách | Nút "✨ Áp dụng tất cả" — tự động áp template top, animation top, tỷ lệ video top · Tích hợp Action Engine: `apply_my_style` | 18/06/2026 — 17:45 |
| F48 | Style Presets Snapshots | Lưu tối đa 10 preset phong cách · Đặt tên tùy ý · Áp dụng / xóa · Action: `save_style_snapshot`, `restore_style` | 18/06/2026 — 17:45 |
| F49 | Dashboard "My Style" | Tab ⭐ My Style trên sidebar · Gợi ý phong cách, thống kê, top 3 template, hoạt động, presets, nút xóa dữ liệu | 18/06/2026 — 17:45 |
| F50 | Suggestion Banner | Banner nổi sau 3s (nếu ≥2 lần hoạt động) · Hiển thị template + export hay dùng · Nút "Áp dụng" · Tự đóng sau 9s | 18/06/2026 — 17:45 |
| F51 | Action Engine Phase 3.0 | 3 ActionType mới: `apply_my_style`, `save_style_snapshot`, `restore_style` · AI Copilot gọi tiếng Việt | 18/06/2026 — 17:45 |

### Nhóm 8 — Phase 3.1: Brand Clone System

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F52 | BrandCloneManager | Module `js/brand.js` — localStorage `cc_brand_profiles` + `cc_brand_active` · Schema: id, brandName, videosAnalyzed, subtitlePatterns, editingPatterns, hookPatterns, titlePatterns, ctaPatterns, shortPatterns, brandScore, confidence | 18/06/2026 — 17:55 |
| F53 | Training Pipeline | `POST /brand/train` — GPT phân tích transcripts + subtitles + timeline clips · Tính avg_clip_dur, cut_style · Trích xuất hookPatterns, ctaPatterns, subtitlePatterns, titlePatterns, brandScore, confidence | 18/06/2026 — 17:55 |
| F54 | Train từ nhiều nguồn | `trainFromCurrentEditor()` — học từ video đang mở · `trainFromProjects()` — đọc tất cả `cc_proj_*` trong localStorage (tối đa 20) · Merge patterns không trùng | 18/06/2026 — 17:55 |
| F55 | Brand Profile CRUD | Tạo mới / xóa / chuyển đổi tối đa 5 Brand Profile · selector dropdown · auto-persist | 18/06/2026 — 17:55 |
| F56 | Brand Score 4 chiều | consistency, subtitleConsistency, hookConsistency, editingConsistency (0–100) · confidence 0.0–1.0 · Progress bar | 18/06/2026 — 17:55 |
| F57 | Apply Brand Style | `applyBrandStyle()` — áp template hay dùng nhất qua SubEngine · action `apply_brand` | 18/06/2026 — 17:55 |
| F58 | Brand Comparison | `POST /brand/compare` — GPT so sánh editor state với brand · Output: similarity 0–100, differences · Score card màu xanh/vàng/đỏ | 18/06/2026 — 17:55 |
| F59 | Generate Brand CTA + Hook | `POST /brand/compare?mode=generate_cta` — GPT tạo CTA + hook theo đúng phong cách brand | 18/06/2026 — 17:55 |
| F60 | Generate Brand Short | `generateBrandShort()` — gọi ShortsGen với brandStyle params (hookType, paceRating, hookExample) | 18/06/2026 — 17:55 |
| F61 | Export / Import JSON | Export brand profile ra `.json` · Import từ file để backup/chuyển thiết bị | 18/06/2026 — 17:55 |
| F62 | Brand Recommendations Banner | Banner nổi màu xanh sau 5s · hookType, subtitle template, CTA placement · Tự đóng sau 10s | 18/06/2026 — 17:55 |
| F63 | Brand Dashboard UI | Tab 🗄 Brand trên sidebar · 8 cards: Profile, Huấn luyện, Score, Hook, Subtitle, CTA, So sánh, Export | 18/06/2026 — 17:55 |
| F64 | Action Engine Phase 3.1 | 5 ActionType: `train_brand`, `apply_brand`, `compare_brand`, `generate_brand_cta`, `generate_brand_short` | 18/06/2026 — 17:55 |

### Nhóm 6 — Phase 2.3: Batch Shorts Factory

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F66 | Batch Shorts Factory | Module `js/factory.js` — `POST /factory/run` → pipeline 2 bước AI (viral scoring → metadata) · Server-side processing với polling · Dashboard kết quả | 18/06/2026 |
| F67 | Viral Scoring 4 chiều | hook_score, retention_score, emotional_score, overall_score (0.0–1.0) · Sắp xếp DESC theo overall_score | 18/06/2026 |
| F68 | Metadata Generation AI | Batch 1 lần gọi AI: 3 variant tiêu đề, description, CTA, 5 hashtag, thumbnail_text cho tất cả short | 18/06/2026 |
| F69 | Preview & Select Shorts | Card kết quả: tiêu đề, thời gian, score bar, hook line · Checkbox multi-select · Preview trên timeline | 18/06/2026 |
| F70 | Batch Export Dashboard | selectAll/selectNone · export từng short qua ExportEngine · Hiển thị trạng thái từng short | 18/06/2026 |

### Nhóm 5 — Phase 2.2: Export Engine v2.2

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F60b | Export Engine v2 | Module `js/export.js` — Modal xuất đầy đủ: MP4/WebM/GIF, 480p/720p/1080p/1440p/4K, FPS 24/30/60, burn subtitle · Kết nối `POST /export/start` | 18/06/2026 |
| F61b | ETA Tracking | Tính ETA real-time từ elapsed/progress · Hiển thị "Encoding Xs/Ys · ETA Zs" | 18/06/2026 |
| F62b | Stage Indicator | 5 bước trực quan: Compile → Build Filter → Encode → Mux → Done | 18/06/2026 |
| F63b | Server-side Cancel | `POST /export/cancel` → gửi SIGKILL đến FFmpeg process, xóa file tạm | 18/06/2026 |
| F64b | Timeline Compiler → RenderPlan | `_compileTimeline()` phía client: convert tracks/clips/subtitles → RenderPlan trước khi gửi server | 18/06/2026 |
| F65 | Lịch sử Export | Load 50 record gần nhất, hiển thị filename, format, quality, filesize, thời gian · Nút download lại | 18/06/2026 |

### Nhóm 4 — Phase 2: Viral Intelligence System

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F55b | Viral Intelligence System | Module `js/viral.js` — `POST /ai/viral-analysis` · ViralEngine v2.1 · Non-invasive: không sửa editor state | 18/06/2026 |
| F56b | Viral Score 0–100 | 4 chiều: speech_pace, scene_activity, subtitle_density, silence_penalty · Tổng hợp per-segment | 18/06/2026 |
| F57b | Timeline Heatmap Overlay | Overlay màu gradient (xanh→vàng→đỏ) trực tiếp trên timeline theo score · Toggle on/off | 18/06/2026 |
| F58b | Boring Segment Detector | Đánh dấu vùng score < 0.4 · Tooltip giải thích lý do · Nút jump-to-segment | 18/06/2026 |
| F59b | Hook Detector | Phát hiện segment hook tốt nhất · Hiển thị hook line + reason · Nút "Jump to hook" | 18/06/2026 |

### Nhóm 3 — Phase 1.7: Transcript Intelligence

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F49b | Real Whisper STT | Module `js/transcript.js` — Upload file → FFmpeg extract audio (16kHz mono WAV) → Whisper API → segments + word-level timestamps · Lưu `cc_transcripts` | 18/06/2026 |
| F50b | Word-level Timestamps | Mỗi từ có start/end/confidence riêng · Hiển thị inline trong segment | 18/06/2026 |
| F51b | Confidence Score | Màu theo độ tin cậy: xanh ≥0.9, vàng ≥0.7, đỏ <0.7 · Stats: wordCount, speakingRate, avgConfidence | 18/06/2026 |
| F52b | Jump-to-Segment | Click segment → seek playhead đúng thời điểm + renderAll() | 18/06/2026 |
| F53b | Transcript Search | Tìm kiếm từ khóa, highlight kết quả, scroll vào view · Clear search | 18/06/2026 |
| F54b | Multi-asset Transcript | Dropdown chọn asset, lưu transcript riêng theo assetId, so sánh được | 18/06/2026 |

### Nhóm 2 — Phase 1.4: Media Asset Manager

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F44b | Media Asset Manager | Module `js/media.js` — Upload file, metadata lưu localStorage `cc_assets` · Session objectURL | 18/06/2026 |
| F45b | Xử lý Video/Image/Audio | Tạo thumbnail video (canvas), đọc duration, tạo waveform audio · Max upload 200MB | 18/06/2026 |
| F46b | Asset Library Grid | Grid phân loại video/image/audio · Card: thumbnail, tên, duration, size · Empty state | 18/06/2026 |
| F47b | Audio Waveform Preview | Decode Web Audio API, vẽ 100 peak samples vào canvas mini trong card | 18/06/2026 |
| F48b | Drag-to-Timeline | Kéo asset card thả vào timeline track đúng loại · Drop time tính theo vị trí chuột | 18/06/2026 |

### Nhóm 1 — Phase 1.2: AI Shorts Generator

| ID | Tính năng | Chi tiết | Ngày & Giờ |
|----|-----------|----------|------------|
| F41b | AI Shorts Generator | Module `js/shorts.js` — `POST /ai/generate-shorts` · Top 10 segments viral · Score 0.0–1.0 · Hook + reason | 18/06/2026 |
| F42b | Short Result Cards | Card kết quả: tiêu đề, thời gian (HH:MM:SS), score bar màu, hook text, reason, nút Apply | 18/06/2026 |
| F43b | Apply Short to Timeline | `applyShort()` — saveState() → cắt clip trong vùng → áp subtitle liên quan → renderAll() | 18/06/2026 |

### Nhóm 0 — Tính năng Cơ bản (F01–F40)

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F01 | Khởi chạy dự án | Workflow Python HTTP Server, deploy Replit | 15/06/2026 |
| F02 | Phím tắt phát lại | Space play/pause · K dừng · J/Home về đầu · L/End về cuối | 15/06/2026 |
| F03 | Di chuyển playhead | ←/→ ±0.1s · Shift+←/→ ±5s · ,/. ±1s | 15/06/2026 |
| F04 | Phím tắt chỉnh sửa | S cắt · Delete xóa · Ctrl+D nhân đôi · Ctrl+Z hoàn tác | 15/06/2026 |
| F05 | Bảng phím tắt | Phím ? mở cheat sheet đầy đủ · Esc đóng | 15/06/2026 |
| F06 | Phím tắt âm lượng | ↑/↓ tăng/giảm 5% volume clip audio đang chọn | 15/06/2026 |
| F07 | Tab chuyển clip | Tab chọn clip tiếp theo, timeline tự cuộn | 15/06/2026 |
| F08 | Xuất phím tắt PDF | Nút "📥 Tải PDF" mở trang in đầy đủ | 15/06/2026 |
| F09 | Zoom phím | Ctrl++ phóng to · Ctrl+- thu nhỏ timeline | 15/06/2026 |
| F10 | Zoom chuột | Ctrl+Scroll zoom tại vị trí con trỏ | 15/06/2026 |
| F11 | Snap to Grid | Hút vào 1s/5s theo mức zoom · Alt tắt tạm | 15/06/2026 |
| F12 | Minimap Timeline | Tổng quan phía dưới · Click/kéo scroll nhanh | 15/06/2026 |
| F13 | Undo/Redo thực | Stack 50 bước · Ctrl+Z / Ctrl+Y | 15/06/2026 |
| F14 | Chọn nhiều clip | Shift+Click + rubber-band selection | 15/06/2026 |
| F15 | Copy / Paste | Ctrl+C sao chép · Ctrl+V dán tại playhead | 15/06/2026 |
| F16 | Keyframe Editor | 4 thuộc tính (Opacity/Volume/Brightness/Scale) · add/remove tại playhead | 15/06/2026 |
| F17 | Easing Curves | 6 loại: Linear/EaseIn/Out/EaseInOut/BounceOut/Elastic · Canvas vẽ đường cong | 15/06/2026 |
| F18 | Audio Waveform thực | Upload MP3/WAV/AAC → Web Audio API → 300 peaks → vẽ canvas | 15/06/2026 |
| F19 | Playback âm thanh thực | HTMLAudioElement pool · drift correction 100ms | 15/06/2026 |
| F20 | Lưu / Mở dự án | File .capcut JSON · Ctrl+S · Modal đặt tên | 15/06/2026 |
| F21 | Đổi màu nền Timeline | 3 chủ đề: Tối / Xanh đậm / Tím | 17/06/2026 |
| F22 | Hiển thị thời lượng Clip | Tooltip chính xác khi hover | 17/06/2026 |
| F23 | Đếm ngược thời gian | Tổng − playhead bên cạnh timecode | 17/06/2026 |
| F24 | Markers thời gian | M đặt marker · click seek · Delete xóa | 17/06/2026 |
| F25 | Slider tốc độ phát | 0.25×→4× · phím [/] | 17/06/2026 |
| F26 | Bộ đếm Clip & Track | Badge live góc dưới phải | 17/06/2026 |
| F27 | Mute / Unmute audio | Phím M khi chọn clip · icon 🔇 | 17/06/2026 |
| F28 | Thanh tiến trình Xuất | Modal với progress bar + bước xử lý | 17/06/2026 |
| F29 | Đặt tên Clip nhanh | Double-click → inline input | 17/06/2026 |
| F30 | Cuộn ngang chuột giữa | Scroll + Shift×5 tốc độ | 17/06/2026 |
| F31 | Ctrl+A chọn tất cả | Ctrl+A chọn · Ctrl+Shift+A bỏ chọn | 17/06/2026 |
| F32 | Xem trước bộ lọc | Tooltip tên + mô tả hiệu ứng màu | 17/06/2026 |
| F33 | Phím I/O vùng chọn | I điểm vào · O điểm ra · hiển thị trên ruler | 17/06/2026 |
| F34 | Badge FPS & Độ phân giải | Hiển thị FPS (30/60) và resolution | 17/06/2026 |
| F35 | Màu sắc theo loại Track | Highlight track head theo video/audio/text/effect | 17/06/2026 |
| F36 | Grid thời gian | Đường kẻ dọc mờ theo mốc thời gian | 17/06/2026 |
| F37 | Tự động lưu | localStorage mỗi 60s · badge xanh xác nhận | 17/06/2026 |
| F38 | Toàn màn hình Preview | Phóng to vùng xem trước | 17/06/2026 |
| F39 | Gộp nhiều clip | Ctrl+G gộp clip cùng track thành 1 | 17/06/2026 |
| F40 | Tìm kiếm clip | Gõ tên lọc clip trên timeline | 17/06/2026 |
| F41 | Migrate Replit | Package openai + ffmpeg Nix · Replit AI Integrations | 18/06/2026 |
| F42 | OPENAI_API_KEY | Replit AI Integrations — không cần key thủ công | 18/06/2026 |
| F43 | Server xác nhận | 9 module JS load đúng trên cổng 5000 | 18/06/2026 |

---

## BACKLOG — TÍNH NĂNG CẦN BUILD

> Thêm tính năng mới vào đây trước khi bắt đầu build.

| Ưu tiên | Tính năng | Mô tả yêu cầu |
|---------|-----------|---------------|
| — | *(trống)* | Chưa có yêu cầu mới |

---

## QUY TRÌNH LÀM VIỆC

```
1. ĐỌC   → Mở file này, nắm trạng thái hiện tại (xem checklist đầu file)
2. PHÂN TÍCH → grep + read code liên quan
3. THIẾT KẾ  → Xác định thay đổi CSS / HTML / JS cần làm
4. BUILD     → Chỉnh sửa file liên quan
5. KIỂM TRA  → Chụp screenshot, xem console log
6. CẬP NHẬT → Thêm [x] vào checklist đầu file + bổ sung vào bảng chi tiết
```

---

## GHI CHÚ KỸ THUẬT QUAN TRỌNG

| Chủ đề | Ghi chú |
|--------|---------|
| **TPL_CLIP** | Snapshot của `#rp-body` lúc load. Thêm HTML vào `#rp-body` trước dòng `const TPL_CLIP = ...` |
| **saveState()** | Phải gọi trước mọi thao tác thay đổi `tracks[]` để Undo hoạt động đúng |
| **renderAll()** | Gọi sau mọi thay đổi state. Tự động gọi `renderMinimap()` và `renderKFEditor()` |
| **Keyframe data** | `clip.keyframes[prop] = [{t, v, easing}]` — `t` là giây tính từ đầu clip |
| **Easing engine** | `kfInterpolate()` dùng easing của keyframe *trước* (out-going) |
| **Snap** | `SNAP_PX = 6` pixels, bắt vào grid (1s/5s) và cạnh clip lân cận. `Alt` disable |
| **Minimap** | `renderMinimap()` đọc `tl-scroll.scrollLeft` — không gọi trong scroll handler |
| **OpenAI model** | Dùng `gpt-5-mini` (mặc định). Model mới nhất là `gpt-5` (ra 07/08/2025) |
| **Module JS** | 18 file trong `js/` — mỗi module là IIFE, expose qua `window.XxxManager` |
| **ID tiếp theo** | ID tính năng tiếp theo: **F87** |
