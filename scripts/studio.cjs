const http = require('node:http');
const { readFile, stat } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { VoiceServiceManager, handleVoiceRequest } = require('./voice-lifecycle.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const mode = process.argv[2] === 'dev' ? 'dev' : 'production';
const manager = new VoiceServiceManager();
let closeWeb = async () => {};
let closing = false;

function middleware(request, response, next) {
  void handleVoiceRequest(request, response, manager).then(handled => { if (!handled) next(); }).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Local voice request failed.');
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function staticFile(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  const candidate = path.resolve(DIST, '.' + pathname);
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) { response.writeHead(403); response.end(); return; }
  let target = candidate;
  try { if (!(await stat(target)).isFile()) throw Error('Not a file'); }
  catch {
    if (path.extname(pathname)) { response.writeHead(404); response.end(); return; }
    target = path.join(DIST, 'index.html');
  }
  try {
    const bytes = await readFile(target);
    response.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end(); }
}

async function startProduction() {
  if (!existsSync(path.join(DIST, 'index.html'))) throw Error('Production build is missing. Run npm run build first.');
  const server = http.createServer((request, response) => middleware(request, response, () => { void staticFile(request, response); }));
  let port = null;
  for (let candidate = 4177; candidate <= 4181; candidate++) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(candidate, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      port = candidate;
      break;
    } catch (error) { if (error.code !== 'EADDRINUSE' || candidate === 4181) throw error; }
  }
  closeWeb = () => new Promise(resolve => server.close(resolve));
  console.log(`BrightTales Studio: http://127.0.0.1:${port}/`);
}

async function startDevelopment() {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { host: '127.0.0.1' },
    plugins: [{ name: 'brighttales-managed-voice', configureServer(vite) { vite.middlewares.use(middleware); } }],
  });
  await server.listen();
  server.printUrls();
  closeWeb = () => server.close();
}

async function shutdown(signal) {
  if (closing) return;
  closing = true;
  try { await closeWeb(); } finally { await manager.close(); }
  process.exitCode = signal === 'SIGINT' ? 130 : 0;
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

void (async () => {
  try {
    if (mode === 'dev') await startDevelopment(); else await startProduction();
    void manager.start();
  } catch (error) {
    console.error(`BrightTales could not start: ${error.message}`);
    await shutdown('error');
    process.exitCode = 1;
  }
})();
