const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  window: {
    x: null,
    y: null,
    alwaysOnTop: true,
    opacity: 1,
  },
  pet: {
    locked: false,
    skin: 'default',
    selectedSkin: 'default',
    size: 1,
  },
  lyric: {
    visible: true,
    x: null,
    y: null,
    fontSize: 34,
    color: '#ffffff',
    locked: true,
  },
  player: {
    volume: 0.8,
    muted: false,
    lastSong: null,
    lastPlaylist: null,
    progress: 0,
  },
};

function mergeConfig(base, next) {
  const output = { ...base };
  for (const [key, value] of Object.entries(next || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = mergeConfig(base[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLoadedConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig || {});
  const legacyPetConfig = rawConfig?.pet || {};

  if (Number.isFinite(legacyPetConfig.x) && !Number.isFinite(merged.window.x)) merged.window.x = legacyPetConfig.x;
  if (Number.isFinite(legacyPetConfig.y) && !Number.isFinite(merged.window.y)) merged.window.y = legacyPetConfig.y;
  if (legacyPetConfig.skin && !merged.pet.selectedSkin) merged.pet.selectedSkin = legacyPetConfig.skin;
  if (merged.pet.selectedSkin && !merged.pet.skin) merged.pet.skin = merged.pet.selectedSkin;
  if (merged.pet.skin && !merged.pet.selectedSkin) merged.pet.selectedSkin = merged.pet.skin;

  return merged;
}

class ConfigStore {
  constructor(app, logger) {
    this.app = app;
    this.logger = logger;
    this.filePath = path.join(app.getPath('userData'), 'user-config.json');
    this.legacyFilePath = path.join(app.getPath('userData'), 'desktop-pet-config.json');
    this.data = cloneConfig(DEFAULT_CONFIG);
    this.lastLoadUsedDefaults = false;
  }

  load() {
    this.lastLoadUsedDefaults = false;
    try {
      const targetPath = fs.existsSync(this.filePath)
        ? this.filePath
        : (fs.existsSync(this.legacyFilePath) ? this.legacyFilePath : this.filePath);

      if (fs.existsSync(targetPath)) {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        this.data = normalizeLoadedConfig(JSON.parse(raw));
        if (targetPath !== this.filePath) this.save();
      } else {
        this.data = cloneConfig(DEFAULT_CONFIG);
        this.save();
      }
    } catch (err) {
      this.logger?.warn('config read failed, using defaults', { error: err.message });
      this.data = cloneConfig(DEFAULT_CONFIG);
      this.lastLoadUsedDefaults = true;
      this.save();
    }
    return this.data;
  }

  get(section) {
    return section ? this.data[section] : this.data;
  }

  update(section, patch) {
    this.data = normalizeLoadedConfig(mergeConfig(this.data, { [section]: patch }));
    this.save();
    return this.data[section];
  }

  merge(patch) {
    this.data = normalizeLoadedConfig(mergeConfig(this.data, patch || {}));
    this.save();
    return this.data;
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf-8');
    } catch (err) {
      this.logger?.warn('config write failed', { error: err.message });
    }
  }
}

module.exports = { ConfigStore, DEFAULT_CONFIG, normalizeLoadedConfig };
