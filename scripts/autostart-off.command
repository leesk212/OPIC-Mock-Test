#!/bin/bash
PL="$HOME/Library/LaunchAgents/com.opic-mock-test.server.plist"
launchctl unload "$PL" 2>/dev/null; rm -f "$PL"; echo "Autostart off."
