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

PROJECTS_DIR = Path("projects")
PROJECTS_DIR.mkdir(exist_ok=True)

# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
MODEL = "gpt-5-mini"

_api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=_api_key) if _api_key else None

AI_PATHS = {"/ai/subtitle", "/ai/title", "/ai/describe", "/ai/translate", "/ai/editor-command", "/ai/generate-shorts"}


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
            return super().do_GET()
        if self.path == "/project/list":
            return self.send_json(project_list())
        if self.path.startswith("/project/") and len(self.path) > 9:
            pid = self.path[9:].strip("/")
            data = project_get(pid)
            if data:
                return self.send_json(data)
            return self.send_json({"error": "Not found"}, 404)
        super().do_GET()

    def do_DELETE(self):
        self.send_response(204)
        self._cors()
        self.end_headers()
        if self.path.startswith("/project/") and len(self.path) > 9:
            pid = self.path[9:].strip("/")
            project_delete(pid)

    def do_POST(self):
        ALLOWED_PATHS = AI_PATHS | {"/project/save"}
        if self.path not in ALLOWED_PATHS:
            self.send_json({"error": "Not found"}, 404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        try:
            if self.path == "/project/save":
                result = project_save(body)
                return self.send_json(result)
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
            elif self.path == "/ai/generate-shorts":
                result = handle_generate_shorts(body)
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


def project_save(body):
    pid = body.get("id") or ("proj_" + str(int(__import__("time").time() * 1000)))
    body["id"] = pid
    path = PROJECTS_DIR / (pid + ".json")
    path.write_text(json.dumps(body, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "id": pid}


def project_get(pid):
    path = PROJECTS_DIR / (pid + ".json")
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def project_list():
    projects = []
    for f in sorted(PROJECTS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            projects.append({
                "id":          data.get("id", f.stem),
                "name":        data.get("name", "Untitled"),
                "createdAt":   data.get("createdAt", ""),
                "updatedAt":   data.get("updatedAt", ""),
                "duration":    data.get("duration", 0),
                "trackCount":  data.get("trackCount", 0),
            })
        except Exception:
            pass
    return {"projects": projects}


def project_delete(pid):
    path = PROJECTS_DIR / (pid + ".json")
    if path.exists():
        path.unlink()


def handle_generate_shorts(body):
    _require_client()
    state      = body.get("editorState", {})
    total_dur  = float(state.get("totalDuration", 0))

    clips_lines = []
    for tr in state.get("tracks", []):
        for c in tr.get("clips", []):
            s   = float(c.get("start", 0))
            dur = float(c.get("dur", 0))
            clips_lines.append(
                f'  [{tr.get("type","?")}] "{c.get("label","")}"  {s:.1f}s → {s+dur:.1f}s  ({dur:.1f}s)'
            )

    subs_lines = [
        f'  {float(s.get("start",0)):.1f}s: "{s.get("text","")}"'
        for s in state.get("subtitles", [])[:20]
    ]

    timeline_text = "\n".join(clips_lines)  if clips_lines  else "  (empty)"
    subs_text     = "\n".join(subs_lines)   if subs_lines   else "  (none)"

    prompt = f"""You are a viral content strategist and professional video editor.
Analyze the following video timeline and return the TOP 10 most viral-worthy short segments.

VIDEO TIMELINE  (total: {total_dur:.1f}s)
{timeline_text}

SUBTITLES
{subs_text}

Score each candidate 0.0–1.0 using these criteria:
  • Hook strength — how engaging are the first 3 seconds?
  • Emotional arc — does it tell a mini story?
  • Content density — lots happening, no dead air
  • Completeness — has a clear start + end
  • Platform fit — strong for TikTok / Reels / YouTube Shorts

Return ONLY valid JSON:
{{
  "shorts": [
    {{
      "title":  "Catchy viral title (max 8 words)",
      "start":  <number — start time in seconds>,
      "end":    <number — end time within {total_dur:.1f}s>,
      "score":  <float 0.0–1.0>,
      "hook":   "One sentence on why the first 3s grab attention",
      "reason": "One sentence on overall viral potential"
    }}
  ]
}}

Rules:
- Exactly up to 10 shorts, sorted score DESC
- Each short: 15 – 60 seconds long
- Shorts may overlap — pick the best windows
- All start/end values must be between 0 and {total_dur:.1f}
- If the entire video is ≤60s, include it as one of the candidates
- If the timeline is empty return a few demo shorts within 30s total
- Make titles punchy, platform-native (no quotes inside the title field)"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=2048,
    )
    result = json.loads(resp.choices[0].message.content)
    # Clamp scores
    for s in result.get("shorts", []):
        s["score"] = round(max(0.0, min(1.0, float(s.get("score", 0.5)))), 2)
        s["start"] = round(max(0.0, float(s.get("start", 0))), 2)
        s["end"]   = round(min(float(total_dur) if total_dur else 999,
                               float(s.get("end", 30))), 2)
    return result


if __name__ == "__main__":
    PORT = 5000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"[server] Chạy tại http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
