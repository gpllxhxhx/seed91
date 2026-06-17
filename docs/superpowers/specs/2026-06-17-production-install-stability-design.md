# Production Install Stability Design

**Goal:** Make the API package install cleanly in production environments that omit development dependencies, while keeping local development hooks available when `husky` is installed.

## Problem

The API package at `NeteaseCloudMusicApiEnhanced/package.json` declares `prepare: "husky install"`. Production installs on the server use `npm install --omit=dev`, so `husky` is not present. `npm` still runs `prepare`, which makes installation fail before the service can start.

## Proposed Approach

1. Replace the direct `husky install` call with a small Node script that checks whether `husky` is resolvable before trying to run it.
2. Keep the behavior unchanged for developer machines where `husky` is installed.
3. Update the deployment documentation so the server install and update flow matches the guarded behavior and includes a quick verification step for `music-api`.

## Constraints

- Do not change runtime business logic for the web app or API.
- Do not require development dependencies in production.
- Keep the deployment commands simple enough to run manually on the server.

## Verification

- Add a regression test for the prepare guard script covering:
  - no `husky` present: exits successfully
  - fake `husky` module present: attempts to execute it
- Verify the deployment docs reference the stable install flow and service verification commands.
