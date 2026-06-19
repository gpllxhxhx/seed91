# Desktop Pet Web Beta Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the stage-8 Tauri desktop pet executable through the existing website download page as `desktop-pet-player-v0.1.0-windows.exe`, with beta-only copy and metadata.

**Architecture:** Reuse the existing website desktop download page, `frontend/downloads/` static directory, and `version.json` metadata flow. Update only the publish script, download-page copy, and download metadata so the site points at the stage-8 Tauri executable without touching desktop business logic.

**Tech Stack:** Static HTML/CSS/JS frontend, Node.js release script, filesystem copy, SHA256 metadata, existing local HTTP frontend server

## Global Constraints

- Only modify website download entry files, release metadata logic, release docs, and related tests.
- Do not modify desktop playback, playlist, queue, drag, right-click exit, transparency, or backend logic.
- Do not add login, lyrics, search, skins, auto-update, installer work, or new backend endpoints.
- Do not represent the portable exe as an installer.
- Published file name must be `desktop-pet-player-v0.1.0-windows.exe`.
- Reuse the existing `frontend/downloads/` directory and `version.json` mechanism.
- Avoid committing unrelated large binaries or a real `.env`.

---

### Task 1: Lock the release-page copy with failing tests

**Files:**
- Modify: `desktop-download.test.js`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: desktop download section in `frontend/index.html`
- Produces:
  - button copy `下载 Windows 内测版 v0.1.0`
  - agreed beta description copy

- [ ] **Step 1: Write the failing test**

```js
test('desktop download section shows the v0.1.0 Windows beta copy', () => {
  const html = read('frontend/index.html');

  assert.match(html, /下载 Windows 内测版 v0\.1\.0/);
  assert.match(
    html,
    /当前版本为桌宠音乐播放器 Windows 内测版，支持导入歌单、播放歌曲、上一首、下一首、桌宠拖动和右键退出。当前为免安装测试版，内测阶段可能存在兼容性问题。/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test desktop-download.test.js`
Expected: FAIL because the old copy still says `下载桌面版` and uses older test-build wording.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/index.html` only inside the existing desktop section so the button and description match the agreed Windows beta portable exe wording.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test desktop-download.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop-download.test.js frontend/index.html
git commit -m "feat: update desktop beta download copy"
```

### Task 2: Move the publish script to the stage-8 Tauri executable

**Files:**
- Modify: `desktop-download.test.js`
- Modify: `scripts/publish-desktop.cjs`

**Interfaces:**
- Consumes:
  - source file `apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe`
- Produces:
  - published file `frontend/downloads/desktop-pet-player-v0.1.0-windows.exe`
  - matching `.sha256`
  - matching `latest`
  - matching `version.json`

- [ ] **Step 1: Write the failing test**

```js
test('publish script targets the stage-8 Tauri exe and portable beta output name', () => {
  const script = read('scripts/publish-desktop.cjs');

  assert.match(script, /apps[\\\\/]desktop-pet[\\\\/]src-tauri[\\\\/]target[\\\\/]release[\\\\/]music-pet-desktop\.exe/);
  assert.match(script, /desktop-pet-player-v0\.1\.0-windows\.exe/);
  assert.doesNotMatch(script, /MusicPet-Setup-/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test desktop-download.test.js`
Expected: FAIL because the script still reads the old `dist/MusicPet-Setup-*.exe` pattern.

- [ ] **Step 3: Write minimal implementation**

