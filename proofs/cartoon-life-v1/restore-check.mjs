import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/cartoon-life-v1');
const profile = await mkdtemp(join(tmpdir(), 'bright-life-restore-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, attempts = 180) => { for (let i = 0; i < attempts; i++) { const value = await js(expression); if (value) return value; await delay(200); } throw Error(`Timed out: ${expression}`); };
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  const initialScenes = await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`);
  if (initialScenes !== null) throw Error('Restore profile was not empty');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Characters')).click()`);
  await until(`!!document.querySelector('section[aria-label="Studio backup"] input[type=file]')`);
  const doc = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [join(root, 'cartoon-life-studio-backup.json')] });
  await until(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1') ?? '{}').scenes?.length === 2`);
  const restored = await js(`(()=>{const scenes=JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'));const episodes=JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1'));return{life:scenes.scenes[0].life?.enabled,baselineOff:!scenes.scenes[1].life,sceneAudio:scenes.scenes[0].audio?.length,episodes:episodes.episodes.length}})()`);
  restored.audioAssets = await js(`new Promise((resolve,reject)=>{const open=indexedDB.open('brightsenappstales.audio.v1',2);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const request=open.result.transaction('assets','readonly').objectStore('assets').getAll();request.onsuccess=()=>resolve(request.result.map(a=>a.name));request.onerror=()=>reject(request.error)}})`);
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(`document.querySelectorAll('.scene-library article').length===2`);
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(900);
  restored.openedLife = await js(`document.querySelector('input[aria-label="Cartoon Life experimental"]')?.checked`);
  const data = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`);
  await writeFile(join(root, 'restored-preview.png'), Buffer.from(data.split(',')[1], 'base64'));
  restored.consoleErrors = errors;
  await writeFile(join(root, 'restore-results.json'), JSON.stringify(restored, null, 2) + '\n');
  if (!restored.life || !restored.baselineOff || restored.sceneAudio !== 3 || restored.episodes !== 1 || restored.audioAssets.length !== 2 || !restored.openedLife || errors.length) throw Error(`Restore check failed: ${JSON.stringify(restored)}`);
  console.log(JSON.stringify(restored));
} finally { socket?.close(); chrome.kill(); }
