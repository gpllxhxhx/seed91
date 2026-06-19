# Desktop Pet Playlist Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact playlist import panel below the desktop pet so users can import a Netease playlist by ID or link, render the song list, and play any clicked song through the existing backend song URL flow.

**Architecture:** Keep the current non-React, string-template desktop renderer and extend it with one below-pet playlist panel. Add a dedicated playlist resolver for parsing and backend normalization, convert the song URL resolver into a reusable song-ID based helper, and extend the playback controller so it can switch the current song while preserving stage 2, 3, 4, and 5 behaviors.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest, HTMLAudioElement, Fetch API, DOM event wiring

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning docs under `docs/superpowers/`.
- Do not modify website frontend code.
- Do not modify backend code.
- Do not add login, search, lyrics, auto-next, account sync, or new backend endpoints.
- Do not migrate the desktop app to React or TSX.
- Do not refactor the whole project.
- The playlist panel must sit below the pet, not to the right.
- The Tauri window may grow moderately, but must not become a large transparent window.
- Only the pet surface may trigger drag, right-click exit, or pet-click play/pause.
- The playlist panel must accept click, input, and scroll interactions without triggering drag.
- Playlist import must request `GET {VITE_MUSIC_API_BASE}/playlist/detail?id=歌单ID`.
- Song playback from the list must request `GET {VITE_MUSIC_API_BASE}/song/url/v1?id=歌曲ID&level=exhigh&unblock=true`.
- Song URL extraction priority must remain `data[0].proxyUrl`, then `data[0].url`, then top-level `url`.

---

### Task 1: Add playlist resolver tests and implementation

**Files:**
- Create: `apps/desktop-pet/src/playlist-resolver.ts`
- Create: `apps/desktop-pet/src/playlist-resolver.test.ts`

**Interfaces:**
- Consumes: `fetch`, `VITE_MUSIC_API_BASE`, raw playlist input strings
- Produces:
  - `parsePlaylistId(rawInput: string): string`
  - `createPlaylistResolver(options): (rawInput: string) => Promise<ResolvedPlaylist>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createPlaylistResolver, parsePlaylistId } from "./playlist-resolver";

describe("parsePlaylistId", () => {
  it("extracts an id from a Netease playlist link", () => {
    expect(
      parsePlaylistId("https://music.163.com/#/playlist?id=123456789")
    ).toBe("123456789");
  });
});

describe("createPlaylistResolver", () => {
  it("normalizes playlist tracks into desktop playlist songs", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          playlist: {
            name: "测试歌单",
            tracks: [
              {
                id: 101,
                name: "第一首",
                ar: [{ name: "歌手甲" }, { name: "歌手乙" }],
                al: { name: "专辑甲" }
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const resolvePlaylist = createPlaylistResolver({
      apiBase: "http://127.0.0.1:3000",
      fetchImpl
    });

    await expect(resolvePlaylist("123456789")).resolves.toEqual({
      id: "123456789",
      name: "测试歌单",
      songs: [
        { id: 101, name: "第一首", artists: "歌手甲 / 歌手乙", album: "专辑甲" }
      ]
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/playlist-resolver.test.ts`  
Expected: FAIL because `playlist-resolver.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `parsePlaylistId(rawInput)` for numeric IDs and supported Netease links
- `createPlaylistResolver({ apiBase, fetchImpl })`
- response parsing for `playlist.name` and `playlist.tracks`
- normalized `PlaylistSong` rows with `artists` joined by ` / `
- explicit errors for parse failure, HTTP failure, and empty playlists

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/playlist-resolver.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/playlist-resolver.ts apps/desktop-pet/src/playlist-resolver.test.ts
git commit -m "feat: add desktop playlist resolver"
```

### Task 2: Make the song URL resolver and playback controller song-aware

**Files:**
- Modify: `apps/desktop-pet/src/song-url-resolver.ts`
- Modify: `apps/desktop-pet/src/song-url-resolver.test.ts`
- Modify: `apps/desktop-pet/src/playback-controller.ts`
- Modify: `apps/desktop-pet/src/playback-controller.test.ts`

**Interfaces:**
- Consumes:
  - `resolveSongUrl(songId: string | number): Promise<string>`
  - `PlaylistSong`
- Produces:
  - `createSongUrlResolver(options): (songId: string | number) => Promise<string>`
  - `createPlaybackController(audio, refs, options)` with:
    - `togglePlayback(): Promise<void>`
    - `playSong(song: PlaybackSong): Promise<void>`
    - `getCurrentSong(): PlaybackSong | null`

