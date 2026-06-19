# Desktop Pet Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone `apps/desktop-pet` Tauri 2 + Vite + TypeScript desktop shell that opens a normal window and renders `Music Pet Desktop Started`.

**Architecture:** Keep the new desktop shell entirely self-contained under `apps/desktop-pet`. The renderer uses a tiny TypeScript/Vite UI with one exported render function, and Tauri uses the default Rust entry point plus one standard window defined in configuration.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest, Rust

## Global Constraints

- Only add files under `apps/desktop-pet` plus design and planning docs under `docs/superpowers/`.
- Do not modify `apps/web`.
- Do not modify `server`.
- Do not modify the existing `desktop/` directory.
- Do not integrate music playback.
- Do not integrate backend APIs.
- Do not add playlist import.
- Do not add pet animation.
- Do not use a transparent window.
- Do not add auto update.
- Avoid changing root `package.json`; if a root-file change becomes necessary, stop and ask first.
- Keep the structure intentionally small and easy to delete or extend later.

---

### Task 1: Scaffold the renderer with a startup-message test

**Files:**
- Create: `apps/desktop-pet/package.json`
- Create: `apps/desktop-pet/.gitignore`
- Create: `apps/desktop-pet/tsconfig.json`
- Create: `apps/desktop-pet/tsconfig.node.json`
- Create: `apps/desktop-pet/vite.config.ts`
- Create: `apps/desktop-pet/vitest.config.ts`
- Create: `apps/desktop-pet/index.html`
- Create: `apps/desktop-pet/src/App.ts`
- Create: `apps/desktop-pet/src/App.test.ts`
- Create: `apps/desktop-pet/src/main.ts`
- Create: `apps/desktop-pet/src/style.css`
- Test: `apps/desktop-pet/src/App.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `renderApp(): string` from `apps/desktop-pet/src/App.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { renderApp } from "./App";

describe("renderApp", () => {
  it("returns the desktop startup message", () => {
    expect(renderApp()).toContain("Music Pet Desktop Started");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- App.test.ts`
Expected: FAIL with a module-not-found error because `./App` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function renderApp(): string {
  return `<main class="app">Music Pet Desktop Started</main>`;
}
```

```ts
import "./style.css";
import { renderApp } from "./App";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element was not found.");
}

root.innerHTML = renderApp();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- App.test.ts`
Expected: PASS with one passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet docs/superpowers/specs/2026-06-18-desktop-pet-shell-design.md docs/superpowers/plans/2026-06-18-desktop-pet-shell.md
git commit -m "feat: add desktop pet tauri shell scaffold"
```

### Task 2: Add the minimal Tauri shell

**Files:**
- Create: `apps/desktop-pet/src-tauri/Cargo.toml`
- Create: `apps/desktop-pet/src-tauri/build.rs`
- Create: `apps/desktop-pet/src-tauri/capabilities/default.json`
- Create: `apps/desktop-pet/src-tauri/tauri.conf.json`
- Create: `apps/desktop-pet/src-tauri/src/main.rs`

**Interfaces:**
- Consumes: Vite dev server on `http://localhost:1420` in development and built assets in `../dist`
- Produces: A standard desktop window titled `Music Pet Desktop`

- [ ] **Step 1: Write the failing shell verification**

```json
{
  "productName": "Music Pet Desktop",
  "version": "0.1.0"
}
```

The verification target is a fresh Tauri check command. Without the Rust crate and config files, `npm run tauri info` or `cargo check` cannot succeed.

- [ ] **Step 2: Run verification to confirm it fails before files exist**

Run: `npm run tauri info`
Expected: FAIL because `src-tauri` and its manifest are missing.

- [ ] **Step 3: Write minimal implementation**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Run verification to confirm it passes**

Run: `npm run tauri info`
Expected: PASS and report Tauri project information.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src-tauri
git commit -m "feat: add tauri shell for desktop pet"
```

### Task 3: Verify the minimal shell end to end

**Files:**
- Reuse: `apps/desktop-pet/package.json`
- Reuse: `apps/desktop-pet/src/App.ts`
- Reuse: `apps/desktop-pet/src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: `renderApp(): string`
- Produces: repeatable commands for install, test, build, and dev startup

- [ ] **Step 1: Run the focused renderer test**

Run: `npm run test -- App.test.ts`
Expected: PASS with `Music Pet Desktop Started` verified.

- [ ] **Step 2: Run the renderer build**

Run: `npm run build`
Expected: PASS and emit `dist/` assets.

- [ ] **Step 3: Run the Tauri validation build**

Run: `npm run tauri build -- --debug`
Expected: PASS and produce a debug desktop build without auto-update or transparent-window features.

- [ ] **Step 4: Record operator commands**

Install: `cd apps/desktop-pet && npm install`
Start: `cd apps/desktop-pet && npm run tauri dev`
Expected runtime result: one normal window opens and shows `Music Pet Desktop Started`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet
git commit -m "test: verify desktop pet shell startup flow"
```
