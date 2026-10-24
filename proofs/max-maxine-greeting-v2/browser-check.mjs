import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run only against a disposable Chrome profile and the local production Studio.
const root = resolve('proofs/max-maxine-greeting-v2');
const downloads = resolve(root, 'downloads');
await mkdir(downloads, { recursive: true });
const sceneLibrary = JSON.parse(await readFile(resolve(root, 'greeting-scene.json'), 'utf8'));
const scene = sceneLibrary.scenes[0];
const pages = await fetch('http://127.0.0.1:9246/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page');
if (!page) throw Error('Disposable Chrome page is unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const callback = pending.get(data.id);
    pending.delete(data.id);
    data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result);
  }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
});
function send(method, params = {}) {
  const id = ++sequence;
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
  throw Error(`${message}; status=${await js(`document.querySelector('.scene-status')?.textContent`)}`);
}
async function reload() {
  try { await send('Page.reload'); } catch (error) { if (!String(error).includes('Inspected target navigated')) throw error; }
  await pause(450);
}
async function clickText(text) {
  const bounds = await js(`(()=>{const element=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()===${JSON.stringify(text)});if(!element)throw Error('Missing button: ${text}');element.scrollIntoView({block:'center'});const b=element.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', buttons: 0, clickCount: 1 });
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(resolve(root, name), Buffer.from(result.data, 'base64'));
}
async function downloaded(name) {
  for (let i = 0; i < 80; i++) {
    if ((await readdir(downloads)).includes(name)) {
      const bytes = await readFile(resolve(downloads, name));
      if (bytes.length > 1000) return bytes.length;
    }
    await pause(250);
  }
  throw Error(`Missing or empty download: ${name}`);
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not load');
  const existing = await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`);
  if (existing !== null && JSON.stringify(JSON.parse(existing)) !== JSON.stringify(sceneLibrary) || await js(`localStorage.getItem('brightsenappstales.episodes.v1') !== null`)) throw Error('Disposable profile contains unexpected data');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify(sceneLibrary))})`);
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reopen');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Greeting scene was not loaded');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas')`, 'Scene Maker did not open greeting');
  await pause(1000);
  await js(`document.querySelector('.director-cast button').click()`);
  const disabled = await js(`(()=>{const buttons=[...document.querySelectorAll('.director-actions button')];return ['Sit down','Stand up','Pick up toy','Put down toy'].every(label=>buttons.find(button=>button.textContent===label)?.disabled)})()`);
  if (!disabled) throw Error('A rejected Batch 3 action is enabled');
  await screenshot('scene-maker.png');
  await clickText('Save Scene');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`, 'Scene Maker save failed');
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reload after save');
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (JSON.stringify(reopened) !== JSON.stringify(sceneLibrary)) throw Error('Scene changed on save/reopen');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Saved scene was not listed');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.scene-stage canvas')`, 'Saved scene did not reopen in Scene Maker');
  await pause(1800);
  await clickText('Export scene video (WebM)');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Scene video exported')`, 'Scene recording failed', 130);
  const sceneBytes = await downloaded('Max_and_Maxine_Greeting_V2.webm');
  await rename(resolve(downloads, 'Max_and_Maxine_Greeting_V2.webm'), resolve(root, 'greeting-scene.webm'));
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Episodes')).click()`);
  await waitFor(`!![...document.querySelectorAll('button')].find(button=>button.textContent==='Create Episode')`, 'Episode Maker did not open');
  await clickText('Create Episode');
  await waitFor(`!!document.querySelector('input[aria-label="Episode name"]')`, 'New episode did not open');
  await js(`(()=>{const input=document.querySelector('input[aria-label="Episode name"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'Max and Maxine Greeting V2');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await js(`document.querySelector('.episode-scene-library button').click()`);
  await waitFor(`!!document.querySelector('.episode-cards article')`, 'Greeting scene was not added to episode');
  await clickText('Save Episode');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Episode saved')`, 'Episode save failed');
  const savedEpisode = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1'))`);
  if (savedEpisode.episodes.length !== 1 || savedEpisode.episodes[0].sceneIds[0] !== scene.id) throw Error('Saved episode does not reference greeting scene');
  await writeFile(resolve(root, 'greeting-episode.json'), JSON.stringify(savedEpisode, null, 2) + '\n');
  await clickText('Export Episode Video');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 'Episode export failed', 150);
  const episodeBytes = await downloaded('Max_and_Maxine_Greeting_V2.webm');
  // The two exports share a default name. Keep the episode under its own review filename.
  const episodeVideo = await readFile(resolve(downloads, 'Max_and_Maxine_Greeting_V2.webm'));
  await writeFile(resolve(root, 'greeting-episode.webm'), episodeVideo);
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Characters')).click()`);
  await waitFor(`!![...document.querySelectorAll('button')].find(button=>button.textContent==='Export Studio Backup')`, 'Backup control unavailable');
  await clickText('Export Studio Backup');
  let backupName;
  for (let i = 0; i < 80; i++) { backupName = (await readdir(downloads)).find(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json')); if (backupName) break; await pause(250); }
  if (!backupName) throw Error('Studio Backup download missing');
  const backup = JSON.parse(await readFile(resolve(downloads, backupName), 'utf8'));
  if (backup.timedScenes?.scenes?.[0]?.id !== scene.id || backup.episodes?.episodes?.[0]?.sceneIds?.[0] !== scene.id) throw Error('Studio Backup does not contain greeting');
  await writeFile(resolve(root, 'greeting-studio-backup.json'), JSON.stringify(backup, null, 2) + '\n');
  if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  const result = { sceneSaveReload: true, episodeSave: true, sceneBytes, episodeBytes, rejectedBatch3Disabled: disabled, backupContainsGreeting: true, consoleErrors: errors, disposableProfile: true };
  await writeFile(resolve(root, 'browser-check.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} finally { ws.close(); }
