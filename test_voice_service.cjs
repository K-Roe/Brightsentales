const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { mkdtempSync, appendFileSync, readFileSync, existsSync } = require('node:fs');
const { handleVoiceRequest, healthAt, VoiceServiceManager } = require('./scripts/voice-lifecycle.cjs');

const SERVICE = 'BrightTalesVoiceMaker';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const workspace = mkdtempSync(path.join(os.tmpdir(), 'brighttales-voice-test-'));
const started = [];
const managers = [];

const randomPort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const STUB = `
const http = require('node:http');
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 0;
const state = process.env.STUB_STATE || 'ready';
if (process.env.STUB_LOG) appendFileSync(process.env.STUB_LOG, String(port) + '\\n');
http.createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://127.0.0.1');
  if (pathname === '/voice-api/health') {
    const delayMs = Number(process.env.STUB_SLOW_HEALTH_MS || 0);
    if (delayMs) setTimeout(() => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ service: '${SERVICE}', protocol: 2, state })); }, delayMs);
    else { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ service: '${SERVICE}', protocol: 2, state })); }
    return;
  }
  if (pathname === '/voice-api/owner/shutdown') {
    if (request.headers['x-brighttales-owner'] !== process.env.BRIGHTTALES_VOICE_OWNER_TOKEN) { response.writeHead(403); response.end(); return; }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"stopping":true}');
    setTimeout(() => process.exit(0), 20);
    return;
  }
  if (pathname === '/voice-api/echo') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ method: request.method, token: request.headers['x-brighttales-voice'] || null }));
    return;
  }
  response.writeHead(404); response.end();
}).listen(port, '127.0.0.1', () => {
  if (process.env.STUB_EXIT_AFTER_MS) setTimeout(() => process.exit(7), Number(process.env.STUB_EXIT_AFTER_MS));
});
`;
const stubPath = path.join(workspace, 'voice-service-stub.cjs');
require('node:fs').writeFileSync(stubPath, STUB);

function readStarts(log) {
  return existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
}

test.after(async () => {
  for (const manager of managers.splice(0)) await manager.close();
  for (const child of started.splice(0)) if (child.exitCode === null) child.kill();
});

function track(manager) {
  managers.push(manager);
  return manager;
}

test('healthAt ignores foreign servers and wrong protocol versions', async () => {
  const port = await randomPort();
  const foreign = http.createServer((request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"service":"something-else","protocol":2,"state":"ready"}'); });
  await new Promise(resolve => foreign.listen(port, '127.0.0.1', resolve));
  assert.equal(await healthAt(port), null, 'an unrelated server must never be adopted');
  await new Promise(resolve => foreign.close(resolve));
  assert.equal(await healthAt(port), null, 'a closed port is not healthy');
});

test('a compatible already-running service is adopted, not duplicated, and never stopped', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'adopt.log');
  const child = spawn(process.execPath, [stubPath, '--port', String(port)], { env: { ...process.env, STUB_LOG: log }, stdio: 'ignore', windowsHide: true });
  await sleep(400);
  assert.ok(await healthAt(port), 'stub service should be healthy');

  const manager = track(new VoiceServiceManager({ ports: [port], python: { command: path.join(workspace, 'missing-python.exe'), args: [] }, monitorMs: 150 }));
  const state = await manager.start();
  assert.equal(state.state, 'ready');
  assert.equal(state.owned, false, 'an external service must not be owned');
  assert.equal(readStarts(log).length, 1, 'adopting must not launch a second service');

  await manager.close();
  await sleep(200);
  assert.ok(await healthAt(port), 'closing BrightTales must not stop a shared service');
  child.kill();
});

