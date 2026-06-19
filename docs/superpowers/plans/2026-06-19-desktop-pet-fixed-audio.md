# Desktop Pet Fixed Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real playback for the fixed local test file `/audio/test-song.mp3` while preserving the stage 2 window behavior and stage 3 click-vs-drag behavior.

**Architecture:** Keep Tauri window behavior untouched and add one local browser audio element in the desktop renderer. A small playback controller coordinates audio events and UI state, while the existing pet interaction module continues deciding whether left-button input is a click or a drag.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest, HTMLAudioElement

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning/spec docs under `docs/superpowers/`.
- Do not add backend API calls.
- Do not add playlists, search, login, or provider integrations.
- Do not modify website frontend code.
- Do not modify backend code.
- Do not refactor the whole project.
- Do not change transparent, borderless, or always-on-top window configuration.
- Drag still requires movement greater than 4px.
- Right-click exit must remain independent from playback logic.

---

### Task 1: Add playback controller tests and UI hooks

**Files:**
- Modify: `apps/desktop-pet/src/App.ts`
- Modify: `apps/desktop-pet/src/App.test.ts`
- Create: `apps/desktop-pet/src/playback-controller.ts`
- Create: `apps/desktop-pet/src/playback-controller.test.ts`

**Interfaces:**
- Consumes: stage 3 status UI hooks
- Produces: `createPlaybackController(audio, elements)` with `togglePlayback(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
it("shows an error message when play() rejects", async () => {
  const audio = new FakeAudio({ shouldRejectPlay: true });
  const refs = createPlaybackRefs();
  const controller = createPlaybackController(audio, refs);

  await controller.togglePlayback();

  expect(refs.error.textContent).toContain("播放失败");
  expect(refs.stage.dataset.playbackState).toBe("paused");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- playback-controller.test.ts`
Expected: FAIL because the controller does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a small controller that:
- initializes paused UI
- calls `audio.play()` when paused
- calls `audio.pause()` when playing
- updates UI on `play`, `pause`, `ended`, and `error`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- playback-controller.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/App.ts apps/desktop-pet/src/App.test.ts apps/desktop-pet/src/playback-controller.ts apps/desktop-pet/src/playback-controller.test.ts
git commit -m "feat: add fixed audio playback controller"
```

### Task 2: Wire fixed audio into click behavior

**Files:**
- Modify: `apps/desktop-pet/src/main.ts`
- Modify: `apps/desktop-pet/src/pet-window.ts`
- Modify: `apps/desktop-pet/src/pet-window.test.ts`

**Interfaces:**
- Consumes: `/audio/test-song.mp3`, `createPlaybackController(...)`
- Produces: click-to-play/pause on valid non-drag left clicks

- [ ] **Step 1: Write the failing test**

```ts
it("awaits an async playback toggle on left click", async () => {
  const target = new EventTarget();
  const togglePlayback = vi.fn(async () => {});

  bindPetWindowInteractions(target, { startDragging, closeWindow, togglePlayback });
  target.dispatchEvent(mouseEvent("mousedown", { button: 0, clientX: 1, clientY: 1 }));
  target.dispatchEvent(mouseEvent("mouseup", { button: 0, clientX: 2, clientY: 2 }));

  await Promise.resolve();
  expect(togglePlayback).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- pet-window.test.ts`
Expected: FAIL if the click callback path cannot support the new real playback flow.

- [ ] **Step 3: Write minimal implementation**

Keep the 4px threshold logic, but let the click callback return a promise so the real audio toggle can run safely.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- pet-window.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/main.ts apps/desktop-pet/src/pet-window.ts apps/desktop-pet/src/pet-window.test.ts
git commit -m "feat: wire fixed audio playback into pet clicks"
```

### Task 3: Add playback error styling and verify stage 4

**Files:**
- Modify: `apps/desktop-pet/src/style.css`

**Interfaces:**
- Consumes: playback error UI hook
- Produces: clear, readable error feedback

- [ ] **Step 1: Write the failing verification**

The current stylesheet has no visible playback-error styles.

- [ ] **Step 2: Run verification to confirm stage 3 styles are insufficient**

Run: `Get-Content apps/desktop-pet/src/style.css`
Expected: no error-specific playback styling.

- [ ] **Step 3: Write minimal implementation**

Add a small visible error chip near the pet while keeping pointer events disabled for the status/error labels.

- [ ] **Step 4: Run verification to confirm styles are present**

Run: `Get-Content apps/desktop-pet/src/style.css`
Expected: error styling exists.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/style.css
git commit -m "feat: add fixed audio playback error styling"
```

### Task 4: Verify stage 4 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/playback-controller.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`
- Reuse: `apps/desktop-pet/src/App.test.ts`

**Interfaces:**
- Consumes: fixed audio controller, click-vs-drag logic, and renderer UI
- Produces: reproducible stage 4 verification commands

- [ ] **Step 1: Run the full focused test suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run the native validation build**

Run: `cargo check`
Working directory: `apps/desktop-pet/src-tauri`
Expected: PASS.

- [ ] **Step 4: Run the desktop shell manually**

Run: `npm run tauri dev`
Expected: click plays and pauses `/audio/test-song.mp3`, drag still works, and right-click still exits.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet
git commit -m "test: verify desktop pet fixed audio playback"
```
