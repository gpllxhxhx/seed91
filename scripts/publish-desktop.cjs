const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const downloadsDir = path.join(rootDir, 'frontend', 'downloads');
const packageJson = require(path.join(rootDir, 'package.json'));

function findInstaller() {
  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory does not exist. Run npm run desktop:build first.');
  }

  const installers = fs
    .readdirSync(distDir)
    .filter((file) => /^MusicPet-Setup-.+\.exe$/i.test(file))
    .map((file) => {
      const absolutePath = path.join(distDir, file);
      return { file, absolutePath, mtimeMs: fs.statSync(absolutePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!installers.length) {
    throw new Error('No MusicPet setup executable found in dist.');
  }

  return installers[0];
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

const installer = findInstaller();
fs.mkdirSync(downloadsDir, { recursive: true });

const targetPath = path.join(downloadsDir, installer.file);
fs.copyFileSync(installer.absolutePath, targetPath);

const metadata = {
  version: packageJson.version,
  platform: 'win32-x64',
  file: installer.file,
  sha256: sha256(targetPath),
  releaseDate: new Date().toISOString().slice(0, 10),
  notes: [
    '新增桌宠播放器首版',
    '支持桌面歌词',
    '支持播放/暂停/切歌',
  ],
};

fs.writeFileSync(path.join(downloadsDir, 'latest'), `${installer.file}\n`, 'utf-8');
fs.writeFileSync(path.join(downloadsDir, 'version.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
fs.writeFileSync(path.join(downloadsDir, `${installer.file}.sha256`), `${metadata.sha256}  ${installer.file}\n`, 'utf-8');

console.log(`Published ${installer.file} to ${path.relative(rootDir, downloadsDir)}`);
console.log(`SHA256 ${metadata.sha256}`);