test('an occupied preferred port moves the managed service to the next candidate without touching the occupier', async () => {
  const [blocked, spare] = [await randomPort(), await randomPort()];
  const foreign = http.createServer((request, response) => { response.writeHead(200); response.end('busy'); });
  await new Promise(resolve => foreign.listen(blocked, '127.0.0.1', resolve));
  const log = path.join(workspace, 'fallback.log');
  const manager = track(new VoiceServiceManager({ ports: [blocked, spare], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  process.env.STUB_LOG = log;
  const state = await manager.start();
  delete process.env.STUB_LOG;
  assert.equal(state.state, 'ready');
  assert.equal(state.port, spare, 'must use a free port rather than an occupied one');
  assert.deepEqual(readStarts(log), [String(spare)]);
  await manager.close();
  assert.ok(await healthAt(spare) === null, 'owned service must stop with the manager');
  const occupier = await new Promise(resolve => {
  const request = http.get({ host: '127.0.0.1', port: blocked, path: '/' }, response => {
    let body = '';
    response.on('data', chunk => { body += chunk; });
    response.on('end', () => resolve(body));
  });
  request.on('error', () => resolve('no-response'));
});
  assert.equal(occupier, 'busy', 'the unrelated process must keep running untouched');
  await new Promise(resolve => foreign.close(resolve));
});

test('a missing Python interpreter reports a plain error instead of a false ready state', async () => {
  const manager = track(new VoiceServiceManager({ ports: [await randomPort()], python: { command: path.join(workspace, 'no-such-python.exe'), args: [] }, monitorMs: 150 }));
  const state = await manager.start();
  assert.equal(state.state, 'error');
  assert.match(state.detail, /Python executable is missing/i);
  await manager.close();
});

test('shutdown stops only the owned child and leaves no orphan listening', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'shutdown.log');
  process.env.STUB_LOG = log;
  const manager = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  const state = await manager.start();
  delete process.env.STUB_LOG;
  assert.equal(state.state, 'ready');
  assert.equal(state.owned, true);
  const child = manager.owned;
  await manager.close();
  await sleep(300);
  assert.notEqual(child.exitCode, null, 'the managed child must exit');
  assert.equal(await healthAt(port), null, 'no service may remain on the port after shutdown');
});

test('an unexpected crash is recovered automatically and restart looping is bounded', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'crash.log');
  process.env.STUB_LOG = log;
  process.env.STUB_EXIT_AFTER_MS = '1500';
  const manager = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  await manager.start();
  for (let i = 0; i < 60 && manager.state !== 'error'; i++) await sleep(250);
  assert.equal(manager.state, 'error', 'repeated crashes must stop at a reported error');
  assert.match(manager.snapshot().detail, /stopped repeatedly/i);
  const attempts = readStarts(log).length;
  assert.ok(attempts >= 2, `the service should have been restarted at least once (attempts: ${attempts})`);
  assert.ok(attempts <= 4, `restart looping must be bounded (attempts: ${attempts})`);

  const child = manager.owned;
  await manager.close();
  if (child && child.exitCode === null) child.kill();
  delete process.env.STUB_LOG;
  delete process.env.STUB_EXIT_AFTER_MS;
});

test('a second launcher waits for the owner to restore a crashed shared service instead of starting a duplicate', async () => {
  const port = await randomPort();
  const ownerLog = path.join(workspace, 'shared-owner.log');
  const guestLog = path.join(workspace, 'shared-guest.log');
  process.env.STUB_LOG = ownerLog;
  const owner = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  assert.equal((await owner.start()).state, 'ready');
  delete process.env.STUB_LOG;

  process.env.STUB_LOG = guestLog;
  const guest = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  const guestState = await guest.start();
  delete process.env.STUB_LOG;
  assert.equal(guestState.state, 'ready');
  assert.equal(guestState.owned, false, 'the second launcher must share the first service');
  assert.equal(readStarts(guestLog).length, 0, 'the second launcher must not launch its own service');

  const shared = owner.owned;
  shared.kill();
  await sleep(2000);
  assert.equal(readStarts(guestLog).length, 0, 'the second launcher must not start a duplicate while the owner restarts');
  assert.equal(owner.snapshot().state, 'ready', 'the owner must restore its service');
  assert.equal(guest.snapshot().state, 'ready', 'the second launcher must reconnect to the restored service');
  assert.equal(guest.snapshot().owned, false, 'the second launcher must still be sharing, not owning, a service');
  await owner.close();
  await guest.close();
});

test('a busy but healthy service is not mistaken for a crash', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'busy.log');
  process.env.STUB_LOG = log;
  process.env.STUB_SLOW_HEALTH_MS = '1500';
  const manager = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  await manager.start();
  delete process.env.STUB_LOG;
  delete process.env.STUB_SLOW_HEALTH_MS;
  assert.equal(manager.state, 'ready', 'a slow health response is still a healthy service');
  await sleep(2500);
  assert.equal(manager.state, 'ready', 'a busy service must not be reported as stopped');
  assert.equal(readStarts(log).length, 1, 'a busy service must not be restarted');
  await manager.close();
});

