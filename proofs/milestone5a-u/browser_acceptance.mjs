import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone5a-u');
const shotDir = resolve(root, 'recording-frames');
await mkdir(shotDir, { recursive: true });
const findings = { browserErrors: [], failedRequests: [], events: [], assetHashes: {} };

const frames = ['max-0.png', 'max-side-0.png', 'max-side-v3-1.png', 'max-side-v3-2.png', 'max-side-v3-3.png', 'max-side-v3-4.png', 'max-wave-1.png', 'max-wave-2.png', 'max-wave-3.png'];
for (const [port, tag] of [[5174, 'candidate'], [5173, 'original']]) {
  for (const frame of frames) {
    const url = `http://127.0.0.1:${port}/art/${frame}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    const digest = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
    const expectedFile = tag === 'candidate' ? `proofs/milestone5a-q-recovery/frames/${frame}` : `public/art/${frame}`;
    const expected = createHash('sha256').update(await readFile(expectedFile)).digest('hex');
    if (digest !== expected) throw new Error(`${tag} asset mismatch: ${frame}`);
    findings.assetHashes[`${tag}/${frame}`] = digest;
  }
}

const target = await fetch('http://127.0.0.1:9225/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((yes, no) => { socket.addEventListener('open', yes, { once: true }); socket.addEventListener('error', no, { once: true }); });
let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const action = pending.get(message.id);
    if (action) { pending.delete(message.id); message.error ? action.reject(new Error(JSON.stringify(message.error))) : action.resolve(message.result); }
  } else if (message.method === 'Runtime.exceptionThrown') {
    findings.browserErrors.push(message.params.exceptionDetails.text);
  } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    findings.browserErrors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
  } else if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
    findings.failedRequests.push(message.params.errorText);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evalPage = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (expression, timeout = 8000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await evalPage(expression)) return; await sleep(100); }
  throw new Error(`Timed out waiting for ${expression}`);
};
const screenshot = async name => {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(resolve(root, name), Buffer.from(result.data, 'base64'));
};
let sequence = 0;
const record = async (label, durationMs, intervalMs = 100) => {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(shotDir, `frame-${String(sequence++).padStart(4, '0')}.png`), Buffer.from(result.data, 'base64'));
    await sleep(intervalMs);
  }
  findings.events.push({ label, capturedFrames: sequence });
};
const clickButton = async text => {
  const clicked = await evalPage(`(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)})); if (!button || button.disabled) return false; button.click(); return true; })()`);
  if (!clicked) throw new Error(`Button unavailable: ${text}`);
};
const selectMax = async () => {
  const selected = await evalPage(`(() => { const card = [...document.querySelectorAll('.character-card')].find(item => item.querySelector('strong')?.textContent === 'Max'); if (!card) return false; card.click(); return card.getAttribute('aria-pressed') === 'true'; })()`);
  if (!selected) {
    await waitFor(`document.querySelector('.character-card strong')?.textContent === 'Max' && document.querySelector('.character-card')?.getAttribute('aria-pressed') === 'true'`);
  }
};
const assertMaxSelected = async () => {
  const label = await evalPage(`document.querySelector('.wave-button')?.getAttribute('aria-label')`);
  if (label !== 'Wave Max') throw new Error(`Max was not selected: ${label}`);
};
const canvasRect = async () => evalPage(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; })()`);
const point = async (x, y) => { const rect = await canvasRect(); return { x: rect.x + rect.width * x / 1672, y: rect.y + rect.height * y / 941 }; };
const mouse = async (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
const clickStage = async (x, y) => {
  const p = await point(x, y);
  await mouse('mouseMoved', p.x, p.y);
  await mouse('mousePressed', p.x, p.y, 1);
  await mouse('mouseReleased', p.x, p.y);
};
const dragStage = async (fromX, fromY, toX, toY) => {
  const start = await point(fromX, fromY), end = await point(toX, toY);
  await mouse('mouseMoved', start.x, start.y);
  await mouse('mousePressed', start.x, start.y, 1);
  for (let step = 1; step <= 10; step++) {
    await mouse('mouseMoved', start.x + (end.x - start.x) * step / 10, start.y + (end.y - start.y) * step / 10, 1);
    await sleep(20);
  }
  await mouse('mouseReleased', end.x, end.y);
};
const navigate = async url => {
  await send('Page.navigate', { url });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('canvas')`);
  await clickButton('Playground');
  await sleep(900);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false });

await navigate('http://127.0.0.1:5174/');
await screenshot('candidate-idle.png');
await record('candidate idle', 600);

// Move Maxine closer and farther downstage so Max crosses visually behind her.
await dragStage(1090, 700, 850, 750);
await sleep(300);
await screenshot('candidate-depth-setup.png');
await selectMax();
await assertMaxSelected();
await clickStage(1280, 730);
await clickButton('Play scene');
await record('Max walking right behind Maxine', 4200);
await screenshot('candidate-walk-stopped.png');
await waitFor(`!document.querySelector('.play-button')?.disabled`);

await assertMaxSelected();
await clickButton('Wave Max');
await record('Max wave one', 1800);
await waitFor(`!document.querySelector('.wave-button')?.disabled`);
await clickButton('Wave Max');
await record('Max wave two', 1800);
await waitFor(`!document.querySelector('.wave-button')?.disabled`);
await screenshot('candidate-returned-idle.png');

await clickStage(320, 755);
await clickButton('Play scene');
await record('Max walking left', 4300);
await waitFor(`!document.querySelector('.play-button')?.disabled`);
await screenshot('candidate-after-left-walk.png');
findings.candidateStorage = await evalPage(`({ library: localStorage.getItem('brightsenappstales.library.v1'), scene: localStorage.getItem('brightsenappstales.scene.v1') })`);

// Original comparison comes from the normal Vite server on its own origin.
await navigate('http://127.0.0.1:5173/');
await screenshot('original-hoodie-idle.png');
await record('original Max comparison', 500);

findings.recordingFrames = sequence;
findings.candidateOrigin = 'http://127.0.0.1:5174/';
findings.originalOrigin = 'http://127.0.0.1:5173/';
findings.originalStorage = await evalPage(`({ library: localStorage.getItem('brightsenappstales.library.v1'), scene: localStorage.getItem('brightsenappstales.scene.v1') })`);
await writeFile(resolve(root, 'browser-findings.json'), JSON.stringify(findings, null, 2) + '\n');
socket.close();
if (findings.browserErrors.length || findings.failedRequests.length) process.exitCode = 1;
