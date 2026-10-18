const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SERVICE = 'BrightTalesVoiceMaker';
const PROTOCOL = 2;
const PORTS = [8766, 8767, 8768, 8769, 8770];
const SHARED_GRACE_MS = 9000;
// Synthesis and FFmpeg can make the service slow to answer for a moment, so health checks
// are given room and a service must fail several checks in a row before it is treated as gone.
const HEALTH_TIMEOUT_MS = 2500;
const HEALTH_FAILURES_BEFORE_RESTART = 3;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function healthAt(port, timeout = HEALTH_TIMEOUT_MS) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/voice-api/health`, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    const value = await response.json();
    return value?.service === SERVICE && value.protocol === PROTOCOL && ['ready', 'error'].includes(value.state) ? value : null;
  } catch { return null; }
}

async function portIsFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

function pythonCommand() {
  if (process.env.BRIGHTTALES_PYTHON) return { command: process.env.BRIGHTTALES_PYTHON, args: [] };
  const local = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (existsSync(local)) return { command: local, args: [] };
  return process.platform === 'win32' ? { command: 'py', args: ['-3.12'] } : { command: 'python3', args: [] };
}

class VoiceServiceManager {
  constructor(options = {}) {
    this.ports = options.ports ?? PORTS;
    this.python = options.python ?? pythonCommand();
    this.state = 'starting';
    this.detail = 'Voice engine is starting.';
    this.port = null;
    this.owned = null;
    this.ownerToken = null;
    this.closed = false;
    this.startTask = null;
    this.monitorTask = null;
    this.restarts = [];
    this.failures = 0;
    this.awaitingShared = 0;
    this.shared = false;
    this.lastOutput = '';
    this.monitor = setInterval(() => { void this.check(); }, options.monitorMs ?? 2000);
    this.monitor.unref();
  }

  snapshot() { return { state: this.state, detail: this.detail, port: this.port, owned: !!this.owned }; }
  set(state, detail) { this.state = state; this.detail = detail; }

  adopt(found) {
    this.port = found.port;
    this.awaitingShared = 0;
    this.shared = true;
    this.set(found.health.state, found.health.state === 'ready' ? 'Local voice engine is ready.' : found.health.detail);
    return this.snapshot();
  }

  adoptHealth(health) {
    this.set(health.state, health.state === 'ready' ? 'Local voice engine is ready.' : health.detail);
    return this.snapshot();
  }

  // A BrightTales window that was using another window's service waits for that owner to
  // bring it back before considering a private copy, so two launchers never race into
  // duplicate services on the same port.
  async awaitSharedService() {
    const deadline = this.awaitingShared;
    if (!deadline) return null;
    while (!this.closed && Date.now() < deadline) {
      await sleep(400);
      const found = await this.compatible();
      if (found) return found;
    }
    this.awaitingShared = 0;
    return null;
  }

  async compatible() {
    for (const port of this.ports) {
      const health = await healthAt(port);
      if (health) return { port, health };
    }
    return null;
  }

  async start() {
    if (this.closed) return this.snapshot();
    if (this.startTask) return this.startTask;
    this.startTask = this.startInner().finally(() => { this.startTask = null; });
    return this.startTask;
  }

  async startInner() {
    this.set('starting', 'Voice engine is starting.');
    this.failures = 0;
    const shared = await this.compatible() ?? await this.awaitSharedService();
    if (shared) return this.adopt(shared);
    this.awaitingShared = 0;
    this.shared = false;
    const port = await this.findFreePort();
    if (port === null) {
      this.port = null;
      this.set('unavailable', 'Voice service ports are in use. Close the other local app and retry.');
      return this.snapshot();
    }
    this.port = port;
    this.ownerToken = randomBytes(32).toString('hex');
    const child = spawn(this.python.command, [...this.python.args, path.join(ROOT, 'voice_local.py'), '--port', String(port)], {
      cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BRIGHTTALES_VOICE_OWNER_TOKEN: this.ownerToken, PYTHONDONTWRITEBYTECODE: '1' },
    });
    this.owned = child;
    let launchError = '';
    child.once('error', error => { launchError = error.code === 'ENOENT' ? 'Required Python executable is missing.' : `Voice service failed to start: ${error.message}`; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { this.lastOutput = (this.lastOutput + chunk.toString('utf8')).slice(-1200); });
    child.once('exit', (code, signal) => {
      if (this.owned !== child) return;
      this.owned = null;
      this.ownerToken = null;
      if (this.closed || this.state === 'starting') return;
      this.set('unavailable', `Voice service stopped unexpectedly${code === null ? '' : ` (exit ${code})`}. Reconnecting.`);
      this.scheduleRestart();
    });
    const deadline = Date.now() + 25000;
    while (!this.closed && Date.now() < deadline) {
      const health = await healthAt(port, 900);
      if (health) return this.adoptHealth(health);
      if (launchError || child.exitCode !== null) break;
      await sleep(180);
    }
    const raced = await this.compatible();
    if (raced) return this.adopt(raced);
    this.port = null;
    this.shared = false;
    this.set('error', launchError || (this.lastOutput.includes('Address already in use') ? 'Voice service port was taken during startup. Retry to reconnect.' : 'Voice service failed to start. Check Python, installed models and FFmpeg.'));
    return this.snapshot();
  }

  async findFreePort() {
    for (const port of this.ports) if (await portIsFree(port)) return port;
    return null;
  }

  scheduleRestart() {
    if (this.closed || this.startTask || this.monitorTask) return;
    const now = Date.now();
    this.restarts = this.restarts.filter(time => now - time < 60000);
    if (this.restarts.length >= 2) {
      this.set('error', 'Voice service stopped repeatedly. Select Retry when ready.');
      return;
    }
    this.restarts.push(now);
    const delay = this.restarts.length * 500;
    this.monitorTask = setTimeout(() => {
      this.monitorTask = null;
      if (!this.closed) void this.start();
    }, delay);
  }

  async check() {
    if (this.closed || this.startTask || this.state === 'error') return;
    if (!this.port) { this.scheduleRestart(); return; }
    const health = await healthAt(this.port);
    if (health) {
      this.failures = 0;
      return this.adoptHealth(health);
    }
    this.failures += 1;
    if (this.failures < HEALTH_FAILURES_BEFORE_RESTART) return;
    if (this.shared) {
      this.port = null;
      this.awaitingShared = Date.now() + SHARED_GRACE_MS;
      this.set('unavailable', 'Waiting for the shared voice service to come back.');
      this.scheduleRestart();
      return;
    }
    if (!this.owned || this.owned.exitCode !== null) return;
    this.set('unavailable', 'Voice service is not responding. Select Retry to restart it.');
  }

  async retry() {
    if (this.closed) return this.snapshot();
    if (this.startTask) return this.snapshot();
    this.restarts = [];
    if (this.monitorTask) { clearTimeout(this.monitorTask); this.monitorTask = null; }
    const wasShared = this.shared && !!this.port;
    if (this.owned) await this.stopOwned();
    this.port = null;
    if (wasShared) this.awaitingShared = Date.now() + SHARED_GRACE_MS;
    this.shared = false;
    void this.start();
    return this.snapshot();
  }

  async stopOwned() {
    const child = this.owned;
    const port = this.port;
    const token = this.ownerToken;
    if (!child) return;
    this.owned = null;
    this.ownerToken = null;
    if (port && token && child.exitCode === null) {
      try { await fetch(`http://127.0.0.1:${port}/voice-api/owner/shutdown`, { method: 'POST', headers: { 'X-BrightTales-Owner': token }, signal: AbortSignal.timeout(1500) }); } catch { /* The child may already be gone. */ }
    }
    for (let i = 0; i < 30 && child.exitCode === null; i++) await sleep(100);
    if (child.exitCode === null && !child.killed) child.kill();
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.monitor);
    if (this.monitorTask) clearTimeout(this.monitorTask);
    await this.stopOwned();
  }
}

