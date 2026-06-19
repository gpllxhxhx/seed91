# Desktop Pet Windows Release Guide

## Scope

This guide covers local Windows packaging and basic release verification for `apps/desktop-pet`.
It does not package the backend into the desktop app.

## Pre-build Checklist

1. Start the backend service and confirm the desktop app can already call it in dev mode.
2. Make sure `apps/desktop-pet/.env` exists locally and is not committed.
3. Confirm the backend address in `apps/desktop-pet/.env` is correct for the machine that will run the exe.
4. Confirm Node.js, Rust, and the Tauri Windows toolchain are installed on the build machine.

## Local `.env` Setup

Create `apps/desktop-pet/.env` locally before build.

Example for a backend running on the same PC:

```env
VITE_MUSIC_API_BASE=http://127.0.0.1:3000
```

Example for a backend running on another server:

```env
VITE_MUSIC_API_BASE=http://SERVER_PUBLIC_IP:3000
```

Or:

```env
VITE_MUSIC_API_BASE=https://your-domain.example.com
```

`VITE_MUSIC_API_BASE` is baked into the frontend at build time, so update `.env` before running the release build.

## Verification Commands

Run these commands from `apps/desktop-pet` in this order:

```bash
npm run test
npm run build
```

Then run this command from `apps/desktop-pet/src-tauri`:

```bash
cargo check
```

Finally run the release build from `apps/desktop-pet`:

```bash
npm run tauri -- build
```

## Build Output Paths

Current successful Windows exe output:

```text
apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe
```

Tauri release artifacts live under:

```text
apps/desktop-pet/src-tauri/target/release/
```

If bundle-based installers are enabled in the future, they will usually appear under:

```text
apps/desktop-pet/src-tauri/target/release/bundle/
```

## How To Run The Built Exe

1. Keep the backend service running.
2. Double-click `apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe`.
3. Or run it from PowerShell:

```powershell
Start-Process -FilePath ".\apps\desktop-pet\src-tauri\target\release\music-pet-desktop.exe"
```

## Exe Acceptance Checklist

After the exe starts, verify:

1. The desktop pet window appears.
2. The window is still transparent.
3. The window is still borderless.
4. The window is still always on top of normal apps.
5. Dragging the pet still works.
6. Right-clicking the pet still exits the app.
7. Importing a playlist still works.
8. Clicking a song still plays audio.
9. Previous and next still work.
10. Closing the app does not produce a new obvious runtime error in the terminal you are watching.

## If The Exe Cannot Reach The Backend

Check these items first:

1. `apps/desktop-pet/.env` used the correct `VITE_MUSIC_API_BASE` before build.
2. The backend process is actually running on the expected host and port.
3. The backend is reachable from the same Windows machine using a browser:

```text
http://127.0.0.1:3000/playlist/detail?id=24381616
http://127.0.0.1:3000/song/url/v1?id=1496089152&level=exhigh&unblock=true
```

4. If the backend is remote, check firewall rules, public IP, reverse proxy, and HTTPS configuration.
5. Rebuild the desktop app after changing `.env`, because the Vite env value is not hot-swapped into an existing exe.

## If The Transparent Window Looks Wrong

Check these items first:

1. `apps/desktop-pet/src-tauri/tauri.conf.json` still has:
   - `"transparent": true`
   - `"decorations": false`
   - `"alwaysOnTop": true`
2. The app is running on a Windows environment with WebView2 available.
3. GPU/graphics driver issues are not interfering with transparent composition.
4. No third-party window manager or capture overlay is forcing a solid background.

## If Antivirus Or SmartScreen Blocks The Exe

This can happen with unsigned local builds.

Try these steps:

1. Confirm the exe path is the one you just built locally.
2. In Windows SmartScreen, choose the option to show more details and allow the app if you trust the local build.
3. Add a local antivirus allow rule for the release folder if your environment policy allows it.
4. If a corporate policy deletes the exe automatically, rebuild and test on a machine or VM with a less restrictive policy.

## Notes

This phase only validates a Windows exe release path.
It does not add auto-update, login, lyrics, search, backend packaging, or installer signing.

## Web Beta Publish Note

For the website beta download flow, publish the stage-8 Tauri executable as a portable Windows beta exe:

```text
frontend/downloads/desktop-pet-player-v0.1.0-windows.exe
```

This file is a portable runnable exe, not an installer.
Do not label it as `setup.exe` unless a real installer build is introduced later.
