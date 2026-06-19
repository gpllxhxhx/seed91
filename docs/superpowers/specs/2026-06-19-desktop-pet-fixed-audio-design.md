# Desktop Pet Fixed Audio Design

**Goal:** Upgrade `apps/desktop-pet` from stage 3 fake playback into stage 4 fixed-audio playback using the local test file `apps/desktop-pet/public/audio/test-song.mp3`.

## Problem

Stage 3 already proves the pet can distinguish click from drag and can toggle a fake playback state. Stage 4 must keep those interactions intact while connecting the click action to one real, local test audio file. This stage must not introduce backend calls, playlists, or any broader music feature set.

## Scope

This stage includes only:

- One fixed audio source: `/audio/test-song.mp3`
- Play on click when paused
- Pause on click when playing
- Resume from paused position
- Visible status text updates
- Explicit playback failure feedback

This stage explicitly excludes:

- Backend API requests
- Search, playlists, login, or provider integrations
- Complex player UI
- Auto-next behavior
- Website frontend changes
- Backend changes
- Window configuration changes for transparency, borderless display, or always-on-top

## Proposed Approach

### Audio Control

Create one `HTMLAudioElement` in the desktop renderer and point it to `/audio/test-song.mp3`. Use the existing 4px click-vs-drag logic so only a true click can trigger playback changes.

### Playback Behavior

- If the pet is paused, clicking calls `play()`
- If the pet is playing, clicking calls `pause()`
- Resume uses the browser audio element's built-in current position retention

### Error Handling

Playback failure must not crash the app. Show a visible error message near the pet if:

- `play()` rejects
- the audio element emits an error event

The pet should stay in `已暂停` state after failure.

## File Plan

- `apps/desktop-pet/src/App.ts`
  Add a dedicated playback-error UI hook.
- `apps/desktop-pet/src/main.ts`
  Create the fixed audio element, initialize the controller, and keep existing click/drag/exit wiring.
- `apps/desktop-pet/src/pet-window.ts`
  Keep the 4px threshold logic and allow the click callback to become async for real playback control.
- `apps/desktop-pet/src/style.css`
  Add readable error styling without affecting transparency or pointer boundaries.
- `apps/desktop-pet/src/App.test.ts`
  Verify stage 4 playback markup includes the error area.
- `apps/desktop-pet/src/pet-window.test.ts`
  Keep click-vs-drag and right-click behavior covered.
- `apps/desktop-pet/src/playback-controller.ts`
  Small controller that maps audio events to `播放中` / `已暂停` / error UI updates.
- `apps/desktop-pet/src/playback-controller.test.ts`
  Verify play, pause, resume-oriented state updates, and playback failure handling.

## Verification

Stage 4 is complete when all of the following are true:

1. Clicking the pet while paused plays `/audio/test-song.mp3`.
2. Clicking again pauses playback.
3. Clicking again resumes from the paused position.
4. Status text still shows `播放中` and `已暂停` correctly.
5. Playback failure shows a clear error message instead of crashing.
6. Dragging still works when pointer movement exceeds 4px.
7. Right-click exit still works.
8. Transparent, borderless, always-on-top window behavior remains unchanged.
