import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run against a disposable Chrome profile with remote debugging on port 9242
// and the local Vite app on port 4177. No normal browser data is read.
const root = resolve('proofs/frame-actions-batch2');
const downloads = resolve(root, 'provisional-downloads');
await mkdir(downloads, { recursive: true });
const pages = await fetch('http://127.0.0.1:9242/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:4177'));
if (!page) throw Error('Disposable Chrome page is unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
});
function send(method, params = {}) { const id = ++sequence; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject })); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function waitFor(expression, message, attempts = 100) { for (let i = 0; i < attempts; i++) { if (await js(expression)) return; await pause(200); } throw Error(message); }
async function reload() { try { await send('Page.reload'); } catch (error) { if (!String(error).includes('Inspected target navigated')) throw error; } await pause(350); }
async function shot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(resolve(root, name), Buffer.from(result.data, 'base64')); }
async function pointerClick(selector) {
  const bounds = await js(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const b=element.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', buttons: 0, clickCount: 1 });
}
async function pointerClickText(text) {
  const bounds = await js(`(()=>{const element=[...document.querySelectorAll('button')].find(button=>button.textContent?.includes(${JSON.stringify(text)}));element.scrollIntoView({block:'center'});const b=element.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', buttons: 0, clickCount: 1 });
}
const id = n => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const scene = {
  id: id(1), name: 'Batch 2 Provisional Gestures', duration: 10, placeId: 'living-room',
  characters: { max: { x: 500, y: 790 }, maxine: { x: 1120, y: 820 } },
  actions: [
    { id: id(2), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 500, y: 790 } },
    { id: id(3), characterId: 'max', type: 'point', start: 0, duration: 2, artwork: 'provisional-v1' },
    { id: id(4), characterId: 'max', type: 'nod', start: 2, duration: 2, artwork: 'provisional-v1' },
    { id: id(5), characterId: 'max', type: 'shake', start: 4, duration: 2, artwork: 'provisional-v1' },
    { id: id(6), characterId: 'max', type: 'clap', start: 6, duration: 2, artwork: 'provisional-v1' },
    { id: id(7), characterId: 'maxine', type: 'appear', start: 0, duration: 0, point: { x: 1120, y: 820 } },
    { id: id(8), characterId: 'maxine', type: 'point', start: 1, duration: 2, artwork: 'provisional-v1' },
    { id: id(9), characterId: 'maxine', type: 'nod', start: 3, duration: 2, artwork: 'provisional-v1' },
    { id: id(10), characterId: 'maxine', type: 'shake', start: 5, duration: 2, artwork: 'provisional-v1' },
    { id: id(11), characterId: 'maxine', type: 'clap', start: 7, duration: 2, artwork: 'provisional-v1' },
  ],
};
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not load');
  const existing = await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`);
  if (existing && JSON.stringify(JSON.parse(existing)) !== JSON.stringify({ version: 1, scenes: [scene] })) throw Error('Disposable browser profile contains unexpected scene data');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify({ version: 1, scenes: [scene] }))})`);
  await reload();
  await pause(500);
  await waitFor(`[...document.querySelectorAll('.studio-nav button')].some(button=>button.textContent.includes('Scenes'))`, 'Studio did not reload');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Saved scene did not appear');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas') && !!document.querySelector('.director-cast button')`, 'Scene editor did not open');
  await js(`document.querySelector('.director-cast button').click()`);
  await waitFor(`!![...document.querySelectorAll('.director-actions button')].find(button=>button.textContent==='Clap')`, 'Clap button is missing');
  for (const name of ['Point', 'Nod', 'Shake head']) if (!await js(`[...document.querySelectorAll('.director-actions button')].some(button=>button.textContent===${JSON.stringify(name)})`)) throw Error(`${name} action is missing`);
  await js(`document.querySelector('.scene-stage-main').scrollIntoView({block:'start'})`);
  await pause(1300);
  await shot('provisional-scene-maker.png');
  if (process.argv.includes('--ui-only')) { process.stdout.write(JSON.stringify({ result: 'ui-passed', errors }) + '\n'); process.exit(0); }
  await pointerClick('.scene-heading button:last-child');
  try { await waitFor(`document.querySelector('.scene-heading button:last-child')?.textContent==='Export scene video (WebM)'`, 'Scene export did not finish', 130); }
  catch (error) { process.stdout.write(JSON.stringify({ button: await js(`document.querySelector('.scene-heading button:last-child')?.textContent`), status: await js(`document.querySelector('.scene-status')?.textContent`), errors }) + '\n'); throw error; }
  let files = [];
  for (let i = 0; i < 40; i++) { files = await readdir(downloads); if (files.includes('Batch_2_Provisional_Gestures.webm')) break; await pause(250); }
  if (!files.includes('Batch_2_Provisional_Gestures.webm')) throw Error('Scene WebM download is missing');
  const webm = await readFile(resolve(downloads, 'Batch_2_Provisional_Gestures.webm'));
  if (webm.length < 1000) throw Error('Exported scene video is empty');
  await js(`[...document.querySelectorAll('.scene-heading button')].find(button=>button.textContent==='Save Scene').click()`);
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('saved')`, 'Scene did not save');
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reopen');
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (JSON.stringify(reopened) !== JSON.stringify({ version: 1, scenes: [scene] })) throw Error('Reopened scene changed provisional frame markers');
  const episode = { id: id(20), name: 'Batch 2 Provisional Episode', sceneIds: [scene.id] };
  await js(`localStorage.setItem('brightsenappstales.episodes.v1', ${JSON.stringify(JSON.stringify({ version: 1, episodes: [episode] }))})`);
  await reload();
  await waitFor(`[...document.querySelectorAll('.studio-nav button')].some(button=>button.textContent.includes('Episodes'))`, 'Episode navigation did not load');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Episodes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Episode did not appear');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.episode-preview canvas')`, 'Episode editor did not open');
  await pointerClickText('Export Episode Video');
  try { await waitFor(`[...document.querySelectorAll('.scene-actions button')].some(button=>button.textContent==='Export Episode Video') && document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 'Episode export did not finish', 150); }
  catch (error) { process.stdout.write(JSON.stringify({ episodeButtons: await js(`[...document.querySelectorAll('.scene-actions button')].map(button=>button.textContent)`), status: await js(`document.querySelector('.scene-status')?.textContent`), errors }) + '\n'); throw error; }
  for (let i = 0; i < 40; i++) { files = await readdir(downloads); if (files.includes('Batch_2_Provisional_Episode.webm')) break; await pause(250); }
  if (!files.includes('Batch_2_Provisional_Episode.webm')) throw Error('Episode WebM download is missing');
  const episodeVideo = await readFile(resolve(downloads, 'Batch_2_Provisional_Episode.webm'));
  if (episodeVideo.length < 1000) throw Error('Exported episode video is empty');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Scene library did not reopen');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.director-cast button')`, 'Scene editor did not reopen');
  await js(`document.querySelector('.director-cast button').click()`);
  await js(`[...document.querySelectorAll('.director-actions button')].find(button=>button.textContent==='Point').click()`);
  await waitFor(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Point')`, 'New point action was not selected');
  await js(`[...document.querySelectorAll('.scene-heading button')].find(button=>button.textContent==='Save Scene').click()`);
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('saved')`, 'New gesture did not save');
  const edited = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (edited.scenes[0].actions.length !== scene.actions.length + 1 || edited.scenes[0].actions.at(-1).artwork !== 'provisional-v1') throw Error('Scene Maker did not persist a newly selected gesture');
  await writeFile(resolve(root, 'provisional-browser-check.json'), JSON.stringify({ scene, videoBytes: webm.length, episodeVideoBytes: episodeVideo.length, saveReload: true, sceneMakerAddAndSave: true, errors, disposableProfile: true }, null, 2));
  if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  process.stdout.write(JSON.stringify({ result: 'passed', videoBytes: webm.length, episodeVideoBytes: episodeVideo.length, errors }) + '\n');
} finally { ws.close(); }
