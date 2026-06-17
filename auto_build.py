#!/usr/bin/env python3
"""
auto_build.py — Tự động build tính năng mới cho CapCut Video Editor Clone.

Quy trình:
  1. Đọc tientrinhhethong.md (danh sách tính năng đã có + backlog)
  2. Đọc capcut.html (source code hiện tại)
  3. Gọi Gemini: phân tích, chọn 1 tính năng từ backlog (hoặc đề xuất mới)
  4. Gọi Gemini: sinh code JS/CSS/HTML để thêm vào capcut.html
  5. Chèn code vào capcut.html ngay trước </script> cuối cùng
  6. Cập nhật tientrinhhethong.md: chuyển tính năng sang Đã hoàn thành
"""

import os, re, sys, json
from datetime import datetime
from google import genai
from google.genai import types

MD_FILE   = "tientrinhhethong.md"
HTML_FILE = "capcut.html"
MODEL     = "gemini-2.0-flash"
TODAY     = datetime.now().strftime("%d/%m/%Y")


def log(msg):
    print(f"[auto_build] {msg}", flush=True)


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def get_api_key():
    """Đọc Gemini API key — thử nhiều tên env var khác nhau."""
    candidates = [
        os.environ.get("GOOGLE_API_KEY", ""),
        os.environ.get("GEMINI_API_KEY", ""),
        os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY", ""),
        os.environ.get("OPENAI_API_KEY", ""),   # user lưu key Gemini vào đây
    ]
    for key in candidates:
        key = key.strip()
        if key and key.startswith("AIzaSy"):
            return key
    return None


SYSTEM_ANALYST = """Bạn là senior developer chuyên về trình chỉnh sửa video web (HTML/CSS/JS thuần).
Nhiệm vụ: Phân tích dự án CapCut Clone và quyết định tính năng tiếp theo cần build.

Nguyên tắc:
- Ưu tiên tính năng trong Backlog (nếu có)
- Nếu Backlog trống, đề xuất 1 tính năng mới phù hợp với dự án
- Tính năng phải thực tế, implement được bằng JS/CSS/HTML thuần, phù hợp phong cách CapCut
- KHÔNG trùng với bất kỳ tính năng nào đã có trong danh sách Đã hoàn thành
- Tập trung vào UX/UI hoặc chức năng chỉnh sửa video

Trả về JSON (chỉ JSON, không có markdown):
{
  "feature_id": "F21",
  "feature_name": "Tên tính năng",
  "feature_detail": "Mô tả chi tiết kỹ thuật",
  "from_backlog": true,
  "reasoning": "Lý do chọn"
}"""


SYSTEM_CODER = """Bạn là senior frontend developer chuyên HTML/CSS/JS thuần (không dùng framework).
Nhiệm vụ: Viết code thêm tính năng mới vào CapCut Video Editor Clone.

Quy tắc QUAN TRỌNG:
- Code chạy trong browser, single-file SPA
- CSS variables: --bg0..--bg5, --accent (#D4A017), --t1..--t4, --border
- Prefix hàm mới bằng `auto_` để tránh xung đột
- Gọi renderAll() sau khi thay đổi state
- Gọi saveState() trước khi thay đổi tracks[]
- toast(msg) để hiển thị thông báo nhỏ
- selected (Set) = clip đang chọn; tracks[] = mảng track
- Clip: {id, start, dur, label, cls(cs/cx/cv/ca)}
- Code HOÀN CHỈNH, tự đứng được, không cần sửa phần còn lại
- HTML mới: inject bằng JS (insertAdjacentHTML hoặc tương tự)
- CSS mới: tạo <style> tag append vào document.head
- KHÔNG dùng import/require/async top-level

Trả về JSON (chỉ JSON, không có markdown):
{
  "js_code": "// code hoàn chỉnh...",
  "description": "Mô tả ngắn gọn (1 câu)",
  "usage": "Hướng dẫn dùng (1-2 câu)"
}"""


def call_gemini(client, system_prompt, user_prompt):
    """Gọi Gemini API với JSON output."""
    response = client.models.generate_content(
        model=MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            temperature=0.4,
            max_output_tokens=3000,
        ),
    )
    text = response.text.strip()
    # Bóc markdown nếu có
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text)


def analyze_and_choose_feature(client, md_content):
    log("Đang phân tích tientrinhhethong.md và chọn tính năng...")
    result = call_gemini(
        client,
        SYSTEM_ANALYST,
        f"File tiến trình dự án:\n\n{md_content}"
    )
    log(f"Tính năng chọn: [{result['feature_id']}] {result['feature_name']}")
    log(f"Lý do: {result['reasoning']}")
    return result


def generate_feature_code(client, feature, html_summary):
    log(f"Đang sinh code cho: {feature['feature_name']}...")
    prompt = f"""Tính năng:
ID: {feature['feature_id']}
Tên: {feature['feature_name']}
Kỹ thuật: {feature['feature_detail']}

Tóm tắt capcut.html:
{html_summary}

Code sẽ được chèn ngay trước </script> cuối cùng."""

    result = call_gemini(client, SYSTEM_CODER, prompt)
    log(f"Code xong: {result['description']}")
    return result


