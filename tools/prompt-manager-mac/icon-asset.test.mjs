import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./Assets/PromptManager.svg', import.meta.url), 'utf8');

assert.match(source, /viewBox="0 0 200 200"/);
assert.match(source, /<rect x="18" y="18" width="164" height="164" rx="38"/);
assert.doesNotMatch(source, /<rect x="0" y="0" width="200" height="200" rx="46"/);
