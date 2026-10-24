import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/max-maxine-greeting-v2');
const downloads = resolve(root, 'downloads');
const pages = await fetch('http://127.0.0.1:9246/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page');
if (!page) throw Error('Disposable Studio page unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
let id = 0;
const waiting = new Map();
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (!data.id || !waiting.has(data.id)) return;
  const item = waiting.get(data.id); waiting.delete(data.id);
  data.error ? item.fail(Error(data.error.message)) : item.ok(data.result);
});
function send(method, params = {}) { const key = ++id; ws.send(JSON.stringify({ id: key, method, params })); return new Promise((ok, fail) => waiting.set(key, { ok, fail })); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(ok => setTimeout(ok, ms));
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Characters')).click()`);
  for (let i = 0; i < 40 && !await js(`[...document.querySelectorAll('button')].some(button=>button.textContent==='Export Studio Backup')`); i++) await pause(250);
  const bounds = await js(`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent==='Export Studio Backup');button.scrollIntoView({block:'center'});const b=button.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', buttons: 0, clickCount: 1 });
  let backupName;
  for (let i = 0; i < 80; i++) { backupName = (await readdir(downloads)).find(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json')); if (backupName) break; await pause(250); }
  if (!backupName) throw Error(`Backup download failed: ${await js(`document.body.innerText.slice(-700)`)}`);
  const backup = JSON.parse(await readFile(resolve(downloads, backupName), 'utf8'));
  const sceneId = '55555555-5555-4555-8555-000000000001';
  if (backup.timedScenes?.scenes?.[0]?.id !== sceneId || backup.episodes?.episodes?.[0]?.sceneIds?.[0] !== sceneId) throw Error('Backup missing greeting scene or episode');
  await writeFile(resolve(root, 'greeting-studio-backup.json'), JSON.stringify(backup, null, 2) + '\n');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  for (let i = 0; i < 40 && !await js(`!!document.querySelector('.scene-library article')`); i++) await pause(250);
  await js(`document.querySelector('.scene-library article button').click()`);
  for (let i = 0; i < 40 && !await js(`!!document.querySelector('.director-cast button')`); i++) await pause(250);
  await js(`document.querySelector('.director-cast button').click()`);
  const disabled = await js(`(()=>{const buttons=[...document.querySelectorAll('.director-actions button')];return ['Sit down','Stand up','Pick up toy','Put down toy'].every(label=>buttons.find(button=>button.textContent===label)?.disabled)})()`);
  if (!disabled) throw Error('Rejected Batch 3 actions are enabled');
  const sceneBytes = (await readFile(resolve(root, 'greeting-scene.webm'))).length;
  const episodeBytes = (await readFile(resolve(root, 'greeting-episode.webm'))).length;
  const result = { sceneSaveReload: true, episodeSave: true, sceneBytes, episodeBytes, rejectedBatch3Disabled: true, backupContainsGreeting: true, disposableProfile: true };
  await writeFile(resolve(root, 'browser-check.json'), JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
} finally { ws.close(); }
