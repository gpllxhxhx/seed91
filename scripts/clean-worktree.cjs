#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

const PROTECTED_PREFIXES = [
  '.git',
  'archive',
  'apps/desktop-pet/src',
  'apps/desktop-pet/src/assets',
  'apps/desktop-pet/src/assets/skins',
  'apps/desktop-pet/src-tauri/src',
  'desktop',
  'frontend',
  'NeteaseCloudMusicApiEnhanced',
];

const CLEANABLE_DIRECTORIES = [
  'dist',
  'build',
  'out',
  '.vite',
  '.turbo',
  'coverage',
  'logs',
  '.cache',
  '.parcel-cache',
  'apps/desktop-pet/dist',
  'apps/desktop-pet/.vite',
  'apps/desktop-pet/.cache',
  'apps/desktop-pet/coverage',
  'apps/desktop-pet/src-tauri/target',
];

const NODE_MODULE_DIRECTORIES = [
  'node_modules',
  'apps/desktop-pet/node_modules',
  'NeteaseCloudMusicApiEnhanced/node_modules',
];

const SKIP_TRAVERSAL_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'build',
  'out',
]);

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function toRelativePath(absolutePath, baseDir = rootDir) {
  return normalizeRelativePath(path.relative(baseDir, absolutePath));
}

function toAbsolutePath(baseDir, relativePath) {
  return path.join(baseDir, ...normalizeRelativePath(relativePath).split('/'));
}

function pathExists(baseDir, relativePath) {
  return fs.existsSync(toAbsolutePath(baseDir, relativePath));
}

function isSameOrInsidePath(relativePath, prefix) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedPrefix = normalizeRelativePath(prefix);

  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function isProtectedPath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);

  return PROTECTED_PREFIXES.some((prefix) => isSameOrInsidePath(normalizedPath, prefix));
}

function isTrackedOrInsideTracked(relativePath, trackedPaths) {
  const normalizedPath = normalizeRelativePath(relativePath);

  if (trackedPaths.has(normalizedPath)) {
    return true;
  }

  for (const trackedPath of trackedPaths) {
    if (isSameOrInsidePath(trackedPath, normalizedPath)) {
      return true;
    }
  }

  return false;
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return `Git command failed: git ${args.join(' ')}\n${error.stderr || error.message}`;
  }
}

function parseGitCleanPreview(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Would remove '))
    .map((line) => normalizeRelativePath(line.slice('Would remove '.length)))
    .filter(Boolean);
}

function getTrackedPaths(cwd = rootDir) {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return new Set(
      output
        .split('\0')
        .filter(Boolean)
        .map(normalizeRelativePath),
    );
  } catch {
    return new Set();
  }
}

function addGitPreviewManualItems(plan, previewOutput, sourceLabel) {
  const seenCleanablePaths = new Set(plan.cleanableItems.map((item) => item.relativePath));
  const seenManualPaths = new Set(plan.manualReviewItems.map((item) => item.relativePath));

  for (const relativePath of parseGitCleanPreview(previewOutput)) {
    if (!pathExists(plan.rootDir, relativePath)) {
      continue;
    }

    let isAlreadyCovered = false;
    for (const cleanablePath of seenCleanablePaths) {
      if (isSameOrInsidePath(relativePath, cleanablePath)) {
        isAlreadyCovered = true;
        break;
      }
    }

    if (isAlreadyCovered) {
      continue;
    }

    addUniqueItem(plan.manualReviewItems, seenManualPaths, {
      ...createItem(plan.rootDir, relativePath, `${sourceLabel}; not in cleanup whitelist`),
    });
  }

  plan.manualReviewItems.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function createItem(baseDir, relativePath, reason) {
  const absolutePath = toAbsolutePath(baseDir, relativePath);
  const stats = fs.statSync(absolutePath);

  return {
    relativePath: normalizeRelativePath(relativePath),
    absolutePath,
    type: stats.isDirectory() ? 'directory' : 'file',
    reason,
  };
}

function shouldCleanFileName(fileName) {
  const lowerName = fileName.toLowerCase();

  return (
    lowerName === '.ds_store' ||
    lowerName === 'thumbs.db' ||
    lowerName === '.eslintcache' ||
    lowerName === '.stylelintcache' ||
    lowerName.endsWith('.log') ||
    lowerName.startsWith('npm-debug.log') ||
    lowerName.startsWith('yarn-debug.log') ||
    lowerName.startsWith('yarn-error.log') ||
    lowerName.startsWith('pnpm-debug.log') ||
    lowerName.endsWith('.tmp') ||
    lowerName.endsWith('.temp') ||
    lowerName.endsWith('.bak') ||
    lowerName.endsWith('.old') ||
    lowerName.endsWith('.backup') ||
    lowerName.endsWith('.swp')
  );
}

function walkFiles(baseDir, currentDir, visitor) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = toRelativePath(absolutePath, baseDir);

    if (entry.isDirectory()) {
      if (!SKIP_TRAVERSAL_DIRECTORIES.has(entry.name)) {
        walkFiles(baseDir, absolutePath, visitor);
      }
      continue;
    }

    visitor(relativePath, entry.name);
  }
}

