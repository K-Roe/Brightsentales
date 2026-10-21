import { writeFile } from 'node:fs/promises';

// Connect only to the disposable headless Chrome launched for this audit.
const pages = await fetch('http://127.0.0.1:9246/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:4178'));
if (!page) throw Error('Disposable audit page not found');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { const result = pending.get(data.id); pending.delete(data.id); data.error ? result.reject(Error(data.error.message)) : result.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
});
function send(method, params = {}) { const id = ++nextId; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; }
async function waitFor(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw Error(`UI did not reach: ${expression}`); }
const scene = {
  id: '44444444-4444-4444-8444-000000000001', name: 'Rejected Batch 3 audit', duration: 4, placeId: 'living-room', characters: { max: { x: 700, y: 790 } },
  actions: [
    { id: '44444444-4444-4444-8444-000000000002', characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 700, y: 790 } },
    { id: '44444444-4444-4444-8444-000000000003', characterId: 'max', type: 'sit-down', start: 1, duration: 1.5, artwork: 'provisional-v1', seat: 'chair' },
  ],
};
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await waitFor(`!!document.querySelector('.studio-nav')`);
  await evaluate(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify({ version: 1, scenes: [scene] }))})`);
  await send('Page.reload');
  await waitFor(`!!document.querySelector('.studio-nav')`);
  await evaluate(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`document.querySelectorAll('.scene-library article').length === 1`);
  await evaluate(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas')`);
  await evaluate(`document.querySelector('.director-cast button').click()`);
  const result = await evaluate(`(()=>{
    const buttons=[...document.querySelectorAll('.scene-director .director-actions button')];
    const find=name=>buttons.find(button=>button.textContent.trim()===name);
    return {
      rejectedDisabled:['Sit down','Stand up','Pick up toy','Put down toy'].every(name=>find(name)?.disabled),
      approvedEnabled:['Wave','Clap','Point','Nod','Shake head','Jump','Excited bounce'].every(name=>find(name) && !find(name).disabled),
      toyDisabled:[...document.querySelectorAll('.scene-director button')].find(button=>button.textContent.trim()==='Add toy ball')?.disabled,
      savedSceneWarning:document.querySelector('.episode-warning[role="alert"]')?.textContent ?? null,
      sceneVisible:!!document.querySelector('.scene-stage canvas'),
    };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 1200));
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL('./browser-gate.png', import.meta.url), Buffer.from(screenshot.data, 'base64'));
  await writeFile(new URL('./browser-gate.json', import.meta.url), JSON.stringify({ ...result, errors }, null, 2));
  if (!result.rejectedDisabled || !result.approvedEnabled || !result.toyDisabled || !result.savedSceneWarning || errors.length) throw Error('Review gate browser check failed');
  process.stdout.write(`${JSON.stringify({ ...result, errors })}\n`);
} finally { socket.close(); }
