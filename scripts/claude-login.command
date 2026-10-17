#!/bin/zsh -l
# One-time: sign in the Claude Code CLI so the exam server can grade answers right away
# with your Claude subscription (no API key). Finish the sign-in in the browser, then
# type /exit (or close this window).
B="$(command -v claude)"
[ -z "$B" ] && B="$(ls -d "$HOME/Library/Application Support/Claude/claude-code"/*/*/claude.app/Contents/MacOS/claude 2>/dev/null | sort -V | tail -1)"
if [ -z "$B" ]; then
  echo "Claude Code를 찾지 못했어요. https://docs.claude.com/en/docs/claude-code/setup 에서 설치하세요."; exit 1
fi
if echo 'Reply with just: OK' | "$B" -p --output-format text 2>/dev/null | grep -q OK; then
  echo "이미 로그인돼 있어요. 시험이 끝나면 바로 자동 첨삭돼요."; exit 0
fi
echo "Claude Code 로그인 창을 열어요. 브라우저에서 로그인을 마친 뒤 /exit 를 입력하세요."
"$B" /login
