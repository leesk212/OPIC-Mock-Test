#!/bin/bash
# Double-click on macOS: starts the server (if not running) and opens the exam in Chrome.
cd "$(dirname "$0")/.."
URL="http://localhost:8765"
openit(){ open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"; }
if curl -s --max-time 1 "$URL/api/health" >/dev/null; then echo "Already running."; openit; exit 0; fi
command -v python3 >/dev/null || { echo "python3 is required (xcode-select --install)."; exit 1; }
(sleep 1.5; openit) &
python3 server.py
