const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUnityStartupControl, runReviewLauncher, sessionPath, startPath } = require('./scripts/unity-startup-control.cjs');

const token = 'a'.repeat(64);

function fakeResponse() {
  let finish;
  return {
    status: 0, headers: {}, body: '',
    done: new Promise(resolve => { finish = resolve; }),
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; },
    end(body = '') { this.body = String(body); this.ended = true; finish(); },
  };
}

function fakeRequest({ pathname = startPath, method = 'POST', origin = 'http://127.0.0.1:5177', localAddress = '127.0.0.1', authorization = `Bearer ${token}`, body = '{"command":"start"}', contentType = 'application/json' } = {}) {
  const request = new EventEmitter();
  request.url = pathname;
  request.method = method;
  request.socket = { localAddress };
  request.headers = { origin, host: '127.0.0.1:5177', 'sec-fetch-site': 'same-origin', authorization, 'content-type': contentType, 'content-length': String(Buffer.byteLength(body)) };
  process.nextTick(() => { if (body) request.emit('data', Buffer.from(body)); request.emit('end'); });
  return request;
}

async function call(control, options) {
  const response = fakeResponse();
  const handled = control.handle(fakeRequest(options), response);
  await response.done;
  return { handled, status: response.status, body: JSON.parse(response.body), headers: response.headers };
}

test('Unity startup session is disclosed only to the same-origin loopback Studio', async () => {
  const control = createUnityStartupControl({ launcherPath: 'trusted.ps1', token, runLauncher: async () => ({ status: 'started', processId: 120 }) });
  const result = await call(control, { pathname: sessionPath, method: 'GET', body: '' });
  assert.equal(result.status, 200);
  assert.equal(result.body.token, token);
  assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
  for (const candidate of [
    { origin: 'http://127.0.0.1:5176' },
    { localAddress: '192.168.1.5' },
  ]) assert.equal((await call(control, { pathname: sessionPath, method: 'GET', body: '', ...candidate })).status, 403);
  assert.equal((await call(control, { pathname: sessionPath, method: 'POST', body: '' })).status, 405);
});

test('only an authenticated fixed JSON start command can invoke the trusted launcher', async () => {
  let launches = 0;
  const control = createUnityStartupControl({ launcherPath: 'trusted.ps1', token, runLauncher: async script => { launches++; assert.equal(script, 'trusted.ps1'); return { status: 'reused', processId: 99 }; } });
  assert.equal((await call(control, { authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await call(control, { body: '{"command":"start","projectPath":"C:\\\\Other"}' })).status, 400);
  assert.equal((await call(control, { body: '{"command":"stop"}' })).status, 400);
  assert.equal((await call(control, { contentType: 'text/plain' })).status, 415);
  const result = await call(control);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'reused', processId: 99 });
  assert.equal(launches, 1);
});

test('concurrent start requests share one launcher run and launcher failures are retryable', async () => {
  let launches = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const control = createUnityStartupControl({ launcherPath: 'trusted.ps1', token, runLauncher: async () => { launches++; await pending; return { status: 'started', processId: 135 }; } });
  const one = call(control);
  const two = call(control);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(launches, 1);
  release();
  assert.equal((await one).status, 200);
  assert.equal((await two).status, 200);

  let fail = true;
  const retryable = createUnityStartupControl({ launcherPath: 'trusted.ps1', token: 'b'.repeat(64), runLauncher: async () => {
    if (fail) { fail = false; throw new Error('Unity launcher timed out while loading the project.'); }
    return { status: 'reused', processId: 136 };
  } });
  const authToken = 'b'.repeat(64);
  const failed = await call(retryable, { authorization: `Bearer ${authToken}` });
  assert.equal(failed.status, 503);
  assert.match(failed.body.error, /timed out/);
  const retried = await call(retryable, { authorization: `Bearer ${authToken}` });
  assert.deepEqual(retried.body, { status: 'reused', processId: 136 });
});

test('automatic startup is blocked when Studio is not configured for bridge port 17844', async () => {
  let launched = false;
  const control = createUnityStartupControl({ launcherPath: 'trusted.ps1', token, isConfigured: () => false, runLauncher: async () => { launched = true; return { status: 'started', processId: 1 }; } });
  const result = await call(control);
  assert.equal(result.status, 503);
  assert.match(result.body.error, /17844/);
  assert.equal(launched, false);
});

test('the server invokes only the existing Unity review launcher with its fixed Unity-only mode', async () => {
  let received;
  const result = await runReviewLauncher('C:\\BrightTales Studio\\scripts\\review\\Start-BrightTalesReview.ps1', {
    execFileImpl(file, args, options, callback) {
      received = { file, args, options };
      callback(null, 'launcher output\nBRIGHTTALES_UNITY_START={"status":"started","processId":777}\n', '');
    },
  });
  assert.deepEqual(result, { status: 'started', processId: 777 });
  assert.equal(received.file, 'powershell.exe');
  const fileIndex = received.args.indexOf('-File');
  assert.deepEqual(received.args.slice(fileIndex, fileIndex + 2), ['-File', 'C:\\BrightTales Studio\\scripts\\review\\Start-BrightTalesReview.ps1']);
  assert.ok(received.args.includes('-UnityOnly'));
  assert.ok(received.args.includes('-NoBrowser'));
  assert.equal(received.options.windowsHide, true);
  await assert.rejects(runReviewLauncher('trusted.ps1', { execFileImpl(_file, _args, _options, callback) { callback(null, 'no confirmation', ''); } }), /without confirming/);
  await assert.rejects(runReviewLauncher('trusted.ps1', { execFileImpl(_file, _args, _options, callback) { callback(Object.assign(new Error('timeout'), { killed: true }), '', 'timed out'); } }), /timed out/);
});
