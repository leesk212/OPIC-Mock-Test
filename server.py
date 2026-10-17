#!/usr/bin/env python3
"""OPIc mock test — local exam server (Python 3 standard library only).

Serves the exam on http://localhost:8765. Browsers treat localhost as a
secure origin, so the page may use the microphone without HTTPS.

Folders next to this file:
  web/         setup page, exam page, feedback page, avatar image
  sets/        YYYY-MM-DD.json            today's 15 questions (written by the daily scheduled task)
  results/     YYYY-MM-DD[_TAG].json      times, transcripts and flags saved when an exam ends
  recordings/  YYYY-MM-DD/Qn.webm         one recording per question
  feedback/    YYYY-MM-DD[_TAG].json      AL feedback for a result
  prompts/     feedback.md                grading rubric shared by the API path and the nightly task

Feedback is produced one of two ways:
  * Instant — put an Anthropic API key in config.json (or ANTHROPIC_API_KEY) and the
    server grades the result right after the exam.
  * Nightly — without a key the result is queued (feedback/<name>.pending) and a
    scheduled Claude task grades every queued result and writes feedback/<name>.json.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
PORT = int(os.environ.get("OPIC_PORT", "8765"))
KST = timezone(timedelta(hours=9))
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TAG_RE = re.compile(r"^[A-Za-z0-9-]{1,16}$")
NAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(_[A-Za-z0-9-]{1,16})?$")
MAX_AUDIO = 60 * 1024 * 1024
MAX_JSON = 2 * 1024 * 1024
DEFAULT_MODEL = "claude-sonnet-5-5"


def today():
    return datetime.now(KST).strftime("%Y-%m-%d")


def load_config():
    cfg = {}
    f = ROOT / "config.json"
    if f.exists():
        try:
            cfg = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            sys.stderr.write("config.json is not valid JSON — ignoring it\n")
    key = os.environ.get("ANTHROPIC_API_KEY") or cfg.get("anthropic_api_key") or ""
    model = os.environ.get("OPIC_MODEL") or cfg.get("model") or DEFAULT_MODEL
    return key.strip(), model


def result_name(date, tag):
    return f"{date}_{tag}" if tag and TAG_RE.match(tag) else date


def extract_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in model reply")
    return json.loads(text[start : end + 1])


def grade_with_api(result, key, model):
    rubric = (ROOT / "prompts" / "feedback.md").read_text(encoding="utf-8")
    payload = {
        "model": model,
        "max_tokens": 8000,
        "system": rubric,
        "messages": [
            {
                "role": "user",
                "content": "Grade this OPIc mock-test result. Reply with the JSON object only.\n\n"
                + json.dumps(result, ensure_ascii=False),
            }
        ],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        body = json.loads(r.read().decode("utf-8"))
    text = "".join(b.get("text", "") for b in body.get("content", []) if b.get("type") == "text")
    fb = extract_json(text)
    fb["model"] = model
    fb["graded_at"] = datetime.now(KST).isoformat(timespec="seconds")
    fb["source"] = "api"
    return fb


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (datetime.now(KST).strftime("%H:%M:%S"), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _date(self, q):
        d = (q.get("date") or [today()])[0]
        return d if DATE_RE.match(d) else None

    def _feedback_state(self, name):
        fb = ROOT / "feedback" / f"{name}.json"
        if fb.exists():
            try:
                return {"status": "ready", "feedback": json.loads(fb.read_text(encoding="utf-8"))}
            except ValueError:
                return {"status": "error", "error": "feedback file is not valid JSON"}
        if (ROOT / "feedback" / f"{name}.pending").exists():
            return {"status": "queued"}
        return {"status": "none"}

    # ---------- GET ----------
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/health":
            key, model = load_config()
            return self._json(200, {"ok": True, "today": today(), "instant_feedback": bool(key), "model": model})
        if u.path == "/api/set":
            d = self._date(q)
            f = ROOT / "sets" / f"{d}.json" if d else None
            if f and f.exists():
                try:
                    return self._json(200, json.loads(f.read_text(encoding="utf-8")))
                except ValueError:
                    return self._json(500, {"error": "set file is not valid JSON"})
            return self._json(404, {"error": "no set for this date"})
        if u.path == "/api/feedback":
            name = (q.get("name") or [""])[0]
            if not NAME_RE.match(name):
                return self._json(400, {"error": "bad name"})
            return self._json(200, self._feedback_state(name))
        if u.path == "/api/history":
            out = []
            for f in sorted((ROOT / "results").glob("*.json"), reverse=True)[:60]:
                try:
                    r = json.loads(f.read_text(encoding="utf-8"))
                except ValueError:
                    continue
                st = self._feedback_state(f.stem)
                out.append({
                    "name": f.stem, "date": r.get("date"), "part": r.get("part"), "count": r.get("count"),
                    "totalSec": r.get("totalSec"), "theme": r.get("theme"), "feedback": st["status"],
                    "grade": (st.get("feedback") or {}).get("overall", {}).get("grade"),
                })
            return self._json(200, {"items": out})
        if u.path == "/api/result":
            name = (q.get("name") or [""])[0]
            f = ROOT / "results" / f"{name}.json"
            if NAME_RE.match(name) and f.exists():
                return self._json(200, json.loads(f.read_text(encoding="utf-8")))
            return self._json(404, {"error": "no result"})
        if u.path.startswith("/recordings/"):
            rel = u.path[len("/recordings/"):]
            if re.match(r"^\d{4}-\d{2}-\d{2}/Q\d{1,2}\.webm$", rel) and (ROOT / "recordings" / rel).exists():
                data = (ROOT / "recordings" / rel).read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "audio/webm")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            return self._json(404, {"error": "no recording"})
        return super().do_GET()

    # ---------- POST ----------
    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        d = self._date(q)
        if not d:
            return self._json(400, {"error": "bad date"})
        n = int(self.headers.get("Content-Length") or 0)
        tag = (q.get("tag") or [""])[0]
        name = result_name(d, tag)

        if u.path == "/api/recording":
            try:
                qn = int((q.get("n") or ["0"])[0])
            except ValueError:
                qn = 0
            if not (1 <= qn <= 20) or n <= 0 or n > MAX_AUDIO:
                return self._json(400, {"error": "bad recording"})
            out = ROOT / "recordings" / d
            out.mkdir(parents=True, exist_ok=True)
            (out / f"Q{qn}.webm").write_bytes(self.rfile.read(n))
            return self._json(200, {"saved": f"recordings/{d}/Q{qn}.webm"})

        if u.path == "/api/result":
            if n <= 0 or n > MAX_JSON:
                return self._json(400, {"error": "bad result"})
            try:
                data = json.loads(self.rfile.read(n).decode("utf-8"))
            except ValueError:
                return self._json(400, {"error": "not JSON"})
            out = ROOT / "results"
            out.mkdir(exist_ok=True)
            (out / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return self._json(200, {"saved": f"results/{name}.json", "name": name})

        if u.path == "/api/feedback":
            res = ROOT / "results" / f"{name}.json"
            if not res.exists():
                return self._json(404, {"error": "save the result first"})
            fbdir = ROOT / "feedback"
            fbdir.mkdir(exist_ok=True)
            st = self._feedback_state(name)
            if st["status"] == "ready" and (q.get("force") or ["0"])[0] != "1":
                return self._json(200, st)
            key, model = load_config()
            if not key:
                (fbdir / f"{name}.pending").write_text(datetime.now(KST).isoformat(timespec="seconds"), encoding="utf-8")
                return self._json(202, {"status": "queued", "name": name})
            try:
                fb = grade_with_api(json.loads(res.read_text(encoding="utf-8")), key, model)
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:300]
                return self._json(502, {"status": "error", "error": f"API {e.code}: {detail}"})
            except Exception as e:  # network, timeout, unparsable reply
                return self._json(502, {"status": "error", "error": str(e)[:300]})
            fb["name"] = name
            (fbdir / f"{name}.json").write_text(json.dumps(fb, ensure_ascii=False, indent=2), encoding="utf-8")
            pend = fbdir / f"{name}.pending"
            if pend.exists():
                pend.write_text("", encoding="utf-8")  # cleared marker; harmless if it cannot be removed
                try:
                    pend.unlink()
                except OSError:
                    pass
            return self._json(200, {"status": "ready", "feedback": fb})

        return self._json(404, {"error": "not found"})


if __name__ == "__main__":
    for sub in ("sets", "results", "recordings", "feedback"):
        (ROOT / sub).mkdir(exist_ok=True)
    key, model = load_config()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"OPIc mock test: http://localhost:{PORT}")
    print("  feedback: " + (f"instant ({model})" if key else "nightly (no API key in config.json)"))
    print("  stop: Ctrl+C")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
