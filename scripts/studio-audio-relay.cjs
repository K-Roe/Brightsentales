const { createHash, randomBytes } = require('node:crypto');

const MAX_ASSET_BYTES = 20_000_000;
const MAX_CACHE_BYTES = 100_000_000;
const AUDIO_MIMES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

// Ephemeral media relay for the local Unity preview. Audio stays out of scene JSON and disk.
function createStudioAudioRelay() {
  const entries = new Map();
  const byContent = new Map();
  let totalBytes = 0;
  async function handle(request, response) {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    if (path !== '/api/studio-audio' && !/^\/api\/studio-audio\/[a-f0-9]{48}$/.test(path)) return false;
    const host = request.headers.host;
    if (!/^127\.0\.0\.1:\d{1,5}$/.test(host || '') && !/^localhost:\d{1,5}$/.test(host || '')) {
      response.writeHead(403); response.end(); return true;
    }
    if (request.method === 'POST' && path === '/api/studio-audio') {
      if (request.headers.origin !== `http://${host}` || !UUID.test(request.headers['x-brighttales-audio-id'] || '') ||
          !AUDIO_MIMES.has(request.headers['content-type']) ||
          !/^[a-f0-9]{64}$/.test(request.headers['x-brighttales-sha256'] || '') ||
          !Number.isSafeInteger(Number(request.headers['content-length'])) ||
          Number(request.headers['content-length']) < 1 || Number(request.headers['content-length']) > MAX_ASSET_BYTES) {
        response.writeHead(400); response.end('Invalid local audio asset.'); return true;
      }
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > MAX_ASSET_BYTES) { response.writeHead(413); response.end('Audio asset is too large.'); return true; }
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== Number(request.headers['content-length']) || sha256 !== request.headers['x-brighttales-sha256']) {
        response.writeHead(400); response.end('Audio content hash does not match.'); return true;
      }
      const key = `${request.headers['x-brighttales-audio-id']}:${request.headers['content-type']}:${sha256}`;
      let token = byContent.get(key);
      if (!token && totalBytes + bytes.length > MAX_CACHE_BYTES) {
        response.writeHead(507); response.end('Local audio preview cache is full. Restart Studio to clear it.'); return true;
      }
      if (!token) {
        token = randomBytes(24).toString('hex');
        entries.set(token, { bytes, id: request.headers['x-brighttales-audio-id'], sha256, mime: request.headers['content-type'] });
        byContent.set(key, token);
        totalBytes += bytes.length;
      }
      const body = JSON.stringify({ url: `http://${host}/api/studio-audio/${token}`, id: request.headers['x-brighttales-audio-id'], sha256, size: bytes.length });
      response.writeHead(201, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
      response.end(body); return true;
    }
    if (request.method === 'GET' && path !== '/api/studio-audio') {
      const entry = entries.get(path.slice('/api/studio-audio/'.length));
      if (!entry) { response.writeHead(404); response.end(); return true; }
      response.writeHead(200, { 'Content-Type': entry.mime, 'Content-Length': entry.bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(entry.bytes); return true;
    }
    response.writeHead(405); response.end(); return true;
  }
  return { handle };
}

module.exports = { createStudioAudioRelay };
