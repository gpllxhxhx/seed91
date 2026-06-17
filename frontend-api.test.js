const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApi(overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, 'frontend', 'js', 'api.js'), 'utf8');
  const storage = new Map();
  const fetchCalls = [];

  const context = {
    URL,
    URLSearchParams,
    console,
    window: {
      NCM_API_BASE: 'http://127.0.0.1:8000/api',
      NCM_API_TOKEN: '',
      ...overrides.window,
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
          },
        },
        async json() {
          return { code: 200, data: { version: 'test' } };
        },
        async text() {
          return '{"code":200}';
        },
      };
    },
    ...overrides.context,
  };

  vm.runInNewContext(`${source}\n;globalThis.__API__ = API;`, context, { filename: 'frontend/js/api.js' });
  return { API: context.__API__, fetchCalls };
}

test('API.health keeps the /api prefix when building request URLs', async () => {
  const { API, fetchCalls } = loadApi();

  await API.health();

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /^http:\/\/127\.0\.0\.1:8000\/api\/inner\/version\?/);
});

test('API.getStreamUrl keeps the /api prefix for same-origin playback URLs', () => {
  const { API } = loadApi();

  const streamUrl = API.getStreamUrl(12345);

  assert.match(streamUrl, /^http:\/\/127\.0\.0\.1:8000\/api\/song\/url\/v1\?/);
});
