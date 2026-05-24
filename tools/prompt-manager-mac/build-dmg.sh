#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
APP_DIR="$ROOT_DIR/build/PromptManager.app"
DIST_DIR="$ROOT_DIR/dist"
STAGING_DIR="$ROOT_DIR/build/dmg-staging"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$PROJECT_DIR/package.json', 'utf8')).version")"
DMG_NAME="PromptManager-${VERSION}.dmg"
DMG_PATH="$DIST_DIR/$DMG_NAME"
VOLUME_NAME="PromptManager"

"$ROOT_DIR/build.sh"

rm -rf "$STAGING_DIR" "$DIST_DIR"
mkdir -p "$STAGING_DIR" "$DIST_DIR"

cp -R "$APP_DIR" "$STAGING_DIR/PromptManager.app"
ln -s /Applications "$STAGING_DIR/Applications"
cat > "$STAGING_DIR/使用说明.txt" <<'TXT'
PromptManager 测试版安装说明

1. 把 PromptManager.app 拖到 Applications。
2. 从启动台或 Applications 打开 PromptManager。
3. 第一次打开如果提示无法验证开发者，请右键点击 App，选择“打开”，再确认一次。
4. 启动后会出现在菜单栏，使用快捷键 Option + Space 唤起。
5. 如果需要自动粘贴到其他 App，请在“系统设置 > 隐私与安全性 > 辅助功能”里允许 PromptManager。
TXT

hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH" >/dev/null

rm -rf "$STAGING_DIR"

echo "$DMG_PATH"
