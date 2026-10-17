#!/usr/bin/env python3
"""Build a daily study-log entry from results/ and feedback/ (no transcripts, no audio).

    python3 scripts/study_log.py 2026-10-17            # prints markdown
    python3 scripts/study_log.py 2026-10-17 --write    # writes study-log/2026/2026-10-17.md and updates study-log/README.md

The nightly scheduled task runs this, then commits study-log/ so every study day
shows up on the GitHub contribution graph.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PART = {"full": "15 questions (full test)", "ADV": "Q14–15 advanced focus"}
TYPE = {"intro": "intro", "d": "description", "h": "habit", "p": "past experience", "c": "comparison",
        "rp1": "roleplay · ask", "rp2": "roleplay · solve", "rp3": "roleplay · related experience",
        "a1": "advanced · change", "a2": "advanced · issue"}


def fmt(s):
    return "—" if s is None else f"{s // 60}:{s % 60:02d}"


def load(p):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def entry(date):
    runs = sorted((ROOT / "results").glob(f"{date}*.json"))
    if not runs:
        return None
    lines = [f"# {date}", ""]
    total = 0
    for f in runs:
        r = load(f) or {}
        fb = load(ROOT / "feedback" / f"{f.stem}.json") or {}
        o = fb.get("overall", {})
        total += r.get("totalSec") or 0
        part = PART.get(r.get("part"), r.get("part") or "?")
        lines += [f"## {part} — {r.get('count', '?')} questions · {fmt(r.get('totalSec'))}", ""]
        if r.get("theme"):
            lines += [f"Set: {r['theme']}", ""]
        if o:
            lines += [f"**Estimated level: {o.get('grade', '—')}** · fluency {o.get('fluency', '—')}/10", ""]
            if o.get("next_focus"):
                lines += [f"Next focus: {o['next_focus']}", ""]
        else:
            lines += ["Feedback: not graded yet", ""]
        lines += ["| Q | type | topic | time | level |", "|---|---|---|---|---|"]
        grades = {i.get("n"): i.get("grade") for i in fb.get("items", [])}
        for it in r.get("items", []):
            lines.append(f"| {it.get('n')} | {TYPE.get(it.get('type'), it.get('type'))} | {it.get('topic', '')} | {fmt(it.get('sec'))} | {grades.get(it.get('n'), '—')} |")
        lines.append("")
        if fb.get("memorize"):
            lines += ["Sentences to memorize:", ""] + [f"- {s}" for s in fb["memorize"]] + [""]
    lines.insert(2, f"Speaking time today: **{fmt(total)}** across {len(runs)} session(s).\n")
    return "\n".join(lines)


def update_index():
    logs = sorted((ROOT / "study-log").glob("*/*.md"), reverse=True)
    rows = ["# Study log", "", "One file per study day, written by the nightly task. Only summaries — no transcripts or audio.", "",
            "| date | sessions | level |", "|---|---|---|"]
    for p in logs:
        txt = p.read_text(encoding="utf-8")
        sessions = txt.count("\n## ")
        level = next((l.split("Estimated level: ")[1].split("**")[0] for l in txt.splitlines() if "Estimated level:" in l), "—")
        rows.append(f"| [{p.stem}]({p.parent.name}/{p.name}) | {sessions} | {level} |")
    (ROOT / "study-log" / "README.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    d = sys.argv[1]
    md = entry(d)
    if md is None:
        sys.exit(f"no results for {d}")
    if "--write" in sys.argv:
        out = ROOT / "study-log" / d[:4] / f"{d}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(md + "\n", encoding="utf-8")
        update_index()
        print(out.relative_to(ROOT))
    else:
        print(md)
