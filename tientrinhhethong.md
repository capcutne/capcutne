# TIẾN TRÌNH DỰ ÁN — CapCut Video Editor Clone

**Cập nhật lần cuối:** 17/06/2026
**Trạng thái:** Đang phát triển tích cực  
**File chính:** `capcut.html` · **Server:** Python HTTP cổng 5000 · **UI:** Tiếng Việt

---

## TỔNG QUAN DỰ ÁN

Ứng dụng chỉnh sửa video trên trình duyệt theo phong cách CapCut, xây dựng bằng HTML/CSS/JS thuần trong một file duy nhất. Phục vụ qua Python HTTP Server, triển khai dưới dạng static site trên Replit.

| Thông số | Giá trị |
|----------|---------|
| Kiến trúc | Single-file SPA (HTML + CSS + JS) |
| Runtime | Python 3.11 HTTP Server |
| Cổng | 5000 |
| Triển khai | Replit Static Site |
| Ngôn ngữ UI | Tiếng Việt |
| Hệ thống Undo | Stack thực, tối đa 50 bước |

---

## TÍNH NĂNG ĐÃ HOÀN THÀNH

### Nhóm 1 — Hạ tầng & Khởi động

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F01 | Khởi chạy dự án | Cài workflow Python HTTP Server, cấu hình deploy static site trên Replit | 15/06/2026 |

### Nhóm 2 — Phím tắt & Điều hướng

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F02 | Phím tắt phát lại | `Space` play/pause · `K` dừng · `J`/`Home` về đầu · `L`/`End` về cuối | 15/06/2026 |
| F03 | Di chuyển playhead | `←`/`→` ±0.1s · `Shift+←`/`→` ±5s · `,`/`.` ±1s | 15/06/2026 |
| F04 | Phím tắt chỉnh sửa | `S` cắt · `Delete` xóa · `Ctrl+D` nhân đôi · `Ctrl+Z` hoàn tác | 15/06/2026 |
| F05 | Bảng phím tắt | Nhấn `?` hoặc nút toolbar để mở cheat sheet đầy đủ · `Esc` đóng | 15/06/2026 |
| F06 | Phím tắt âm lượng | `↑`/`↓` tăng/giảm 5% volume cho clip audio đang chọn | 15/06/2026 |
| F07 | Chuyển clip bằng Tab | `Tab` chọn clip tiếp theo theo thứ tự thời gian, timeline tự cuộn vào view | 15/06/2026 |
| F08 | Xuất phím tắt PDF | Nút "📥 Tải PDF" trong popup mở trang in đầy đủ, hỗ trợ Print to PDF | 15/06/2026 |

### Nhóm 3 — Timeline & Zoom

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F09 | Zoom bằng phím | `Ctrl++` phóng to · `Ctrl+-` thu nhỏ timeline | 15/06/2026 |
| F10 | Zoom bằng chuột | `Ctrl+Scroll` zoom tại vị trí con trỏ, giữ nguyên điểm nhìn | 15/06/2026 |
| F11 | Snap to Grid nâng cao | Clip tự hút vào mốc 1s/5s tùy mức zoom · `Alt+Drag` để tắt snap tạm thời | 15/06/2026 |
| F12 | Minimap Timeline | Thanh tổng quan phía dưới: hiển thị tất cả clip theo màu track, viewport indicator, playhead marker · Click/kéo để scroll nhanh | 15/06/2026 |

### Nhóm 4 — Chỉnh sửa Clip

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F13 | Undo/Redo thực | History stack thực (tối đa 50 bước) · `Ctrl+Z` hoàn tác · `Ctrl+Y` làm lại · dots trên topbar phản ánh trạng thái | 15/06/2026 |
| F14 | Chọn nhiều clip | `Shift+Click` thêm vào chọn · Kéo chuột trên nền timeline để chọn vùng (rubber-band selection) | 15/06/2026 |
| F15 | Copy / Paste | `Ctrl+C` sao chép · `Ctrl+V` dán tại vị trí playhead | 15/06/2026 |
| F22 | Hiển thị thời lượng Clip | Tooltip hiển thị thời lượng chính xác (giây) khi hover lên clip trên timeline | 17/06/2026 |

