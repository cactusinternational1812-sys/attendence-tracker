/**
 * Minimal static file server for Render (and local dev).
 * Uses only Node builtins — no serve/npm CLI quirks.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function isInsideRoot(filePath) {
  const rel = path.relative(ROOT, filePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    const u = new URL(req.url || '/', 'http://localhost');
    pathname = decodeURIComponent(u.pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  if (pathname.includes('\0')) {
    res.writeHead(400);
    res.end();
    return;
  }

  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(ROOT, 'index.html');
  } else {
    const rel = pathname.replace(/^\/+/, '');
    if (rel.includes('..')) {
      res.writeHead(403);
      res.end();
      return;
    }
    filePath = path.resolve(ROOT, rel);
  }

  if (!isInsideRoot(filePath)) {
    res.writeHead(403);
    res.end();
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isFile()) {
      sendFile(res, filePath);
      return;
    }
    sendFile(res, path.join(ROOT, 'index.html'));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on 0.0.0.0:${PORT}`);
});
