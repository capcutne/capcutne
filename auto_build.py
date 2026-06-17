#!/usr/bin/env python3
"""
auto_build.py — Tự động build tính năng mới cho CapCut Video Editor Clone.

Quy trình:
  1. Đọc tientrinhhethong.md (danh sách tính năng đã có + backlog)
  2. Đọc capcut.html (source code hiện tại)
  3. Gọi OpenAI: phân tích, chọn 1 tính năng từ backlog (hoặc đề xuất mới)
  4. Gọi OpenAI: sinh code JS/CSS/HTML để thêm vào capcut.html
  5. Chèn code vào capcut.html ngay trước </script> cuối cùng
  6. Cập nhật tientrinhhethong.md: chuyển tính năng sang Đã hoàn thành
"""

import os
import re
import sys
import json
from datetime import datetime
from openai import OpenAI

MD_FILE   = "tientrinhhethong.md"
HTML_FILE = "capcut.html"
MODEL     = "gpt-4.1"
TODAY     = datetime.now().strftime("%d/%m/%Y")


def log(msg: str):
    print(f"[auto_build] {msg}", flush=True)


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path: str, content: str):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_client():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        log("⚠️  OPENAI_API_KEY chưa được thiết lập — bỏ qua auto-build.")
        return None
    if not api_key.startswith("sk-"):
        log(f"⚠️  OPENAI_API_KEY không hợp lệ (bắt đầu bằng '{api_key[:10]}...') — bỏ qua auto-build.")
        log("    OpenAI API key phải bắt đầu bằng 'sk-'. Cập nhật tại Replit Secrets.")
        return None
    return OpenAI(api_key=api_key)


SYSTEM_ANALYST = """Bạn là senior developer chuyên về trình chỉnh sửa video web (HTML/CSS/JS thuần).
Nhiệm vụ: Phân tích dự án CapCut Clone và quyết định tính năng tiếp theo cần build.

Nguyên tắc:
- Ưu tiên tính năng trong Backlog (nếu có)
- Nếu Backlog trống, đề xuất 1 tính năng mới phù hợp với dự án
- Tính năng phải: thực tế, có thể implement bằng JS/CSS/HTML thuần, phù hợp phong cách CapCut
- Tính năng KHÔNG được trùng với bất kỳ tính năng nào đã có trong danh sách Đã hoàn thành
- Tính năng nên tập trung vào UX/UI hoặc chức năng chỉnh sửa video

Trả về JSON với format:
{
  "feature_id": "F21",
  "feature_name": "Tên tính năng ngắn gọn",
  "feature_detail": "Mô tả chi tiết kỹ thuật để implement",
  "from_backlog": true,
  "reasoning": "Lý do chọn tính năng này"
}"""


