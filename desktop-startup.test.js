const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

test('desktop scripts use the Windows bootstrap wrapper instead of bare node commands', () => {
  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.scripts.desktop, 'scripts\\desktop-dev.cmd');
  assert.equal(pkg.scripts['desktop:dev'], 'scripts\\desktop-dev.cmd');
});

test('desktop bootstrap wrapper clears Electron node mode and delegates to the shared node wrapper', () => {
  const source = read('scripts/desktop-dev.cmd');
  const sharedWrapper = read('scripts/run-node-script.cmd');

  assert.match(source, /set\s+ELECTRON_RUN_AS_NODE=/i);
  assert.match(source, /run-node-script\.cmd/i);
  assert.match(source, /desktop-dev\.cjs/i);
  assert.match(sharedWrapper, /npm_node_execpath/i);
  assert.match(sharedWrapper, /set\s+"NODE_EXE=/i);
});

test('resolveNodeExecPath prefers npm_node_execpath before process execPath and node fallback', () => {
  const { resolveNodeExecPath } = require(path.join(__dirname, 'scripts', 'runtime-paths.cjs'));

  assert.equal(
    resolveNodeExecPath({ npm_node_execpath: '"C:\\Program Files\\nodejs\\node.exe"' }, 'C:\\Program Files\\electron\\electron.exe'),
    'C:\\Program Files\\nodejs\\node.exe',
  );
  assert.equal(resolveNodeExecPath({}, 'C:\\node.exe'), 'C:\\node.exe');
  assert.equal(resolveNodeExecPath({}, ''), 'node');
});

test('desktop and API launchers resolve child runtimes without assuming node is in PATH', () => {
  const desktopDev = read('scripts/desktop-dev.cjs');
  const apiStart = read('scripts/start-api-enhanced.cjs');
  const apiService = read('desktop/main/services/api-process-service.cjs');

  assert.match(desktopDev, /resolveNodeExecPath/);
  assert.match(apiStart, /resolveNodeExecPath/);
  assert.match(apiService, /resolveNodeExecPath/);
});
