#!/usr/bin/env python3
"""
server.py — Static files (port 5000) + AI API + Export Engine
"""

import os
import json
import uuid
import time
import math
import mimetypes
import threading
import subprocess
import http.server
import socketserver
import tempfile
from pathlib import Path
from openai import OpenAI

PROJECTS_DIR = Path("projects")
PROJECTS_DIR.mkdir(exist_ok=True)
EXPORTS_DIR  = Path("exports")
EXPORTS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR  = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
MODEL = "gpt-5-mini"

_api_key = os.environ.get("OPENAI_API_KEY")
client   = OpenAI(api_key=_api_key) if _api_key else None

AI_PATHS = {
    "/ai/subtitle", "/ai/title", "/ai/describe",
    "/ai/translate", "/ai/editor-command", "/ai/generate-shorts",
    "/ai/viral-analysis", "/ai/transcribe",
    "/ai/upload-media", "/ai/transcribe-real",
    "/ai/auto-style",
    "/brand/train", "/brand/compare",
}

# ── Export job store ──────────────────────────────────────────────────────────
# job_id → { status, progress, message, output_path, filename, format, quality }
export_jobs: dict = {}

# ── Batch Shorts Factory job store ────────────────────────────────────────────
# batch_id → { status, progress, stage, shorts[], subtitle_template, ... }
factory_batches: dict = {}

QUALITY_MAP = {
    "480p":  {"w": 854,   "h": 480,  "vbr": "1000k"},
    "720p":  {"w": 1280,  "h": 720,  "vbr": "2000k"},
    "1080p": {"w": 1920,  "h": 1080, "vbr": "4000k"},
    "1440p": {"w": 2560,  "h": 1440, "vbr": "8000k"},
    "4k":    {"w": 3840,  "h": 2160, "vbr": "15000k"},
}

EXPORT_HISTORY_FILE = EXPORTS_DIR / "history.json"


def _esc_dt(text: str) -> str:
    """Escape a string for use inside FFmpeg drawtext=text='...'."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'",  "\\'")
    text = text.replace(":",  r"\:")
    text = text.replace("[",  r"\[")
    text = text.replace("]",  r"\]")
    text = text.replace(",",  r"\,")
    return text


def _compile_timeline(project: dict, burn_subtitles: bool = True) -> dict:
    """
    Convert editor tracks/clips/subtitles into a structured RenderPlan.

    RenderPlan schema:
    {
        "duration": float,
        "title": str,
        "segments": [{"type", "src", "start", "end", "label"}],
        "subtitle_cues": [{"text", "start", "end"}],
        "audio_mix": {"voice": float, "music": float, "sfx": float},
        "burn_subtitles": bool,
    }
    """
    plan: dict = {
        "duration": 10.0,
        "title": str(project.get("name", "CapCut Export"))[:40].replace("'", "").replace("\\", ""),
        "segments": [],
        "subtitle_cues": [],
        "audio_mix": project.get("audioMix", {"voice": 1.0, "music": 0.5, "sfx": 0.8}),
        "burn_subtitles": burn_subtitles,
    }

    dur = 10.0
    for track in project.get("tracks", []):
        track_type = track.get("type", "video")
        for clip in track.get("clips", []):
            start    = float(clip.get("start", 0))
            clip_dur = float(clip.get("dur",   5))
            end      = start + clip_dur
            dur      = max(dur, end)
            plan["segments"].append({
                "type":  track_type,
                "src":   clip.get("src", ""),
                "start": round(start, 3),
                "end":   round(end, 3),
                "label": str(clip.get("label", ""))[:40].replace("'", "").replace("\\", ""),
            })

    plan["duration"] = min(dur, 600)

    if burn_subtitles:
        for sub in project.get("subtitles", []):
            start    = float(sub.get("start", 0))
            sub_dur  = float(sub.get("dur",   2))
            raw_text = str(sub.get("text", "")).strip()
            if raw_text:
                plan["subtitle_cues"].append({
                    "text":  raw_text,
                    "start": round(start, 3),
                    "end":   round(start + sub_dur, 3),
                })

    return plan


def _build_subtitle_drawtext(subtitle_cues: list, w: int, h: int) -> list:
    """Generate FFmpeg drawtext filters for subtitle burn-in."""
    parts = []
    fs    = max(16, h // 28)
    pad   = max(10, h // 80)

    for cue in subtitle_cues[:200]:
        text    = _esc_dt(cue["text"])
        t_start = cue["start"]
        t_end   = cue["end"]
        # Shadow
        parts.append(
            f"drawtext=text='{text}':fontcolor=black@0.75:fontsize={fs}:"
            f"x=(w-tw)/2+2:y=h-th-{pad+2}:"
            f"enable='between(t\\,{t_start:.3f}\\,{t_end:.3f})'"
        )
        # Main text
        parts.append(
            f"drawtext=text='{text}':fontcolor=white:fontsize={fs}:"
            f"x=(w-tw)/2:y=h-th-{pad}:"
            f"enable='between(t\\,{t_start:.3f}\\,{t_end:.3f})'"
        )
    return parts


def _save_export_history():
    """Persist recent export records to disk."""
    records = [j for j in export_jobs.values() if j.get("status") in ("done", "error")]
    try:
        with open(EXPORT_HISTORY_FILE, "w") as f:
            json.dump(records[-50:], f, indent=2)
    except Exception:
        pass


def _load_export_history():
    """Load persisted export history on startup."""
    if not EXPORT_HISTORY_FILE.exists():
        return
    try:
        with open(EXPORT_HISTORY_FILE) as f:
            records = json.load(f)
        for r in records:
            if r.get("id") and r["id"] not in export_jobs:
                export_jobs[r["id"]] = r
    except Exception:
        pass


# ── Batch Shorts Factory worker ───────────────────────────────────────────────

def _run_factory_batch(batch_id: str, editor_state: dict, max_shorts: int, subtitle_template: str):
    """Full pipeline: AI segment detection → viral scoring → metadata generation."""
    batch = factory_batches[batch_id]
    try:
        total_dur = float(editor_state.get("totalDuration", 30))
        clips_lines = []
        for tr in editor_state.get("tracks", []):
            for c in tr.get("clips", []):
                s   = float(c.get("start", 0))
                dur = float(c.get("dur", 0))
                clips_lines.append(
                    f'  [{tr.get("type","?")}] "{c.get("label","")}"  {s:.1f}s→{s+dur:.1f}s ({dur:.1f}s)'
                )
        subs_lines = [
            f'  {float(s.get("start",0)):.1f}s: "{s.get("text","")}"'
            for s in editor_state.get("subtitles", [])[:30]
        ]
        timeline_text = "\n".join(clips_lines) or "  (empty timeline)"
        subs_text     = "\n".join(subs_lines)  or "  (none)"

        # ── Stage 1: Generate viral short candidates ───────────────────────────
        batch.update({"status": "analyzing", "progress": 5,
                       "stage": "Detecting viral segments…"})

        prompt1 = f"""You are a viral content strategist. Analyze this video timeline and find the TOP {max_shorts} most viral-worthy short clips.