function addUniqueItem(items, seenPaths, item) {
  for (const seenPath of seenPaths) {
    if (isSameOrInsidePath(item.relativePath, seenPath)) {
      return;
    }
  }

  if (seenPaths.has(item.relativePath)) {
    return;
  }

  seenPaths.add(item.relativePath);
  items.push(item);
}

function classifyCandidate({
  baseDir,
  relativePath,
  reason,
  trackedPaths,
  cleanableItems,
  manualReviewItems,
  seenCleanablePaths,
  seenManualPaths,
  allowProtectedPath = false,
}) {
  const normalizedPath = normalizeRelativePath(relativePath);

  if (!pathExists(baseDir, normalizedPath)) {
    return;
  }

  const item = createItem(baseDir, normalizedPath, reason);

  if (isTrackedOrInsideTracked(normalizedPath, trackedPaths)) {
    addUniqueItem(manualReviewItems, seenManualPaths, {
      ...item,
      reason: `${reason}; skipped because it is Git tracked`,
    });
    return;
  }

  if (!allowProtectedPath && isProtectedPath(normalizedPath)) {
    addUniqueItem(manualReviewItems, seenManualPaths, {
      ...item,
      reason: `${reason}; skipped because it is protected`,
    });
    return;
  }

  addUniqueItem(cleanableItems, seenCleanablePaths, item);
}

function createCleanupPlan(options = {}) {
  const baseDir = options.rootDir ? path.resolve(options.rootDir) : rootDir;
  const trackedPaths = options.trackedPaths ?? getTrackedPaths(baseDir);
  const includeNodeModules = options.includeNodeModules === true;
  const cleanableItems = [];
  const manualReviewItems = [];
  const seenCleanablePaths = new Set();
  const seenManualPaths = new Set();

  for (const relativePath of CLEANABLE_DIRECTORIES) {
    classifyCandidate({
      baseDir,
      relativePath,
      reason: 'whitelisted build/cache/log directory',
      trackedPaths,
      cleanableItems,
      manualReviewItems,
      seenCleanablePaths,
      seenManualPaths,
    });
  }

  for (const relativePath of NODE_MODULE_DIRECTORIES) {
    if (!pathExists(baseDir, relativePath)) {
      continue;
    }

    if (!includeNodeModules) {
      addUniqueItem(manualReviewItems, seenManualPaths, {
        ...createItem(baseDir, relativePath, 'node_modules requires --include-node-modules'),
      });
      continue;
    }

    classifyCandidate({
      baseDir,
      relativePath,
      reason: 'node_modules requested by --include-node-modules',
      trackedPaths,
      cleanableItems,
      manualReviewItems,
      seenCleanablePaths,
      seenManualPaths,
      allowProtectedPath: true,
    });
  }

  walkFiles(baseDir, baseDir, (relativePath, fileName) => {
    if (!shouldCleanFileName(fileName)) {
      return;
    }

    classifyCandidate({
      baseDir,
      relativePath,
      reason: 'whitelisted temporary/log file pattern',
      trackedPaths,
      cleanableItems,
      manualReviewItems,
      seenCleanablePaths,
      seenManualPaths,
    });
  });

  return {
    rootDir: baseDir,
    cleanableItems: cleanableItems.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    manualReviewItems: manualReviewItems.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
  };
}

