import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./build-dmg.sh', import.meta.url), 'utf8');

assert.match(source, /"\$ROOT_DIR\/build\.sh"/);
assert.match(source, /cp -R "\$APP_DIR" "\$STAGING_DIR\/PromptManager\.app"/);
assert.match(source, /ln -s \/Applications "\$STAGING_DIR\/Applications"/);
assert.match(source, /cat > "\$STAGING_DIR\/使用说明\.txt"/);
assert.match(source, /hdiutil create/);
assert.match(source, /-format UDZO/);
assert.match(source, /echo "\$DMG_PATH"/);
