# Desktop Pet Transparent Window Design

**Goal:** Upgrade `apps/desktop-pet` from the stage 1 plain Tauri window into a stage 2 transparent desktop-pet shell that shows a pet image, stays on top, can be dragged, and exits on right-click of the visible pet area.

## Problem

Stage 1 proves that the standalone Tauri 2 desktop shell can open. Stage 2 needs to validate the next vertical slice for a desktop pet without introducing any music, backend, playlist, or animation behavior. The window must behave like a small pet shell rather than a normal application window.

## Scope

This stage includes only:

- Borderless window
- Transparent window background
- Pet image rendering in the window
- Always-on-top behavior
- Dragging via the visible pet area
- Right-click exit on the visible pet area
- Safe close behavior without runtime errors

This stage explicitly excludes:

- Music playback
- Playback state
- Backend API calls
- Playlist features
- Pet animation
- Complex tray or context menus
- Changes to website frontend code
- Changes to backend code
- Project-wide refactors

## Proposed Approach

### Window Configuration

Update the existing Tauri 2 main window configuration in `apps/desktop-pet/src-tauri/tauri.conf.json` to:

- Remove system window decorations
- Enable transparency
- Keep the window always on top
- Reduce the default size to closely fit the placeholder pet art
- Keep a standard interactive window model so later phases can still add click interactions

The implementation stays inside the current single-window shell instead of introducing secondary windows or native menus.

### Renderer UI

Replace the stage 1 text-only markup with a minimal desktop-pet view:

- One root transparent container
- One visible pet surface that holds the placeholder image
- One image asset under `apps/desktop-pet/src/assets/`

The transparent area outside the visible pet surface will not register the custom right-click exit handler. This keeps the interaction limited to the pet itself and reduces interference with the desktop.

### Dragging

Use the Tauri-recommended drag-region approach on the visible pet surface rather than building a custom pointer-move drag system. This keeps the implementation small and avoids fighting future click interactions.

### Exit Interaction

Bind a `contextmenu` handler only to the visible pet surface. On right-click:

- Prevent the browser default context menu
- Request application exit through Tauri 2 frontend APIs

No complex menu is added in this stage. The action is immediate exit.

## File Plan

- `apps/desktop-pet/src-tauri/tauri.conf.json`
  Update window properties for transparency, borderless display, always-on-top, and tighter size.
- `apps/desktop-pet/src/App.ts`
  Render the minimal pet shell markup instead of the stage 1 text-only view.
- `apps/desktop-pet/src/main.ts`
  Attach the right-click exit behavior to the visible pet surface only.
- `apps/desktop-pet/src/style.css`
  Make `html`, `body`, and root containers transparent and size the window to the visible pet surface.
- `apps/desktop-pet/src/assets/pet-placeholder.svg`
  Placeholder pet image for stage 2 verification.
- `apps/desktop-pet/src/App.test.ts`
  Update the focused renderer test so it verifies the stage 2 pet-shell markup exists.

## Risks And Mitigations

- Transparent background renders black
  Ensure transparency is configured both in Tauri window settings and in renderer CSS for all root layers.
- Dragging does not work
  Put the drag region on the visible pet surface, not only on a transparent parent.
- Right-click exit triggers on transparent space
  Bind the exit handler only to the pet surface element.
- Window blocks too much of the desktop
  Keep the window dimensions close to the placeholder image and avoid a large transparent canvas.
- Close behavior throws runtime errors
  Use the supported Tauri 2 frontend API path for exit and keep the exit logic minimal.

## Verification

Stage 2 is complete when all of the following are true:

1. `npm run tauri dev` launches the desktop shell.
2. The window has no visible system border.
3. The window background is transparent.
4. A placeholder pet image is visible.
5. The pet window stays on top of normal windows.
6. Dragging the visible pet area moves the window.
7. Right-clicking the visible pet area exits the app.
8. Right-clicking transparent empty space does not trigger the custom exit behavior.
9. Closing the window does not produce runtime errors.
