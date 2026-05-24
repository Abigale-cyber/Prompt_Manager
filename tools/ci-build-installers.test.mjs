import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowPath = new URL('../.github/workflows/build-installers.yml', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

assert.ok(fs.existsSync(workflowPath), 'build-installers workflow should exist');

const workflow = fs.readFileSync(workflowPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

assert.match(workflow, /push:\s*\n\s*branches:\s*\[\s*main\s*\]/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /runs-on:\s*macos-14/);
assert.match(workflow, /runs-on:\s*windows-latest/);
assert.match(workflow, /npm ci/);
assert.match(workflow, /npm test/);
assert.match(workflow, /npm run package:mac/);
assert.match(workflow, /npm run package:windows/);
assert.match(workflow, /tools\/prompt-manager-mac\/dist\/\*\.dmg/);
assert.match(workflow, /tools\/prompt-manager-windows\/dist\/\*\.exe/);

assert.equal(packageJson.scripts['package:mac'], 'tools/prompt-manager-mac/build-dmg.sh');
assert.equal(packageJson.scripts['package:windows'], 'node tools/prompt-manager-windows/build.mjs');