def analyze_and_choose_feature(client: OpenAI, md_content: str) -> dict:
    log("Đang phân tích tientrinhhethong.md và chọn tính năng...")
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ANALYST},
            {"role": "user", "content": f"Đây là file tiến trình dự án:\n\n{md_content}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )
    result = json.loads(resp.choices[0].message.content)
    log(f"Tính năng được chọn: [{result['feature_id']}] {result['feature_name']}")
    log(f"Lý do: {result['reasoning']}")
    return result


SYSTEM_CODER = """Bạn là senior frontend developer chuyên HTML/CSS/JS thuần (không dùng framework).
Nhiệm vụ: Viết code để thêm tính năng mới vào CapCut Video Editor Clone.

Quy tắc kỹ thuật QUAN TRỌNG:
- Code chạy trong môi trường browser, single-file SPA
- Sử dụng CSS variables: --bg0..--bg5, --accent (#D4A017), --t1..--t4, --border
- Tất cả hàm mới đặt tên có prefix `auto_` để tránh xung đột
- Gọi `renderAll()` sau khi thay đổi state
- Gọi `saveState()` trước khi thay đổi tracks[] để Undo hoạt động
- `toast(msg)` để hiển thị thông báo nhỏ
- `selected` (Set) chứa id clip đang chọn; `tracks[]` là mảng track
- Mỗi clip có: id, start, dur, label, cls (cs/cx/cv/ca)
- Code phải HOÀN CHỈNH, tự đứng được, không cần sửa phần còn lại
- Nếu cần HTML: dùng JS inject vào DOM (insertAdjacentHTML hoặc tương tự)
- Nếu cần CSS: tạo <style> tag và append vào document.head
- KHÔNG dùng import/require, KHÔNG dùng async ở top-level

Trả về JSON:
{
  "js_code": "// code JavaScript hoàn chỉnh...",
  "description": "Mô tả ngắn gọn code đã làm gì",
  "usage": "Hướng dẫn sử dụng tính năng (1-2 câu)"
}"""


def generate_feature_code(client: OpenAI, feature: dict, html_summary: str) -> dict:
    log(f"Đang sinh code cho: {feature['feature_name']}...")
    user_prompt = f"""Tính năng cần build:
ID: {feature['feature_id']}
Tên: {feature['feature_name']}
Mô tả kỹ thuật: {feature['feature_detail']}

Tóm tắt cấu trúc capcut.html hiện tại:
{html_summary}

Hãy viết code JS/CSS để implement tính năng này.
Code sẽ được chèn ngay trước thẻ </script> cuối cùng trong file."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_CODER},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=3000,
    )
    result = json.loads(resp.choices[0].message.content)
    log(f"Code sinh xong: {result['description']}")
    return result


def summarize_html(html_content: str) -> str:
    lines = html_content.split('\n')
    total = len(lines)
    head = '\n'.join(lines[:80])
    mid_start = total // 2 - 30
    mid = '\n'.join(lines[mid_start:mid_start + 60])
    tail = '\n'.join(lines[-60:])
    return f"""=== PHẦN ĐẦU (CSS vars, layout) ===
{head}

=== PHẦN GIỮA (state, tracks[]) ===
{mid}

=== PHẦN CUỐI (script kết thúc) ===
{tail}

=== TỔNG QUAN ===
- Tổng dòng: {total}
- State chính: tracks[], selected (Set), zoomIdx, nextId
- Hàm quan trọng: renderAll(), saveState(), toast(), renderMinimap(), renderKFEditor()
- Phím tắt: Space(play), S(split), Delete(xóa), Ctrl+Z(undo), Ctrl+Y(redo)
- Tracks: text(cs), effect(cx), video(cv), audio(ca)
- CSS accent: --accent (#D4A017), --bg0..bg5, --t1..t4"""


def inject_code_into_html(html_content: str, feature: dict, code_result: dict) -> str:
    js_code = code_result["js_code"].strip()
    injection = f"""
/* ═══════════════════════════════════════════════════════════════
   AUTO-BUILD: [{feature['feature_id']}] {feature['feature_name']}
   Ngày: {TODAY} | {code_result['description']}
   Cách dùng: {code_result['usage']}
   ═══════════════════════════════════════════════════════════════ */
{js_code}
"""
    last_script_close = html_content.rfind('</script>')
    if last_script_close == -1:
        log("LỖI: Không tìm thấy </script> trong capcut.html")
        sys.exit(1)
    return (
        html_content[:last_script_close]
        + injection
        + '\n</script>'
        + html_content[last_script_close + len('</script>'):]
    )


def update_markdown(md_content: str, feature: dict, code_result: dict) -> str:
    md_content = re.sub(
        r'\*\*Cập nhật lần cuối:\*\*.*',
        f'**Cập nhật lần cuối:** {TODAY}',
        md_content
    )

    if feature.get("from_backlog"):
        pattern = rf'\|[^|]*\|[^|]*{re.escape(feature["feature_name"])}[^|]*\|[^|]*\|\n?'
        md_content = re.sub(pattern, '', md_content)

    backlog_section = re.search(r'## BACKLOG.*?(?=##|\Z)', md_content, re.DOTALL)
    if backlog_section:
        backlog_text = backlog_section.group(0)
        rows = [
            l for l in backlog_text.split('\n')
            if l.strip().startswith('|')
            and '---' not in l
            and 'Ưu tiên' not in l
            and '*(trống)*' not in l
            and l.strip() != '|'
        ]
        if not rows:
            md_content = re.sub(
                r'(\| Ưu tiên \| Tính năng \| Mô tả yêu cầu \|\n\|[-| ]+\|\n).*?(\n---)',
                r'\1| — | *(trống)* | Chưa có yêu cầu mới |\2',
                md_content,
                flags=re.DOTALL
            )

    groups = re.findall(r'### Nhóm (\d+)', md_content)
    last_group_num = int(groups[-1]) if groups else 0
    feature_id = feature['feature_id']
    new_row = (
        f'\n| {feature_id} | {feature["feature_name"]} '
        f'| {code_result["description"]} · {code_result["usage"]} | {TODAY} |'
    )

    last_group_pattern = (
        rf'(### Nhóm {last_group_num}.*?\n\| ID \| Tính năng \| Chi tiết \| Ngày \|\n'
        rf'\|[-| ]+\|)(.*?)(\n\n---|\n\n###|\Z)'
    )
    match = re.search(last_group_pattern, md_content, re.DOTALL)
    if match:
        md_content = (
            md_content[:match.start(2)]
            + match.group(2) + new_row
            + md_content[match.start(3):]
        )
    else:
        new_group = f"""
### Nhóm {last_group_num + 1} — Tính năng Auto-Build

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| {feature_id} | {feature["feature_name"]} | {code_result["description"]} · {code_result["usage"]} | {TODAY} |

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
            log(f"LỖI: Không tìm thấy file '{f}'")
            sys.exit(1)

    log(f"Đọc {MD_FILE}...")
    md_content = read_file(MD_FILE)

    log(f"Đọc {HTML_FILE}...")
    html_content = read_file(HTML_FILE)

    client = get_client()
    if client is None:
        log("⏭️  Bỏ qua auto-build (không có API key hợp lệ). Server sẽ khởi động bình thường.")
        log("    Để kích hoạt auto-build: thêm OPENAI_API_KEY (bắt đầu bằng 'sk-') vào Replit Secrets.")
        sys.exit(0)

    feature = analyze_and_choose_feature(client, md_content)
    html_summary = summarize_html(html_content)
    code_result = generate_feature_code(client, feature, html_summary)

    backup_html = html_content
    backup_md = md_content

    try:
        log("Chèn code vào capcut.html...")
        new_html = inject_code_into_html(html_content, feature, code_result)
        write_file(HTML_FILE, new_html)
        log(f"✅ Đã cập nhật {HTML_FILE}")

        log("Cập nhật tientrinhhethong.md...")
        new_md = update_markdown(md_content, feature, code_result)
        write_file(MD_FILE, new_md)
        log(f"✅ Đã cập nhật {MD_FILE}")

    except Exception as e:
        log(f"LỖI khi ghi file: {e}")
        log("Khôi phục file gốc...")
        write_file(HTML_FILE, backup_html)
        write_file(MD_FILE, backup_md)
        sys.exit(1)

    log("=" * 60)
    log(f"✅ HOÀN THÀNH! [{feature['feature_id']}] {feature['feature_name']}")
    log(f"   Cách dùng: {code_result['usage']}")
    log("=" * 60)


if __name__ == "__main__":
    main()
