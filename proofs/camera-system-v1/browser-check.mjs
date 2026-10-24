import { mkdtemp, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/camera-system-v1');
const profile = await mkdtemp(join(tmpdir(), 'bright-camera-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'bright-camera-downloads-'));
const library = JSON.parse(await readFile(join(root, 'camera-demo-scene.json'), 'utf8'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map(), errors = [], checks = {};
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, attempts = 150) => { for (let i = 0; i < attempts; i++) { const value = await js(expression); if (value) return value; await delay(200); } throw Error(`Timed out: ${expression}`); };
const click = label => js(`(()=>{const item=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!item)throw Error('Missing '+${JSON.stringify(label)});item.click();return true})()`);
const screenshot = async filename => { const data = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`); await writeFile(join(root, filename), Buffer.from(data.split(',')[1], 'base64')); };
async function seek(time) {
  const position = await js(`(()=>{const el=document.querySelector('.timeline-ruler');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+116+${time}*24,y:r.top+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: position.x, y: position.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await delay(150);
}
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Profile was not empty');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify(library))})`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(`!!document.querySelector('.scene-library article')`);
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(700);
  checks.cameraBlocks = await js(`document.querySelectorAll('[data-lane-kind="camera"] .timeline-block').length`);
  if (checks.cameraBlocks !== 3) throw Error('Camera lane did not show three keyframes');
  for (const time of [0, 1.5, 4, 5.5, 8, 9.5, 12.5]) { await seek(time); await screenshot(`preview-${String(time).replace('.', '-')}.png`); }
  await js(`document.querySelector('[data-lane-kind="camera"] .timeline-block').click()`);
  checks.cameraInspector = await until(`document.querySelector('input[aria-label="Camera start time"]')?.value === '3'`);
  await js(`(()=>{const select=document.querySelector('select[aria-label="Camera shot"]');select.value='close-up';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(`document.querySelector('select[aria-label="Camera shot"]')?.value === 'close-up'`);
  await seek(5.5); await screenshot('close-up-preview.png');
  await js(`(()=>{const select=document.querySelector('select[aria-label="Camera shot"]');select.value='medium';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(`document.querySelector('select[aria-label="Camera shot"]')?.value === 'medium'`);
  checks.closeUpControl = true;
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  checks.savedLibrary = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (JSON.stringify(checks.savedLibrary) !== JSON.stringify(library)) throw Error('Camera scene changed on save/reopen');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(`!!document.querySelector('.scene-library article')`);
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(700);
  await seek(8); await screenshot('reopened-preview-8.png');
  await click('Export scene video (WebM)');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene video exported')`, 180);
  let name;
  for (let i = 0; i < 100; i++) { const files = await readdir(downloads); name = files.find(file => file.endsWith('.webm')); if (name && !files.some(file => file.endsWith('.crdownload')) && (await stat(join(downloads, name))).size > 1000) break; name = undefined; await delay(250); }
  if (!name) throw Error('WebM download missing');
  await rename(join(downloads, name), join(root, 'camera-demo.webm'));
  checks.videoBytes = (await readFile(join(root, 'camera-demo.webm'))).length;
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Episodes')).click()`);
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Episode')`);
  await click('Create Episode');
  await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  await click('Add Scene');
  await click('Save Episode');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  await click('Export Episode Video');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 180);
  let episodeName;
  for (let i = 0; i < 100; i++) { const files = await readdir(downloads); episodeName = files.find(file => file.endsWith('.webm')); if (episodeName && !files.some(file => file.endsWith('.crdownload')) && (await stat(join(downloads, episodeName))).size > 1000) break; episodeName = undefined; await delay(250); }
  if (!episodeName) throw Error('Episode WebM download missing');
  await rename(join(downloads, episodeName), join(root, 'camera-demo-episode.webm'));
  checks.episodeVideoBytes = (await readFile(join(root, 'camera-demo-episode.webm'))).length;
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Characters')).click()`);
  await click('Export Studio Backup');
  let backupName;
  for (let i = 0; i < 100; i++) { backupName = (await readdir(downloads)).find(file => file.endsWith('.json')); if (backupName) break; await delay(250); }
  if (!backupName) throw Error('Studio Backup download missing');
  const backup = JSON.parse(await readFile(join(downloads, backupName), 'utf8'));
  if (backup.timedScenes.scenes[0].camera?.length !== 3 || backup.episodes.episodes.length !== 1) throw Error('Backup omitted the camera scene or episode');
  await rename(join(downloads, backupName), join(root, 'camera-demo-studio-backup.json'));
  checks.backupExportRetainsCamera = true;
  // Prove the normal editor can create a keyframe; leave the review exports untouched.
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(`!!document.querySelector('.scene-library article')`);
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(`!!document.querySelector('.camera-panel')`);
  await click('New shot');
  await js(`(()=>{const select=document.querySelector('select[aria-label="Camera shot"]');select.value='close-up';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await js(`(()=>{const select=document.querySelector('select[aria-label="Camera focus"]');select.value='max';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await click('Add camera keyframe at 0.0s');
  await until(`document.querySelectorAll('[data-lane-kind="camera"] .timeline-block').length === 4`);
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  checks.uiAddedKeyframe = (await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].camera.length`)) === 4;
  if (!checks.uiAddedKeyframe) throw Error('UI-created camera keyframe did not persist');
  checks.consoleErrors = errors;
  delete checks.savedLibrary;
  await writeFile(join(root, 'browser-results.json'), JSON.stringify(checks, null, 2) + '\n');
  if (errors.length) throw Error(`Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify(checks));
} finally { socket?.close(); chrome.kill(); }
