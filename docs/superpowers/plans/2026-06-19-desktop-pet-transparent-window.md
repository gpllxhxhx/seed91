# Desktop Pet Transparent Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `apps/desktop-pet` into a transparent, borderless stage 2 desktop-pet shell that shows a placeholder pet image, stays on top, can be dragged, and exits on right-click of the visible pet area.

**Architecture:** Keep the existing single-window Tauri 2 shell. The Rust side stays configuration-only through `tauri.conf.json`, while the renderer swaps the stage 1 text UI for a transparent pet surface with a visible image and a minimal right-click close handler.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning/spec docs under `docs/superpowers/`.
- Do not modify website frontend code.
- Do not modify backend code.
- Do not modify the old `desktop/` directory.
- Do not add music playback.
- Do not add playback logic.
- Do not add backend API calls.
- Do not add playlist features.
- Do not add pet animation.
- Do not do a project-wide refactor.
- Keep the window size close to the pet image so transparent empty space stays small.
- Right-click exit must only work on the pet image or visible pet area, not on transparent empty space.

---

### Task 1: Replace the stage 1 UI with a pet-shell view

**Files:**
- Modify: `apps/desktop-pet/src/App.ts`
- Modify: `apps/desktop-pet/src/App.test.ts`
- Create: `apps/desktop-pet/src/assets/pet-placeholder.svg`
- Modify: `apps/desktop-pet/src/style.css`

**Interfaces:**
- Consumes: none
- Produces: `renderApp(): string` returning stage 2 pet-shell markup with a `data-pet-surface` hook

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("renders the pet surface and placeholder image", () => {
    const markup = renderApp();

    expect(markup).toContain('data-pet-surface');
    expect(markup).toContain("pet-placeholder.svg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- App.test.ts`
Expected: FAIL because the stage 1 markup does not contain the pet surface hook or placeholder image reference.

- [ ] **Step 3: Write minimal implementation**

```ts
export function renderApp(): string {
  return `
    <main class="pet-shell">
      <button
        type="button"
        class="pet-surface"
        data-pet-surface
        data-tauri-drag-region
        aria-label="Desktop pet"
      >
        <img
          src="/src/assets/pet-placeholder.svg"
          alt="Desktop pet placeholder"
          class="pet-image"
          data-tauri-drag-region
        />
      </button>
    </main>
  `.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- App.test.ts`
Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/App.ts apps/desktop-pet/src/App.test.ts apps/desktop-pet/src/assets/pet-placeholder.svg apps/desktop-pet/src/style.css
git commit -m "feat: add desktop pet stage 2 shell view"
```

### Task 2: Add right-click exit on the visible pet area only

**Files:**
- Modify: `apps/desktop-pet/package.json`
- Modify: `apps/desktop-pet/package-lock.json`
- Modify: `apps/desktop-pet/vitest.config.ts`
- Modify: `apps/desktop-pet/src/main.ts`
- Create: `apps/desktop-pet/src/pet-window.ts`
- Create: `apps/desktop-pet/src/pet-window.test.ts`

**Interfaces:**
- Consumes: `data-pet-surface` element from `renderApp(): string`
- Produces: `bindPetWindowInteractions(target: HTMLElement, closeWindow: () => Promise<void> | void): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { bindPetWindowInteractions } from "./pet-window";

describe("bindPetWindowInteractions", () => {
  it("closes the window when the pet surface is right-clicked", async () => {
    document.body.innerHTML = '<button data-pet-surface></button>';
    const target = document.querySelector<HTMLElement>("[data-pet-surface]");
    const closeWindow = vi.fn(async () => {});

    if (!target) {
      throw new Error("Pet surface not found.");
    }

    bindPetWindowInteractions(target, closeWindow);
    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

    expect(closeWindow).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- pet-window.test.ts`
Expected: FAIL because `bindPetWindowInteractions` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function bindPetWindowInteractions(
  target: HTMLElement,
  closeWindow: () => Promise<void> | void
): void {
  target.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    await closeWindow();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- pet-window.test.ts`
Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/package.json apps/desktop-pet/package-lock.json apps/desktop-pet/vitest.config.ts apps/desktop-pet/src/main.ts apps/desktop-pet/src/pet-window.ts apps/desktop-pet/src/pet-window.test.ts
git commit -m "feat: add pet window right-click exit"
```

### Task 3: Reconfigure the Tauri window for stage 2

**Files:**
- Modify: `apps/desktop-pet/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: existing `main` window label
- Produces: a transparent, borderless, always-on-top main window sized near the pet art

- [ ] **Step 1: Write the failing verification**

The verification target is the current config file. Stage 1 still uses `transparent: false` and decorated window defaults, which do not satisfy stage 2 acceptance.

- [ ] **Step 2: Run verification to confirm stage 1 config is insufficient**

Run: `Get-Content apps/desktop-pet/src-tauri/tauri.conf.json`
Expected: the file shows `transparent: false` and no `decorations: false` / `alwaysOnTop: true`.

- [ ] **Step 3: Write minimal implementation**

```json
{
  "label": "main",
  "title": "Music Pet Desktop",
  "width": 220,
  "height": 260,
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "resizable": false,
  "shadow": false
}
```

- [ ] **Step 4: Run verification to confirm the stage 2 config is present**

Run: `Get-Content apps/desktop-pet/src-tauri/tauri.conf.json`
Expected: the window config includes `transparent: true`, `decorations: false`, `alwaysOnTop: true`, and a smaller width/height.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src-tauri/tauri.conf.json
git commit -m "feat: configure transparent pet window"
```

### Task 4: Verify stage 2 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/App.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`
- Reuse: `apps/desktop-pet/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: `renderApp()` and `bindPetWindowInteractions(...)`
- Produces: reproducible stage 2 verification commands

- [ ] **Step 1: Run the full focused test suite**

Run: `npm run test`
Expected: PASS with the renderer and interaction tests both green.

- [ ] **Step 2: Run the frontend build**

Run: `npm run build`
Expected: PASS and emit the updated `dist/` assets.

- [ ] **Step 3: Run the native validation build**

Run: `cargo check`
Working directory: `apps/desktop-pet/src-tauri`
Expected: PASS with the Tauri window config compiling cleanly.

- [ ] **Step 4: Run the desktop shell manually**

Run: `npm run tauri dev`
Expected: a small transparent borderless window opens, shows the placeholder pet image, stays on top, moves when dragging the pet, and exits on right-click of the pet surface.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet
git commit -m "test: verify desktop pet transparent window flow"
```
