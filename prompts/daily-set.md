# Daily set generator (scheduled task, 23:22 KST)

Runs on the user's Mac through Claude's device tools. Writes tonight's 15
questions to `sets/<YYYY-MM-DD>.json` and sends a push notification.

1. Today's date in Asia/Seoul.
2. Read `sets/` (last 7 days) and `results/` (last 14 days). Weak question
   types = items with `sec` < 50 for d/h or < 70 for p/c/rp2/rp3/a1/a2, few
   words, or `replay`/`text_shown` true. Also read `feedback/` and lean toward
   the types graded below AL.
3. Build exactly 15 questions in the real OPIc interviewer style:
   - Q1 `intro` — "Let's start the interview now. Tell me a little bit about yourself."
   - Q2–4 survey topic combo, Q5–7 unexpected (돌발) topic combo, Q8–10 second survey combo.
     Each combo uses `d` description, `h` habit, `p` past experience, `c` comparison.
   - Q11 `rp1` ask 3–4 questions, Q12 `rp2` "I'm sorry, but there is a problem…" explain + 2–3 alternatives,
     Q13 `rp3` related past experience — one roleplay situation.
   - Q14 `a1` change over time, Q15 `a2` issue / concern / opinion — one advanced topic.
   - Topic pools and weights live in the task prompt (they reflect the user's survey choices).
   - Do not repeat a combo, roleplay or advanced topic from the previous 3 days.
   - Never put facts about the user into a question.
4. Write `{"date","theme","note","source":"coach","questions":[{"type","topic","text"} × 15]}` and validate it has 15 items.
5. Notification (≤ 4 Korean lines): theme, focus note, yesterday's summary, link to http://localhost:8765.
