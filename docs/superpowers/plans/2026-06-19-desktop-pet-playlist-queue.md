# Desktop Pet Playlist Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a basic non-looping playback queue for imported playlist songs, with previous/next buttons, current-song highlighting, and automatic next-song playback on audio end.

**Architecture:** Keep queue state in `playback-controller.ts` and keep `main.ts` focused on DOM wiring and refreshes. Extend the existing stage-6 playlist panel with two queue buttons, reuse the same `/song/url/v1` song URL path, and let the controller own queue navigation plus `ended` behavior.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest, HTMLAudioElement, DOM event wiring

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning docs under `docs/superpowers/`.
- Do not modify website frontend code.
- Do not modify backend code or add new endpoints.
- Do not add login, search, lyrics, random play, loop mode settings, or other later-stage features.
- Do not migrate the desktop app to React or TSX.
- Do not refactor the whole project.
- Queue state must live in `playback-controller.ts`.
- `main.ts` must stay as the UI/event layer.
- Use non-looping queue boundaries.
- Queue buttons, playlist rows, and the input field must not trigger pet dragging.
- Pet click must remain play/pause for the current song only.
- Dragging must remain tied to the 4px threshold on the pet surface.
- Right-click exit must remain tied to the pet surface only.

---

### Task 1: Add failing queue tests for controller behavior

**Files:**
- Modify: `apps/desktop-pet/src/playback-controller.test.ts`

**Interfaces:**
- Consumes: `createPlaybackController(audio, refs, options)`
- Produces tests for:
  - `setQueue(songs)`
  - `getCurrentSongIndex()`
  - `playSongAtIndex(index)`
  - `playNext()`
  - `playPrevious()`

- [ ] **Step 1: Write the failing test**

```ts
it("plays the next song in the queue and updates the current index", async () => {
  const audio = new FakeAudio();
  const refs = createPlaybackRefs();
  const controller = createPlaybackController(audio, refs, {
    resolveSongUrl: async (songId) => `https://example.com/${songId}.mp3`
  });

  controller.setQueue([
    { id: 101, name: "第一首" },
    { id: 202, name: "第二首" }
  ]);

  await controller.playSongAtIndex(0);
  await controller.playNext();

  expect(controller.getCurrentSongIndex()).toBe(1);
  expect(controller.getCurrentSong()?.name).toBe("第二首");
  expect(audio.src).toBe("https://example.com/202.mp3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/playback-controller.test.ts`  
Expected: FAIL because queue methods do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Extend `playback-controller.ts` so it can:
- store queue songs
- store current index
- play a song at a queue index
- move to next or previous songs with non-looping boundaries

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/playback-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/playback-controller.test.ts apps/desktop-pet/src/playback-controller.ts
git commit -m "feat: add queue navigation to playback controller"
```

### Task 2: Add automatic-next and boundary tests

**Files:**
- Modify: `apps/desktop-pet/src/playback-controller.test.ts`
- Modify: `apps/desktop-pet/src/playback-controller.ts`

**Interfaces:**
- Consumes:
  - `audio.dispatchEvent(new Event("ended"))`
  - controller queue methods
- Produces:
  - automatic next on `ended`
  - clear first/last boundary messages

- [ ] **Step 1: Write the failing test**

```ts
it("automatically advances to the next queue song on ended", async () => {
  const audio = new FakeAudio();
  const refs = createPlaybackRefs();
  const controller = createPlaybackController(audio, refs, {
    resolveSongUrl: async (songId) => `https://example.com/${songId}.mp3`
  });

  controller.setQueue([
    { id: 101, name: "第一首" },
    { id: 202, name: "第二首" }
  ]);

  await controller.playSongAtIndex(0);
  audio.dispatchEvent(new Event("ended"));
  await Promise.resolve();

  expect(controller.getCurrentSongIndex()).toBe(1);
  expect(controller.getCurrentSong()?.name).toBe("第二首");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/playback-controller.test.ts`  
Expected: FAIL because `ended` currently only pauses.

- [ ] **Step 3: Write minimal implementation**

Update `playback-controller.ts` so:
- `ended` calls the next-song path once when another queue song exists
- `ended` stops cleanly at the end of the queue
- `playNext()` and `playPrevious()` show `已经是最后一首` / `已经是第一首` without crashing

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/playback-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/playback-controller.test.ts apps/desktop-pet/src/playback-controller.ts
git commit -m "feat: add auto-next and queue boundaries"
```

### Task 3: Add queue controls to the desktop UI and wire them

**Files:**
- Modify: `apps/desktop-pet/src/App.ts`
- Modify: `apps/desktop-pet/src/App.test.ts`
- Modify: `apps/desktop-pet/src/main.ts`
- Modify: `apps/desktop-pet/src/style.css`

**Interfaces:**
- Consumes:
  - `playbackController.setQueue(songs)`
  - `playbackController.playSongAtIndex(index)`
  - `playbackController.playNext()`
  - `playbackController.playPrevious()`
  - `playbackController.getCurrentSongIndex()`
- Produces working prev/next buttons plus synced current-song label and list highlight

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders previous and next queue control hooks", () => {
    const markup = renderApp();

    expect(markup).toContain("data-play-previous");
    expect(markup).toContain("data-play-next");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/App.test.ts`  
Expected: FAIL because the queue button hooks are missing.

- [ ] **Step 3: Write minimal implementation**

Update:
- `App.ts` with `上一首` and `下一首` buttons
- `main.ts` to:
  - load queue songs into the controller after import
  - call `playSongAtIndex(...)` on song click
  - call `playPrevious()` / `playNext()` on button clicks
  - rerender current-song label and active-song highlight from controller getters
- `style.css` with compact queue button styles

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/App.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/App.ts apps/desktop-pet/src/App.test.ts apps/desktop-pet/src/main.ts apps/desktop-pet/src/style.css
git commit -m "feat: add desktop queue controls"
```

### Task 4: Verify stage 7 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/playback-controller.test.ts`
- Reuse: `apps/desktop-pet/src/App.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`
- Reuse: `apps/desktop-pet/src/song-url-resolver.test.ts`
- Reuse: `apps/desktop-pet/src/playlist-resolver.test.ts`

**Interfaces:**
- Consumes: queue controller, playlist UI, existing pet interaction logic
- Produces reproducible verification evidence for phase 7

- [ ] **Step 1: Run the full desktop test suite**

Run: `npm run test`  
Expected: PASS.

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 3: Run the native validation build**

Run: `cargo check`  
Working directory: `apps/desktop-pet/src-tauri`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop-pet docs/superpowers/specs/2026-06-19-desktop-pet-playlist-queue-design.md docs/superpowers/plans/2026-06-19-desktop-pet-playlist-queue.md
git commit -m "test: verify desktop pet playlist queue flow"
```
