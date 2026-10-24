import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/max-maxine-greeting-v3');
const downloads = resolve(root, 'foundation-downloads');
await mkdir(downloads, { recursive: true });
const library = JSON.parse(await readFile(resolve(root, 'foundation-scene.json'), 'utf8'));
const pages = await fetch('http://127.0.0.1:9250/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page');
if (!page) throw Error('Disposable Chrome page unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let nextId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const callback = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
});
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject }));
}
async function js(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function waitFor(expression, message, attempts = 100) {
  for (let i = 0; i < attempts; i++) { if (await js(expression)) return; await pause(200); }
  throw Error(message);
}
async function clickText(label) {
  const bounds = await js(`(()=>{const el=[...document.querySelectorAll('button')].find(item=>item.textContent?.trim()===${JSON.stringify(label)});if(!el)throw Error('Missing ${label}');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: bounds.x, y: bounds.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
}
async function previewAt(time) {
  const coords = await js(`(()=>{const el=document.querySelector('.timeline-ruler');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+116+${time}*24,y:r.top+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: coords.x, y: coords.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await pause(150);
  const url = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`);
  await writeFile(resolve(root, `foundation-preview-${time.toFixed(1)}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not load');
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Disposable profile already has scenes');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify(library))})`);
  await send('Page.reload'); await pause(500);
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reload');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Foundation scene missing');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas')`, 'Scene Maker did not open');
  await pause(1000);
  for (const time of [2.8, 2.9, 3.0, 3.1, 3.6]) await previewAt(time);
  await clickText('Save Scene');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`, 'Scene save failed');
  await send('Page.reload'); await pause(500);
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio failed to reload after save');
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (JSON.stringify(reopened) !== JSON.stringify(library)) throw Error('Foundation scene changed on save/reopen');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Saved scene missing');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas')`, 'Saved scene did not reopen');
  await pause(1000);
  await clickText('Export scene video (WebM)');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Scene video exported')`, 'Foundation export failed', 120);
  let name;
  for (let i = 0; i < 80; i++) { name = (await readdir(downloads)).find(item => item.endsWith('.webm')); if (name) break; await pause(250); }
  if (!name) throw Error('Video download missing');
  await rename(resolve(downloads, name), resolve(root, 'foundation-scene.webm'));
  await writeFile(resolve(root, 'foundation-browser-result.json'), JSON.stringify({ savedAndReopened: true, previews: [2.8,2.9,3.0,3.1,3.6], videoBytes: (await readFile(resolve(root, 'foundation-scene.webm'))).length, consoleErrors: errors }, null, 2));
  if (errors.length) throw Error(`Browser console errors: ${errors.join(' | ')}`);
  console.log('Foundation preview, save/reopen, and scene export completed');
} finally { ws.close(); }
