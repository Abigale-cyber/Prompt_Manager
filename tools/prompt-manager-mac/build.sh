#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
APP_DIR="$ROOT_DIR/build/PromptManager.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
PLIST="$APP_DIR/Contents/Info.plist"

mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"
rm -f "$MACOS_DIR/PromptManager"

cd "$PROJECT_DIR"
npm run build

rm -rf "$RESOURCES_DIR/web"
mkdir -p "$RESOURCES_DIR/web"
cp -R "$PROJECT_DIR/dist/." "$RESOURCES_DIR/web/"
cp "$RESOURCES_DIR/web/index.html" "$RESOURCES_DIR/web/launcher.html"

swiftc "$ROOT_DIR/Sources/main.swift" \
  -framework AppKit \
  -framework Carbon \
  -framework WebKit \
  -framework ApplicationServices \
  -o "$MACOS_DIR/PromptManager"

cat > "$PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleExecutable</key>
  <string>PromptManager</string>
  <key>CFBundleIdentifier</key>
  <string>com.local.promptmanager</string>
  <key>CFBundleName</key>
  <string>Prompt 管理器</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "$APP_DIR"
