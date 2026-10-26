const { randomBytes, timingSafeEqual } = require('node:crypto');
const { execFile } = require('node:child_process');
const path = require('node:path');

const rootPath = '/__brighttales_unity_startup';
const sessionPath = `${rootPath}/session`;
const startPath = `${rootPath}/start`;

function isLoopback(request) {
  const local = request.socket?.localAddress;
  return local === '127.0.0.1' || local === '::1' || local === '::ffff:127.0.0.1';
}

function writeJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function runReviewLauncher(scriptPath, { timeoutMs = 120000, execFileImpl = execFile } = {}) {
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-UnityOnly', '-NoBrowser'];
  return new Promise((resolve, reject) => {
    execFileImpl('powershell.exe', args, { cwd: path.dirname(path.dirname(path.dirname(scriptPath))), windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout = '', stderr = '') => {
      const output = `${stdout}\n${stderr}`.trim();
      const line = output.split(/\r?\n/).find(item => item.startsWith('BRIGHTTALES_UNITY_START='));
      if (error) return reject(new Error(output || `BrightTales Unity launcher failed: ${error.message}`));
      if (!line) return reject(new Error('BrightTales Unity launcher completed without confirming whether the correct project started. Check the review launcher log.'));
      try {
        const result = JSON.parse(line.slice('BRIGHTTALES_UNITY_START='.length));
        if (!['started', 'reused'].includes(result.status) || !Number.isSafeInteger(result.processId) || result.processId <= 0)
          throw new Error('Launcher confirmation was invalid.');
        resolve(result);
      } catch (parseError) { reject(new Error(`Could not verify Unity startup: ${parseError.message}`)); }
    });
  });
}

function createUnityStartupControl({ launcherPath, runLauncher = runReviewLauncher, token = randomBytes(32).toString('hex'), isConfigured = () => true }) {
  let activeLaunch = null;

  function sameOriginRequest(request) {
    const host = request.headers.host;
    return isLoopback(request) && typeof host === 'string' && /^127\.0\.0\.1:\d{1,5}$/.test(host) &&
      request.headers.origin === `http://${host}` && (!request.headers['sec-fetch-site'] || request.headers['sec-fetch-site'] === 'same-origin');
  }

  function authorized(request) {
    const supplied = request.headers.authorization;
    if (typeof supplied !== 'string' || !supplied.startsWith('Bearer ')) return false;
    const bytes = Buffer.from(supplied.slice(7));
    const expected = Buffer.from(token);
    return bytes.length === expected.length && timingSafeEqual(bytes, expected);
  }

  function handle(request, response) {
    let pathname;
    try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; } catch { return false; }
    if (pathname !== sessionPath && pathname !== startPath) return false;
    if (!sameOriginRequest(request)) { writeJson(response, 403, { error: 'A same-origin loopback Studio request is required.' }); return true; }
    if (pathname === sessionPath) {
      if (request.method !== 'GET') { writeJson(response, 405, { error: 'GET is required.' }); return true; }
      writeJson(response, 200, { token });
      return true;
    }
    if (request.method !== 'POST') { writeJson(response, 405, { error: 'POST is required.' }); return true; }
    if (!authorized(request)) { writeJson(response, 401, { error: 'Unity startup authentication failed. Refresh Studio and retry.' }); return true; }
    if (!isConfigured()) { writeJson(response, 503, { error: 'Automatic Cartoon Preview startup requires the BrightTales review launcher with bridge port 17844. Restart Studio with Start-BrightTales-Review.cmd.' }); return true; }
    if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      writeJson(response, 415, { error: 'A JSON start request is required.' }); return true;
    }
    const declaredLength = Number(request.headers['content-length'] || 0);
    if (declaredLength > 64) { writeJson(response, 413, { error: 'Unity startup request is too large.' }); return true; }

    const chunks = [];
    let length = 0;
    let finished = false;
    const fail = (status, error) => { if (finished) return; finished = true; writeJson(response, status, { error }); };
    request.on('data', chunk => {
      length += chunk.length;
      if (length > 64) { fail(413, 'Unity startup request is too large.'); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('error', () => fail(400, 'Unity startup request could not be read.'));
    request.on('end', async () => {
      if (finished) return;
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'Unity startup request must be valid JSON.'); return; }
      if (!body || body.command !== 'start' || Object.keys(body).length !== 1) { fail(400, 'Only the fixed BrightTales Unity start command is allowed.'); return; }
      try {
        if (!activeLaunch) activeLaunch = Promise.resolve().then(() => runLauncher(launcherPath));
        const result = await activeLaunch;
        if (finished) return;
        finished = true;
        writeJson(response, 200, result);
      } catch (error) {
        if (finished) return;
        finished = true;
        writeJson(response, 503, { error: error instanceof Error ? error.message : 'The trusted BrightTales Unity launcher failed.' });
      } finally { activeLaunch = null; }
    });
    return true;
  }

  return { handle, sessionPath, startPath };
}

module.exports = { createUnityStartupControl, runReviewLauncher, sessionPath, startPath };
