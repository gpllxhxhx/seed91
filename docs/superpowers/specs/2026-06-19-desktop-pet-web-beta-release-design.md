# Desktop Pet Web Beta Release Design

**Goal:** Publish the already-built Windows desktop pet beta executable on the existing website, expose a clear download entry, and keep release metadata upgrade-friendly without changing any desktop playback, playlist, drag, or backend behavior.

## Problem

Stage 8 already proved the Tauri desktop pet can be built into a Windows executable and run locally. What is missing is a public website release path: the site should host the desktop beta binary, show a correct beta-only message, and let users download the exact file directly from the browser.

This stage is strictly about release distribution, not new product features.

## Scope

This stage includes only:

- reusing the existing website desktop download page
- reusing `frontend/downloads/` as the static download directory
- reusing the existing `version.json` metadata mechanism
- changing the publish script to copy the Tauri stage-8 executable
- renaming the published file to `desktop-pet-player-v0.1.0-windows.exe`
- generating matching `latest`, `version.json`, and `.sha256` files
- updating website copy to say this is a Windows beta portable executable
- adding or updating release documentation for this beta web publish flow

This stage explicitly excludes:

- desktop playback logic changes
- playlist logic changes
- previous/next logic changes
- drag, right-click exit, transparency, or always-on-top behavior changes
- backend API changes
- login, lyrics, search, skins, auto-update, or installer work
- pretending the portable exe is an installer

## Existing Release Path

The current repo already has the right building blocks:

- `frontend/index.html` already contains a desktop download section
- `frontend/js/app.js` already fetches `/downloads/version.json`
- `app.js` already serves `frontend/` as static files, so `/downloads/...` is web-accessible
- `frontend/downloads/` already exists for release artifacts
- `scripts/publish-desktop.cjs` already writes `version.json`, `latest`, and `.sha256`

The main problem is that the current publish script still reflects an older Electron/dist release path and stale release notes. It needs to publish the stage-8 Tauri executable instead.

## Proposed Approach

### Download Artifact

Use the stage-8 verified Tauri output as the source:

`apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe`

Publish it to:

`frontend/downloads/desktop-pet-player-v0.1.0-windows.exe`

The file name deliberately uses `windows.exe` instead of `setup.exe`, because the current stage-8 artifact is a portable runnable exe, not a signed or bundled installer.

### Website Copy

Keep the current desktop download page and only update the visible beta messaging.

Button text:

`下载 Windows 内测版 v0.1.0`

Description copy:

`当前版本为桌宠音乐播放器 Windows 内测版，支持导入歌单、播放歌曲、上一首、下一首、桌宠拖动和右键退出。当前为免安装测试版，内测阶段可能存在兼容性问题。`

This preserves future versioning space because the metadata-driven rendering still decides the actual file link.

### Metadata Contract

Continue using `frontend/downloads/version.json` as the source of truth for the download link and release summary.

Required metadata for this stage:

- `version`: `0.1.0`
- `platform`: `win32-x64`
- `channel`: `beta`
- `portable`: `true`
- `file`: `desktop-pet-player-v0.1.0-windows.exe`
- `releaseDate`: current release date
- `notes`: short beta-safe notes matching the actual feature set

The page can keep reading `version.json` and building the link as `/downloads/${file}`.

### Publish Script Behavior

`scripts/publish-desktop.cjs` should:

1. read the stage-8 Tauri executable from `apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe`
2. copy it into `frontend/downloads/desktop-pet-player-v0.1.0-windows.exe`
3. compute SHA256 for the copied file
4. write:
   - `frontend/downloads/latest`
   - `frontend/downloads/version.json`
   - `frontend/downloads/desktop-pet-player-v0.1.0-windows.exe.sha256`

The script should fail clearly if the Tauri release exe does not exist, because that means stage 8 was not built on the current machine yet.

### Hosting Behavior

No Nginx special-case is required for this stage.

Current site behavior already proxies all non-API routes to the frontend Node server, and the frontend Node server serves files directly from `frontend/`. Since `.exe` files are not in the custom MIME map, they fall back to `application/octet-stream`, which is acceptable for browser download behavior.

## File Plan

- `frontend/index.html`
  Update the desktop beta button text and explanatory copy.
- `frontend/js/app.js`
  Keep the `version.json` flow, but update the summary/details wording so it matches a Windows beta portable executable.
- `scripts/publish-desktop.cjs`
  Replace the old Electron/dist source lookup with the stage-8 Tauri executable and emit the new portable file name and metadata.
- `desktop-download.test.js`
  Update or extend tests so the page copy, file name, and metadata references all match the v0.1.0 beta release.
- `frontend/downloads/version.json`
  Regenerate with the new file name and beta metadata via the publish script.
- `docs/release-guide.md`
  Add a small section or note that the web-published artifact is a portable beta exe, not an installer.

## Risks And Mitigations

- published file name implies installer behavior
  Use `windows.exe`, not `setup.exe`.
- stale metadata points at an old artifact
  Regenerate `version.json`, `latest`, and `.sha256` in the publish script every time.
- website copy promises unsupported features
  Restrict copy to imported playlists, playback, previous/next, dragging, and right-click exit only.
- browser returns 404 for the download
  Publish into `frontend/downloads/` and keep the existing `/downloads/<file>` path contract.
- large binary is committed accidentally
  Follow the user requirement and avoid committing unrelated large binaries unless explicitly required later.

## Verification

Stage 9 is complete when all of the following are true:

1. The website still opens normally.
2. The desktop download page still renders.
3. The button shows `下载 Windows 内测版 v0.1.0`.
4. The beta description text matches the agreed copy.
5. `scripts/publish-desktop.cjs` copies the stage-8 Tauri executable into `frontend/downloads/desktop-pet-player-v0.1.0-windows.exe`.
6. The script generates matching `version.json`, `latest`, and `.sha256`.
7. The web page resolves the download link to `/downloads/desktop-pet-player-v0.1.0-windows.exe`.
8. The downloaded file name is exactly `desktop-pet-player-v0.1.0-windows.exe`.
9. The downloaded exe can be launched on Windows.
10. The launched exe retains stage-8 behavior: backend connectivity, playlist import, playback, previous/next, drag, and right-click exit.
