# Nightly grader + study log (scheduled task, 00:15 KST)

Runs on the user's Mac through Claude's device tools, for people who do not
put an API key in `config.json`.

1. Find every `results/<name>.json` that has no `feedback/<name>.json`
   (a `feedback/<name>.pending` marker means the user asked for it).
2. Grade each one with `prompts/feedback.md` and write `feedback/<name>.json`
   with `"source": "nightly"`, `"model"` and `"graded_at"` added.
3. For each study date that changed, run `python3 scripts/study_log.py <date> --write`
   and commit `study-log/` to GitHub with the user's own author identity, so the
   day appears on their contribution graph. Only summaries are committed —
   transcripts, audio and feedback text stay on the Mac.
4. Notification (≤ 3 Korean lines): level per session, the single next focus.
