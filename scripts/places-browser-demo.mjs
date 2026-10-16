import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone4a');
const frames = resolve(root, 'frames');
const downloads = resolve(root, 'downloads');
await mkdir(frames, { recursive: true }); await mkdir(downloads, { recursive: true });
const target = await fetch('http://127.0.0.1:9235/json/new?http://127.0.0.1:4178/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let serial = 0, frame = 0, recording = false;
const pending = new Map(), errors = [];
ws.addEventListener('message', async event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const done = pending.get(message.id); pending.delete(message.id); message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  if (message.method === 'Page.screencastFrame') {
    if (recording) await writeFile(resolve(frames, `${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(message.params.data, 'base64'));
    send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
  }
});
function send(method, params = {}) { const id = ++serial; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function until(expression, message) { for (let i = 0; i < 90; i++) { if (await js(expression)) return; await pause(200); } throw new Error(message); }
async function click(selector, text = '') { await until(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(text)}));return !!e&&!e.disabled})()`, `Missing ${text || selector}`); await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(text)}));e.scrollIntoView({block:'center'});e.click()})()`); await pause(250); }
async function shot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(root, name), Buffer.from(result.data, 'base64')); }
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
  await pause(1800);
  assert(await js(`document.querySelector('.studio-nav .active')?.textContent.includes('Characters')`), 'Characters default changed');
  assert(await js(`localStorage.length===0`), 'Test profile was not empty');
  recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 3 });
  await click('.studio-nav button', 'Places');
  assert(await js(`document.querySelectorAll('.place-card').length===3`), 'Places library missing entries');
  assert(await js(`document.querySelector('.place-card:first-child img')?.getAttribute('src')==='/art/living-room.png'`), 'Approved Living Room art missing');
  assert(await js(`[...document.querySelectorAll('.place-card')].slice(1).every(e=>e.textContent.includes('Artwork Needed') && e.querySelector('button').disabled && !e.querySelector('img'))`), 'Unapproved art was treated as available');
  await shot('desktop-places.png');
  await click('.place-card:first-child button', 'Preview');
  await until(`document.querySelector('.place-preview img')?.complete`, 'Living Room preview did not load');
  const dimensions = await js(`(()=>{const e=document.querySelector('.place-preview img');return {naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,renderedWidth:e.getBoundingClientRect().width,renderedHeight:e.getBoundingClientRect().height}})()`);
  assert(dimensions.naturalWidth === 1672 && dimensions.naturalHeight === 941 && Math.abs(dimensions.renderedWidth / dimensions.renderedHeight - 1672 / 941) < .01, 'Preview aspect ratio changed');
  await shot('desktop-living-room-preview.png');
  await click('.place-preview button', 'Close preview');
  assert(await js(`!document.querySelector('.place-preview')`), 'Preview did not close');
  await click('.studio-nav button', 'Characters');
  await click('.create-brightling');
  await js(`document.querySelector('#brightling-name').focus()`);
  await send('Input.insertText', { text: 'Place Check' });
  await click('.maker-save', 'Save Brightling');
  await until(`document.querySelectorAll('.portrait-card').length===3`, 'Character Maker regressed');
  await click('.portrait-card:nth-child(3) button', 'Add to Playground');
  await until(`document.querySelectorAll('.character-card').length===3`, 'Playground custom character missing');
  await click('.save-actions button', 'Save scene');
  const before = await js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1')})`);
  await shot('desktop-playground-preserved.png');
  await click('.studio-nav button', 'Places');
  await click('.place-card:first-child button', 'Preview');
  await pause(500);
  const after = await js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1')})`);
  assert(JSON.stringify(after) === JSON.stringify(before), 'Place preview changed stored characters or scene');
  await click('.studio-nav button', 'Playground');
  assert(await js(`document.querySelectorAll('.character-card').length===3`), 'Playground changed after preview');
  await click('.studio-nav button', 'Characters');
  await click('[aria-label="Studio backup"] button', 'Export Studio Backup');
  await pause(1200);
  assert((await readdir(downloads)).some(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json')), 'Studio Backup export regressed');
  await click('.studio-nav button', 'Places');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(700);
  const mobileOverview = await js(`({scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth})`);
  await shot('mobile-places.png');
  await click('.place-card:first-child button', 'Preview');
  const mobilePreview = await js(`({scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth})`);
  await shot('mobile-living-room-preview.png');
  assert(mobileOverview.scrollWidth <= mobileOverview.viewport && mobilePreview.scrollWidth <= mobilePreview.viewport, 'Mobile Places overflows horizontally');
  assert(errors.length === 0, 'Browser console errors');
  await writeFile(resolve(root, 'browser-report.json'), JSON.stringify({ result: 'passed', dimensions, mobileOverview, mobilePreview, storageUnchanged: true, studioBackupExported: true, frames: frame, errors, isolatedProfile: true }, null, 2));
  console.log(JSON.stringify({ result: 'passed', frames: frame, errors, dimensions }));
} finally {
  recording = false;
  await send('Page.stopScreencast').catch(() => {});
  ws.close();
}
