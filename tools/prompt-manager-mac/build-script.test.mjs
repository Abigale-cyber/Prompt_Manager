import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./build.sh', import.meta.url), 'utf8');

assert.match(source, /ICON_FILE="PromptManager\.icns"/);
assert.match(source, /ICON_SOURCE="\$ROOT_DIR\/Assets\/\$ICON_FILE"/);
assert.match(source, /cp "\$ICON_SOURCE" "\$RESOURCES_DIR\/\$ICON_FILE"/);
assert.match(source, /MENU_BAR_ICON_FILE="PromptManagerMenuBar\.png"/);
assert.match(source, /cp "\$MENU_BAR_ICON_SOURCE" "\$RESOURCES_DIR\/\$MENU_BAR_ICON_FILE"/);
assert.match(source, /<key>CFBundleIconFile<\/key>\s*<string>PromptManager<\/string>/);
assert.match(source, /<key>CFBundleVersion<\/key>\s*<string>4<\/string>/);
assert.match(source, /<key>CFBundleDisplayName<\/key>\s*<string>Prompt Manager<\/string>/);
assert.match(source, /<key>CFBundleName<\/key>\s*<string>Prompt Manager<\/string>/);
assert.doesNotMatch(source, /<string>Prompt 管理器<\/string>/);
assert.doesNotMatch(source, /<key>LSUIElement<\/key>/);
