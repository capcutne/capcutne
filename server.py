#!/usr/bin/env python3
"""
server.py — Server duy nhất phục vụ:
  - File tĩnh (capcut.html, assets...) trên port 5000
  - API AI tại /ai/subtitle, /ai/title, /ai/describe
"""

import os
import json
import mimetypes
import http.server
import socketserver
from pathlib import Path
from openai import OpenAI

# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
MODEL = "gpt-5-mini"

_api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=_api_key) if _api_key else None

AI_PATHS = {"/ai/subtitle", "/ai/title", "/ai/describe", "/ai/translate", "/ai/editor-command"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[server] {format % args}", flush=True)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "":
            self.path = "/capcut.html"
        super().do_GET()

    def do_POST(self):
        if self.path not in AI_PATHS:
            self.send_json({"error": "Not found"}, 404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        try:
            if self.path == "/ai/subtitle":
                result = handle_subtitle(body)
            elif self.path == "/ai/title":
                result = handle_title(body)
            elif self.path == "/ai/describe":
                result = handle_describe(body)
            elif self.path == "/ai/translate":
                result = handle_translate(body)
            elif self.path == "/ai/editor-command":
                result = handle_editor_command(body)
            self.send_json(result)
        except Exception as e:
            err = str(e)
            print(f"[server] AI ERROR: {err}", flush=True)
            if "FREE_CLOUD_BUDGET_EXCEEDED" in err:
                self.send_json({"error": "FREE_CLOUD_BUDGET_EXCEEDED"}, 402)
            else:
                self.send_json({"error": err}, 500)


def _require_client():
    if client is None:
        raise ValueError("OPENAI_API_KEY is not set. Add it in the Secrets tab to enable AI features.")


def handle_subtitle(body):
    _require_client()
    clips = body.get("clips", [])
    lang = body.get("lang", "vi")
    if not clips:
        return {"subtitles": []}

    clip_list = "\n".join(
        f"- Clip {i+1}: \"{c.get('label','')}\", {c.get('start',0):.1f}s → {c.get('start',0)+c.get('dur',3):.1f}s"
        for i, c in enumerate(clips)
    )
    lang_name = "tiếng Việt" if lang == "vi" else "English"
    prompt = f"""Bạn là trợ lý tạo phụ đề chuyên nghiệp cho video.
Dưới đây là danh sách các clip trong video:
{clip_list}

Hãy tạo phụ đề ngắn gọn, hấp dẫn bằng {lang_name} cho từng clip.
Trả về JSON với format:
{{"subtitles": [{{"index": 0, "text": "nội dung phụ đề"}}, ...]}}
Mỗi phụ đề tối đa 10 từ. Chỉ trả JSON, không giải thích thêm."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=1024,
    )
    return json.loads(resp.choices[0].message.content)


def handle_title(body):
    _require_client()
    clips = body.get("clips", [])
    labels = ", ".join(c.get("label", "") for c in clips[:10])
    if not labels:
        labels = "video chỉnh sửa"
    prompt = f"""Gợi ý 5 tên dự án video sáng tạo bằng tiếng Việt cho video có các cảnh: {labels}.
Trả về JSON: {{"titles": ["tên 1", "tên 2", "tên 3", "tên 4", "tên 5"]}}
Chỉ trả JSON."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=512,
    )
    return json.loads(resp.choices[0].message.content)


def handle_describe(body):
    _require_client()
    label = body.get("label", "video")
    prompt = f"""Mô tả cảnh video ngắn gọn bằng tiếng Việt cho clip có tên: "{label}".
Trả về JSON: {{"description": "mô tả 1-2 câu sinh động"}}
Chỉ trả JSON."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=256,
    )
    return json.loads(resp.choices[0].message.content)


def handle_translate(body):
    _require_client()
    lines = body.get("lines", [])
    src_lang = body.get("srcLang", "vi")
    dst_lang = body.get("dstLang", "en")
    if not lines:
        return {"translations": []}

    lang_names = {
        "vi": "Tiếng Việt", "en": "English", "ko": "Korean (한국어)",
        "ja": "Japanese (日本語)", "zh": "Chinese (中文)", "fr": "French",
        "de": "German", "es": "Spanish", "th": "Thai", "id": "Indonesian",
        "ms": "Malay", "pt": "Portuguese", "ar": "Arabic", "ru": "Russian", "hi": "Hindi"
    }
    src_name = lang_names.get(src_lang, src_lang)
    dst_name = lang_names.get(dst_lang, dst_lang)

    numbered = "\n".join(f"{i+1}. {line}" for i, line in enumerate(lines))
    prompt = f"""Dịch các dòng văn bản sau từ {src_name} sang {dst_name}.
Giữ nguyên số thứ tự. Trả về JSON:
{{"translations": ["dòng 1 đã dịch", "dòng 2 đã dịch", ...]}}

Văn bản gốc:
{numbered}

Chỉ trả JSON, không giải thích."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=1024,
    )
    return json.loads(resp.choices[0].message.content)


def handle_editor_command(body):
    _require_client()
    prompt = body.get("prompt", "").strip()
    state  = body.get("editorState", {})

    if not prompt:
        return {"actions": []}

    # Build a compact summary of the current timeline for the AI
    clips_summary = []
    for tr in state.get("tracks", []):
        for c in tr.get("clips", []):
            clips_summary.append(
                f"  [{tr.get('type','?')}] id={c.get('id','?')} "
                f"label=\"{c.get('label','')}\" "
                f"start={c.get('start',0)}s dur={c.get('dur',0)}s"
            )

    subs_summary = [
        f"  id={s.get('id','?')} start={s.get('start',0)}s "
        f"dur={s.get('dur',3)}s text=\"{s.get('text','')}\""
        for s in state.get("subtitles", [])[:10]
    ]

    timeline_text = "\n".join(clips_summary) if clips_summary else "  (empty timeline)"
    subs_text     = "\n".join(subs_summary)  if subs_summary  else "  (no subtitles)"
    playhead      = state.get("playhead", 0)

    system_prompt = """You are an AI video editing assistant.
The user tells you what they want to do with their video project.
You must respond with ONLY a JSON object containing an "actions" array.

Each action has a "type" and a "params" object.
Supported action types and their params:

cut_clip      — { "clipId"?: str, "newStart"?: number, "newEnd"?: number }
delete_clip   — { "clipId"?: str }
split_clip    — { "time"?: number, "clipId"?: str }
add_subtitle  — { "start": number, "dur": number, "text": str }
remove_silence— { "threshold"?: number (0-1) }
create_short  — { "duration"?: number (seconds, default 30) }
apply_style   — { "style": str, "clipId"?: str }

Rules:
- Return ONLY a JSON object like: {"actions": [...]}
- Do NOT modify the timeline directly — only return actions.
- Omit params you don't need; the engine has sensible defaults.
- For add_subtitle, generate realistic subtitle text based on clip labels.
- For create_short without a specified duration, default to 30 seconds.
- If the request is ambiguous, pick the most reasonable interpretation.
- If the request cannot map to any action, return {"actions": []} with a brief
  "message" field explaining why.
"""

    user_message = f"""Current editor state:
Playhead: {playhead}s
Timeline clips:
{timeline_text}
Current subtitles:
{subs_text}

User request: {prompt}

Return the actions JSON now."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        response_format={"type": "json_object"},
        max_completion_tokens=1024,
    )
    return json.loads(resp.choices[0].message.content)


if __name__ == "__main__":
    PORT = 5000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"[server] Chạy tại http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