### Nhóm 5 — Keyframe Animation

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F16 | Keyframe Editor | Panel 🎯 Keyframe trong right panel: thêm/xóa keyframe tại playhead cho 4 thuộc tính (Opacity, Volume, Brightness, Scale) · Mini strip hiển thị vị trí · Slider chỉnh giá trị · Áp dụng preview trực tiếp lên khung hình khi phát | 15/06/2026 |
| F17 | Easing Curves | 6 loại easing: **Linear · Ease In · Ease Out · Ease In-Out · Bounce Out · Elastic** · Mỗi keyframe chọn riêng loại easing · Canvas mini vẽ đường cong thực tế theo hàm toán học | 15/06/2026 |
| F18 | Audio Waveform thực | Upload file MP3/WAV/AAC → Web Audio API decode → 300 peak samples → vẽ canvas trên clip. Fallback pseudo-random có seed (nhất quán). Duration tự cập nhật theo file thực. Nút tải lên trong tab Âm thanh | 15/06/2026 |
| F19 | Playback âm thanh thực | `HTMLAudioElement` pool đồng bộ với playhead · Phát/dừng cùng `Space` · Seek tức thì khi kéo ruler/phím · Drift correction mỗi 100ms · Volume `↑`/`↓` cập nhật live · Clip highlight `playing-now` khi đang phát | 15/06/2026 |
| F20 | Lưu / Mở dự án | Xuất toàn bộ state ra file `.capcut` (JSON) · Nút Lưu/Mở trên toolbar · `Ctrl+S` lưu nhanh · Modal đặt tên dự án · Load khôi phục tracks/zoom/playhead/ratio · Cảnh báo clip audio cần upload lại | 15/06/2026 |

### Nhóm 6 — Giao diện & Chủ đề

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F21 | Đổi màu nền Timeline | Nút chuyển đổi màu nền timeline giữa 3 chủ đề: Tối (mặc định), Xanh đậm, Tím | 17/06/2026 |


### Nhóm 3 — Timeline & Zoom

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F23 | Đếm ngược thời gian còn lại | Hiển thị thời gian còn lại (tổng − playhead) bên cạnh timecode trên preview | 17/06/2026 |


### Nhóm 2 — Phím tắt & Điều hướng

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F40 | Tìm kiếm clip theo tên | Gõ tên để lọc clip trên timeline | 17/06/2026 |


### Nhóm 6 — Giao diện & Chủ đề

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F38 | Chế độ toàn màn hình Preview | Phóng to vùng xem trước | 17/06/2026 |


### Nhóm 3 — Timeline & Zoom

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F24 | Đánh dấu mốc thời gian (Markers) | Phím M đặt marker tại playhead; hiển thị trên ruler; click để seek; Delete để xóa | 17/06/2026 |


### Nhóm 2 — Phím tắt & Điều hướng

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F25 | Slider tốc độ phát tùy chỉnh | Slider 0.25x→4x trên topbar; phím [ ] để tăng/giảm tốc; áp dụng lên tất cả audio | 17/06/2026 |


### Nhóm 4 — Chỉnh sửa Clip

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F26 | Bộ đếm Clip & Track | Badge góc dưới phải hiển thị số track và clip hiện có, cập nhật live | 17/06/2026 |


### Nhóm 2 — Phím tắt & Điều hướng

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F27 | Mute / Unmute clip audio | Phím M khi chọn clip audio để mute/unmute; icon 🔇 hiển thị trên clip | 17/06/2026 |


### Nhóm 1 — Hạ tầng & Khởi động

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F28 | Thanh tiến trình Xuất video | Modal giả lập xuất với progress bar, phần trăm, bước xử lý khi nhấn 'Xuất video' | 17/06/2026 |


