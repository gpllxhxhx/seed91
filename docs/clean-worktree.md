# Safe Worktree Cleanup

This project includes a conservative cleanup helper for regular local maintenance.
It is designed for Windows-friendly Node.js usage and defaults to reporting only.

## Why Clean The Worktree

During desktop and frontend development, the repository can collect build outputs,
logs, cache folders, temporary files, and local release artifacts. These files make
`git status` noisy and can hide real source changes. The cleanup tool helps find
that noise without using dangerous broad commands such as `git clean -fdx`.

## Commands

Run commands from the repository root.

```powershell
npm run clean:check
npm run clean:dry
npm run clean:report
npm run clean:apply
npm run clean:node-modules
```

- `clean:check`: scans the tree and prints the safe cleanup plan. It does not delete files.
- `clean:dry`: same safe preview mode, useful when you want the command to be explicit.
- `clean:report`: includes Git reference output from `git status --short`, `git clean -ndX`, and `git clean -nd`.
- `clean:apply`: deletes only whitelisted, untracked, unprotected cleanup items.
- `clean:node-modules`: deletes normal cleanup items and explicitly includes `node_modules/`.

## What Can Be Cleaned

The script can clean common generated files and folders when they are not tracked
by Git and are not inside protected source/resource areas:

- Build output folders: `dist/`, `build/`, `out/`, `coverage/`, `apps/desktop-pet/dist/`.
- Tauri build cache: `apps/desktop-pet/src-tauri/target/`.
- Cache folders: `.vite/`, `.turbo/`, `.cache/`, `.parcel-cache/`.
- Log folders and files: `logs/`, `*.log`, `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `pnpm-debug.log*`.
- Temporary files: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.temp`, `*.bak`, `*.old`, `*.backup`, `*.swp`.

## What Will Not Be Cleaned

The script protects important project areas by default:

- `.git/`
- `apps/desktop-pet/src/`
- `apps/desktop-pet/src/assets/`
- `apps/desktop-pet/src/assets/skins/`
- `apps/desktop-pet/src-tauri/src/`
- `frontend/`
- `NeteaseCloudMusicApiEnhanced/`
- `desktop/`
- `archive/`

Git tracked files are never deleted. Unrecognized files are reported for manual
review instead of being deleted.

## Node Modules

`node_modules/` is not cleaned by default because reinstalling dependencies can
take time and may temporarily break local development until `npm install` runs.

Only use this command when you want a dependency reinstall:

```powershell
npm run clean:node-modules
```

After cleaning node modules, reinstall where needed:

```powershell
npm install
npm --prefix apps/desktop-pet install
```

## When Not To Clean

Do not run `clean:apply` if:

- You have not reviewed `clean:check` or `clean:dry`.
- You are unsure whether an item in the manual review section is important.
- A build, test, or Tauri process is still running.
- You have uncommitted source changes and have not checked `git status`.

## If Something Was Deleted By Mistake

Tracked files can be restored through Git because the cleanup tool does not delete
tracked files. Generated files can usually be recreated by running the relevant
build command:

```powershell
npm run desktop:build
```

If dependencies were removed, run `npm install` again.

## Recommended Routine

At the end of a development phase:

```powershell
npm run clean:check
npm run clean:dry
npm run clean:report
npm run clean:apply
git status --short
```

Review the output before using `clean:apply`. Treat anything listed under manual
review as a separate human decision, not as an automatic cleanup target.
