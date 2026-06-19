# Desktop Pet Shell Design

**Goal:** Add an independent `apps/desktop-pet` Windows desktop shell using Tauri 2, Vite, and TypeScript that opens a normal window and renders the text `Music Pet Desktop Started`.

## Problem

The repository currently contains a web frontend and an older Electron-based desktop implementation, but it does not yet contain the first-step Tauri desktop shell requested for the future desktop pet player. This step must stay isolated from existing app structures and avoid any broader repository refactor.

## Proposed Approach

1. Create a new standalone project under `apps/desktop-pet`.
2. Use Vite + TypeScript for the renderer UI with a single minimal component.
3. Use Tauri 2 for the desktop shell with one standard window.
4. Add only the smallest test coverage needed to prove the startup message renders.

## Constraints

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

## File Plan

- `apps/desktop-pet/package.json`: local scripts and dependencies for the standalone desktop shell.
- `apps/desktop-pet/.gitignore`: local dependency and build-output ignores.
- `apps/desktop-pet/tsconfig.json`: renderer TypeScript settings.
- `apps/desktop-pet/tsconfig.node.json`: TypeScript settings for Vite config files.
- `apps/desktop-pet/vite.config.ts`: minimal Vite configuration.
- `apps/desktop-pet/vitest.config.ts`: minimal test configuration.
- `apps/desktop-pet/index.html`: Vite HTML entry.
- `apps/desktop-pet/src/main.ts`: renderer bootstrap.
- `apps/desktop-pet/src/App.ts`: minimal UI component that returns the startup message.
- `apps/desktop-pet/src/style.css`: minimal renderer styles.
- `apps/desktop-pet/src/App.test.ts`: regression test for the startup message.
- `apps/desktop-pet/src-tauri/Cargo.toml`: Rust crate definition for the Tauri shell.
- `apps/desktop-pet/src-tauri/build.rs`: Tauri build-script entry required by the Rust crate.
- `apps/desktop-pet/src-tauri/capabilities/default.json`: default capability scope for the single desktop window.
- `apps/desktop-pet/src-tauri/tauri.conf.json`: Tauri application and window configuration.
- `apps/desktop-pet/src-tauri/src/main.rs`: Rust entry point that runs the default Tauri app.

## Verification

- Install dependencies only inside `apps/desktop-pet`.
- Run the renderer test and confirm the `Music Pet Desktop Started` text assertion passes.
- Run the frontend build and confirm Vite succeeds.
- Run a Tauri Rust check/build command and confirm the desktop shell configuration is valid.
