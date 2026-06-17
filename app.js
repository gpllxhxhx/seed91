const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8000);
const frontendDir = path.join(__dirname, 'frontend');
const apiProxyOrigin = process.env.API_PROXY_ORIGIN || `http://127.0.0.1:${process.env.API_PORT || 3000}`;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function decodeRequestPath(urlPath) {
  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  return decodedPath;
}

function resolveFrontendPath(decodedPath) {
  const normalizedPath = decodedPath.endsWith('/') ? `${decodedPath}index.html` : decodedPath;
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(frontendDir, relativePath);
  const relativeToFrontend = path.relative(frontendDir, absolutePath);
  if (relativeToFrontend.startsWith('..') || path.isAbsolute(relativeToFrontend)) return null;
  return absolutePath;
}

function shouldFallbackToIndex(decodedPath) {
  return decodedPath !== '/' && !path.extname(decodedPath);
}

function shouldProxyApi(decodedPath) {
  return decodedPath === '/api' || decodedPath.startsWith('/api/');
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

function proxyApiRequest(req, res) {
  let targetUrl;
  try {
    const proxiedPath = (req.url || '/').replace(/^\/api(?=\/|$)/, '') || '/';
    targetUrl = new URL(proxiedPath, apiProxyOrigin);
  } catch {
    res.writeHead(502);
    res.end('Bad gateway');
    return;
  }

  const client = targetUrl.protocol === 'https:' ? https : http;
  const proxyReq = client.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end('Bad gateway');
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const decodedPath = decodeRequestPath(req.url || '/');
  if (decodedPath && shouldProxyApi(decodedPath)) {
    proxyApiRequest(req, res);
    return;
  }

  const filePath = decodedPath ? resolveFrontendPath(decodedPath) : null;
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      serveFile(res, filePath);
      return;
    }

    if (!shouldFallbackToIndex(decodedPath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const fallbackPath = path.join(frontendDir, 'index.html');
    fs.stat(fallbackPath, (fallbackError, fallbackStats) => {
      if (fallbackError || !fallbackStats.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      serveFile(res, fallbackPath);
    });
  });
});

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`Frontend available at http://${displayHost}:${port}`);
  console.log(`Proxying /api requests to ${apiProxyOrigin}`);
});
