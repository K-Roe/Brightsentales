import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/studio-3');
const { profile } = JSON.parse(await readFile(join(root, 'browser-workflow-results.json'), 'utf8'));
const frames = await mkdtemp(join(tmpdir(), 'bright-studio3-walkthrough-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const wait = async (condition, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { const result = await condition(); if (result) return result; await delay(100); } throw Error('Timed out waiting for browser.'); };
let socket, serial = 0, frame = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; };
const capture = async (seconds = 2) => { for (let i = 0; i < seconds * 5; i++) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(frames, `frame-${String(frame++).padStart(4, '0')}.png`), Buffer.from(result.data, 'base64')); await delay(200); } };
const nav = async label => { await js(`(()=>{const b=[...document.querySelectorAll('nav button,.studio3-sidebar-footer button')].find(x=>x.textContent.trim().endsWith(${JSON.stringify(label)}));if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click()})()`); await delay(400); };
try {
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(p => p.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5177/' });
  await wait(() => js(`!!document.querySelector('.studio3-shell')`));
  await nav('Projects'); await capture(2);
  await nav('Cartoon Editor');
  await js(`document.querySelector('.scene-library .scene-actions button').click()`);
  await wait(() => js(`!!document.querySelector('.scene-stage canvas')`));
  await capture(2);
  await js(`document.querySelector('.scene-hierarchy > button').click()`);
  await capture(2);
  await js(`document.querySelector('.scene-timeline').scrollIntoView({block:'center'})`);
  await capture(2);
  await nav('Settings'); await capture(2);
  await js(`document.querySelectorAll('input[name="preferred-studio"]')[1].click()`);
  await wait(() => js(`!!document.querySelector('.classic-shell')`));
  await nav('Characters');
  await capture(2);
  await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Settings')&&x.textContent.includes('Workspace'));b.click()})()`);
  await wait(() => js(`!!document.querySelector('.studio3-settings')`));
  await js(`document.querySelectorAll('input[name="preferred-studio"]')[0].click()`);
  await wait(() => js(`!!document.querySelector('.studio3-shell')`));
  await nav('Cartoon Preview'); await capture(2);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* browser closes socket */ } socket.close(); }
  if (chrome.exitCode === null) chrome.kill();
}
const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', join(frames, 'frame-%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-movflags', '+faststart', join(root, 'studio-3-ui-walkthrough.mp4')], { encoding: 'utf8' });
if (encoded.status !== 0) throw Error(encoded.stderr || 'FFmpeg failed.');
console.log(JSON.stringify({ frames: frame, seconds: frame / 5, video: join(root, 'studio-3-ui-walkthrough.mp4') }));