const writeJson = (response, status, value) => {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  response.end(body);
};

async function handleVoiceRequest(request, response, manager) {
  const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
  if (!pathname.startsWith('/voice-api/') && !pathname.startsWith('/voice-manager/')) return false;
  if (!/^127\.0\.0\.1:\d+$/.test(request.headers.host || '')) { writeJson(response, 403, { error: 'Local Studio request required.' }); return true; }
  if (pathname === '/voice-manager/status' && request.method === 'GET') { writeJson(response, 200, manager.snapshot()); return true; }
  if (pathname === '/voice-manager/retry' && request.method === 'POST') {
    const origin = request.headers.origin;
    if (request.headers['x-brighttales-voice'] !== '1' || origin && origin !== `http://${request.headers.host}`) writeJson(response, 403, { error: 'Local Studio request required.' });
    else writeJson(response, 202, await manager.retry());
    return true;
  }
  if (pathname.startsWith('/voice-manager/') || pathname === '/voice-api/owner/shutdown') { writeJson(response, 404, { error: 'Unknown local endpoint.' }); return true; }
  const state = manager.snapshot();
  if (state.state !== 'ready' || !state.port) { writeJson(response, 503, { error: state.detail }); return true; }
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 28_000_000) { writeJson(response, 413, { error: 'Voice request is too large.' }); return true; }
      chunks.push(chunk);
    }
    const upstream = await fetch(`http://127.0.0.1:${state.port}${request.url}`, {
      method: request.method, body: request.method === 'GET' ? undefined : Buffer.concat(chunks),
      headers: { 'Content-Type': request.headers['content-type'] || 'application/json', 'X-BrightTales-Voice': request.headers['x-brighttales-voice'] || '' },
      signal: AbortSignal.timeout(120000),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    writeJson(response, 503, { error: 'Voice service stopped responding. Use Retry in Voice Maker.' });
    void manager.check();
  }
  return true;
}

module.exports = { VoiceServiceManager, handleVoiceRequest, healthAt };
