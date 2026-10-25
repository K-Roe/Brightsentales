const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { createStudioAudioRelay } = require('./scripts/studio-audio-relay.cjs');

test('local relay verifies content, isolates tokens and serves the original media bytes', async () => {
  const relay = createStudioAudioRelay();
  const server = http.createServer((request, response) => { void relay.handle(request, response).then(handled => {
    if (!handled) { response.writeHead(404); response.end(); }
  }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const bytes = Buffer.from('RIFF disposable test audio');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const headers = { Origin: origin, 'Content-Type': 'audio/wav', 'X-BrightTales-Audio-Id': '11111111-1111-4111-8111-111111111111', 'X-BrightTales-Sha256': hash };
    const rejectedOrigin = await fetch(origin + '/api/studio-audio', { method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: bytes });
    assert.equal(rejectedOrigin.status, 400);
    const rejectedHash = await fetch(origin + '/api/studio-audio', { method: 'POST', headers: { ...headers, 'X-BrightTales-Sha256': '0'.repeat(64) }, body: bytes });
    assert.equal(rejectedHash.status, 400);
    const uploaded = await fetch(origin + '/api/studio-audio', { method: 'POST', headers, body: bytes });
    assert.equal(uploaded.status, 201);
    const manifest = await uploaded.json();
    assert.equal(manifest.sha256, hash);
    const repeated = await fetch(origin + '/api/studio-audio', { method: 'POST', headers, body: bytes });
    assert.equal((await repeated.json()).url, manifest.url);
    const media = await fetch(manifest.url);
    assert.equal(media.headers.get('content-type'), 'audio/wav');
    assert.deepEqual(Buffer.from(await media.arrayBuffer()), bytes);
    assert.equal((await fetch(origin + '/api/studio-audio/' + 'a'.repeat(48))).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