test('Retry clears the restart budget and starts the service again', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'retry.log');
  process.env.STUB_LOG = log;
  process.env.STUB_EXIT_AFTER_MS = '1500';
  const manager = track(new VoiceServiceManager({ ports: [port], python: { command: process.execPath, args: [stubPath] }, monitorMs: 150 }));
  await manager.start();
  for (let i = 0; i < 60 && manager.state !== 'error'; i++) await sleep(250);
  assert.equal(manager.state, 'error');
  delete process.env.STUB_EXIT_AFTER_MS;
  await manager.retry();
  for (let i = 0; i < 40 && manager.state !== 'ready'; i++) await sleep(250);
  assert.equal(manager.state, 'ready', 'Retry must produce a ready service');
  const child = manager.owned;
  await manager.close();
  if (child && child.exitCode === null) child.kill();
  delete process.env.STUB_LOG;
});

function fakeResponse() {
  const chunks = [];
  return {
    headersSent: false,
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; return this; },
    end(body) { if (body !== undefined) chunks.push(Buffer.from(body)); this.body = Buffer.concat(chunks).toString('utf8'); },
  };
}

function fakeRequest(url, method = 'GET', headers = {}, body = '') {
  const payload = Buffer.from(body);
  return {
    url,
    method,
    headers: { host: '127.0.0.1:5177', ...headers },
    async *[Symbol.asyncIterator]() { if (payload.length) yield payload; },
  };
}

test('only loopback Studio requests may reach the voice endpoints', async () => {
  const manager = { snapshot: () => ({ state: 'ready', detail: 'Local voice engine is ready.', port: 1, owned: true }), check: () => {} };
  const foreignHost = fakeResponse();
  assert.equal(await handleVoiceRequest({ url: '/voice-manager/status', method: 'GET', headers: { host: 'evil.example.com' } }, foreignHost, manager), true);
  assert.equal(foreignHost.status, 403);
  const status = fakeResponse();
  await handleVoiceRequest({ url: '/voice-manager/status', method: 'GET', headers: { host: '127.0.0.1:5177' } }, status, manager);
  assert.equal(status.status, 200);
  assert.equal(JSON.parse(status.body).state, 'ready');
  const retry = fakeResponse();
  await handleVoiceRequest({ url: '/voice-manager/retry', method: 'POST', headers: { host: '127.0.0.1:5177' } }, retry, manager);
  assert.equal(retry.status, 403, 'Retry needs the Studio request header and matching origin');
  assert.equal(await handleVoiceRequest({ url: '/scenes', method: 'GET', headers: { host: '127.0.0.1:5177' } }, fakeResponse(), manager), false, 'non-voice paths must pass through to the app');
});

test('voice requests are refused while the service is not ready and proxied when it is', async () => {
  const port = await randomPort();
  const log = path.join(workspace, 'proxy.log');
  process.env.STUB_LOG = log;
  const manager = { snapshot: () => ({ state: 'unavailable', detail: 'Voice engine is starting.', port: null, owned: false }), check: () => {} };
  const blocked = fakeResponse();
  await handleVoiceRequest({ url: '/voice-api/voices', method: 'GET', headers: { host: '127.0.0.1:5177' } }, blocked, manager);
  assert.equal(blocked.status, 503);
  assert.match(JSON.parse(blocked.body).error, /unavailable|starting|stopped/i);

  const child = spawn(process.execPath, [stubPath, '--port', String(port)], { env: { ...process.env }, stdio: 'ignore', windowsHide: true });
  started.push(child);
  for (let i = 0; i < 40 && !(await healthAt(port)); i++) await sleep(100);
  const live = { snapshot: () => ({ state: 'ready', detail: 'Local voice engine is ready.', port, owned: true }), check: () => {} };
  const proxied = fakeResponse();
  await handleVoiceRequest(fakeRequest('/voice-api/echo', 'POST', { 'content-type': 'application/json', 'x-brighttales-voice': '1' }, '{"text":"hello"}'), proxied, live);
  assert.equal(proxied.status, 200);
  assert.deepEqual(JSON.parse(proxied.body), { method: 'POST', token: '1' });
});