import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildScript = new URL('./build.mjs', import.meta.url);
const mainScript = new URL('./electron-main.cjs', import.meta.url);
const builderConfig = new URL('./electron-builder.yml', import.meta.url);
const packagePath = new URL('../../package.json', import.meta.url);

assert.ok(fs.existsSync(buildScript), 'Windows build script should exist');
assert.ok(fs.existsSync(mainScript), 'Electron main script should exist');
assert.ok(fs.existsSync(builderConfig), 'electron-builder config should exist');

const buildSource = fs.readFileSync(buildScript, 'utf8');
const mainSource = fs.readFileSync(mainScript, 'utf8');
const builderSource = fs.readFileSync(builderConfig, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

assert.match(buildSource, /run\(\['run', 'build'\]\)/);
assert.match(buildSource, /shell:\s*process\.platform === 'win32'/);
assert.match(buildSource, /result\.error/);
assert.match(buildSource, /CSC_IDENTITY_AUTO_DISCOVERY/);
assert.match(buildSource, /'--publish',\n\s+'never'/);
assert.match(buildSource, /tools\/prompt-manager-windows\/electron-builder\.yml/);
assert.equal(packageJson.devDependencies.electron, '33.4.11');
assert.equal(packageJson.devDependencies['electron-builder'], '25.1.8');

assert.match(mainSource, /loadFile/);
assert.match(mainSource, /dist.+index\.html/s);
assert.match(mainSource, /contextIsolation:\s*true/);
assert.match(mainSource, /nodeIntegration:\s*false/);
assert.match(mainSource, /setWindowOpenHandler/);

assert.match(builderSource, /productName:\s*Prompt Manager/);
assert.match(builderSource, /electronVersion:\s*33\.4\.11/);
assert.match(builderSource, /target:\s*nsis/);
assert.match(builderSource, /artifactName:\s*PromptManager-\$\{version\}-\$\{arch\}\.\$\{ext\}/);
assert.match(builderSource, /output:\s*tools\/prompt-manager-windows\/dist/);
assert.match(builderSource, /files:\n\s+- package\.json/);