VIDEO TIMELINE (total: {total_dur:.1f}s):
{timeline_text}

SUBTITLES:
{subs_text}

Score each candidate on 4 dimensions (0.0–1.0 each):
- hook_score:      How grabbing are the first 3 seconds?
- retention_score: Does it hold attention throughout?
- emotional_score: Emotional highs — humor, shock, inspiration?
- overall_score:   Composite viral potential

Return ONLY valid JSON:
{{
  "shorts": [
    {{
      "id": "short_01",
      "title": "Catchy 6-word viral title",
      "start": <number>,
      "end": <number>,
      "hook_score": <float 0.0-1.0>,
      "retention_score": <float 0.0-1.0>,
      "emotional_score": <float 0.0-1.0>,
      "overall_score": <float 0.0-1.0>,
      "hook_line": "Why the first 3 seconds grab attention (1 sentence)",
      "reason": "Overall viral potential (1 sentence)"
    }}
  ]
}}

Rules:
- Up to {max_shorts} shorts, sorted overall_score DESC
- Each short 15–60 seconds long (clamp to timeline bounds)
- All start/end values within 0 and {total_dur:.1f}
- If timeline is empty, generate 3 demo shorts within 30s
- Shorts may overlap — pick best windows
"""

        resp1 = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt1}],
            response_format={"type": "json_object"},
            max_completion_tokens=2048,
        )
        shorts_data = json.loads(resp1.choices[0].message.content)
        shorts = shorts_data.get("shorts", [])[:max_shorts]

        # Normalize IDs and attach template info
        for i, s in enumerate(shorts):
            s["id"]                = f"short_{i+1:02d}"
            s["subtitle_template"] = subtitle_template
            s["status"]            = "ready"
            s["duration"]          = round(float(s.get("end", 0)) - float(s.get("start", 0)), 2)

        batch.update({"progress": 45, "stage": "Generating titles, descriptions & hashtags…"})

        # ── Stage 2: Batch metadata for all shorts (single AI call) ───────────
        shorts_summary = "\n".join(
            f'Short {s["id"]}: "{s["title"]}" '
            f'({s.get("start",0):.1f}s–{s.get("end",0):.1f}s) | '
            f'hook: {s.get("hook_line","")[:60]}'
            for s in shorts
        )

        prompt2 = f"""You are a social media content writer. Generate publishing metadata for each short video below.

SHORTS:
{shorts_summary}

