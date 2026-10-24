import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const out = resolve('proofs/brighttales-introduction-v1');
const profile = await mkdtemp(join(tmpdir(), 'bright-intro-preview-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async expression => { for (let i = 0; i < 300; i++) { if (await js(expression)) return; await delay(100); } throw Error(`Timed out: ${expression}`); };
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const call = pending.get(data.id); pending.delete(data.id); data.error ? call.reject(Error(data.error.message)) : call.resolve(data.result); } if (data.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Characters')).click()`);
  const { root } = await send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [join(out, 'introduction-studio-backup-v8.json')] });
  await until(`document.querySelector('.form-message')?.textContent.includes('restored')`);
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(`document.querySelectorAll('.scene-library article').length===6`);
  await js(`[...document.querySelectorAll('.scene-library article')].find(a=>a.textContent.includes('Bright Speak')).querySelector('button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  const target = await js(`(()=>{const e=document.querySelector('.timeline-ruler');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.left+116+13*24,y:r.top+15}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await delay(500);
  const data = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`);
  await writeFile(join(out, 'scene-preview-phone-13s.png'), Buffer.from(data.split(',')[1], 'base64'));
  const result = { scenePreviewTime: 13, globalEpisodeTime: 35, browserErrors: errors };
  await writeFile(join(out, 'scene-preview-check.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { try { if (ws) await send('Browser.close'); } catch { chrome.kill(); } ws?.close(); }
