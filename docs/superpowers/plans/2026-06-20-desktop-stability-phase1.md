# Desktop Stability Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the current Electron desktop player with daily local logging, safer startup/runtime error handling, persistent user config in appData, and minimal-intrusion playback/import state persistence without changing the existing UI or core feature flow.

**Architecture:** Keep the current Electron main-process + preload + frontend structure intact. Extend the existing `desktop/main/services/logger.cjs` and `config-store.cjs`, add narrowly scoped IPC bridges in `desktop/preload/player-preload.cjs`, and teach the current frontend scripts to report errors and persist compatible state both to existing `localStorage` and the new desktop config store.

**Tech Stack:** Electron 33, CommonJS, browser JavaScript, Node test runner, built-in `fs`/`path`/`screen`/`ipcMain`

## Global Constraints

- This phase only covers logging, error fallback, user state persistence, and baseline stability checks.
- Do not rewrite the project architecture.
- Do not remove existing features.
- Do not redesign the current UI or animations.
- Do not introduce heavy dependencies.
- Keep existing `localStorage` logic and add desktop persistence as a compatibility enhancement.
- Do not auto-play music on startup unless the current app already does so.
- Do not scatter API base URL handling across new files.
- All new names and IPC channels must be explicit and readable.

---
