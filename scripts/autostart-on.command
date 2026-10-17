#!/bin/bash
# Registers a LaunchAgent so the server starts at login. Undo with autostart-off.command.
cd "$(dirname "$0")/.."; DIR="$(pwd)"; PY="$(command -v python3)"
[ -z "$PY" ] && { echo "python3 not found"; exit 1; }
PL="$HOME/Library/LaunchAgents/com.opic-mock-test.server.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.opic-mock-test.server</string>
<key>ProgramArguments</key><array><string>$PY</string><string>$DIR/server.py</string></array>
<key>WorkingDirectory</key><string>$DIR</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardErrorPath</key><string>$DIR/server.log</string>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null; launchctl load "$PL"; sleep 2
curl -s --max-time 2 http://localhost:8765/api/health >/dev/null && echo "Autostart on: http://localhost:8765" || echo "Registered, but the server did not answer — check server.log (macOS may block LaunchAgents from reading Desktop folders)."
