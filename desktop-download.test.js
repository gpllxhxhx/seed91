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

test('desktop download section shows the v0.1.0 Windows beta copy', () => {
  const html = read('frontend/index.html');

  assert.match(html, /下载 Windows 内测版 v0\.1\.0/);
  assert.match(
    html,
    /当前版本为桌宠音乐播放器 Windows 内测版，支持导入歌单、播放歌曲、上一首、下一首、桌宠拖动和右键退出。当前为免安装测试版，内测阶段可能存在兼容性问题。/
  );
});

test('publish script targets the stage-8 Tauri exe and portable beta output name', () => {
  const script = read('scripts/publish-desktop.cjs');

  assert.match(
    script,
    /apps[\\/]+desktop-pet[\\/]+src-tauri[\\/]+target[\\/]+release[\\/]+music-pet-desktop\.exe/
  );
  assert.match(script, /desktop-pet-player-v0\.1\.0-windows\.exe/);
  assert.doesNotMatch(script, /MusicPet-Setup-/);
});

test('desktop download page uses portable beta metadata wording', () => {
  const appSource = read('frontend/js/app.js');

  assert.match(appSource, /\/downloads\/version\.json/);
  assert.match(appSource, /desktop-pet-player-v0\.1\.0-windows\.exe/);
  assert.match(appSource, /免安装/);
  assert.doesNotMatch(appSource, /安装包元数据/);
});

test('desktop download html does not present the portable exe as an installer', () => {
  const html = read('frontend/index.html');

  assert.doesNotMatch(html, /测试版安装包/);
  assert.match(html, /未做代码签名/);
});

test('published desktop metadata points to the portable windows beta exe', () => {
  const version = JSON.parse(read('frontend/downloads/version.json'));

  assert.equal(version.version, '0.1.0');
  assert.equal(version.file, 'desktop-pet-player-v0.1.0-windows.exe');
  assert.equal(version.channel, 'beta');
  assert.equal(version.portable, true);
});