### Nhóm 4 — Chỉnh sửa Clip

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F29 | Đặt tên Clip nhanh | Double-click vào clip trên timeline mở inline input để đổi tên clip | 17/06/2026 |


### Nhóm 3 — Timeline & Zoom

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F30 | Cuộn Timeline bằng chuột giữa | Scroll chuột trên timeline cuộn ngang; Shift+Scroll cuộn nhanh hơn 5x | 17/06/2026 |


### Nhóm 4 — Chỉnh sửa Clip

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F31 | Nhóm chọn clip bằng Ctrl+A | Ctrl+A chọn tất cả clip; Ctrl+Shift+A bỏ chọn tất cả | 17/06/2026 |


### Nhóm 5 — Keyframe Animation

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F32 | Xem trước màu Bộ lọc | Hover lên thumbnail bộ lọc hiển thị tên và mô tả hiệu ứng màu trong tooltip | 17/06/2026 |


### Nhóm 2 — Phím tắt & Điều hướng

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F33 | Phím tắt I/O vùng chọn | Phím I đặt điểm vào (In), phím O đặt điểm ra (Out); hiển thị vùng trên ruler | 17/06/2026 |


### Nhóm 6 — Giao diện & Chủ đề

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F34 | Hiển thị FPS & Độ phân giải | Badge nhỏ trên topbar hiển thị FPS (30/60) và độ phân giải hiện tại của dự án | 17/06/2026 |


### Nhóm 4 — Chỉnh sửa Clip

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F35 | Màu sắc theo loại Track | Highlight track head bằng màu riêng theo loại (video/audio/text/effect) khi hover | 17/06/2026 |


### Nhóm 3 — Timeline & Zoom

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| F36 | Hiển thị grid thời gian | Đường kẻ dọc mờ theo mốc thời gian trên timeline để căn chỉnh dễ hơn | 17/06/2026 |

---

## BACKLOG — TÍNH NĂNG CẦN BUILD

> Thêm tính năng mới vào đây trước khi bắt đầu build.

| Ưu tiên | Tính năng | Mô tả yêu cầu |
|---------|-----------|---------------|
| — | *(trống)* | Chưa có yêu cầu mới |
---

## QUY TRÌNH LÀM VIỆC

```
1. ĐỌC   → Mở file này, nắm trạng thái hiện tại
2. PHÂN TÍCH → grep + read code liên quan trong capcut.html
3. THIẾT KẾ  → Xác định thay đổi CSS / HTML / JS cần làm
4. BUILD     → Chỉnh sửa capcut.html (edit song song nếu có thể)
5. KIỂM TRA  → Chụp screenshot, xem console log
6. CẬP NHẬT → Di chuyển tính năng từ Backlog → Đã hoàn thành
```

---

## GHI CHÚ KỸ THUẬT QUAN TRỌNG

| Chủ đề | Ghi chú |
|--------|---------|
| **TPL_CLIP** | Snapshot của `#rp-body` lúc load, dùng cho tab Chỉnh sửa. Thêm HTML vào `#rp-body` trước dòng `const TPL_CLIP = ...` |
| **saveState()** | Phải gọi trước mọi thao tác thay đổi `tracks[]` để Undo hoạt động đúng |
| **renderAll()** | Gọi sau mọi thay đổi state. Tự động gọi `renderMinimap()` và `renderKFEditor()` |
| **Keyframe data** | `clip.keyframes[prop] = [{t, v, easing}]` — `t` là giây tính từ đầu clip |
| **Easing engine** | `kfInterpolate()` dùng easing của keyframe *trước* (out-going), không phải keyframe sau |
| **Snap** | `SNAP_PX = 6` pixels, bắt vào grid (1s/5s) và cạnh clip lân cận. `Alt` key disable |
| **Minimap** | `renderMinimap()` đọc `tl-scroll.scrollLeft` → không gọi trong scroll handler vòng lặp |
