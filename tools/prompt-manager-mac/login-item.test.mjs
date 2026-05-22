import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./install-login-item.sh', import.meta.url), 'utf8');

assert.match(source, /LABEL="com\.local\.promptmanager"/);
assert.match(source, /APP_DIR="\$ROOT_DIR\/build\/PromptManager\.app"/);
assert.match(source, /EXECUTABLE="\$APP_DIR\/Contents\/MacOS\/PromptManager"/);
assert.match(source, /PLIST="\$HOME\/Library\/LaunchAgents\/\$LABEL\.plist"/);
assert.match(source, /<key>RunAtLoad<\/key>/);
assert.match(source, /launchctl bootstrap "\$GUI_DOMAIN" "\$PLIST"/);
assert.match(source, /launchctl kickstart -k "\$GUI_DOMAIN\/\$LABEL"/);