Return ONLY valid JSON:
{{
  "metadata": [
    {{
      "id": "short_01",
      "titles": ["Title A (6–8 words)", "Title B (punchy variant)", "Title C (question format?)"],
      "description": "Compelling 2-sentence description with hook.",
      "cta": "Call-to-action (e.g. Follow for more!)",
      "hashtags": ["#viral", "#shorts", "#trending", "#fyp", "#content"],
      "thumbnail_text": "3–4 word bold thumbnail text"
    }}
  ]
}}
"""

        resp2 = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt2}],
            response_format={"type": "json_object"},
            max_completion_tokens=2048,
        )
        meta_data = json.loads(resp2.choices[0].message.content)
        meta_map  = {m["id"]: m for m in meta_data.get("metadata", [])}

        for s in shorts:
            m = meta_map.get(s["id"], {})
            s["titles"]         = m.get("titles", [s["title"]])
            s["description"]    = m.get("description", "")
            s["cta"]            = m.get("cta", "Follow for more!")
            s["hashtags"]       = m.get("hashtags", ["#shorts", "#viral"])
            s["thumbnail_text"] = m.get("thumbnail_text", s["title"][:20])

        batch.update({
            "status":       "ready",
            "progress":     100,
            "stage":        f"Factory complete — {len(shorts)} shorts ready",
            "shorts":       shorts,
            "completed_at": time.time(),
        })
        print(f"[factory] ✅ {batch_id} — {len(shorts)} shorts", flush=True)

    except Exception as exc:
        print(f"[factory] ERROR {batch_id}: {exc}", flush=True)
        factory_batches[batch_id].update({"status": "error", "stage": str(exc), "progress": 0})


# ── FFmpeg background worker ──────────────────────────────────────────────────

def _run_export(job_id: str, project: dict, fmt: str, quality: str, fps: int, settings: dict):
    job = export_jobs[job_id]
    try:
        q   = QUALITY_MAP.get(quality, QUALITY_MAP["1080p"])
        w, h, vbr = q["w"], q["h"], q["vbr"]

        burn_subs = settings.get("burnSubtitles", True)
        job.update({"status": "running", "progress": 3, "message": "Compiling timeline…"})

        # ── Phase 1: Compile timeline → RenderPlan ────────────────────────────
        plan = _compile_timeline(project, burn_subtitles=burn_subs)
        dur  = plan["duration"]
        title = plan["title"]

        job.update({"progress": 6, "message": "Building filter graph…",
                    "render_plan": {
                        "duration":       dur,
                        "segments":       len(plan["segments"]),
                        "subtitle_cues":  len(plan["subtitle_cues"]),
                        "burn_subtitles": burn_subs,
                    }})

        ext      = "gif" if fmt == "gif" else ("webm" if fmt == "webm" else "mp4")
        out_path = str(EXPORTS_DIR / f"{job_id}.{ext}")

        # ── Phase 2: Build FFmpeg filter graph ────────────────────────────────
        # Legacy segment labels for the visualization
        segment_labels = [(s["start"], s["end"] - s["start"], s["label"])
                          for s in plan["segments"]]

        if fmt == "gif":
            gw, gh = min(w, 480), min(h, 270)
            dt = []
            for i, (st, sdur, lbl) in enumerate(segment_labels[:12]):
                if lbl:
                    dt.append(
                        f"drawtext=text='{_esc_dt(lbl)}':fontcolor=white:"
                        f"fontsize={max(9, gh//30)}:x=(w-tw)/2:y=h-th-10:"
                        f"enable='between(t\\,{st:.2f}\\,{st+sdur:.2f})'"
                    )
            if burn_subs:
                dt += _build_subtitle_drawtext(plan["subtitle_cues"], gw, gh)
            vf = ",".join(
                [f"scale={gw}:{gh}"] + dt +
                ["fps=12,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse"]
            )
            cmd = [
                "ffmpeg", "-y",
                "-f", "lavfi", "-i",
                f"color=c=#1a1a2e:size={gw}x{gh}:rate=12:duration={dur}",
                "-vf", vf, "-t", str(min(dur, 15)), out_path,
            ]

        else:
            dt_parts = _build_drawtext(segment_labels, title, w, h)
            if burn_subs:
                dt_parts += _build_subtitle_drawtext(plan["subtitle_cues"], w, h)
            vf = ",".join(dt_parts) if dt_parts else "null"

            if fmt == "webm":
                cmd = [
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i",
                    f"color=c=#0d1117:size={w}x{h}:rate={fps}:duration={dur}",
                    "-f", "lavfi", "-i", f"sine=frequency=0:duration={dur}",
                    "-filter_complex", f"[0:v]{vf}[vout]",
                    "-map", "[vout]", "-map", "1:a",
                    "-c:v", "libvpx-vp9", "-b:v", vbr, "-crf", "30",
                    "-c:a", "libopus", "-b:a", "96k",
                    "-t", str(dur), out_path,
                ]
            else:  # mp4
                cmd = [
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i",
                    f"color=c=#0d1117:size={w}x{h}:rate={fps}:duration={dur}",
                    "-f", "lavfi", "-i", f"sine=frequency=0:duration={dur}",
                    "-filter_complex", f"[0:v]{vf}[vout]",
                    "-map", "[vout]", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "fast", "-b:v", vbr,
                    "-c:a", "aac", "-b:a", "128k",
                    "-t", str(dur), "-movflags", "+faststart", out_path,
                ]

        # ── Phase 3: Run FFmpeg with progress tracking ────────────────────────
        job.update({"progress": 8, "message": "Starting FFmpeg…", "started_at": time.time()})
        proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, text=True, bufsize=1)

        for line in proc.stderr:
            if job.get("status") == "cancelled":
                proc.kill()
                break
            if "time=" in line:
                try:
                    t_str = line.split("time=")[1].split(" ")[0]
                    parts = t_str.split(":")
                    t = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                    pct = min(95, int(t / dur * 87) + 8)
                    elapsed = time.time() - job.get("started_at", time.time())
                    eta_s   = int(elapsed / max(t, 0.1) * (dur - t)) if t > 0 else 0
                    eta_str = f" · ETA {eta_s}s" if eta_s > 0 else ""
                    job.update({
                        "progress": pct,
                        "message":  f"Encoding {int(t)}/{int(dur)}s{eta_str}",
                        "eta":      eta_s,
                    })
                except Exception:
                    pass

        proc.wait()

        if job.get("status") == "cancelled":
            if os.path.exists(out_path):
                os.unlink(out_path)
            return

        if proc.returncode == 0:
            fsize = os.path.getsize(out_path)
            job.update({
                "status":       "done",
                "progress":     100,
                "message":      "Export complete",
                "output_path":  out_path,
                "filename":     f"capcut_{quality}.{ext}",
                "filesize":     fsize,
                "completed_at": time.time(),
                "eta":          0,
            })
            print(f"[export] ✅ {job_id} → {out_path} ({fsize//1024} KB)", flush=True)
            _save_export_history()
        else:
            job.update({"status": "error", "message": "FFmpeg encoding failed (code %d)" % proc.returncode})
            _save_export_history()

    except Exception as exc:
        print(f"[export] ERROR {job_id}: {exc}", flush=True)
        export_jobs[job_id].update({"status": "error", "message": str(exc)})
        _save_export_history()


def _build_drawtext(segment_labels, title, w, h):
    fs_big  = max(18, h // 40)
    fs_sm   = max(11, h // 70)
    parts   = []

    # Background gradient via drawbox
    parts.append(f"drawbox=x=0:y=0:w={w}:h={h}:color=#1a1a2e@1.0:t=fill")

    # Header bar
    parts.append(f"drawbox=x=0:y=0:w={w}:h={h//12}:color=#21213a@1.0:t=fill")

    # Title
    safe_title = title.replace(":", r"\:").replace("[", r"\[").replace("]", r"\]")
    parts.append(
        f"drawtext=text='🎬 {safe_title}':fontcolor=#d4a017:"
        f"fontsize={fs_big}:x=20:y=(h/12-th)/2"
    )

    # Quality / format badge
    parts.append(
        f"drawtext=text='CapCut Clone  |  {w}x{h}  |  %{{pts\\:hms}}':"
        f"fontcolor=#666688:fontsize={fs_sm}:x=w-tw-20:y=(h/12-th)/2"
    )

    # Clip labels (timed)
    bar_y = h // 10
    for i, (start, sdur, lbl) in enumerate(segment_labels[:20]):
        if not lbl:
            continue
        x_pos = int(start / max(1, start + sdur) * w * 0.9) + int(w * 0.02)
        safe_lbl = lbl.replace(":", r"\:").replace("[", r"\[").replace("]", r"\]")
        t_start  = start
        t_end    = start + sdur
        parts.append(
            f"drawtext=text='▸ {safe_lbl}':fontcolor=#e0e0ff:fontsize={fs_sm}:"
            f"x={x_pos}:y={bar_y + (i % 6) * (fs_sm + 6)}:"
            f"enable='between(t\\,{t_start:.2f}\\,{t_end:.2f})'"
        )

    # Footer
    parts.append(
        f"drawbox=x=0:y={h-h//16}:w={w}:h={h//16}:color=#12121f@1.0:t=fill"
    )
    parts.append(
        f"drawtext=text='Exported with CapCut Clone  •  Duration\\: %{{pts\\:hms}}':"
        f"fontcolor=#444466:fontsize={fs_sm}:x=(w-tw)/2:y={h - h//16 + (h//16 - th)/2}"
    )

    return parts


# ── HTTP Handler ──────────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[server] {format % args}", flush=True)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── Phase 5.1: Standardized response helpers ─────────────────────────────
    # New endpoints should use these. Existing endpoints keep backward-compat shape.
    # Schema: { "success": bool, "data": any, "error": str|null }
    def send_ok(self, data=None, status=200):
        """Return a standardized success response."""
        self.send_json({"success": True,  "data": data, "error": None}, status)

    def send_err(self, message, status=400):
        """Return a standardized error response."""
        self.send_json({"success": False, "data": None, "error": str(message)}, status)
        print(f"[server] {status} {self.path}: {message}", flush=True)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        # Root
        if self.path == "/" or self.path == "":
            self.path = "/capcut.html"
            return super().do_GET()

        # Project endpoints
        if self.path == "/project/list":
            return self.send_json(project_list())
        if self.path.startswith("/project/") and len(self.path) > 9:
            pid = self.path[9:].strip("/")
            data = project_get(pid)
            if data:
                return self.send_json(data)
            return self.send_json({"error": "Not found"}, 404)

        # Factory status
        if self.path.startswith("/factory/status"):
            from urllib.parse import urlparse, parse_qs
            qs  = parse_qs(urlparse(self.path).query)
            bid = (qs.get("id") or [""])[0]
            b   = factory_batches.get(bid)
            if not b:
                return self.send_json({"error": "Batch not found"}, 404)
            safe = {k: v for k, v in b.items() if k != "shorts"}
            safe["shorts"] = b.get("shorts", []) if b.get("status") == "ready" else []
            return self.send_json(safe)

        # Factory results
        if self.path.startswith("/factory/results"):
            from urllib.parse import urlparse, parse_qs
            qs  = parse_qs(urlparse(self.path).query)
            bid = (qs.get("id") or [""])[0]
            b   = factory_batches.get(bid)
            if not b:
                return self.send_json({"error": "Batch not found"}, 404)
            return self.send_json({
                "batch_id": bid,
                "status":   b.get("status"),
                "shorts":   b.get("shorts", []),
                "subtitle_template": b.get("subtitle_template", "tiktok"),
                "completed_at": b.get("completed_at"),
            })

        # Export history
        if self.path == "/export/history":
            records = [
                {k: v for k, v in j.items() if k != "output_path"}
                for j in export_jobs.values()
                if j.get("status") in ("done", "error", "cancelled")
            ]
            records.sort(key=lambda r: r.get("completed_at") or r.get("created_at", 0), reverse=True)
            return self.send_json({"history": records[:50]})

        # Export status
        if self.path.startswith("/export/status"):
            from urllib.parse import urlparse, parse_qs
            qs  = parse_qs(urlparse(self.path).query)
            jid = (qs.get("id") or qs.get("job_id") or [""])[0]
            job = export_jobs.get(jid)
            if not job:
                return self.send_json({"error": "Job not found"}, 404)
            return self.send_json({k: v for k, v in job.items() if k != "output_path"})

        # Export download
        if self.path.startswith("/export/download"):
            from urllib.parse import urlparse, parse_qs
            qs  = parse_qs(urlparse(self.path).query)
            jid = (qs.get("id") or qs.get("job_id") or [""])[0]
            job = export_jobs.get(jid)
            if not job or job.get("status") != "done":
                return self.send_json({"error": "Not ready"}, 404)
            path = job.get("output_path", "")
            if not path or not os.path.exists(path):
                return self.send_json({"error": "File missing"}, 404)
            fname = job.get("filename", "export.mp4")
            ext   = fname.rsplit(".", 1)[-1]
            ct_map = {
                "mp4":  "video/mp4",
                "webm": "video/webm",
                "gif":  "image/gif",
            }
            ct    = ct_map.get(ext, "application/octet-stream")
            fsize = os.path.getsize(path)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type",        ct)
            self.send_header("Content-Length",      str(fsize))
            self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
            self.end_headers()
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            return

        super().do_GET()

    def do_DELETE(self):
        self.send_response(204)
        self._cors()
        self.end_headers()
        if self.path.startswith("/project/") and len(self.path) > 9:
            pid = self.path[9:].strip("/")
            project_delete(pid)

    def do_POST(self):
        EXPORT_START    = "/export/start"
        EXPORT_CANCEL   = "/export/cancel"
        FACTORY_GENERATE = "/factory/generate"
        ALLOWED_PATHS = AI_PATHS | {"/project/save", EXPORT_START, EXPORT_CANCEL, FACTORY_GENERATE}
        if self.path not in ALLOWED_PATHS:
            self.send_json({"error": "Not found"}, 404)
            return

        # Multipart upload must be handled before the JSON body read
        if self.path == "/ai/upload-media":
            try:
                return self.send_json(handle_upload_media(self))
            except Exception as exc:
                return self.send_json({"error": str(exc)}, 500)

        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        try:
            # Export start
            if self.path == EXPORT_START:
                jid      = "exp_" + uuid.uuid4().hex[:12]
                fmt      = body.get("format",  "mp4").lower()
                quality  = body.get("quality", "1080p").lower()
                fps      = int(body.get("fps", 30))
                project  = body.get("project", {})
                settings = body.get("settings", {})
                export_jobs[jid] = {
                    "id":           jid,
                    "status":       "queued",
                    "progress":     0,
                    "message":      "Queued…",
                    "format":       fmt,
                    "quality":      quality,
                    "fps":          fps,
                    "burn_subs":    settings.get("burnSubtitles", True),
                    "created_at":   time.time(),
                }
                t = threading.Thread(
                    target=_run_export,
                    args=(jid, project, fmt, quality, fps, settings),
                    daemon=True,
                )
                t.start()
                return self.send_json({"ok": True, "job_id": jid})

            # Factory generate
            if self.path == FACTORY_GENERATE:
                bid              = "fac_" + uuid.uuid4().hex[:12]
                editor_state     = body.get("editorState", {})
                max_shorts       = int(body.get("maxShorts", 10))
                subtitle_template = str(body.get("subtitleTemplate", "tiktok"))
                factory_batches[bid] = {
                    "id":               bid,
                    "status":           "queued",
                    "progress":         0,
                    "stage":            "Queued…",
                    "shorts":           [],
                    "subtitle_template": subtitle_template,
                    "created_at":       time.time(),
                }
                t = threading.Thread(
                    target=_run_factory_batch,
                    args=(bid, editor_state, max_shorts, subtitle_template),
                    daemon=True,
                )
                t.start()
                return self.send_json({"ok": True, "batch_id": bid})

            # Export cancel
            if self.path == EXPORT_CANCEL:
                jid = body.get("job_id", "")
                job = export_jobs.get(jid)
                if job and job.get("status") in ("queued", "running"):
                    job.update({"status": "cancelled", "message": "Cancelled by user"})
                    _save_export_history()
                    return self.send_json({"ok": True})
                return self.send_json({"error": "Job not found or already finished"}, 404)

            # Project save
            if self.path == "/project/save":
                return self.send_json(project_save(body))

            # AI endpoints
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
            elif self.path == "/ai/viral-analysis":
                result = handle_viral_analysis(body)
            elif self.path == "/ai/transcribe":
                result = handle_transcribe(body)
            elif self.path == "/ai/transcribe-real":
                result = handle_transcribe_real(body)
            elif self.path == "/ai/auto-style":
                result = handle_auto_style(body)
            elif self.path == "/brand/train":
                result = handle_brand_train(body)
            elif self.path == "/brand/compare":
                result = handle_brand_compare(body)
            else:
                result = {"error": "Unknown endpoint"}

            self.send_json(result)

        except Exception as e:
            err = str(e)
            print(f"[server] ERROR {self.path}: {err}", flush=True)
            if "FREE_CLOUD_BUDGET_EXCEEDED" in err:
                self.send_json({"error": "FREE_CLOUD_BUDGET_EXCEEDED"}, 402)
            else:
                self.send_json({"error": err}, 500)


# ── Brand Clone Handlers ───────────────────────────────────────────────────────

def handle_brand_train(body):
    """Phân tích assets và trích xuất brand patterns bằng AI."""
    if not client:
        return {"error": "OpenAI not configured"}

    brand_name = body.get("brand_name", "My Brand")
    assets     = body.get("assets", [])
    if not assets:
        return {"error": "No assets provided"}

    all_transcripts = []
    all_subtitles   = []
    clip_durations  = []

    for asset in assets:
        tx = (asset.get("transcript") or "").strip()
        if tx:
            all_transcripts.append(tx[:800])
        for s in (asset.get("subtitles") or [])[:30]:
            text = (s.get("text") or "").strip()
            if text:
                all_subtitles.append(text)
        for clip in (asset.get("timeline") or {}).get("clips", []):
            dur = float(clip.get("dur", 0))
            if dur > 0:
                clip_durations.append(dur)

    avg_clip_dur = round(sum(clip_durations) / len(clip_durations), 2) if clip_durations else None
    if avg_clip_dur:
        cut_style = "fast" if avg_clip_dur < 3 else ("medium" if avg_clip_dur < 6 else "slow")
    else:
        cut_style = None

    tx_block   = "\n---\n".join(all_transcripts[:10]) or "(không có transcript)"
    sub_block  = "\n".join(all_subtitles[:50])         or "(không có subtitle)"

    prompt = f"""Bạn là AI chuyên gia phân tích phong cách sáng tạo nội dung video.
