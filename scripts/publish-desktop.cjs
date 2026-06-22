const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'frontend', 'downloads');
const packageJson = require(path.join(rootDir, 'package.json'));
const tauriReleaseRelativePath = 'apps/desktop-pet/src-tauri/target/release/music-pet-desktop.exe';
const tauriReleaseExe = path.join(rootDir, tauriReleaseRelativePath);
const publishedFileName = 'desktop-pet-player-v0.1.0-windows.exe';

function getReleaseExecutable() {
  if (!fs.existsSync(tauriReleaseExe)) {
    throw new Error(
      'Tauri release executable does not exist. Run npm run desktop:build from the repository root first.'
    );
  }

  return {
    file: publishedFileName,
    absolutePath: tauriReleaseExe,
  };
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getLocalReleaseDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const executable = getReleaseExecutable();
fs.mkdirSync(downloadsDir, { recursive: true });

const targetPath = path.join(downloadsDir, executable.file);
fs.copyFileSync(executable.absolutePath, targetPath);

const metadata = {
  version: packageJson.version,
  platform: 'win32-x64',
  channel: 'beta',
  portable: true,
  file: executable.file,
  sha256: sha256(targetPath),
  releaseDate: getLocalReleaseDate(),
  notes: [
    '桌宠音乐播放器 Windows 内测版',
    '支持导入歌单与歌曲播放',
    '支持上一首、下一首、桌宠拖动和右键退出',
  ],
};

fs.writeFileSync(path.join(downloadsDir, 'latest'), `${executable.file}\n`, 'utf-8');
fs.writeFileSync(path.join(downloadsDir, 'version.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
fs.writeFileSync(
  path.join(downloadsDir, `${executable.file}.sha256`),
  `${metadata.sha256}  ${executable.file}\n`,
  'utf-8'
);

console.log(`Published ${executable.file} to ${path.relative(rootDir, downloadsDir)}`);
console.log(`SHA256 ${metadata.sha256}`);
