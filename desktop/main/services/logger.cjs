const fs = require('fs');
const path = require('path');

const REDACTED_TEXT = '[redacted]';
const SENSITIVE_KEY_PATTERN = /(token|cookie|authorization|password|secret|session|credential)/i;

function sanitizeLogMeta(value, keyName = '') {
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogMeta(item));
  }
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_TEXT
        : sanitizeLogMeta(nestedValue, key);
    }
    return sanitized;
  }
  if (typeof value === 'string' && SENSITIVE_KEY_PATTERN.test(keyName)) {
    return REDACTED_TEXT;
  }
  return value;
}

class Logger {
  constructor(app) {
    this.app = app;
    this.logDir = null;
  }

  init() {
    const userData = this.app.getPath('userData');
    this.logDir = path.join(userData, 'logs');
    fs.mkdirSync(this.logDir, { recursive: true });
    this.info('logger initialized', {
      appVersion: typeof this.app.getVersion === 'function' ? this.app.getVersion() : 'unknown',
      isPackaged: Boolean(this.app.isPackaged),
      logDir: this.logDir,
    });
  }

  getLogFilePath(date = new Date()) {
    const safeDate = date.toISOString().slice(0, 10);
    return path.join(this.logDir, `app-${safeDate}.log`);
  }

  write(level, message, meta) {
    const sanitizedMeta = sanitizeLogMeta(meta);
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    });

    try {
      if (this.logDir) fs.appendFileSync(this.getLogFilePath(), `${line}\n`, 'utf-8');
    } catch (err) {
      console.error('Failed to write log:', err);
    }

    const printable = `[${level}] ${message}`;
    if (level === 'error') console.error(printable, sanitizedMeta || '');
    else if (level === 'warn') console.warn(printable, sanitizedMeta || '');
    else console.log(printable, sanitizedMeta || '');
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

module.exports = { Logger, sanitizeLogMeta, REDACTED_TEXT };