Phân tích dữ liệu từ {len(assets)} video của creator có tên brand: "{brand_name}".

TRANSCRIPT (nội dung nói):
{tx_block}

SUBTITLE TEXT:
{sub_block}

THỐNG KÊ TIMELINE:
- Số video phân tích: {len(assets)}
- Thời lượng clip trung bình: {avg_clip_dur}s
- Phong cách cắt: {cut_style}
- Tổng số clip: {len(clip_durations)}

Dựa HOÀN TOÀN trên dữ liệu thực được cung cấp. Trả về JSON:
{{
  "subtitlePatterns": {{
    "dominantColor": "yellow|white|green|...|null",
    "dominantFont": "bold|normal|null",
    "usesHighlight": true,
    "highlightWords": ["từ hay được highlight"],
    "templateUsage": {{"tiktok": 3, "mrbeast": 2}},
    "topTemplate": "tên template hay dùng nhất hoặc null"
  }},
  "editingPatterns": {{
    "avgCutInterval": {avg_clip_dur if avg_clip_dur else 'null'},
    "cutStyle": "{cut_style if cut_style else 'null'}",
    "paceRating": "fast|medium|slow",
    "usesZoom": false,
    "avgClipDur": {avg_clip_dur if avg_clip_dur else 'null'}
  }},
  "hookPatterns": {{
    "examples": ["hook ví dụ lấy từ transcript thật"],
    "commonStructures": ["câu hỏi tu từ", "số liệu gây shock"],
    "dominantType": "question|shock|story|listicle|promise"
  }},
  "titlePatterns": {{
    "examples": ["title từ nội dung thật"],
    "commonStructures": ["dùng số", "dùng câu hỏi"],
    "avgLength": 8
  }},
  "ctaPatterns": {{
    "examples": ["Follow để xem thêm", "Like nếu hữu ích"],
    "placement": "end|start|middle",
    "dominantType": "follow|like|comment|share"
  }},
  "shortPatterns": {{
    "avgDuration": 30,
    "hookStyle": "mở đầu bằng câu hỏi",
    "paceRating": "fast|medium|slow"
  }},
  "brandScore": {{
    "consistency": 75,
    "subtitleConsistency": 80,
    "hookConsistency": 70,
    "editingConsistency": 75
  }},
  "confidence": 0.72
}}

