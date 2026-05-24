import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const outputDir = path.join(rootDir, 'tools/prompt-manager-windows/dist');

function run(args, options = {}) {
  const result = spawnSync(npmCommand, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });

run(['run', 'build']);
run(
  [
    'exec',
    '--',
    'electron-builder',
    '--win',
    'nsis',
    '--x64',
    '--config',
    'tools/prompt-manager-windows/electron-builder.yml',
  ],
  {
    env: {
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  },
);
