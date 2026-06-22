const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

test('formal desktop scripts point to the Tauri desktop pet', () => {
  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.scripts.desktop, 'npm --prefix apps/desktop-pet run tauri -- dev');
  assert.equal(pkg.scripts['desktop:dev'], 'npm --prefix apps/desktop-pet run tauri -- dev');
  assert.equal(pkg.scripts['desktop:build'], 'npm --prefix apps/desktop-pet run tauri -- build');
  assert.equal(pkg.scripts['desktop:legacy'], undefined);
  assert.equal(pkg.scripts['desktop:electron:legacy'], undefined);
  assert.equal(pkg.scripts['desktop:electron:legacy:build'], undefined);
});

test('old Electron launcher files are retired from the formal toolchain', () => {
  assert.equal(fs.existsSync(path.join(__dirname, 'scripts', 'desktop-dev.cmd')), false);
  assert.equal(fs.existsSync(path.join(__dirname, 'scripts', 'desktop-dev.cjs')), false);
  assert.equal(fs.existsSync(path.join(__dirname, 'electron-builder.legacy.json')), false);

  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.devDependencies?.electron, undefined);
  assert.equal(pkg.devDependencies?.['electron-builder'], undefined);
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

test('API launchers resolve child runtimes without assuming node is in PATH', () => {
  const apiStart = read('scripts/start-api-enhanced.cjs');
  const apiService = read('desktop/main/services/api-process-service.cjs');

  assert.match(apiStart, /resolveNodeExecPath/);
  assert.match(apiService, /resolveNodeExecPath/);
});
