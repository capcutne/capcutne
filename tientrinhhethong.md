# 📋 TIẾN TRÌNH HỆ THỐNG — CapCut Video Editor

> Tự động cập nhật sau mỗi lần build tính năng mới.  
> Cập nhật lần cuối: 15/06/2026

---

## ✅ TÍNH NĂNG ĐÃ BUILD

| # | Tính năng | Mô tả | Ngày hoàn thành |
|---|-----------|--------|-----------------|
| 1 | **Khởi chạy dự án** | Cài workflow Python HTTP server phục vụ file tĩnh trên cổng 5000, cấu hình deploy static site | 15/06/2026 |
| 2 | **Phím tắt phát lại** | `Space` play/pause, `K` dừng, `J`/`Home` về đầu, `L`/`End` về cuối | 15/06/2026 |
| 3 | **Phím tắt di chuyển playhead** | `←`/`→` lùi/tiến 0.1s, `Shift+←`/`→` lùi/tiến 5s, `,`/`.` lùi/tiến 1s | 15/06/2026 |
| 4 | **Phím tắt chỉnh sửa** | `S` cắt clip, `Delete` xóa, `Ctrl+D` nhân đôi, `Ctrl+Z` hoàn tác | 15/06/2026 |
| 5 | **Popup bảng phím tắt** | Nhấn `?` hoặc click nút `?` trên toolbar mở bảng cheat sheet đầy đủ, `Esc` đóng | 15/06/2026 |
| 6 | **Nút ? trên toolbar** | Nút truy cập nhanh bảng phím tắt ngay trên thanh công cụ | 15/06/2026 |
| 7 | **Zoom timeline bằng phím** | `Ctrl++` phóng to, `Ctrl+-` thu nhỏ timeline | 15/06/2026 |
| 8 | **Zoom timeline bằng Ctrl+Scroll** | Cuộn chuột + Ctrl để zoom tại vị trí con trỏ, giữ nguyên điểm nhìn | 15/06/2026 |
| 9 | **Snap to Grid nâng cao** | Clip tự hút vào mốc thời gian tròn (1s/5s tùy zoom), `Alt+Drag` để tắt snap tạm thời | 15/06/2026 |
| 10 | **Lịch sử hoàn tác thực** | Undo/Redo stack thực sự (tối đa 50 bước), `Ctrl+Z` hoàn tác, `Ctrl+Y` làm lại, dots trên topbar cập nhật theo | 15/06/2026 |
| 11 | **Phím tắt âm lượng** | `↑`/`↓` tăng/giảm 5% volume clip audio đang chọn | 15/06/2026 |
| 12 | **Chọn nhiều clip** | `Shift+Click` thêm vào chọn, kéo chuột trên nền timeline để chọn vùng (rubber-band) | 15/06/2026 |
| 13 | **Copy/Paste clip** | `Ctrl+C` sao chép, `Ctrl+V` dán tại vị trí playhead | 15/06/2026 |
| 14 | **Phím tắt chuyển track** | `Tab` chuyển sang clip tiếp theo theo thứ tự thời gian, tự cuộn timeline vào view | 15/06/2026 |
| 15 | **Minimap timeline** | Thanh tổng quan phía dưới timeline hiển thị tất cả clips theo màu track, viewport indicator, click/kéo để cuộn timeline, playhead marker | 15/06/2026 |
| 16 | **Xuất danh sách phím tắt PDF** | Nút "📥 Tải PDF" trong popup phím tắt, mở trang in với toàn bộ shortcuts, hỗ trợ Print to PDF | 15/06/2026 |

---

## 🔨 TÍNH NĂNG CẦN BUILD

*Không còn tính năng nào trong backlog — tất cả đã hoàn thành!*

---

## 🔄 QUY TRÌNH KẾ TIẾP

### Bước 1 — Đề xuất tính năng mới
- Người dùng đề xuất tính năng mới để thêm vào danh sách
- Hoặc Agent tự đề xuất dựa trên nhu cầu thực tế

### Bước 2 — Build
1. Đọc file này trước để nắm tình trạng
2. Đọc code hiện tại liên quan đến tính năng (`grep` → `read`)
3. Thiết kế thay đổi (CSS / HTML / JS)
4. Thực hiện chỉnh sửa file `capcut.html`
5. Chụp màn hình kiểm tra kết quả

### Bước 3 — Cập nhật file này
Sau khi build xong, thêm tính năng vào bảng **ĐÃ BUILD**:
- Thêm hàng mới với ngày hoàn thành
- Cập nhật dòng `Cập nhật lần cuối` ở đầu file

---

## 📝 GHI CHÚ KỸ THUẬT

| Mục | Chi tiết |
|-----|----------|
| File chính | `capcut.html` (toàn bộ app trong 1 file) |
| Server dev | Python `http.server` cổng 5000 |
| Deploy | Static site (Replit) |
| Ngôn ngữ UI | Tiếng Việt |
| Phím tắt popup | `?` hoặc nút `?` trên toolbar |
| Undo/Redo | Stack thực, tối đa 50 bước |
| Minimap | Tự động cập nhật khi cuộn/zoom/thêm clip |
| Snap | Grid + edge snap, `Alt` để tắt khi drag |
