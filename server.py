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

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

AI_PATHS = {"/ai/subtitle", "/ai/title", "/ai/describe"}


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
            self.send_json(result)
        except Exception as e:
            err = str(e)
            print(f"[server] AI ERROR: {err}", flush=True)
            if "FREE_CLOUD_BUDGET_EXCEEDED" in err:
                self.send_json({"error": "FREE_CLOUD_BUDGET_EXCEEDED"}, 402)
            else:
                self.send_json({"error": err}, 500)


def handle_subtitle(body):
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


if __name__ == "__main__":
    PORT = 5000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"[server] Chạy tại http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
