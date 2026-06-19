# Desktop Pet Fake Playback Design

**Goal:** Add a stage 3 fake playback state to `apps/desktop-pet` so the pet can toggle between `播放中` and `已暂停` on left click without introducing any real music, backend, or playlist behavior.

## Problem

Stage 2 already proved the transparent desktop-pet shell works: the window is borderless, transparent, always on top, draggable, and exits on right-click. Stage 3 needs the next isolated interaction slice: a believable playback state toggle that changes visible UI and styling, while preserving the drag and right-click exit behavior already working in stage 2.

## Scope

This stage includes only:

- A local fake playback state variable
- Left-click toggling between `播放中` and `已暂停`
- Visible status text near the pet
- A simple visual distinction between playing and paused
- Drag-vs-click separation using a 4px movement threshold

This stage explicitly excludes:

- Real music playback
- `audio` element usage
- Backend API calls
- Playlist functionality
- Login functionality
- Website frontend changes
- Backend changes
- Project-wide refactors
- Changes to transparent, borderless, or always-on-top window configuration

## Proposed Approach

### Interaction Model

Use the already existing pet interaction module to separate three pointer behaviors:

1. Left press + total movement `<= 4px`
   Treat as a click and toggle fake playback state.
2. Left press + total movement `> 4px`
   Treat as drag and start moving the Tauri window. Do not toggle playback state.
3. Right click on the visible pet area
   Keep the existing exit behavior unchanged.

The transparent empty area outside the visible pet region must not toggle state or react to right-click.

### Renderer UI

Extend the current pet markup to include:

- One visible pet surface for pointer interaction
- One nearby status label
- One container attribute that records current playback state, starting from paused

The text values are:

- `播放中`
- `已暂停`

### Styling

Use lightweight CSS only:

- `播放中`: slightly brighter / gently floating
- `已暂停`: static / slightly dimmer

This must preserve:

- Transparent background
- Existing pointer event boundaries
- Small visual footprint matching the pet window

## File Plan

- `apps/desktop-pet/src/App.ts`
  Add stage 3 markup hooks for fake playback state and status text.
- `apps/desktop-pet/src/main.ts`
  Initialize state toggling and wire it into the existing interaction setup.
- `apps/desktop-pet/src/pet-window.ts`
  Implement the 4px click-vs-drag threshold logic while preserving right-click exit.
- `apps/desktop-pet/src/style.css`
  Add visual styles for `播放中` and `已暂停` without affecting the transparent shell behavior.
- `apps/desktop-pet/src/App.test.ts`
  Update the renderer test to verify the stage 3 status UI exists.
- `apps/desktop-pet/src/pet-window.test.ts`
  Add interaction tests for click toggle, drag without toggle, and right-click exit.

## Risks And Mitigations

- Click always turns into drag
  Remove reliance on drag-region attributes and use explicit movement-threshold logic.
- Drag still toggles playback
  Track pointer origin and only toggle on mouseup when movement stayed within 4px.
- Right-click stops working
  Keep `contextmenu` handling separate from left-button logic.
- Transparent empty area reacts to clicks
  Keep pointer events enabled only on the visible pet surface and status-adjacent UI.
- Stage 2 window behavior regresses
  Avoid changing Tauri window config and keep all work in desktop renderer code only.

## Verification

Stage 3 is complete when all of the following are true:

1. `npm run tauri dev` starts successfully.
2. Left-clicking the pet without moving more than 4px toggles `已暂停` -> `播放中` -> `已暂停`.
3. A visible status label near the pet updates with the current fake playback state.
4. The pet styling visibly differs between playing and paused.
5. Dragging the pet farther than 4px moves the window and does not toggle playback state.
6. Right-clicking the visible pet area still exits the app.
7. Transparent empty space still does not react to fake playback clicks.
8. No new runtime errors appear on close or right-click exit.
