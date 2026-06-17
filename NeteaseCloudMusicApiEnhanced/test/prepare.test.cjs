const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'prepare.cjs');

function makeTempProject() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-script-'));
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify({ name: 'temp-project', private: true }, null, 2),
  );
  return tempDir;
}

test('skips husky install when husky is unavailable', () => {
  const tempDir = makeTempProject();

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: tempDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Skipping husky install because husky is not installed\./);
  assert.equal(result.stderr, '');
});

test('runs husky install when husky is available', () => {
  const tempDir = makeTempProject();
  const huskyDir = path.join(tempDir, 'node_modules', 'husky', 'lib');
  fs.mkdirSync(huskyDir, { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, 'node_modules', 'husky', 'package.json'),
    JSON.stringify({ name: 'husky', version: '0.0.0-test' }, null, 2),
  );
  fs.writeFileSync(
    path.join(huskyDir, 'bin.js'),
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const markerPath = path.join(process.cwd(), 'husky-ran.txt');",
      "fs.writeFileSync(markerPath, process.argv.slice(2).join(' '));",
      "console.log('fake husky called with ' + process.argv.slice(2).join(' '));",
    ].join('\n'),
  );

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: tempDir,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /fake husky called with install/);
  assert.equal(
    fs.readFileSync(path.join(tempDir, 'husky-ran.txt'), 'utf8'),
    'install',
  );
});
