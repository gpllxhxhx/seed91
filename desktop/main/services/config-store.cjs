const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  pet: {
    x: 100,
    y: 100,
    locked: false,
    skin: 'default',
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

class ConfigStore {
  constructor(app, logger) {
    this.app = app;
    this.logger = logger;
    this.filePath = path.join(app.getPath('userData'), 'desktop-pet-config.json');
    this.data = DEFAULT_CONFIG;
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = mergeConfig(DEFAULT_CONFIG, JSON.parse(raw));
      } else {
        this.data = DEFAULT_CONFIG;
        this.save();
      }
    } catch (err) {
      this.logger?.warn('config read failed, using defaults', { error: err.message });
      this.data = DEFAULT_CONFIG;
    }
    return this.data;
  }

  get(section) {
    return section ? this.data[section] : this.data;
  }

  update(section, patch) {
    this.data = mergeConfig(this.data, { [section]: patch });
    this.save();
    return this.data[section];
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

module.exports = { ConfigStore, DEFAULT_CONFIG };
