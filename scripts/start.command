#!/bin/bash
# Double-click on macOS. Starts the exam server and a Cloudflare quick tunnel (if
# they are not already running), records the public address in tunnel.json, and
# opens the exam in Chrome. Safe to run any number of times.
cd "$(dirname "$0")"; [ -f server.py ] || cd ..
ROOT="$(pwd)"; PORT=8765; LOCAL="http://localhost:$PORT"

say(){ printf '%s\n' "$*"; }
command -v python3 >/dev/null || { say "python3가 필요해요 (xcode-select --install)."; exit 1; }

# 1) exam server
if curl -s --max-time 1 "$LOCAL/api/health" >/dev/null; then
  say "서버: 이미 켜져 있어요"
else
  nohup python3 server.py >>server.log 2>&1 &
  for i in $(seq 1 20); do curl -s --max-time 1 "$LOCAL/api/health" >/dev/null && break; sleep 0.5; done
  curl -s --max-time 1 "$LOCAL/api/health" >/dev/null && say "서버: 켰어요 ($LOCAL)" || { say "서버를 켜지 못했어요. server.log를 확인하세요."; exit 1; }
fi

# 2) tunnel (skip with NO_TUNNEL=1)
if [ "${NO_TUNNEL:-0}" != "1" ]; then
  alive=""
  if [ -f tunnel.json ]; then
    url=$(python3 -c "import json;print(json.load(open('tunnel.json'))['url'])" 2>/dev/null)
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "$url/api/health")
    [ "$code" = "200" ] || [ "$code" = "401" ] && alive="$url"
  fi
  if [ -n "$alive" ]; then
    say "터널: 이미 열려 있어요 ($alive)"
  else
    CF="$ROOT/bin/cloudflared"
    if [ ! -x "$CF" ]; then
      arch=$(uname -m); [ "$arch" = "x86_64" ] && arch=amd64
      say "터널 도구(cloudflared) 내려받는 중… ($arch)"
      mkdir -p "$ROOT/bin" && curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$arch.tgz" | tar xz -C "$ROOT/bin" && chmod +x "$CF"
    fi
    if [ -x "$CF" ]; then
      pkill -f "cloudflared tunnel --no-autoupdate --url $LOCAL" 2>/dev/null
      : > tunnel.log
      nohup "$CF" tunnel --no-autoupdate --url "$LOCAL" >>tunnel.log 2>&1 &
      url=""
      for i in $(seq 1 60); do url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' tunnel.log | head -1); [ -n "$url" ] && break; sleep 0.5; done
      if [ -n "$url" ]; then
        printf '{"url": "%s", "started": "%s"}\n' "$url" "$(date -u +%FT%TZ)" > tunnel.json
        say "터널: 열었어요 ($url)"
      else
        say "터널을 열지 못했어요. tunnel.log를 확인하세요. (localhost로는 계속 쓸 수 있어요)"
      fi
    else
      say "cloudflared를 내려받지 못했어요. 네트워크를 확인하세요."
    fi
  fi
fi

[ "${NO_OPEN:-0}" = "1" ] || (open -a "Google Chrome" "$LOCAL" 2>/dev/null || open "$LOCAL")
