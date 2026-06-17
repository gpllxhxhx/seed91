# Production Install Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production installs succeed without `husky`, and document the stable server update flow.

**Architecture:** Add a small guarded prepare script under the API package, point the package `prepare` hook at it, and cover the guard with a focused regression test. Update deployment docs so server commands match the guarded install behavior and include service checks after reload.

**Tech Stack:** Node.js, npm lifecycle scripts, Mocha/Node assert, Markdown docs

## Global Constraints

- Keep runtime web and API behavior unchanged.
- Production installs must not require development dependencies.
- Local development should still run `husky install` when `husky` is available.
- Documentation must match the actual deploy commands in the repository.

---

### Task 1: Guard the API prepare hook

**Files:**
- Create: `E:/music-backend/app/NeteaseCloudMusicApiEnhanced/scripts/prepare.cjs`
- Modify: `E:/music-backend/app/NeteaseCloudMusicApiEnhanced/package.json`
- Test: `E:/music-backend/app/NeteaseCloudMusicApiEnhanced/test/prepare.test.cjs`

**Interfaces:**
- Consumes: npm `prepare` lifecycle execution in `NeteaseCloudMusicApiEnhanced/package.json`
- Produces: `scripts/prepare.cjs` that exits `0` when `husky` is absent and runs `husky install` when present

- [ ] **Step 1: Write the failing test**

```js
it('skips husky install when husky is unavailable', () => {
  const result = runPrepareWithoutHusky()
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Skipping husky install/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test NeteaseCloudMusicApiEnhanced/test/prepare.test.cjs`
Expected: FAIL because `scripts/prepare.cjs` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```js
const { spawnSync } = require('child_process')

try {
  require.resolve('husky')
} catch {
  console.log('Skipping husky install because husky is not installed.')
  process.exit(0)
}

const result = spawnSync(process.execPath, [require.resolve('husky/lib/bin.js'), 'install'], {
  stdio: 'inherit',
})
process.exit(result.status ?? 0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test NeteaseCloudMusicApiEnhanced/test/prepare.test.cjs`
Expected: PASS

### Task 2: Align deploy docs with the stable install flow

**Files:**
- Modify: `E:/music-backend/app/DEPLOYMENT.md`
- Modify: `E:/music-backend/app/deploy/README.md`

**Interfaces:**
- Consumes: stable install behavior from Task 1 and PM2 process names in `ecosystem.config.cjs`
- Produces: deployment docs that instruct operators to install production deps safely and verify `music-api` after reload

- [ ] **Step 1: Update deployment commands**

```md
cd /www/wwwroot/music-backend/app/NeteaseCloudMusicApiEnhanced
npm install --omit=dev
```

- [ ] **Step 2: Add post-reload verification commands**

```md
pm2 status
pm2 logs music-api --lines 50
```

- [ ] **Step 3: Verify docs reflect the repository behavior**

Run: `rg -n "omit=dev|music-api --lines 50|prepare" E:/music-backend/app/DEPLOYMENT.md E:/music-backend/app/deploy/README.md E:/music-backend/app/NeteaseCloudMusicApiEnhanced/package.json`
Expected: output matches the new install and verification flow