function removeItem(item) {
  fs.rmSync(item.absolutePath, {
    force: true,
    recursive: item.type === 'directory',
  });
}

function parseArgs(argv) {
  const flags = new Set(argv);

  return {
    apply: flags.has('--apply'),
    dryRun: flags.has('--dry-run') || !flags.has('--apply'),
    help: flags.has('--help') || flags.has('-h'),
    includeNodeModules: flags.has('--include-node-modules'),
    report: flags.has('--report'),
  };
}

function printHelp() {
  console.log(`Usage:
  node scripts/clean-worktree.cjs
  node scripts/clean-worktree.cjs --dry-run
  node scripts/clean-worktree.cjs --apply
  node scripts/clean-worktree.cjs --apply --include-node-modules
  node scripts/clean-worktree.cjs --report

Default mode is a safe dry run. The script never runs git clean -fd or git clean -fdx.`);
}

function printItems(title, items) {
  console.log(`\n${title} (${items.length})`);

  if (items.length === 0) {
    console.log('  none');
    return;
  }

  for (const item of items) {
    console.log(`  - [${item.type}] ${item.relativePath} :: ${item.reason}`);
  }
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help) {
    printHelp();
    return 0;
  }

  const gitStatus = runGit(['status', '--short'], rootDir);
  const gitIgnoredPreview = runGit(['clean', '-ndX'], rootDir);
  const gitUntrackedPreview = runGit(['clean', '-nd'], rootDir);
  const plan = createCleanupPlan({
    includeNodeModules: args.includeNodeModules,
    rootDir,
  });
  addGitPreviewManualItems(plan, gitIgnoredPreview, 'git clean -ndX preview');
  addGitPreviewManualItems(plan, gitUntrackedPreview, 'git clean -nd preview');
  const deletedItems = [];
  const failedItems = [];

  console.log('Safe worktree cleanup');
  console.log(`Root: ${rootDir}`);
  console.log(`Mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`Include node_modules: ${args.includeNodeModules ? 'yes' : 'no'}`);
  console.log('\nGit status --short');
  console.log(gitStatus || '  clean');

  if (args.report) {
    console.log('\nGit ignored preview: git clean -ndX');
    console.log(gitIgnoredPreview || '  none');
    console.log('\nGit untracked preview: git clean -nd');
    console.log(gitUntrackedPreview || '  none');
  }

  printItems('Cleanable whitelist items', plan.cleanableItems);
  printItems('Manual review only', plan.manualReviewItems);

  if (args.apply) {
    console.log('\nApplying cleanup');
    for (const item of plan.cleanableItems) {
      try {
        removeItem(item);
        deletedItems.push(item);
        console.log(`  removed ${item.relativePath}`);
      } catch (error) {
        failedItems.push({
          item,
          error,
        });
        console.log(`  failed ${item.relativePath}: ${error.message}`);
      }
    }
  } else {
    console.log('\nNo files were deleted. Re-run with --apply after reviewing the list.');
  }

  console.log('\nSummary');
  console.log(`  cleanable detected: ${plan.cleanableItems.length}`);
  console.log(`  deleted: ${deletedItems.length}`);
  console.log(`  skipped/manual review: ${plan.manualReviewItems.length}`);
  console.log(`  failed: ${failedItems.length}`);

  return failedItems.length > 0 ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  createCleanupPlan,
  isProtectedPath,
  parseArgs,
  parseGitCleanPreview,
  shouldCleanFileName,
};