Quy tắc:
- Chỉ trả JSON hợp lệ, không thêm text
- Dựa hoàn toàn trên dữ liệu thực, không bịa đặt
- Nếu không đủ dữ liệu cho một trường, để null
- confidence: 0.0–1.0 (dựa trên mức độ nhất quán quan sát được)
- brandScore fields: 0–100"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=1500,
    )
    return json.loads(resp.choices[0].message.content)


def handle_brand_compare(body):
    """So sánh video hiện tại với Brand Profile, hoặc tạo CTA theo brand."""
    if not client:
        return {"error": "OpenAI not configured"}

    mode = body.get("mode", "compare")

    # ── Generate CTA mode ──
    if mode == "generate_cta":
        brand   = body.get("brand_profile", {})
        tx      = body.get("transcript", "") or ""
        cta_ex  = (brand.get("ctaPatterns") or {}).get("examples", [])
        dom_cta = (brand.get("ctaPatterns") or {}).get("dominantType", "follow")
        hook_ex = (brand.get("hookPatterns") or {}).get("examples", [])
        prompt  = f"""Bạn là AI sáng tạo nội dung thương hiệu.

Brand: "{brand.get('brandName','?')}"
CTA examples từ brand:
{chr(10).join(cta_ex[:3]) if cta_ex else "(chưa có)"}
Loại CTA hay dùng: {dom_cta}

Hook examples từ brand:
{chr(10).join(hook_ex[:2]) if hook_ex else "(chưa có)"}

Nội dung video hiện tại:
{tx[:400] or "(chưa có transcript)"}

Tạo CTA và hook phù hợp đúng phong cách brand.
Trả về JSON: {{"cta": "câu CTA ngắn gọn, tự nhiên", "hook": "câu mở đầu video theo phong cách brand"}}"""
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=250,
        )
        return json.loads(resp.choices[0].message.content)

    # ── Default: compare mode ──
    brand  = body.get("brand_profile", {})
    estate = body.get("editor_state", {})
    subs   = estate.get("subtitles", []) or []
    trks   = estate.get("tracks", [])    or []
    clips  = [c for t in trks for c in (t.get("clips") or [])]
    durs   = [float(c.get("dur", 0)) for c in clips if float(c.get("dur", 0)) > 0]
    avg_d  = round(sum(durs)/len(durs), 2) if durs else None
    texts  = [s.get("text","") for s in subs[:20]]

    ep = brand.get("editingPatterns") or {}
    hp = brand.get("hookPatterns")    or {}
    sp = brand.get("subtitlePatterns") or {}
    cp = brand.get("ctaPatterns")     or {}

    prompt = f"""Bạn là AI phân tích brand consistency.

Brand Profile: "{brand.get('brandName','?')}"
- Hook dominantType: {hp.get('dominantType','?')}
- Subtitle template: {sp.get('topTemplate','?')}
- CTA type: {cp.get('dominantType','?')} ở {cp.get('placement','?')} video
- Cut style: {ep.get('cutStyle','?')}
- Avg clip dur: {ep.get('avgClipDur','?')}s

Video hiện tại:
- Subtitle text (20 mẫu): {texts[:10]}
- Avg clip dur: {avg_d}s
- Số clip: {len(clips)}

Đánh giá mức độ giống Brand Profile:
{{
  "similarity": 75,
  "differences": [
    "Chưa có hook dạng câu hỏi ở đầu video",
    "Cần thêm CTA ở cuối"
  ]
}}

similarity: 0–100. differences: tối đa 5 điểm khác biệt (tiếng Việt). Chỉ JSON hợp lệ."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=400,
    )
    result = json.loads(resp.choices[0].message.content)
    result["similarity"] = max(0, min(100, int(result.get("similarity", 50))))
    return result


# ── AI Handlers ───────────────────────────────────────────────────────────────

def _require_client():
    if client is None:
        raise ValueError("OPENAI_API_KEY is not set. Add it in the Secrets tab.")


def handle_subtitle(body):
    _require_client()
    clips    = body.get("clips", [])
    lang     = body.get("lang", "vi")
    if not clips:
        return {"subtitles": []}
    clip_list  = "\n".join(
        f"- Clip {i+1}: \"{c.get('label','')}\", {c.get('start',0):.1f}s → {c.get('start',0)+c.get('dur',3):.1f}s"
        for i, c in enumerate(clips)
    )
    lang_name  = "tiếng Việt" if lang == "vi" else "English"
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
    clips  = body.get("clips", [])
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
    label  = body.get("label", "video")
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
    lines    = body.get("lines", [])
    src_lang = body.get("srcLang", "vi")
    dst_lang = body.get("dstLang", "en")
    if not lines:
        return {"translations": []}
    lang_names = {
        "vi": "Tiếng Việt", "en": "English", "ko": "Korean (한국어)",
        "ja": "Japanese (日本語)", "zh": "Chinese (中文)", "fr": "French",
        "de": "German", "es": "Spanish", "th": "Thai", "id": "Indonesian",
        "ms": "Malay", "pt": "Portuguese", "ar": "Arabic", "ru": "Russian", "hi": "Hindi",
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


def handle_generate_shorts(body):
    _require_client()
    state     = body.get("editorState", {})
    total_dur = float(state.get("totalDuration", 0))
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
    timeline_text = "\n".join(clips_lines) if clips_lines else "  (empty)"
    subs_text     = "\n".join(subs_lines)  if subs_lines  else "  (none)"
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
    for s in result.get("shorts", []):
        s["score"] = round(max(0.0, min(1.0, float(s.get("score", 0.5)))), 2)
        s["start"] = round(max(0.0, float(s.get("start", 0))), 2)
        s["end"]   = round(min(float(total_dur) if total_dur else 999,
                               float(s.get("end", 30))), 2)
    return result


def handle_upload_media(handler):
    """Parse multipart/form-data upload, save file to UPLOADS_DIR.
    Uses stdlib email.parser — no deprecated cgi module needed."""
    from email import policy as _ep
    from email.parser import BytesFeedParser as _BFP

    ct     = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length", 0))
    if not ct.startswith("multipart/form-data"):
        raise ValueError("Expected multipart/form-data")
    if length > 200 * 1024 * 1024:
        raise ValueError("File too large (max 200 MB)")

    raw_body = handler.rfile.read(length)

    # Extract boundary from Content-Type
    bnd = None
    for part in ct.split(";"):
        part = part.strip()
        if part.lower().startswith("boundary="):
            bnd = part[9:].strip().strip('"')
            break
    if not bnd:
        raise ValueError("No boundary in Content-Type")

    # Split body into parts on the boundary
    sep    = ("--" + bnd).encode()
    term   = ("--" + bnd + "--").encode()
    chunks = raw_body.split(sep)

    filename = None
    file_data = None

    for chunk in chunks:
        chunk = chunk.strip(b"\r\n")
        if not chunk or chunk == b"--" or chunk.startswith(b"--"):
            continue
        # Each chunk: headers \r\n\r\n body
        if b"\r\n\r\n" not in chunk:
            continue
        head_raw, body = chunk.split(b"\r\n\r\n", 1)
        # Strip trailing boundary marker
        if body.endswith(b"\r\n"):
            body = body[:-2]

        # Parse headers via email
        parser = _BFP(policy=_ep.compat32)
        parser.feed(head_raw + b"\r\n\r\n")
        msg = parser.close()
        disp = msg.get("Content-Disposition", "")
        if 'name="file"' not in disp and "name=file" not in disp:
            continue
        # Extract filename
        for token in disp.split(";"):
            token = token.strip()
            if token.lower().startswith("filename="):
                filename = token[9:].strip().strip('"')
                break
        file_data = body
        break

    if file_data is None:
        raise ValueError("No 'file' field found in multipart body")

    filename = filename or "upload.bin"
    file_id  = "upl_" + uuid.uuid4().hex[:14]
    ext      = Path(filename).suffix.lower() or ".bin"
    save_path = UPLOADS_DIR / f"{file_id}{ext}"
    save_path.write_bytes(file_data)

    print(f"[upload] saved {filename} → {save_path} ({len(file_data)//1024} KB)", flush=True)
    return {
        "ok":       True,
        "fileId":   file_id,
        "filename": filename,
        "size":     len(file_data),
        "ext":      ext,
    }


def handle_transcribe_real(body):
    """FFmpeg audio extraction → OpenAI Whisper → word-level transcript."""
    _require_client()

    file_id  = body.get("fileId", "").strip()
    if not file_id:
        return {"error": "fileId required. Call /ai/upload-media first."}

    # Locate the uploaded file
    matches = list(UPLOADS_DIR.glob(f"{file_id}.*"))
    if not matches:
        return {"error": f"Upload not found for fileId={file_id}. Re-upload the file."}

    src_path = matches[0]
    ext      = src_path.suffix.lower()

    # ── FFmpeg: extract / convert to 16 kHz mono WAV ──────────────────────────
    audio_path = UPLOADS_DIR / f"{file_id}_audio.wav"
    VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv", ".wmv"}
    AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac", ".opus", ".wma"}

    if ext in VIDEO_EXTS:
        cmd = [
            "ffmpeg", "-y", "-i", str(src_path),
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(audio_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=180)
        if proc.returncode != 0:
            return {"error": "FFmpeg audio extraction failed: " + proc.stderr.decode()[-300:]}
        transcribe_path = audio_path
    elif ext in AUDIO_EXTS:
        # Convert to WAV 16 kHz mono anyway for best Whisper results
        cmd = [
            "ffmpeg", "-y", "-i", str(src_path),
            "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(audio_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, timeout=120)
        transcribe_path = audio_path if proc.returncode == 0 else src_path
    else:
        return {"error": f"Unsupported file type: {ext}"}

    # ── Size check: Whisper API limit is 25 MB ─────────────────────────────────
    size_mb = transcribe_path.stat().st_size / 1024 / 1024
    if size_mb > 24.5:
        _cleanup(src_path, audio_path)
        return {"error": f"Audio is {size_mb:.1f} MB — Whisper limit is 25 MB. Use a shorter clip."}

    # ── Whisper API call ───────────────────────────────────────────────────────
    print(f"[whisper] transcribing {transcribe_path.name} ({size_mb:.1f} MB)…", flush=True)
    try:
        with open(transcribe_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
            )
    except Exception as exc:
        _cleanup(src_path, audio_path)
        return {"error": f"Whisper API error: {exc}"}

    # ── Parse response ─────────────────────────────────────────────────────────
    segments   = []
    total_words = 0

    for seg in (response.segments or []):
        raw_conf  = getattr(seg, "avg_logprob", -0.5)
        # avg_logprob is negative; convert to 0-1 via exp, then clip
        confidence = round(min(1.0, max(0.0, math.exp(raw_conf))), 3)

        words = []
        for w in (getattr(seg, "words", None) or []):
            words.append({
                "word":       w.word.strip(),
                "start":      round(float(w.start), 3),
                "end":        round(float(w.end),   3),
                "confidence": round(float(getattr(w, "probability", 0.9)), 3),
            })
        total_words += len(words)

        segments.append({
            "start":      round(float(seg.start), 3),
            "end":        round(float(seg.end),   3),
            "text":       seg.text.strip(),
            "confidence": confidence,
            "words":      words,
        })

    # ── Stats ──────────────────────────────────────────────────────────────────
    duration     = segments[-1]["end"] - segments[0]["start"] if segments else 0
    speaking_rate = round(total_words / (duration / 60)) if duration > 0 else 0
    avg_conf      = round(
        sum(s["confidence"] for s in segments) / len(segments), 3
    ) if segments else 0.0

    _cleanup(src_path, audio_path)
    print(f"[whisper] done — {len(segments)} segments, {total_words} words, lang={response.language}", flush=True)

    return {
        "language":     response.language or "en",
        "transcript":   segments,
        "wordCount":    total_words,
        "speakingRate": speaking_rate,
        "confidence":   avg_conf,
        "duration":     round(duration, 2),
    }


def _cleanup(*paths):
    for p in paths:
        try:
            if Path(p).exists():
                Path(p).unlink()
        except Exception:
            pass


def handle_auto_style(body):
    """AI analyzes subtitle text and recommends the best template."""
    _require_client()
    text = body.get("text", "").strip()
    if not text:
        return {"error": "No text provided"}

    prompt = f"""You are a subtitle design expert. Analyze the following subtitle text and recommend the best visual template.

