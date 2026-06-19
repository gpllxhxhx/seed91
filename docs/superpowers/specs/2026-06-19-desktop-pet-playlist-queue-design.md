# Desktop Pet Playlist Queue Design

**Goal:** Extend `apps/desktop-pet` so an imported playlist becomes a basic playback queue with previous/next controls, current-song highlighting, and automatic advance to the next song when the current song finishes.

## Problem

Stage 6 already proves the desktop pet can import a playlist, render songs, and play a clicked track. What is missing is queue continuity: the app does not remember the playlist as an active play queue, does not track the current song index, and cannot move to previous or next songs. Stage 7 adds only this base queue behavior and must preserve the transparent pet shell, drag behavior, right-click exit, and stage 6 import flow.

## Scope

This stage includes only:

- storing the imported playlist as the current playback queue
- storing the current song index
- rendering `上一首` and `下一首` buttons
- highlighting the currently selected song in the playlist list
- previous/next navigation through the queue
- automatic attempt to play the next song on audio `ended`
- non-looping queue boundaries
- explicit user-facing messages for:
  - no queue
  - first-song boundary
  - last-song boundary
  - next-song URL/playback failure

This stage explicitly excludes:

- login
- search
- lyrics
- random play
- loop mode settings
- new backend endpoints
- website frontend changes
- React or TSX migration
- project-wide refactors

## Proposed Approach

### Queue Ownership

Place queue state inside `playback-controller.ts`, not `main.ts`. The controller already owns:

- current song playback
- song URL resolution before playback
- audio events such as `play`, `pause`, `ended`, and `error`

So it is the narrowest place to own:

- `playlistSongs`
- `currentSongIndex`
- `currentSong`
- `isPlaying`
- queue navigation methods

`main.ts` remains a DOM and event-wiring layer that feeds songs into the controller and refreshes visible UI after controller state changes.

### Queue Behavior

The queue is non-looping.

- `setQueue(songs)` stores the imported songs as the active queue
- clicking a song sets `currentSongIndex` to that row and starts playback
- `playNext()`:
  - if no queue, show `请先导入歌单`
  - if queue exists but no current index, play the first song
  - if current index is the last row, show `已经是最后一首`
  - otherwise move to the next index and play it
- `playPrevious()`:
  - if no queue, show `请先导入歌单`
  - if queue exists but no current index, play the first song
  - if current index is the first row, show `已经是第一首`
  - otherwise move to the previous index and play it

### Automatic Next On Ended

Reuse the existing audio `ended` event in the controller.

- if the queue has a following song, automatically call the next-index playback path once
- if the current song is already the last song, stop at the end and show `播放结束` or fall back to the paused state
- do not loop
- do not retry endlessly if the next song fails to resolve or play

This keeps automatic next behavior in the same place that already reacts to audio events.

### UI Integration

Add two small queue buttons near the current-song and playback status area:

- `上一首`
- `下一首`

The playlist panel stays below the pet. The queue buttons also live inside the visible panel column, so they receive normal pointer events without affecting transparent hit areas.

The playlist list keeps the active-row highlight from stage 6, but stage 7 makes it authoritative by syncing it with the controller's `currentSongIndex`.

### Interaction Boundaries

Keep `bindPetWindowInteractions(...)` bound only to the pet surface. The queue buttons, input field, import button, and playlist rows stay outside that binding, so:

- they do not start a drag session
- they do not trigger pet-click play/pause
- they do not affect right-click exit

### Error Handling

Boundary and queue-state messages are controller-owned:

- `请先导入歌单`
- `已经是第一首`
- `已经是最后一首`
- next-song playback failures

Playback errors continue using the existing stage/error UI slot. The controller remains responsible for showing those messages and keeping the app from crashing.

## File Plan

- `apps/desktop-pet/src/App.ts`
  Add queue button hooks while preserving the existing playlist input, current-song label, status label, and playlist list hooks.
- `apps/desktop-pet/src/main.ts`
  After playlist import, call `setQueue(...)`; wire `上一首` / `下一首` button clicks; keep song-list click playback; refresh current-song label and active-row highlight whenever controller state changes.
- `apps/desktop-pet/src/playback-controller.ts`
  Add queue ownership, `setQueue`, `playSongAtIndex`, `playNext`, `playPrevious`, and one-shot `ended` handling without breaking stage 6 playback behavior.
- `apps/desktop-pet/src/playback-controller.test.ts`
  Verify queue state, index updates, boundary messages, and automatic next behavior.
- `apps/desktop-pet/src/style.css`
  Add queue button styles and keep active-song highlight clear without expanding transparent click areas.
- `apps/desktop-pet/src/App.test.ts`
  Verify the new queue button hooks exist.

## Risks And Mitigations

- automatic next triggers infinite retries
  Only call the next-index playback path once per `ended`; if URL resolution or playback fails, show an error and stop.
- queue state and list highlight drift apart
  Expose controller getters for current song and index, and rerender highlight from those values after every queue action.
- queue buttons interfere with drag behavior
  Keep drag binding exclusive to `data-pet-surface`; queue buttons remain ordinary panel controls.
- boundary behavior feels inconsistent
  Use explicit, fixed non-looping messages for both first and last song edges.

## Verification

Stage 7 is complete when all of the following are true:

1. Importing a playlist stores an internal playback queue.
2. Clicking a song stores the correct current index and current song.
3. The current song name renders correctly in the UI.
4. The current song row is clearly highlighted.
5. Clicking `下一首` plays the next queue song.
6. Clicking `上一首` plays the previous queue song.
7. Clicking `上一首` on the first song does not crash and shows a clear boundary message.
8. Clicking `下一首` on the last song does not crash and shows a clear boundary message.
9. When the current song ends and there is a next song, playback advances automatically.
10. When the current song ends on the last song, playback stops cleanly without looping.
11. If the next song fails to resolve a URL or fails to play, an error is shown and the app does not crash.
12. Pet click still only toggles play/pause for the current song.
13. Dragging still starts only from the pet surface and still uses the 4px threshold.
14. Right-click exit still only works on the pet surface.
15. Transparent, borderless, and always-on-top window behavior remain unchanged.
