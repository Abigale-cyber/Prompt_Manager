#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
APP_DIR="$ROOT_DIR/build/PromptManager.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
PLIST="$APP_DIR/Contents/Info.plist"
ICON_FILE="PromptManager.icns"
ICON_SOURCE="$ROOT_DIR/Assets/$ICON_FILE"
MENU_BAR_ICON_FILE="PromptManagerMenuBar.png"
MENU_BAR_ICON_SOURCE="$ROOT_DIR/Assets/$MENU_BAR_ICON_FILE"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

cd "$PROJECT_DIR"
npm run build

rm -rf "$RESOURCES_DIR/web"
mkdir -p "$RESOURCES_DIR/web"
cp -R "$PROJECT_DIR/dist/." "$RESOURCES_DIR/web/"
cp "$RESOURCES_DIR/web/index.html" "$RESOURCES_DIR/web/launcher.html"
cp "$ICON_SOURCE" "$RESOURCES_DIR/$ICON_FILE"
cp "$MENU_BAR_ICON_SOURCE" "$RESOURCES_DIR/$MENU_BAR_ICON_FILE"

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
  <key>CFBundleIconFile</key>
  <string>PromptManager</string>
  <key>CFBundleDisplayName</key>
  <string>Prompt Manager</string>
  <key>CFBundleName</key>
  <string>Prompt Manager</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.2</string>
  <key>CFBundleVersion</key>
  <string>5</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "$APP_DIR"
