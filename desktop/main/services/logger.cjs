const fs = require('fs');
const path = require('path');

class Logger {
  constructor(app) {
    this.app = app;
    this.logDir = null;
    this.logFile = null;
  }

  init() {
    const userData = this.app.getPath('userData');
    this.logDir = path.join(userData, 'logs');
    const date = new Date().toISOString().slice(0, 10);
    this.logFile = path.join(this.logDir, `music-pet-${date}.log`);
    fs.mkdirSync(this.logDir, { recursive: true });
    this.info('logger initialized');
  }

  write(level, message, meta) {
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {}),
    });

    try {
      if (this.logFile) fs.appendFileSync(this.logFile, `${line}\n`, 'utf-8');
    } catch (err) {
      console.error('Failed to write log:', err);
    }

    const printable = `[${level}] ${message}`;
    if (level === 'error') console.error(printable, meta || '');
    else console.log(printable, meta || '');
  }

  info(message, meta) {
    this.write('info', message, meta);
  }

  warn(message, meta) {
    this.write('warn', message, meta);
  }

  error(message, meta) {
    this.write('error', message, meta);
  }
}

module.exports = { Logger };