Available templates:
- tiktok: Bold, word-by-word, high energy, social media
- mrbeast: ALL CAPS, dramatic outline, viral content
- podcast: Clean, readable, conversational
- netflix: Professional black box, narrative content
- gaming: Neon glow, fast-paced, gaming/action
- minimal: Transparent, thin weight, elegant/educational
- documentary: Gold italic, cinematic, serious/informational

Subtitle text sample:
"{text[:400]}"

Respond with ONLY a JSON object:
{{"template": "<template_key>", "reason": "<one short sentence why>"}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=128,
    )
    result = json.loads(resp.choices[0].message.content)
    valid = {"tiktok", "mrbeast", "podcast", "netflix", "gaming", "minimal", "documentary"}
    if result.get("template") not in valid:
        result["template"] = "tiktok"
    return result


def handle_transcribe(body):
    _require_client()
    state     = body.get("editorState", {})
    total_dur = float(state.get("totalDuration", 0))
    transcript_segs = body.get("transcriptSegments", [])  # pre-generated, from client

    clips_lines = []
    for tr in state.get("tracks", []):
        for c in tr.get("clips", []):
            s   = float(c.get("start", 0))
            dur = float(c.get("dur", 0))
            lbl = c.get("label", "").strip()
            clips_lines.append(
                f'  [{tr.get("type","?")}] {s:.2f}s–{s+dur:.2f}s  label="{lbl}"'
            )
    subs_lines = [
        f'  {float(s.get("start",0)):.2f}s–{float(s.get("start",0))+float(s.get("dur",3)):.2f}s: "{s.get("text","")}"'
        for s in state.get("subtitles", [])[:40]
    ]
    timeline_text = "\n".join(clips_lines) if clips_lines else "  (empty timeline)"
    subs_text     = "\n".join(subs_lines)  if subs_lines  else "  (no subtitles)"

    # If client already sent transcript segments (from a previous session), return them
    if transcript_segs:
        return {"transcript": transcript_segs, "language": "en", "cached": True}

    prompt = f"""You are a professional video transcription AI.
Given a video editor timeline (clip labels + subtitle text), generate a realistic timestamped transcript that represents what would be spoken in this video.

VIDEO TIMELINE  (total duration: {total_dur:.2f}s)
{timeline_text}

EXISTING SUBTITLES (use as primary source for spoken words)
{subs_text}

Instructions:
- Create natural-sounding spoken transcript segments that match the clip labels and subtitle text
- Every segment must have a start time within [0, {total_dur:.2f}]
- Segments should be 3–12 seconds each (one sentence or phrase per segment)
- Use subtitle text verbatim where available; infer speech for unlabeled clips
- Language: detect from subtitle text; default English
- If no subtitle or clip text exists, generate plausible commentary based on clip types

Return ONLY valid JSON:
{{
  "language": "en",
  "transcript": [
    {{"start": 0.0, "end": 4.2, "text": "Spoken words here"}},
    ...
  ]
}}

Rules:
- Return 5–40 segments depending on video length
- Segments must be chronologically ordered
- No gaps larger than 10s between segments
- end = next segment's start (overlaps not allowed)
- If timeline is empty, generate a 30s sample transcript"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=2048,
    )
    result = json.loads(resp.choices[0].message.content)
    segs = result.get("transcript", [])
    # Clamp all timestamps
    for i, seg in enumerate(segs):
        seg["start"] = round(max(0.0, float(seg.get("start", 0))), 2)
        seg["end"]   = round(min(float(total_dur) if total_dur else 9999,
                                 float(seg.get("end", seg["start"] + 5))), 2)
        if seg["end"] <= seg["start"]:
            seg["end"] = round(seg["start"] + 3.0, 2)
    result["transcript"] = segs
    return result


def handle_viral_analysis(body):
    _require_client()
    state     = body.get("editorState", {})
    total_dur = float(state.get("totalDuration", 0)) or 30.0
    segments  = body.get("segments", [])  # [{start, end}]

    # Build context
    clips_lines = []
    has_audio   = False
    sub_times   = []
    for tr in state.get("tracks", []):
        if tr.get("type") == "audio":
            has_audio = True
        for c in tr.get("clips", []):
            s   = float(c.get("start", 0))
            dur = float(c.get("dur", 0))
            clips_lines.append(
                f'  [{tr.get("type","?")}] "{c.get("label","")}"  {s:.1f}s→{s+dur:.1f}s'
            )
    for sub in state.get("subtitles", []):
        sub_times.append((float(sub.get("start", 0)), sub.get("text", "")))

    # Build segment list for analysis
    if not segments:
        step = max(2.0, total_dur / 20)
        segments = []
        t = 0.0
        while t < total_dur:
            segments.append({"start": round(t, 1), "end": round(min(t + step, total_dur), 1)})
            t += step

    segs_text = "\n".join(f"  [{s['start']:.1f}s–{s['end']:.1f}s]" for s in segments[:25])

    prompt = f"""You are a viral video analyst AI. Analyze this video timeline and score each time segment for viewer retention.