- [ ] **Step 1: Write the failing test**

```ts
it("switches to the clicked playlist song and starts playback", async () => {
  const audio = new FakeAudio();
  const refs = createPlaybackRefs();
  const controller = createPlaybackController(audio, refs, {
    resolveSongUrl: async (songId) => `https://example.com/${songId}.mp3`
  });

  await controller.playSong({ id: 202, name: "列表歌曲" });

  expect(audio.src).toBe("https://example.com/202.mp3");
  expect(controller.getCurrentSong()?.name).toBe("列表歌曲");
  expect(refs.status.textContent).toBe("播放中");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/song-url-resolver.test.ts src/playback-controller.test.ts`  
Expected: FAIL because the resolver is fixed-song and the controller cannot switch songs yet.

- [ ] **Step 3: Write minimal implementation**

Update:
- `song-url-resolver.ts` so the resolver accepts arbitrary song IDs
- `playback-controller.ts` so it stores the current song, caches URLs by current song ID, and exposes `playSong(song)`
- keep pet-click `togglePlayback()` working for the current song
- keep request failure, invalid URL, and playback failure handling intact

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/song-url-resolver.test.ts src/playback-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/song-url-resolver.ts apps/desktop-pet/src/song-url-resolver.test.ts apps/desktop-pet/src/playback-controller.ts apps/desktop-pet/src/playback-controller.test.ts
git commit -m "feat: support playlist song playback in desktop pet"
```

### Task 3: Add the below-pet playlist panel markup, styles, and wiring

**Files:**
- Modify: `apps/desktop-pet/src/App.ts`
- Modify: `apps/desktop-pet/src/App.test.ts`
- Modify: `apps/desktop-pet/src/main.ts`
- Modify: `apps/desktop-pet/src/style.css`
- Modify: `apps/desktop-pet/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes:
  - `createPlaylistResolver(...)`
  - `playbackController.playSong(song)`
  - existing `bindPetWindowInteractions(...)`
- Produces: imported playlist UI with working input, button, list clicks, and current-song label

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the playlist import controls and song list hooks", () => {
    const markup = renderApp();

    expect(markup).toContain("data-playlist-input");
    expect(markup).toContain("data-playlist-submit");
    expect(markup).toContain("data-playlist-list");
    expect(markup).toContain("data-current-song");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/App.test.ts`  
Expected: FAIL because the new playlist hooks are missing.

- [ ] **Step 3: Write minimal implementation**

Update:
- `App.ts` with a compact panel below the pet
- `main.ts` to:
  - read input value
  - import a playlist on button click or Enter submit
  - render playlist title and songs
  - call `playbackController.playSong(song)` on row click
  - update the current-song label
- `style.css` so only the pet surface and panel receive pointer events
- `tauri.conf.json` to grow the window moderately downward

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/App.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/App.ts apps/desktop-pet/src/App.test.ts apps/desktop-pet/src/main.ts apps/desktop-pet/src/style.css apps/desktop-pet/src-tauri/tauri.conf.json
git commit -m "feat: add desktop playlist import panel"
```

### Task 4: Verify stage 6 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/playlist-resolver.test.ts`
- Reuse: `apps/desktop-pet/src/song-url-resolver.test.ts`
- Reuse: `apps/desktop-pet/src/playback-controller.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`
- Reuse: `apps/desktop-pet/src/App.test.ts`

**Interfaces:**
- Consumes: playlist resolver, song URL resolver, playback controller, and existing pet interaction logic
- Produces: reproducible verification evidence for phase 6

- [ ] **Step 1: Run the focused desktop test suite**

Run: `npm run test -- src/playlist-resolver.test.ts src/song-url-resolver.test.ts src/playback-controller.test.ts src/pet-window.test.ts src/App.test.ts`  
Expected: PASS.

- [ ] **Step 2: Run the full desktop test suite**

Run: `npm run test`  
Expected: PASS.

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Run the native validation build**

Run: `cargo check`  
Working directory: `apps/desktop-pet/src-tauri`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet docs/superpowers/specs/2026-06-19-desktop-pet-playlist-import-design.md docs/superpowers/plans/2026-06-19-desktop-pet-playlist-import.md
git commit -m "test: verify desktop pet playlist import flow"
```
