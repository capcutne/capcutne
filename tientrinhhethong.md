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

---

## 🔨 TÍNH NĂNG CẦN BUILD

| # | Tính năng | Mô tả | Độ ưu tiên |
|---|-----------|--------|------------|
| 1 | **Snap to Grid nâng cao** | Khi kéo clip tự hút vào mốc thời gian tròn, `Alt` để tắt snap tạm thời | 🔴 Cao |
| 2 | **Lịch sử hoàn tác thực** | Undo/Redo thực sự (stack lịch sử) thay vì demo hiện tại | 🔴 Cao |
| 3 | **Phím tắt âm lượng** | `↑`/`↓` tăng/giảm volume clip đang chọn | 🟡 Trung bình |
| 4 | **Chọn nhiều clip** | `Shift+Click` hoặc kéo chọn vùng để chọn nhiều clip cùng lúc | 🟡 Trung bình |
| 5 | **Copy/Paste clip** | `Ctrl+C` / `Ctrl+V` sao chép và dán clip trên timeline | 🟡 Trung bình |
| 6 | **Phím tắt chuyển track** | `Tab` chuyển focus giữa các track | 🟢 Thấp |
| 7 | **Minimap timeline** | Thanh mini hiển thị tổng quan toàn bộ timeline khi zoom in sâu | 🟢 Thấp |
| 8 | **Xuất danh sách phím tắt PDF** | Cho phép tải bảng phím tắt dạng PDF/ảnh | 🟢 Thấp |

---

## 🔄 QUY TRÌNH KẾ TIẾP

### Bước 1 — Xác nhận tính năng
- Người dùng chọn tính năng từ bảng **TÍNH NĂNG CẦN BUILD** ở trên
- Hoặc đề xuất tính năng mới để thêm vào danh sách

### Bước 2 — Build
1. Đọc code hiện tại liên quan đến tính năng (`grep` → `read`)
2. Thiết kế thay đổi (CSS / HTML / JS)
3. Thực hiện chỉnh sửa file `capcut.html`
4. Chụp màn hình kiểm tra kết quả

### Bước 3 — Cập nhật file này
Sau khi build xong, chuyển tính năng từ bảng **CẦN BUILD** sang **ĐÃ BUILD**:
- Thêm hàng mới vào bảng **ĐÃ BUILD** với ngày hoàn thành
- Xóa hàng tương ứng khỏi bảng **CẦN BUILD**
- Cập nhật dòng `Cập nhật lần cuối` ở đầu file

### Bước 4 — Đồng bộ GitHub
```
git add capcut.html tientrinhhethong.md
git commit -m "feat: <tên tính năng>"
git push origin main
```

---

## 📝 GHI CHÚ KỸ THUẬT

| Mục | Chi tiết |
|-----|----------|
| File chính | `capcut.html` (toàn bộ app trong 1 file) |
| Server dev | Python `http.server` cổng 5000 |
| Deploy | Static site (Replit) |
| GitHub repo | `https://github.com/capcutne/capcutne` |
| Ngôn ngữ UI | Tiếng Việt |
| Phím tắt popup | `?` hoặc nút `?` trên toolbar |
