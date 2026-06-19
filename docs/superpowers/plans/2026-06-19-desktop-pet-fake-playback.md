# Desktop Pet Fake Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fake playback state to the desktop pet that toggles between `播放中` and `已暂停` on click while preserving drag and right-click exit behavior.

**Architecture:** Keep the Tauri window configuration unchanged and implement the whole feature in the desktop renderer. The pet interaction module will split left-click, drag, and right-click into distinct paths using a 4px threshold, while the UI layer reflects state through a small nearby label and state-driven CSS classes.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning/spec docs under `docs/superpowers/`.
- Do not add real music playback.
- Do not add an `audio` element.
- Do not add backend API calls.
- Do not add playlist functionality.
- Do not modify website frontend code.
- Do not modify backend code.
- Do not refactor the whole project.
- Do not change transparent, borderless, or always-on-top window configuration.
- Right-click exit must remain independent from click-vs-drag logic.
- Transparent empty space must not react to playback clicks.

---

### Task 1: Add stage 3 playback-state markup

**Files:**
- Modify: `apps/desktop-pet/src/App.ts`
- Modify: `apps/desktop-pet/src/App.test.ts`

**Interfaces:**
- Consumes: placeholder pet asset already rendered in stage 2
- Produces: playback-state DOM hooks `data-playback-state` and `data-playback-status`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the paused playback state label", () => {
    const markup = renderApp();

    expect(markup).toContain('data-playback-state="paused"');
    expect(markup).toContain("已暂停");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- App.test.ts`
Expected: FAIL because the current markup has no playback-state container or paused label.

- [ ] **Step 3: Write minimal implementation**

```ts
<main class="pet-shell">
  <section class="pet-stage" data-playback-state="paused">
    <button type="button" class="pet-surface" data-pet-surface>
      <img ... />
    </button>
    <p class="playback-status" data-playback-status>已暂停</p>
  </section>
</main>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- App.test.ts`
Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/App.ts apps/desktop-pet/src/App.test.ts
git commit -m "feat: add fake playback status markup"
```

### Task 2: Implement click-vs-drag fake playback behavior

**Files:**
- Modify: `apps/desktop-pet/src/main.ts`
- Modify: `apps/desktop-pet/src/pet-window.ts`
- Modify: `apps/desktop-pet/src/pet-window.test.ts`

**Interfaces:**
- Consumes: `data-pet-surface`, `data-playback-state`, `data-playback-status`
- Produces: `bindPetWindowInteractions(target, callbacks)` with click toggle, drag threshold, and right-click exit preserved

- [ ] **Step 1: Write the failing test**

```ts
it("toggles playback when left click movement stays within 4px", async () => {
  const target = new EventTarget();
  const startDragging = vi.fn(async () => {});
  const closeWindow = vi.fn(async () => {});
  const togglePlayback = vi.fn();

  bindPetWindowInteractions(target, {
    startDragging,
    closeWindow,
    togglePlayback
  });

  target.dispatchEvent(mouseEvent("mousedown", { button: 0, clientX: 10, clientY: 10 }));
  target.dispatchEvent(mouseEvent("mouseup", { button: 0, clientX: 12, clientY: 12 }));

  expect(togglePlayback).toHaveBeenCalledTimes(1);
  expect(startDragging).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- pet-window.test.ts`
Expected: FAIL because the current interaction layer always starts dragging on left-button down and has no playback toggle callback.

- [ ] **Step 3: Write minimal implementation**

```ts
type PetWindowCallbacks = {
  startDragging: () => Promise<void> | void;
  closeWindow: () => Promise<void> | void;
  togglePlayback: () => void;
  movementTarget?: EventTarget;
};
```

Track pointer start coordinates on left-button down, call `startDragging()` only after movement exceeds 4px, and call `togglePlayback()` on left-button up only when the pointer stayed within the threshold.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- pet-window.test.ts`
Expected: PASS with drag, click toggle, and right-click exit tests all green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/main.ts apps/desktop-pet/src/pet-window.ts apps/desktop-pet/src/pet-window.test.ts
git commit -m "feat: add fake playback click and drag threshold"
```

### Task 3: Add stage 3 playback visuals

**Files:**
- Modify: `apps/desktop-pet/src/style.css`

**Interfaces:**
- Consumes: `data-playback-state` values `paused` and `playing`
- Produces: visible status text and style differences for the two fake playback states

- [ ] **Step 1: Write the failing verification**

The current stylesheet has no state-specific playback visuals and no visible status label styling.

- [ ] **Step 2: Run verification to confirm stage 2 styles are insufficient**

Run: `Get-Content apps/desktop-pet/src/style.css`
Expected: no `.playback-status` rules and no state-driven playing/paused styles.

- [ ] **Step 3: Write minimal implementation**

```css
.pet-stage[data-playback-state="playing"] .pet-image {
  animation: pet-float 1.6s ease-in-out infinite;
  filter: drop-shadow(...);
}

.pet-stage[data-playback-state="paused"] .pet-image {
  opacity: 0.82;
}
```

Add a nearby readable status chip that does not enlarge the interactive transparent area more than necessary.

- [ ] **Step 4: Run verification to confirm stage 3 styles are present**

Run: `Get-Content apps/desktop-pet/src/style.css`
Expected: visible status styling plus state-specific playing/paused rules.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/style.css
git commit -m "feat: add fake playback state visuals"
```

### Task 4: Verify stage 3 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/App.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`
- Reuse: `apps/desktop-pet/src/style.css`

**Interfaces:**
- Consumes: stage 3 markup and interaction callbacks
- Produces: reproducible stage 3 verification commands

- [ ] **Step 1: Run the full focused test suite**

Run: `npm run test`
Expected: PASS with renderer and interaction tests all green.

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`
Expected: PASS and emit updated assets.

- [ ] **Step 3: Run the native validation build**

Run: `cargo check`
Working directory: `apps/desktop-pet/src-tauri`
Expected: PASS.

- [ ] **Step 4: Run the desktop shell manually**

Run: `npm run tauri dev`
Expected: click toggles fake playback status, drag still moves the window when movement exceeds 4px, and right-click still exits.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet
git commit -m "test: verify desktop pet fake playback state"
```
