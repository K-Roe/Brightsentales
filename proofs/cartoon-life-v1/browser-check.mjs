import { mkdtemp, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/cartoon-life-v1');
const profile = await mkdtemp(join(tmpdir(), 'bright-life-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'bright-life-downloads-'));
const original = JSON.parse(await readFile(join(root, 'demo-scene.json'), 'utf8')).scenes[0];
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map(), errors = [], checks = {};
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, attempts = 200) => { for (let i = 0; i < attempts; i++) { const value = await js(expression); if (value) return value; await delay(200); } throw Error(`Timed out: ${expression}`); };
const click = label => js(`(()=>{const item=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!item)throw Error('Missing '+${JSON.stringify(label)});item.click();return true})()`);
const nav = label => js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`);
const screenshot = async filename => { const data = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`); await writeFile(join(root, filename), Buffer.from(data.split(',')[1], 'base64')); };
async function seek(time) {
  const position = await js(`(()=>{const el=document.querySelector('.timeline-ruler');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+116+${time}*24,y:r.top+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: position.x, y: position.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await delay(250);
}
async function upload(selector, path) {
  const doc = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
  if (!nodeId) throw Error(`Missing file input: ${selector}`);
  await send('DOM.setFileInputFiles', { nodeId, files: [path] });
}
async function takeDownload(extension, filename, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    const names = await readdir(downloads);
    const name = names.find(file => file.endsWith(extension));
    if (name && !names.some(file => file.endsWith('.crdownload')) && (await stat(join(downloads, name))).size > 1000) {
      await writeFile(join(root, filename), await readFile(join(downloads, name)));
      await unlink(join(downloads, name));
      return (await stat(join(root, filename))).size;
    }
    await delay(250);
  }
  throw Error(`Missing ${extension} download`);
}
const storedAssets = () => js(`new Promise((resolve,reject)=>{const open=indexedDB.open('brightsenappstales.audio.v1',2);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const tx=open.result.transaction('assets','readonly');const request=tx.objectStore('assets').getAll();request.onsuccess=()=>resolve(request.result.map(a=>({id:a.id,name:a.name,kind:a.kind,duration:a.duration})));request.onerror=()=>reject(request.error)}})`);
async function exportScene() {
  await until(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export scene video (WebM)');return button && !button.disabled})()`);
  await click('Export scene video (WebM)');
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Exporting'))`);
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene video exported')`, 300);
}
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Profile was not empty');
  await nav('Audio');
  await until(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  await upload('input[aria-label="Import audio file"]', join(root, 'gentle-hello.wav'));
  await until(`document.querySelector('.audio-asset-list')?.textContent.includes('gentle-hello.wav')`);
  await js(`(()=>{const select=document.querySelector('select[aria-label="Imported audio type"]');select.value='effect';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await upload('input[aria-label="Import audio file"]', join(root, 'soft-chime.wav'));
  await until(`document.querySelector('.audio-asset-list')?.textContent.includes('soft-chime.wav')`);
  const assets = await storedAssets();
  const music = assets.find(item => item.name === 'gentle-hello.wav');
  const effect = assets.find(item => item.name === 'soft-chime.wav');
  if (!music || !effect) throw Error('Imported audio was not saved');
  checks.audioAssets = assets;
  const clips = [
    { id: '91919191-9191-4191-8191-919191919221', assetId: music.id, start: 0, trimStart: 0, trimEnd: 18.5, volume: .62, fadeIn: .7, fadeOut: 1.2 },
    { id: '91919191-9191-4191-8191-919191919222', assetId: effect.id, start: 9.1, trimStart: 0, trimEnd: .65, volume: .36, fadeIn: .05, fadeOut: .18 },
    { id: '91919191-9191-4191-8191-919191919223', assetId: effect.id, start: 12.8, trimStart: 0, trimEnd: .65, volume: .34, fadeIn: .05, fadeOut: .18 }
  ];
  const enabled = { ...original, audio: clips };
  const baseline = { ...original, id: '92929292-9292-4292-8292-929292929292', name: 'A Little Hello - approved baseline', audio: clips };
  delete baseline.life;
  const library = { version: 1, scenes: [enabled, baseline] };
  await writeFile(join(root, 'saved-scenes.json'), JSON.stringify(library, null, 2) + '\n');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify(library))})`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  await nav('Scenes'); await until(`document.querySelectorAll('.scene-library article').length===2`);
  const openScene = async index => { await js(`document.querySelectorAll('.scene-library article')[${index}].querySelector('button').click()`); await until(`!!document.querySelector('.scene-stage canvas')`); await delay(900); };
  await openScene(0);
  checks.lifeToggleEnabled = await js(`document.querySelector('input[aria-label="Cartoon Life experimental"]')?.checked`);
  if (!checks.lifeToggleEnabled) throw Error('Cartoon Life did not load enabled');
  checks.cameraBlocks = await js(`document.querySelectorAll('[data-lane-kind="camera"] .timeline-block').length`);
  for (const time of [0, 2.3, 5.2, 7.8, 9.6, 11.5, 13.3, 17.7]) { await seek(time); await screenshot(`life-preview-${String(time).replace('.', '-')}.png`); }
  await click('Save Scene'); await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  checks.savedLife = (await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].life.enabled`)) === true;
  await nav('Scenes'); await until(`document.querySelectorAll('.scene-library article').length===2`); await openScene(1);
  checks.baselineToggleOff = !(await js(`document.querySelector('input[aria-label="Cartoon Life experimental"]')?.checked`));
  await seek(2.3); await screenshot('baseline-preview-2-3.png');
  await seek(9.6); await screenshot('baseline-preview-9-6.png');
  await exportScene();
  checks.baselineVideoBytes = await takeDownload('.webm', 'baseline-scene.webm');
  await click('← All scenes'); await until(`document.querySelectorAll('.scene-library article').length===2`); await openScene(0);
  await exportScene();
  checks.lifeSceneVideoBytes = await takeDownload('.webm', 'cartoon-life-scene.webm');
  await nav('Episodes'); await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Episode')`);
  await click('Create Episode'); await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  await js(`(()=>{const input=document.querySelector('input[aria-label="Episode name"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'A Little Hello - Cartoon Life V1');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(`!!document.querySelector('.episode-scene-library article button')`);
  await js(`document.querySelector('.episode-scene-library article button').click()`);
  await click('Save Episode'); await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  await click('Export Episode Video'); await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 300);
  checks.episodeVideoBytes = await takeDownload('.webm', 'cartoon-life-episode.webm');
  await nav('Characters'); await click('Export Studio Backup');
  checks.backupBytes = await takeDownload('.json', 'cartoon-life-studio-backup.json');
  const backup = JSON.parse(await readFile(join(root, 'cartoon-life-studio-backup.json'), 'utf8'));
  checks.backupLife = backup.timedScenes.scenes[0].life?.enabled === true;
  checks.backupAudio = backup.audioAssets?.length ?? backup.audio?.length ?? 0;
  checks.episodeSaved = backup.episodes.episodes.length === 1;
  checks.consoleErrors = errors;
  await writeFile(join(root, 'browser-results.json'), JSON.stringify(checks, null, 2) + '\n');
  if (errors.length || !checks.savedLife || !checks.baselineToggleOff || !checks.backupLife || !checks.episodeSaved) throw Error(`Checks failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify(checks));
} finally { socket?.close(); chrome.kill(); }