VIDEO DURATION: {total_dur:.1f}s
HAS AUDIO TRACK: {has_audio}

CLIPS:
{chr(10).join(clips_lines) if clips_lines else '  (none)'}

SUBTITLES (sample):
{chr(10).join(f"  {t:.1f}s: {txt}" for t, txt in sub_times[:15]) if sub_times else '  (none)'}

TIME SEGMENTS TO SCORE:
{segs_text}

For EACH segment, score it 0.0–1.0 based on:
- speech_pace: How fast/engaging is the dialogue/narration (infer from subtitle density)
- scene_activity: Scene changes, motion, clip cuts
- subtitle_density: How many subtitles per second (hooks viewers)
- silence_penalty: Silence/empty frames drag retention down
- emotional_peak: Climax, punchline, hook, reveal moments

Return ONLY valid JSON:
{{
  "segments": [
    {{
      "start": 0.0,
      "end": 5.0,
      "score": 0.85,
      "level": "high",
      "tags": ["hook"],
      "detail": "Strong opening with high energy"
    }}
  ],
  "hooks": [
    {{
      "start": 0.0,
      "strength": 0.9,
      "hook_type": "curiosity",
      "reason": "Immediate attention grab"
    }}
  ],
  "boring": [
    {{"start": 10.0, "end": 15.0, "reason": "Silent gap, no subtitles"}}
  ],
  "peaks": [
    {{
      "start": 8.0,
      "end": 14.0,
      "type": "excitement",
      "reason": "High-energy moment with rapid cuts"
    }}
  ],
  "viral_score": 72,
  "breakdown": {{
    "hook_strength": 80,
    "pacing": 65,
    "subtitle_density": 70,
    "emotion": 75,
    "variety": 60
  }},
  "tips": ["Add a hook in the first 3 seconds", "Cut the silent pause at 12s"]
}}