Update `scripts/publish-desktop.cjs` so it:
- reads `apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe`
- copies it to `frontend/downloads/desktop-pet-player-v0.1.0-windows.exe`
- writes `.sha256`, `latest`, and `version.json`
- writes beta-safe metadata only

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test desktop-download.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop-download.test.js scripts/publish-desktop.cjs
git commit -m "feat: publish tauri desktop beta artifact"
```

### Task 3: Keep the website metadata-driven download link aligned

**Files:**
- Modify: `desktop-download.test.js`
- Modify: `frontend/js/app.js`

**Interfaces:**
- Consumes:
  - `frontend/downloads/version.json`
- Produces:
  - link path `/downloads/desktop-pet-player-v0.1.0-windows.exe`
  - beta/portable wording in the summary/details area

- [ ] **Step 1: Write the failing test**

```js
test('desktop download page uses version metadata for the portable windows beta exe', () => {
  const appSource = read('frontend/js/app.js');

  assert.match(appSource, /downloads\\/version\\.json/);
  assert.match(appSource, /desktop-pet-player-v0\\.1\\.0-windows\\.exe/);
  assert.match(appSource, /免安装/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test desktop-download.test.js`
Expected: FAIL because the current code still falls back to older generic installer wording and file defaults.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/js/app.js` only in the desktop download rendering path so:
- the fallback file name matches `desktop-pet-player-v0.1.0-windows.exe`
- the summary/details wording reflects beta portable exe language
- the existing `version.json` flow remains intact

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test desktop-download.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop-download.test.js frontend/js/app.js
git commit -m "feat: align web download metadata with beta exe"
```

### Task 4: Regenerate release metadata and document the beta publish flow

**Files:**
- Modify: `frontend/downloads/version.json`
- Modify: `docs/release-guide.md`

**Interfaces:**
- Consumes:
  - `node scripts/publish-desktop.cjs`
- Produces:
  - fresh metadata for v0.1.0 beta
  - release docs that explicitly say this is a portable exe, not an installer

- [ ] **Step 1: Write the failing test**

```js
test('published desktop metadata points to the portable windows beta exe', () => {
  const version = JSON.parse(read('frontend/downloads/version.json'));

  assert.equal(version.version, '0.1.0');
  assert.equal(version.file, 'desktop-pet-player-v0.1.0-windows.exe');
  assert.equal(version.channel, 'beta');
  assert.equal(version.portable, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test desktop-download.test.js`
Expected: FAIL because the checked-in metadata still points to an older file and old notes.

- [ ] **Step 3: Write minimal implementation**

Run the publish script to regenerate `frontend/downloads/version.json`, then update `docs/release-guide.md` with a short note that the website release is a portable beta exe.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test desktop-download.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/downloads/version.json docs/release-guide.md
git commit -m "docs: document portable desktop beta release"
```

### Task 5: Verify the website beta release end to end

**Files:**
- Reuse: `desktop-download.test.js`
- Reuse: `frontend/index.html`
- Reuse: `frontend/js/app.js`
- Reuse: `scripts/publish-desktop.cjs`
- Reuse: `frontend/downloads/version.json`

**Interfaces:**
- Consumes: desktop beta release page, publish script, generated metadata
- Produces reproducible verification evidence for stage 9

- [ ] **Step 1: Run the desktop download tests**

Run: `node --test desktop-download.test.js`
Expected: PASS.

- [ ] **Step 2: Run the publish script**

Run: `node scripts/publish-desktop.cjs`
Expected: PASS and logs that `desktop-pet-player-v0.1.0-windows.exe` was published.

- [ ] **Step 3: Run the frontend service smoke test**

Run: `node --test app.test.js frontend-copy.test.js desktop-download.test.js`
Expected: PASS.

- [ ] **Step 4: Optionally open the local website and manually verify the desktop download page**

Run:

```bash
npm run start
```

Then verify:
- `/` opens
- desktop page shows the beta copy
- `/downloads/desktop-pet-player-v0.1.0-windows.exe` resolves

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/js/app.js scripts/publish-desktop.cjs frontend/downloads/version.json docs/release-guide.md desktop-download.test.js docs/superpowers/specs/2026-06-19-desktop-pet-web-beta-release-design.md docs/superpowers/plans/2026-06-19-desktop-pet-web-beta-release.md
git commit -m "feat: publish desktop pet beta download"
```
