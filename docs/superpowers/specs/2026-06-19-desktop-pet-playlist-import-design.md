# Desktop Pet Playlist Import Design

**Goal:** Extend `apps/desktop-pet` so the desktop pet can import one Netease playlist by ID or link, render the playlist songs in a small panel below the pet, and play the clicked song through the existing `/song/url/v1` flow.

## Problem

Stage 5 already proves the desktop pet can fetch one song URL from the backend and play it without breaking transparency, dragging, or right-click exit. Stage 6 needs the next narrow slice: user-provided playlist input, playlist detail fetching, song list rendering, and click-to-play for any song in that list. The new UI must fit the transparent desktop-pet shell rather than turning into a full music app window.

## Scope

This stage includes only:

- One compact playlist import panel under the pet
- One input field for a playlist ID or Netease playlist link
- One import button
- One playlist title area
- One scrollable song list
- One current-song label near the pet status
- Playlist ID parsing for:
  - pure numeric IDs
  - `https://music.163.com/#/playlist?id=...`
  - `https://music.163.com/playlist?id=...`
  - `https://y.music.163.com/m/playlist?id=...`
- Backend request to `/playlist/detail?id=...`
- Song click playback using `/song/url/v1?id=歌曲ID&level=exhigh&unblock=true`
- Explicit loading, empty, parse-failure, request-failure, and playback-failure feedback

This stage explicitly excludes:

- Login
- Search
- Lyrics
- Auto-next
- Account sync
- New backend endpoints
- Website frontend changes
- React or TSX migration
- Project-wide refactors

## Proposed Approach

### Window And Layout

Keep the current single-window Tauri shell and place a compact panel directly below the pet image. The panel stays inside the same centered column so the window can grow mostly downward instead of creating wide transparent margins to the left and right. The Tauri window can be increased moderately in height and slightly in width, but should still feel like a desktop-pet shell instead of a normal application window.

The root container remains non-interactive by default, and only the visible pet surface plus the visible panel receive pointer events. This preserves the stage 2 transparent hit-testing behavior.

### Playlist Input And Parsing

Add a small resolver dedicated to playlist input. It will:

- trim the raw input
- accept pure digits as the playlist ID directly
- extract `id=` from supported Netease links
- throw a user-facing `无法解析歌单 ID` error when parsing fails

This logic lives in a new `playlist-resolver.ts` module so it stays testable and separate from DOM code.

### Playlist Fetching

Request the existing backend endpoint:

- `GET {VITE_MUSIC_API_BASE}/playlist/detail?id=歌单ID`

Parse the response from the common Netease structure:

```json
{
  "playlist": {
    "name": "歌单名称",
    "tracks": [
      {
        "id": 123,
        "name": "歌曲名",
        "ar": [{ "name": "歌手名" }],
        "al": { "name": "专辑名" }
      }
    ]
  }
}
```

Normalize each entry into:

```ts
type PlaylistSong = {
  id: number;
  name: string;
  artists: string;
  album?: string;
};
```

If the backend responds successfully but the list is empty, the UI shows a clear `歌单为空` message instead of silently rendering nothing.

### Playback Integration

Reuse the stage 5 song URL flow instead of creating a second playback path. The current song URL resolver becomes song-ID based instead of fixed to one test song. The playback controller becomes track-aware:

- it keeps a current song identity and display name
- pet click still toggles play/pause for the current song
- clicking a playlist song switches the current song, requests that song's URL, and starts playback
- resumed playback uses the cached URL for the currently selected song only

The URL extraction priority remains unchanged:

1. `data[0].proxyUrl`
2. `data[0].url`
3. top-level `url`

### Interaction Boundaries

Only the pet surface keeps desktop-pet window interactions:

- left-click on the pet surface: play/pause current song
- drag starting from the pet surface: move window with the same 4px threshold
- right-click on the pet surface: close window

The playlist panel is a separate interactive zone:

- input click, typing, selection, and focus stay local to the panel
- import button click triggers only import
- song list click triggers only song selection/playback
- scrolling the list must not start a window drag

No panel events are bound through `bindPetWindowInteractions`, so the panel will not accidentally enter the drag session.

## File Plan

- `apps/desktop-pet/src/App.ts`
  Add the playlist input area, playlist title slot, current song label, loading slot, empty state, and song list container while keeping the pet surface and playback status hooks intact.
- `apps/desktop-pet/src/main.ts`
  Wire the playlist form submit flow, the song-list click flow, the current-song updates, and the existing pet interaction callbacks.
- `apps/desktop-pet/src/playback-controller.ts`
  Extend the controller from fixed-song behavior to selected-song behavior without breaking stage 5 play/pause/error handling.
- `apps/desktop-pet/src/song-url-resolver.ts`
  Change the resolver from fixed test-song configuration to a reusable song-ID based resolver.
- `apps/desktop-pet/src/playlist-resolver.ts`
  New desktop-only helper for playlist ID parsing, backend fetching, and `PlaylistSong` normalization.
- `apps/desktop-pet/src/style.css`
  Add compact panel styling, keep the panel directly below the pet, and preserve transparent background plus limited interactive hit areas.
- `apps/desktop-pet/src-tauri/tauri.conf.json`
  Increase the window size moderately to fit the new below-pet panel without creating a large transparent canvas.
- `apps/desktop-pet/src/App.test.ts`
  Verify the playlist panel hooks are rendered.
- `apps/desktop-pet/src/playlist-resolver.test.ts`
  Verify ID parsing, playlist response normalization, empty list handling, and error cases.
- `apps/desktop-pet/src/playback-controller.test.ts`
  Verify selecting a playlist song updates the current song and playback flow while preserving pause/resume and failure states.
- `apps/desktop-pet/src/song-url-resolver.test.ts`
  Verify the song URL resolver still applies the same response priority with arbitrary song IDs.

## Risks And Mitigations

- Panel clicks accidentally drag the window
  Keep drag binding exclusive to the pet surface and do not attach `bindPetWindowInteractions` to the panel.
- The panel makes the transparent window too large
  Expand mostly downward and keep the panel width close to the pet width.
- Playback controller becomes tangled
  Keep playlist parsing, song URL fetching, and playback state in separate modules with narrow interfaces.
- Playlist API succeeds but returns no visible songs
  Detect an empty normalized list and show `歌单为空`.
- Song switching breaks stage 5 pause/resume
  Add controller tests that cover switching songs, toggling the current song, and replay after selection.

## Verification

Stage 6 is complete when all of the following are true:

1. The desktop app shows a playlist input below the pet.
2. Entering a numeric playlist ID imports the playlist.
3. Entering a supported Netease playlist link imports the playlist.
4. Invalid input shows `无法解析歌单 ID`.
5. The app requests `/playlist/detail?id=...` and renders the playlist name plus song list.
6. Each visible song row shows at least the song name.
7. Clicking a song requests `/song/url/v1?id=歌曲ID&level=exhigh&unblock=true`.
8. The clicked song starts playback and becomes the current song shown in the UI.
9. Empty playlists show a clear empty-state message.
10. Request failures and playback failures show clear error messages without crashing.
11. Pet click still only toggles the current song play/pause state.
12. Dragging still starts only from the pet surface and still uses the 4px threshold.
13. Right-click exit still only works on the pet surface.
14. Transparent, borderless, always-on-top behavior remains unchanged.
15. Closing the window or right-click exiting does not create new runtime errors in the terminal.
