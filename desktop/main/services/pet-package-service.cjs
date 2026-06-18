const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REQUIRED_STATES = ['idle', 'hover', 'click', 'playing', 'paused', 'loading', 'error'];

function assertStateConfig(stateName, config) {
  if (!config || typeof config !== 'object') {
    throw new Error(`Pet manifest is missing state "${stateName}"`);
  }
  if (!Array.isArray(config.frames) || !config.frames.length) {
    throw new Error(`Pet manifest state "${stateName}" must define at least one frame`);
  }
  if (!Number.isFinite(Number(config.fps)) || Number(config.fps) <= 0) {
    throw new Error(`Pet manifest state "${stateName}" must define a positive fps`);
  }
  if (typeof config.loop !== 'boolean') {
    throw new Error(`Pet manifest state "${stateName}" must define a loop boolean`);
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Pet manifest must be an object');
  if (!manifest.id) throw new Error('Pet manifest must define an id');
  if (!manifest.name) throw new Error('Pet manifest must define a name');
  if (!manifest.version) throw new Error('Pet manifest must define a version');
  if (!Number.isFinite(Number(manifest.width)) || Number(manifest.width) <= 0) {
    throw new Error('Pet manifest width must be a positive number');
  }
  if (!Number.isFinite(Number(manifest.height)) || Number(manifest.height) <= 0) {
    throw new Error('Pet manifest height must be a positive number');
  }
  if (manifest.renderer !== 'sprite') {
    throw new Error('Pet manifest renderer must be "sprite" for V1');
  }
  if (!manifest.assets || typeof manifest.assets !== 'object') {
    throw new Error('Pet manifest must define assets');
  }
  if (!manifest.assets.spriteSheet) {
    throw new Error('Pet manifest must define assets.spriteSheet');
  }
  if (!Number.isFinite(Number(manifest.assets.frameWidth)) || Number(manifest.assets.frameWidth) <= 0) {
    throw new Error('Pet manifest assets.frameWidth must be a positive number');
  }
  if (!Number.isFinite(Number(manifest.assets.frameHeight)) || Number(manifest.assets.frameHeight) <= 0) {
    throw new Error('Pet manifest assets.frameHeight must be a positive number');
  }

  for (const stateName of REQUIRED_STATES) {
    assertStateConfig(stateName, manifest.states?.[stateName]);
  }

  return manifest;
}

function loadPetPackage({ app, petId = 'default' }) {
  const petDir = path.join(app.getAppPath(), 'desktop', 'pets', petId);
  const manifestPath = path.join(petDir, 'manifest.json');
  const manifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  return {
    petId,
    petDir,
    manifest,
    manifestPath,
    assetBaseUrl: pathToFileURL(`${petDir}${path.sep}`).toString(),
  };
}

module.exports = {
  REQUIRED_STATES,
  loadPetPackage,
  validateManifest,
};
