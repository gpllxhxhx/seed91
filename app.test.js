const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: 'GET',
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function startServer(port, envOverrides = {}) {
  const child = spawn(process.execPath, ['app.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ...envOverrides,
    },
    stdio: 'ignore',
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await request(port, '/');
      return child;
    } catch {
      await wait(150);
    }
  }

  child.kill();
  throw new Error(`Server failed to start on port ${port}`);
}

async function startBackend(port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/inner/version') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end('{"code":200,"data":{"version":"test"}}');
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return server;
}

test('serves index.html for app routes without a file extension', async (t) => {
  const port = 18080;
  const child = await startServer(port);
  t.after(() => {
    child.kill();
  });

  const response = await request(port, '/search');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] || '', /text\/html/);
  assert.match(response.body, /<title>Music Player - 在线音乐播放器<\/title>/);
});

test('proxies /api requests to the local backend service', async (t) => {
  const apiPort = 19090;
  const backend = await startBackend(apiPort);
  t.after(() => {
    backend.close();
  });

  const port = 18081;
  const child = await startServer(port, { API_PORT: String(apiPort) });
  t.after(() => {
    child.kill();
  });

  const response = await request(port, '/api/inner/version');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] || '', /application\/json/);
  assert.equal(response.body, '{"code":200,"data":{"version":"test"}}');
});
