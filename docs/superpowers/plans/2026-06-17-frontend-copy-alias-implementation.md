# Frontend Copy Alias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `网易云` from user-visible frontend copy and replace user-visible `解灰` wording with `音源补全` in the frontend source.

**Architecture:** Add one regression test that scans the frontend source files containing user-visible copy, then make the minimal copy edits in those files until the test and a direct search both pass. Keep all runtime identifiers, source keys, and API field names unchanged so only visible wording changes.

**Tech Stack:** Node.js built-in test runner, static HTML, browser-side JavaScript

## Global Constraints

- Only edit the frontend source under `frontend/`.
- Do not modify packaged build output under `dist/`.
- Do not change application behavior, request flow, or data structures.
- Only replace strings that are user-visible in the frontend UI or frontend-thrown messages.

---

### Task 1: Add Copy Regression Test

**Files:**
- Create: `frontend-copy.test.js`

**Interfaces:**
- Consumes: `node:assert/strict`, `node:test`, `node:fs`, `node:path`
- Produces: `frontend-copy.test.js` runnable with `node --test frontend-copy.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const files = [
  'frontend/index.html',
  'frontend/js/app.js',
  'frontend/js/api.js',
];

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

test('frontend copy removes 网易云 and rewrites 解灰 to 音源补全', () => {
  const combined = files.map(read).join('\n');

  assert.equal(combined.includes('网易云'), false);
  assert.equal(combined.includes('解灰'), false);
  assert.match(combined, /音源补全/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend-copy.test.js`
Expected: FAIL because current frontend source still contains `网易云` and `解灰`

- [ ] **Step 3: Keep the test as the regression guard**

```js
test('frontend copy removes 网易云 and rewrites 解灰 to 音源补全', () => {
  const combined = files.map(read).join('\n');

  assert.equal(combined.includes('网易云'), false);
  assert.equal(combined.includes('解灰'), false);
  assert.match(combined, /音源补全/);
});
```

- [ ] **Step 4: Re-run this test after implementation**

Run: `node --test frontend-copy.test.js`
Expected: PASS

### Task 2: Update User-Visible Frontend Copy

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/app.js`
- Modify: `frontend/js/api.js`
- Test: `frontend-copy.test.js`

**Interfaces:**
- Consumes: The regression test from Task 1 and the existing UI text in the three frontend source files
- Produces: User-visible copy with no `网易云` mentions and `音源补全` replacing visible `解灰` wording

- [ ] **Step 1: Update the HTML copy**

```html
<p class="subtitle">新建一个歌单，或从歌单链接导入。</p>
<select id="player-quality-select" title="音源补全策略">
```

- [ ] **Step 2: Update visible labels in `frontend/js/app.js`**

```js
creatorName: playlist.source === 'netease' ? '导入歌单' : '本地',
document.getElementById('detail-source').textContent = playlist.source === 'netease' ? '导入歌单' : '本地歌单';
label: '导入歌单',
```

- [ ] **Step 3: Update visible messages and source labels in `frontend/js/api.js`**

```js
throw new Error(`无法连接 API 后端：${NCM_API_BASE}`);
if (!NCM_API_BASE) throw new Error('未配置 API 地址，请先设置 window.NCM_API_BASE');
if (isTrialAudioResponse(data)) throw new Error(`增强音源补全 ${level} 返回的是试听地址`);
if (!url) throw new Error(`增强音源补全 ${level} 未返回播放地址`);
source: `增强音源补全 ${level}`,
throw new Error('匹配音源补全返回的是试听地址');
source: '匹配音源补全',
qualities: [{ level: 'unblock', label: '音源补全决定', available: Boolean(audio.audio_url) }],
```

- [ ] **Step 4: Run the regression test**

Run: `node --test frontend-copy.test.js`
Expected: PASS

- [ ] **Step 5: Run a direct search as a second verification**

Run: `rg -n "解灰|网易云" frontend -S`
Expected: no matches
