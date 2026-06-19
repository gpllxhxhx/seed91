# Desktop Pet Backend Song URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `apps/desktop-pet` fetch one fixed test song URL from the existing backend `/song/url/v1` endpoint and play that returned URL without breaking stage 2, 3, or 4 behaviors.

**Architecture:** Keep the current Tauri window and pointer interaction logic intact. Add one small desktop-only song URL resolver that reads `VITE_MUSIC_API_BASE`, requests `/song/url/v1?id=1496089152&level=exhigh&unblock=true`, extracts `proxyUrl` or `url`, and hands that URL to the existing playback controller, which will own loading, invalid-URL, and playback error UI states.

**Tech Stack:** Tauri 2, Vite, TypeScript, Vitest, HTMLAudioElement, Fetch API

## Global Constraints

- Only modify desktop-side files under `apps/desktop-pet` plus planning docs under `docs/superpowers/`.
- Do not modify website frontend code.
- Do not modify backend code.
- Do not add playlists, search, login, auto-next, desktop lyrics, or complex player UI.
- Do not refactor the whole project.
- First click must request the backend only when no song URL has been cached yet.
- Subsequent clicks must only pause and resume without re-requesting the backend URL.
- Request failure, empty URL, invalid URL, and playback failure must show visible error feedback.
- Failure must not switch the UI into `播放中`.
- Dragging still requires movement greater than 4px and must not trigger requests or playback.
- Right-click exit must remain independent from playback logic.
- Transparent, borderless, always-on-top behavior must remain unchanged.

---

### Task 1: Add backend song URL resolver tests and implementation

**Files:**
- Create: `apps/desktop-pet/src/song-url-resolver.ts`
- Create: `apps/desktop-pet/src/song-url-resolver.test.ts`

**Interfaces:**
- Consumes: `fetch`, `VITE_MUSIC_API_BASE`, fixed test song id `1496089152`
- Produces: `createSongUrlResolver(options): () => Promise<string>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createSongUrlResolver } from "./song-url-resolver";

describe("createSongUrlResolver", () => {
  it("prefers proxyUrl from /song/url/v1 responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ proxyUrl: "https://example.com/proxy.mp3", url: "https://example.com/original.mp3" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const resolveSongUrl = createSongUrlResolver({
      apiBase: "http://127.0.0.1:3000",
      songId: "1496089152",
      fetchImpl
    });

    await expect(resolveSongUrl()).resolves.toBe("https://example.com/proxy.mp3");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/song/url/v1?id=1496089152&level=exhigh&unblock=true",
      expect.objectContaining({ cache: "no-store", method: "GET" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- song-url-resolver.test.ts`  
Expected: FAIL because `song-url-resolver.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
type FetchLike = typeof fetch;

type SongUrlResolverOptions = {
  apiBase: string;
  songId: string;
  fetchImpl?: FetchLike;
};

export function createSongUrlResolver(options: SongUrlResolverOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (): Promise<string> => {
    const url = new URL("/song/url/v1", `${options.apiBase.replace(/\/+$/, "")}/`);
    url.searchParams.set("id", options.songId);
    url.searchParams.set("level", "exhigh");
    url.searchParams.set("unblock", "true");

    const response = await fetchImpl(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    const body = await response.json();
    return body?.data?.[0]?.proxyUrl || body?.data?.[0]?.url || body?.url || "";
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- song-url-resolver.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/song-url-resolver.ts apps/desktop-pet/src/song-url-resolver.test.ts
git commit -m "feat: add desktop song url resolver"
```

### Task 2: Upgrade playback controller for request, validation, and playback errors

**Files:**
- Modify: `apps/desktop-pet/src/playback-controller.ts`
- Modify: `apps/desktop-pet/src/playback-controller.test.ts`

