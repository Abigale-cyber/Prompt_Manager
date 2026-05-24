import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

assert.match(readme, /## 下载安装/);
assert.match(readme, /PromptManager-macOS\.dmg/);
assert.match(readme, /PromptManager-Windows-x64\.exe/);
assert.match(readme, /releases\/latest\/download\/PromptManager-macOS\.dmg/);
assert.match(readme, /releases\/latest\/download\/PromptManager-Windows-x64\.exe/);
assert.match(readme, /Actions/);
assert.match(readme, /Artifacts/);
assert.match(readme, /## 使用方法/);
assert.match(readme, /Mac 安装/);
assert.match(readme, /Windows 安装/);
assert.match(readme, /右键点击 .*打开/);
assert.doesNotMatch(readme, /本地 Prompt 管理小工具雏形/);
assert.doesNotMatch(readme, /Figma 导出的 React UI/);
assert.doesNotMatch(readme, /运行 Mac 小工具/);
assert.doesNotMatch(readme, /前端原型预览/);
