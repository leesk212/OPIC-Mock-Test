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

Feedback (see README "Feedback options"):
  * provider "anthropic"  — Anthropic API key in config.json or ANTHROPIC_API_KEY
  * provider "openai"     — any OpenAI-compatible endpoint: OpenAI, or a local model via
                             Ollama / LM Studio (base_url http://localhost:11434/v1, no key)
  * no provider           — the page shows a ready-made grading prompt to paste into any
                             chat assistant, and a box to paste the JSON reply back
  * scheduled task        — results stay queued (feedback/<name>.pending) for a scheduled
                             Claude task that grades them and writes feedback/<name>.json
"""
import hmac
import json
import os
import secrets
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


def access_token():
    """Secret that remote (tunnelled) requests must present. Created on first run, git-ignored."""
    f = ROOT / ".access_token"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(24), encoding="utf-8")
        try:
            os.chmod(f, 0o600)
        except OSError:
            pass
    return f.read_text(encoding="utf-8").strip()


TOKEN = None


def today():
    return datetime.now(KST).strftime("%Y-%m-%d")


def load_config():
    """Returns dict(provider, key, model, base_url). provider is '' when no grader is configured."""
    cfg = {}
    f = ROOT / "config.json"
    if f.exists():
        try:
            cfg = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            sys.stderr.write("config.json is not valid JSON — ignoring it\n")
    provider = (os.environ.get("OPIC_PROVIDER") or cfg.get("provider") or "").lower()
    key = os.environ.get("OPIC_API_KEY") or cfg.get("api_key") or cfg.get("anthropic_api_key") or ""
    if not provider:
        if os.environ.get("ANTHROPIC_API_KEY") or cfg.get("anthropic_api_key"):
            provider = "anthropic"
            key = key or os.environ.get("ANTHROPIC_API_KEY", "")
        elif cfg.get("base_url"):
            provider = "openai"
    if provider == "anthropic" and not key:
        key = os.environ.get("ANTHROPIC_API_KEY", "")
    if provider == "openai" and not key:
        key = os.environ.get("OPENAI_API_KEY", "")
    if provider == "anthropic" and not key:
        provider = ""
    model = os.environ.get("OPIC_MODEL") or cfg.get("model") or (DEFAULT_MODEL if provider == "anthropic" else "gpt-4o-mini" if provider == "openai" else "")
    base_url = (cfg.get("base_url") or ("https://api.openai.com/v1" if provider == "openai" else "")).rstrip("/")
    return {"provider": provider, "key": key.strip(), "model": model, "base_url": base_url}


def grading_messages(result):
    rubric = (ROOT / "prompts" / "feedback.md").read_text(encoding="utf-8")
    user = ("Grade this OPIc mock-test result. Reply with the JSON object only.\n\n"
            + json.dumps(result, ensure_ascii=False))
    return rubric, user


def result_name(date, tag):
    return f"{date}_{tag}" if tag and TAG_RE.match(tag) else date


def extract_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in model reply")
    return json.loads(text[start : end + 1])


def _post(url, payload, headers):
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                 headers={"content-type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


def grade_with_api(result, cfg):
    system, user = grading_messages(result)
    if cfg["provider"] == "anthropic":
        body = _post("https://api.anthropic.com/v1/messages",
                     {"model": cfg["model"], "max_tokens": 8000, "system": system,
                      "messages": [{"role": "user", "content": user}]},
                     {"x-api-key": cfg["key"], "anthropic-version": "2023-06-01"})
        text = "".join(b.get("text", "") for b in body.get("content", []) if b.get("type") == "text")
    else:  # OpenAI-compatible chat completions (OpenAI, Ollama, LM Studio, vLLM, ...)
        headers = {"authorization": f"Bearer {cfg['key']}"} if cfg["key"] else {}
        body = _post(cfg["base_url"] + "/chat/completions",
                     {"model": cfg["model"], "temperature": 0.3,
                      "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
                     headers)
        text = body["choices"][0]["message"]["content"]
    fb = extract_json(text)
    fb.update({"model": cfg["model"], "graded_at": datetime.now(KST).isoformat(timespec="seconds"), "source": cfg["provider"]})
    return fb


def validate_feedback(fb):
    if not isinstance(fb, dict) or not isinstance(fb.get("overall"), dict) or not isinstance(fb.get("items"), list):
        raise ValueError("feedback JSON needs an 'overall' object and an 'items' list")
    return fb


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (datetime.now(KST).strftime("%H:%M:%S"), fmt % args))

    # ---------- access control ----------
    # Requests that arrive through a tunnel carry proxy headers. Those must present the
    # access token once (?k=...), which is then kept in an HttpOnly cookie. Plain
    # localhost requests are always allowed.
    def _remote(self):
        h = self.headers
        return bool(h.get("Cf-Connecting-Ip") or h.get("X-Forwarded-For") or h.get("X-Forwarded-Host"))

    def _cookie_token(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == "opic_k":
                return v
        return ""

    def _authorized(self):
        if not self._remote():
            return True
        q = parse_qs(urlparse(self.path).query)
        given = (q.get("k") or [""])[0]
        if given and hmac.compare_digest(given, TOKEN):
            self._set_cookie = True
            return True
        c = self._cookie_token()
        return bool(c) and hmac.compare_digest(c, TOKEN)

    def _deny(self):
        body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                "<body style='font-family:system-ui;padding:40px;color:#222'><h2>잠겨 있어요</h2>"
                "<p>이 시험 서버는 비밀 키가 있는 링크로만 열려요. 알림으로 받은 고정 링크로 다시 열어 주세요.</p>").encode("utf-8")
        self.send_response(401)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if getattr(self, "_set_cookie", False):
            self.send_header("Set-Cookie", f"opic_k={TOKEN}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax")
            self._set_cookie = False
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
        if not self._authorized():
            return self._deny()
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/env.js":
            body = b"window.OPIC_SERVER=true;"
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if u.path == "/api/health":
            cfg = load_config()
            return self._json(200, {"ok": True, "today": today(), "instant_feedback": bool(cfg["provider"]),
                                    "provider": cfg["provider"] or "manual", "model": cfg["model"]})
        if u.path == "/api/prompt":
            name = (q.get("name") or [""])[0]
            f = ROOT / "results" / f"{name}.json"
            if not (NAME_RE.match(name) and f.exists()):
                return self._json(404, {"error": "no result"})
            system, user = grading_messages(json.loads(f.read_text(encoding="utf-8")))
            return self._json(200, {"prompt": system + "\n\n---\n\n" + user})
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
        if not self._authorized():
            return self._deny()
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
            cfg = load_config()
            if not cfg["provider"]:
                (fbdir / f"{name}.pending").write_text(datetime.now(KST).isoformat(timespec="seconds"), encoding="utf-8")
                return self._json(202, {"status": "queued", "name": name})
            try:
                fb = validate_feedback(grade_with_api(json.loads(res.read_text(encoding="utf-8")), cfg))
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

        if u.path == "/api/feedback/import":
            res = ROOT / "results" / f"{name}.json"
            if not res.exists() or n <= 0 or n > MAX_JSON:
                return self._json(400, {"error": "unknown result or empty body"})
            try:
                fb = validate_feedback(extract_json(self.rfile.read(n).decode("utf-8")))
            except ValueError as e:
                return self._json(400, {"status": "error", "error": f"could not read feedback JSON: {e}"})
            fb.setdefault("source", "manual")
            fb.setdefault("graded_at", datetime.now(KST).isoformat(timespec="seconds"))
            fb["name"] = name
            fbdir = ROOT / "feedback"
            fbdir.mkdir(exist_ok=True)
            (fbdir / f"{name}.json").write_text(json.dumps(fb, ensure_ascii=False, indent=2), encoding="utf-8")
            return self._json(200, {"status": "ready", "feedback": fb})

        return self._json(404, {"error": "not found"})


if __name__ == "__main__":
    for sub in ("sets", "results", "recordings", "feedback"):
        (ROOT / sub).mkdir(exist_ok=True)
    TOKEN = access_token()
    cfg = load_config()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"OPIc mock test: http://localhost:{PORT}")
    print("  feedback: " + (f"{cfg['provider']} · {cfg['model']}" if cfg["provider"]
                            else "copy-paste mode (no provider in config.json) — see README"))
    print("  remote access: requests through a tunnel need ?k=<token from .access_token>")
    print("  stop: Ctrl+C")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