**Interfaces:**
- Consumes: `resolveSongUrl(): Promise<string>`, `AudioLike`
- Produces: `createPlaybackController(audio, refs, options)` with `togglePlayback(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
it("requests the song url only once and reuses it for resume", async () => {
  const audio = new FakeAudio();
  const refs = createPlaybackRefs();
  const resolveSongUrl = vi.fn(async () => "https://example.com/song.mp3");
  const controller = createPlaybackController(audio, refs, { resolveSongUrl });

  await controller.togglePlayback();
  await controller.togglePlayback();
  await controller.togglePlayback();

  expect(resolveSongUrl).toHaveBeenCalledTimes(1);
  expect(audio.src).toBe("https://example.com/song.mp3");
  expect(refs.stage.dataset.playbackState).toBe("playing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- playback-controller.test.ts`  
Expected: FAIL because the current controller has no resolver support and still assumes `/audio/test-song.mp3`.

- [ ] **Step 3: Write minimal implementation**

Update the controller so it:
- sets `正在请求歌曲` while fetching the first URL
- caches the first successful URL
- validates that the returned URL is non-empty and `http:` or `https:`
- uses `audio.src = resolvedUrl` before `audio.play()`
- keeps `已暂停` on request failure, empty URL, invalid URL, or `play()` rejection

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- playback-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/playback-controller.ts apps/desktop-pet/src/playback-controller.test.ts
git commit -m "feat: add backend url playback controller flow"
```

### Task 3: Wire the desktop renderer to the backend URL flow

**Files:**
- Modify: `apps/desktop-pet/src/main.ts`
- Modify: `apps/desktop-pet/src/style.css`
- Create: `apps/desktop-pet/.env.example`

**Interfaces:**
- Consumes: `createSongUrlResolver(...)`, `createPlaybackController(...)`, existing `bindPetWindowInteractions(...)`
- Produces: desktop renderer bootstrapping that fetches song URLs from `VITE_MUSIC_API_BASE`

- [ ] **Step 1: Write the failing test**

```ts
it("shows loading and request errors without changing the drag threshold logic", async () => {
  const audio = new FakeAudio();
  const refs = createPlaybackRefs();
  const controller = createPlaybackController(audio, refs, {
    resolveSongUrl: async () => {
      throw new Error("请求失败：HTTP 404");
    }
  });

  const pending = controller.togglePlayback();
  expect(refs.status.textContent).toBe("正在请求歌曲");

  await pending;

  expect(refs.stage.dataset.playbackState).toBe("paused");
  expect(refs.error.textContent).toBe("请求失败：HTTP 404");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- playback-controller.test.ts`  
Expected: FAIL until loading and request-error UI states are implemented.

- [ ] **Step 3: Write minimal implementation**

- In `main.ts`, read `import.meta.env.VITE_MUSIC_API_BASE`
- create the resolver with fixed song id `1496089152`
- pass that resolver into the playback controller
- keep existing drag and right-click binding unchanged
- add `.env.example` with `VITE_MUSIC_API_BASE=http://127.0.0.1:3000`
- add loading-state styling in `style.css` without changing pointer-event boundaries

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- playback-controller.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet/src/main.ts apps/desktop-pet/src/style.css apps/desktop-pet/.env.example
git commit -m "feat: fetch desktop test song from backend"
```

### Task 4: Verify stage 5 end to end

**Files:**
- Reuse: `apps/desktop-pet/src/song-url-resolver.test.ts`
- Reuse: `apps/desktop-pet/src/playback-controller.test.ts`
- Reuse: `apps/desktop-pet/src/pet-window.test.ts`

**Interfaces:**
- Consumes: resolver, playback controller, existing pointer interaction logic
- Produces: reproducible verification evidence for phase 5

- [ ] **Step 1: Run the focused desktop test suite**

Run: `npm run test -- src/song-url-resolver.test.ts src/playback-controller.test.ts src/pet-window.test.ts`  
Expected: PASS.

- [ ] **Step 2: Run the full desktop test suite**

Run: `npm run test`  
Expected: PASS.

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`  
Expected: PASS.

- [ ] **Step 4: Run the native validation build**

Run: `cargo check`  
Working directory: `apps/desktop-pet/src-tauri`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-pet docs/superpowers/plans/2026-06-19-desktop-pet-backend-song-url.md
git commit -m "test: verify desktop pet backend song url flow"
```
