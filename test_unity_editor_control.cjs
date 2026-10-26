const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { handleUnityControlSession, sessionPath } = require('./scripts/unity-editor-control.cjs');

function fakeResponse() {
  let finish;
  return {
    status: 0, headers: {}, body: '',
    done: new Promise(resolve => { finish = resolve; }),
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; },
    end(body = '') { this.body = String(body); this.ended = true; finish(); },
  };
}

function request(overrides = {}) {
  return {
    method: 'GET', url: sessionPath,
    socket: { localAddress: '127.0.0.1' },
    headers: { origin: 'http://127.0.0.1:5177', host: '127.0.0.1:5177', 'sec-fetch-site': 'same-origin' },
    ...overrides,
  };
}

test('Unity Editor session endpoint reveals only a valid local session to the same Studio origin', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brighttales-unity-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tokenPath = path.join(root, 'session.json');
  const token = 'a'.repeat(64);
  await writeFile(tokenPath, JSON.stringify({ token, processId: process.pid, controllerState: 'ready', detail: '' }));
  const response = fakeResponse();
  assert.equal(handleUnityControlSession(request(), response, tokenPath), true);
  await response.done;
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { token, controllerState: 'ready', detail: '' });
  assert.equal(response.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('Unity Editor session endpoint rejects cross-origin, non-loopback, non-GET and cross-site requests', async () => {
  for (const candidate of [
    request({ headers: { origin: 'http://127.0.0.1:5176', host: '127.0.0.1:5177', 'sec-fetch-site': 'same-origin' } }),
    request({ socket: { localAddress: '192.168.1.2' } }),
    request({ method: 'POST' }),
    request({ headers: { origin: 'http://127.0.0.1:5177', host: '127.0.0.1:5177', 'sec-fetch-site': 'cross-site' } }),
  ]) {
    const response = fakeResponse();
    assert.equal(handleUnityControlSession(candidate, response, 'unused'), true);
    assert.equal(response.status, 403);
  }
});

test('Unity Editor session endpoint reports a closed or invalid controller without returning a token', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brighttales-unity-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tokenPath = path.join(root, 'session.json');
  const response = fakeResponse();
  assert.equal(handleUnityControlSession(request(), response, tokenPath), true);
  await response.done;
  assert.equal(response.status, 503);
  assert.equal(JSON.parse(response.body).error.includes('review launcher'), true);
});

test('Unity Editor session endpoint rejects a stale token left by a closed Editor process', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brighttales-unity-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tokenPath = path.join(root, 'session.json');
  await writeFile(tokenPath, JSON.stringify({ token: 'b'.repeat(64), processId: 2147483647, controllerState: 'ready' }));
  const response = fakeResponse();
  assert.equal(handleUnityControlSession(request(), response, tokenPath), true);
  await response.done;
  assert.equal(response.status, 503);
  assert.equal(JSON.parse(response.body).error.includes('review launcher'), true);
});

test('unrelated Studio routes are not intercepted', () => {
  const response = fakeResponse();
  assert.equal(handleUnityControlSession(request({ url: '/__brighttales_unity_control/other' }), response, 'unused'), false);
});
