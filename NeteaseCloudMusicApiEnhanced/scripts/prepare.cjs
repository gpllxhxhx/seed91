const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const cwd = process.cwd();
const projectRequire = createRequire(path.join(cwd, 'package.json'));

let huskyBinPath;

try {
  huskyBinPath = projectRequire.resolve('husky/lib/bin.js');
} catch {
  console.log('Skipping husky install because husky is not installed.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [huskyBinPath, 'install'], {
  cwd,
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
