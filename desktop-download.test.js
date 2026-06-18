const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
}

test('desktop download page reads releaseDate metadata instead of releasedAt', () => {
  const appSource = read('frontend/js/app.js');

  assert.match(appSource, /meta\.releaseDate/);
  assert.doesNotMatch(appSource, /meta\.releasedAt/);
});

test('desktop download section is framed as the pet desktop test build', () => {
  const html = read('frontend/index.html');

  assert.match(html, /桌宠桌面版下载/);
  assert.match(html, /测试版/);
  assert.match(html, /Windows x64/);
});
