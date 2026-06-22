const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createCleanupPlan,
  isProtectedPath,
  parseGitCleanPreview,
} = require('./scripts/clean-worktree.cjs');

function makeTempProject() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-worktree-'));

  fs.mkdirSync(path.join(rootDir, 'apps', 'desktop-pet', 'src', 'assets', 'skins'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps', 'desktop-pet', 'dist'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps', 'desktop-pet', 'src-tauri', 'target'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'desktop'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'NeteaseCloudMusicApiEnhanced', 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'logs'), { recursive: true });

  fs.writeFileSync(path.join(rootDir, 'apps', 'desktop-pet', 'src', 'main.ts'), 'console.log("source");');
  fs.writeFileSync(path.join(rootDir, 'apps', 'desktop-pet', 'src', 'assets', 'skins', 'sprite-sheet.svg'), '<svg />');
  fs.writeFileSync(path.join(rootDir, 'apps', 'desktop-pet', 'dist', 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(rootDir, 'apps', 'desktop-pet', 'src-tauri', 'target', 'cache.bin'), 'cache');
  fs.writeFileSync(path.join(rootDir, 'desktop', 'main.cjs'), 'console.log("legacy");');
  fs.writeFileSync(path.join(rootDir, 'NeteaseCloudMusicApiEnhanced', 'node_modules', 'package.bin'), 'dependency');
  fs.writeFileSync(path.join(rootDir, 'logs', 'app.log'), 'log');
  fs.writeFileSync(path.join(rootDir, 'debug.log'), 'log');
  fs.writeFileSync(path.join(rootDir, 'scratch.tmp'), 'tmp');
  fs.writeFileSync(path.join(rootDir, 'node_modules', 'package.bin'), 'dependency');

  return rootDir;
}

test('protects formal desktop pet source, migrated skins, legacy desktop, frontend, backend and git metadata', () => {
  assert.equal(isProtectedPath('apps/desktop-pet/src/main.ts'), true);
  assert.equal(isProtectedPath('apps/desktop-pet/src/assets/skins/default/sprite-sheet.svg'), true);
  assert.equal(isProtectedPath('apps/desktop-pet/src-tauri/src/main.rs'), true);
  assert.equal(isProtectedPath('frontend/js/app.js'), true);
  assert.equal(isProtectedPath('NeteaseCloudMusicApiEnhanced/app.js'), true);
  assert.equal(isProtectedPath('desktop/main.cjs'), true);
  assert.equal(isProtectedPath('.git/config'), true);
});

test('plans safe cleanup for whitelisted artifacts while keeping protected source manual-only', () => {
  const rootDir = makeTempProject();
  const plan = createCleanupPlan({
    rootDir,
    trackedPaths: new Set(['debug.log']),
    includeNodeModules: false,
  });
  const safePaths = plan.cleanableItems.map((item) => item.relativePath).sort();
  const manualPaths = plan.manualReviewItems.map((item) => item.relativePath).sort();

  assert.deepEqual(safePaths, [
    'apps/desktop-pet/dist',
    'apps/desktop-pet/src-tauri/target',
    'logs',
    'scratch.tmp',
  ]);
  assert.equal(safePaths.includes('debug.log'), false);
  assert.equal(safePaths.includes('desktop'), false);
  assert.equal(safePaths.includes('apps/desktop-pet/src'), false);
  assert.equal(safePaths.includes('node_modules'), false);
  assert.equal(manualPaths.includes('NeteaseCloudMusicApiEnhanced/node_modules'), true);
  assert.equal(manualPaths.includes('debug.log'), true);
  assert.equal(manualPaths.includes('node_modules'), true);
});

test('only includes node_modules when explicitly requested', () => {
  const rootDir = makeTempProject();
  const plan = createCleanupPlan({
    rootDir,
    trackedPaths: new Set(),
    includeNodeModules: true,
  });
  const safePaths = plan.cleanableItems.map((item) => item.relativePath);

  assert.equal(safePaths.includes('node_modules'), true);
  assert.equal(safePaths.includes('NeteaseCloudMusicApiEnhanced/node_modules'), true);
  assert.equal(safePaths.includes('NeteaseCloudMusicApiEnhanced'), false);
});

test('parses git clean preview output without treating it as a delete command', () => {
  const paths = parseGitCleanPreview(`Would remove apps/desktop-pet/src/logger.ts
Would remove frontend/downloads/version.json
Would remove apps/desktop-pet/dist/
`);

  assert.deepEqual(paths, [
    'apps/desktop-pet/src/logger.ts',
    'frontend/downloads/version.json',
    'apps/desktop-pet/dist',
  ]);
});
