#!/bin/bash
# Update Gas Portfolio Tracker to the latest release, in place, keeping all data.
#   curl -fsSL https://raw.githubusercontent.com/awpehz/gas-portfolio-tracker/main/scripts/update.sh | bash
set -euo pipefail

REPO="awpehz/gas-portfolio-tracker"
APP="/Applications/Gas Portfolio Tracker.app"
[ -d "$APP" ] || APP="$HOME/Applications/Gas Portfolio Tracker.app"

if [ "$(uname)" != "Darwin" ]; then
  echo "This script is for macOS. On Windows, run the .exe from the Releases page."
  exit 1
fi

echo "Checking latest release…"
JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")
TAG=$(printf '%s' "$JSON" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["tag_name"])')
URL=$(printf '%s' "$JSON" | /usr/bin/python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(a["browser_download_url"] for a in d["assets"] if a["name"].endswith(".dmg")))')
echo "Latest is $TAG"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading…"
curl -fL# -o "$TMP/gpt.dmg" "$URL"

echo "Installing…"
MP=$(hdiutil attach "$TMP/gpt.dmg" -nobrowse -noautoopen | grep -o '/Volumes/.*$' | tail -1)
osascript -e 'tell application "Gas Portfolio Tracker" to quit' >/dev/null 2>&1 || true
sleep 1
rm -rf "$APP"
cp -R "$MP/Gas Portfolio Tracker.app" "$(dirname "$APP")/"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
hdiutil detach "$MP" -quiet

echo "Done — $TAG installed. Your logged hours and settings were untouched."
open "$APP"