def summarize_html(html_content):
    lines = html_content.split('\n')
    total = len(lines)
    head = '\n'.join(lines[:80])
    mid  = '\n'.join(lines[total//2-30 : total//2+30])
    tail = '\n'.join(lines[-60:])
    return f"""=== ĐẦU (CSS vars, layout) ===
{head}

=== GIỮA (state, tracks[]) ===
{mid}

=== CUỐI (script end) ===
{tail}

=== TỔNG QUAN ===
Tổng dòng: {total}
State: tracks[], selected(Set), zoomIdx, nextId
Hàm: renderAll(), saveState(), toast(), renderMinimap(), renderKFEditor()
Phím tắt: Space(play), S(split), Del(xóa), Ctrl+Z/Y(undo/redo)
Tracks: text(cs), effect(cx), video(cv), audio(ca)
CSS: --accent(#D4A017), --bg0..bg5, --t1..t4"""


def inject_code(html_content, feature, code_result):
    js = code_result["js_code"].strip()
    block = f"""
/* ═══════════════════════════════════════════════════════════════
   AUTO-BUILD: [{feature['feature_id']}] {feature['feature_name']}
   Ngày: {TODAY} | {code_result['description']}
   Dùng: {code_result['usage']}
   ═══════════════════════════════════════════════════════════════ */
{js}
"""
    pos = html_content.rfind('</script>')
    if pos == -1:
        log("LỖI: Không tìm thấy </script>")
        sys.exit(1)
    return html_content[:pos] + block + '\n</script>' + html_content[pos+len('</script>'):]


def update_markdown(md_content, feature, code_result):
    # Ngày
    md_content = re.sub(
        r'\*\*Cập nhật lần cuối:\*\*.*',
        f'**Cập nhật lần cuối:** {TODAY}',
        md_content
    )
    # Xóa khỏi backlog nếu từ backlog
    if feature.get("from_backlog"):
        md_content = re.sub(
            rf'\|[^|]*\|[^|]*{re.escape(feature["feature_name"])}[^|]*\|[^|]*\|\n?',
            '', md_content
        )
    # Reset backlog nếu trống
    bl = re.search(r'## BACKLOG.*?(?=##|\Z)', md_content, re.DOTALL)
    if bl:
        rows = [l for l in bl.group(0).split('\n')
                if l.strip().startswith('|') and '---' not in l
                and 'Ưu tiên' not in l and '*(trống)*' not in l and l.strip() != '|']
        if not rows:
            md_content = re.sub(
                r'(\| Ưu tiên \| Tính năng \| Mô tả yêu cầu \|\n\|[-| ]+\|\n).*?(\n---)',
                r'\1| — | *(trống)* | Chưa có yêu cầu mới |\2',
                md_content, flags=re.DOTALL
            )
    # Thêm vào nhóm cuối
    groups = re.findall(r'### Nhóm (\d+)', md_content)
    last_g = int(groups[-1]) if groups else 0
    new_row = (f'\n| {feature["feature_id"]} | {feature["feature_name"]} '
               f'| {code_result["description"]} · {code_result["usage"]} | {TODAY} |')
    pat = (rf'(### Nhóm {last_g}.*?\n\| ID \| Tính năng \| Chi tiết \| Ngày \|\n'
           rf'\|[-| ]+\|)(.*?)(\n\n---|\n\n###|\Z)')
    m = re.search(pat, md_content, re.DOTALL)
    if m:
        md_content = md_content[:m.start(2)] + m.group(2) + new_row + md_content[m.start(3):]
    else:
        new_group = f"""
### Nhóm {last_g + 1} — Tính năng Auto-Build

| ID | Tính năng | Chi tiết | Ngày |
|----|-----------|----------|------|
| {feature["feature_id"]} | {feature["feature_name"]} | {code_result["description"]} · {code_result["usage"]} | {TODAY} |

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

    api_key = get_api_key()
    if not api_key:
        log("⚠️  Không tìm thấy Gemini API key — bỏ qua auto-build.")
        log("   Thêm GOOGLE_API_KEY vào Replit Secrets (key bắt đầu bằng 'AIzaSy').")
        sys.exit(0)

    log(f"✅ Dùng Gemini API (key prefix: {api_key[:15]}...)")
    client = genai.Client(api_key=api_key)

    feature     = analyze_and_choose_feature(client, md_content)
    code_result = generate_feature_code(client, feature, summarize_html(html_content))

    bk_html, bk_md = html_content, md_content
    try:
        log("Chèn code vào capcut.html...")
        write_file(HTML_FILE, inject_code(html_content, feature, code_result))
        log("✅ capcut.html cập nhật")

        log("Cập nhật tientrinhhethong.md...")
        write_file(MD_FILE, update_markdown(md_content, feature, code_result))
        log("✅ tientrinhhethong.md cập nhật")

    except Exception as e:
        log(f"LỖI: {e} — Khôi phục file gốc...")
        write_file(HTML_FILE, bk_html)
        write_file(MD_FILE,   bk_md)
        sys.exit(1)

    log("=" * 60)
    log(f"✅ XONG! [{feature['feature_id']}] {feature['feature_name']}")
    log(f"   {code_result['usage']}")
    log("=" * 60)


if __name__ == "__main__":
    main()
