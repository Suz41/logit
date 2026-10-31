const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');
const FLARESOLVERR_DEFAULT_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Check if FlareSolverr is reachable
 * @param {string} flareUrl
 * @returns {Promise<boolean>}
 */
function checkFlareSolverr(flareUrl) {
  return new Promise((resolve) => {
    try {
      const u = new URL(flareUrl);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port || 8191,
          path: '/',
          method: 'GET',
          timeout: 1000
        },
        (res) => {
          resolve(res.statusCode < 500);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Proxy request using FlareSolverr
 * @param {string} flareUrl
 * @param {string} targetUrl
 * @param {http.ServerResponse} res
 */
function proxyWithFlareSolverr(flareUrl, targetUrl, res) {
  try {
    const u = new URL(flareUrl);
    const postData = JSON.stringify({
      cmd: 'request.get',
      url: targetUrl,
      maxTimeout: 30000
    });

    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 8191,
        path: u.pathname || '/v1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 35000
      },
      (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', (chunk) => (body += chunk));
        upstreamRes.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status === 'ok' && data.solution) {
              const sol = data.solution;
              res.writeHead(sol.status || 200, {
                'Content-Type': sol.headers && sol.headers['content-type'] ? sol.headers['content-type'] : 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
              });
              res.end(sol.response);
              return;
            }
          } catch (e) {
            // parsing failed, fallback below
          }
          // If FlareSolverr failed, fallback to native fetch
          fetchDirect(targetUrl, res);
        });
      }
    );

    req.on('error', () => fetchDirect(targetUrl, res));
    req.on('timeout', () => {
      req.destroy();
      fetchDirect(targetUrl, res);
    });
    req.write(postData);
    req.end();
  } catch (err) {
    fetchDirect(targetUrl, res);
  }
}

/**
 * Proxy request directly using Node https/http
 * @param {string} targetUrl
 * @param {http.ServerResponse} res
 */
function fetchDirect(targetUrl, res) {
  try {
    const u = new URL(targetUrl);
    const client = u.protocol === 'http:' ? http : https;

    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + (u.search || ''),
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    };

    const upstreamReq = client.request(options, (upstreamRes) => {
      // Handle redirect
      if (
        upstreamRes.statusCode >= 300 &&
        upstreamRes.statusCode < 400 &&
        upstreamRes.headers.location
      ) {
        const nextUrl = new URL(upstreamRes.headers.location, targetUrl).toString();
        fetchDirect(nextUrl, res);
        return;
      }

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': upstreamRes.headers['content-type'] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400'
      };

      if (upstreamRes.headers['content-length']) {
        headers['Content-Length'] = upstreamRes.headers['content-length'];
      }

      res.writeHead(upstreamRes.statusCode || 200, headers);
      upstreamRes.pipe(res);
    });

    upstreamReq.on('error', (err) => {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
    });

    upstreamReq.on('timeout', () => {
      upstreamReq.destroy();
      res.writeHead(504, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Proxy request timed out' }));
    });

    upstreamReq.end();
  } catch (err) {
    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ error: 'Invalid URL provided', details: err.message }));
  }
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const reqUrlObj = new URL(req.url, `http://${host}`);
  const pathname = reqUrlObj.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  // 1. Status endpoint
  if (pathname === '/api/status') {
    const hasFlareSolverr = await checkFlareSolverr(FLARESOLVERR_DEFAULT_URL);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(
      JSON.stringify({
        status: 'online',
        server: 'Log!t Local Dev Server',
        flaresolverr: {
          configuredUrl: FLARESOLVERR_DEFAULT_URL,
          reachable: hasFlareSolverr
        }
      })
    );
    return;
  }

  // 2. Built-in Proxy endpoint
  if (pathname === '/api/proxy') {
    let targetUrl = reqUrlObj.searchParams.get('url');

    if (!targetUrl) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
      return;
    }

    targetUrl = targetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const customFlare =
      reqUrlObj.searchParams.get('flaresolverr') ||
      req.headers['x-flaresolverr-url'];

    const flareUrl = customFlare || FLARESOLVERR_DEFAULT_URL;
    const isFlareActive = await checkFlareSolverr(flareUrl);

    if (customFlare || isFlareActive) {
      proxyWithFlareSolverr(flareUrl, targetUrl, res);
    } else {
      fetchDirect(targetUrl, res);
    }
    return;
  }

  // 3. Static File Serving
  let reqUrl = pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(ROOT, reqUrl);

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Log!t local server running at http://localhost:${PORT}/`);
  console.log(`- Inbuilt Proxy: http://localhost:${PORT}/api/proxy?url=...`);
  console.log(`- Companion:     http://localhost:${PORT}/companion.html`);
  console.log(`- Pending:       http://localhost:${PORT}/pending.html`);
  console.log(`- Library:       http://localhost:${PORT}/index.html`);
});