Rules:
- score 0.8–1.0 = "high" (green), 0.4–0.8 = "medium" (yellow), 0.0–0.4 = "low" (red)
- viral_score is 0–100 integer (overall)
- breakdown values are 0–100 integers
- tags can include: hook, climax, boring, transition, silence, dense-subs, scene-cut
- tips: 2–4 actionable improvement suggestions
- Match exact start/end values from the segments list
- hook_type must be one of: curiosity, controversy, urgency, surprise, promise
- peaks: 1–4 emotional high points; type must be one of: surprise, humor, conflict, excitement, inspiration
- boring: only include genuinely low-energy segments (score < 0.4)"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=2048,
    )
    result = json.loads(resp.choices[0].message.content)

    # Clamp values
    for seg in result.get("segments", []):
        seg["score"] = round(max(0.0, min(1.0, float(seg.get("score", 0.5)))), 2)
        lvl = seg.get("level", "medium")
        if seg["score"] >= 0.75:
            seg["level"] = "high"
        elif seg["score"] >= 0.4:
            seg["level"] = "medium"
        else:
            seg["level"] = "low"

    vs = result.get("viral_score", 50)
    result["viral_score"] = max(0, min(100, int(vs)))

    bd = result.get("breakdown", {})
    for k in ("hook_strength", "pacing", "subtitle_density", "emotion", "variety"):
        bd[k] = max(0, min(100, int(bd.get(k, 50))))

    # Validate hook_type
    valid_hook_types = {"curiosity", "controversy", "urgency", "surprise", "promise"}
    for h in result.get("hooks", []):
        h["start"]     = round(max(0.0, float(h.get("start", 0))), 2)
        h["strength"]  = round(max(0.0, min(1.0, float(h.get("strength", 0.5)))), 2)
        if h.get("hook_type") not in valid_hook_types:
            h["hook_type"] = "curiosity"

    # Validate peaks
    valid_peak_types = {"surprise", "humor", "conflict", "excitement", "inspiration"}
    for p in result.get("peaks", []):
        p["start"] = round(max(0.0, float(p.get("start", 0))), 2)
        p["end"]   = round(max(p["start"] + 0.5, float(p.get("end", p["start"] + 5))), 2)
        if p.get("type") not in valid_peak_types:
            p["type"] = "excitement"

    return result


# ── Project helpers ───────────────────────────────────────────────────────────

def project_save(body):
    pid  = body.get("id") or ("proj_" + str(int(time.time() * 1000)))
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
                "id":         data.get("id", f.stem),
                "name":       data.get("name", "Untitled"),
                "createdAt":  data.get("createdAt", ""),
                "updatedAt":  data.get("updatedAt", ""),
                "duration":   data.get("duration", 0),
                "trackCount": data.get("trackCount", 0),
            })
        except Exception:
            pass
    return {"projects": projects}


def project_delete(pid):
    path = PROJECTS_DIR / (pid + ".json")
    if path.exists():
        path.unlink()


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    _load_export_history()
    PORT = 5000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"[server] Chạy tại http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
