import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/cartoon-foundation-phase2');
const previous = JSON.parse(await readFile(join(root, 'browser-workflow-results.json'), 'utf8'));
if (previous.failure || previous.stages.resetReplay !== 'PASS') throw Error('The live Unity workflow must pass first.');
const profile = await mkdtemp(join(tmpdir(), 'bright-foundation-phase2-webm-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'bright-foundation-webm-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank',
], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const js = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const until = async (predicate, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const value = await predicate(); if (value) return value; await delay(200); }
  throw Error('Timed out waiting for browser export.');
};
const result = { profile, downloads, status: 'IN PROGRESS', setup: 'edited scene JSON from the separate passing UI workflow installed in a fresh disposable profile' };
try {
  const page = await until(async () => {
    try {
      const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      return pages.find(item => item.type === 'page');
    } catch { return null; }
  }, 20000);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id); pending.delete(message.id);
    message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result);
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: previous.studioUrl });
  await until(() => js(`!!document.querySelector('.studio-nav')`));
  const sceneJson = await readFile(join(root, 'edited-scene.json'), 'utf8');
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Export profile was not empty.');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(sceneJson)})`);
  await send('Page.reload');
  await delay(700);
  await until(() => js(`!!document.querySelector('.studio-nav')`));
  await js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Scenes')).click()`);
  await until(() => js(`!!document.querySelector('.scene-library article')`));
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(() => js(`!!document.querySelector('.scene-stage canvas')`));
  await until(() => js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Export scene video (WebM)');return !!b&&!b.disabled})()`), 15000);
  await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Export scene video (WebM)');if(!b||b.disabled)throw Error('Browser scene export is unavailable');b.click()})()`);
  await until(() => js(`document.querySelector('.scene-status')?.textContent?.includes('Scene video exported')`), 25000);
  const file = await until(async () => {
    const names = await readdir(downloads);
    const name = names.find(item => item.endsWith('.webm'));
    return name && !names.some(item => item.endsWith('.crdownload')) && (await stat(join(downloads, name))).size > 1000 ? name : null;
  }, 15000);
  const output = join(root, 'phase2-browser-scene.webm');
  await writeFile(output, await readFile(join(downloads, file)));
  result.status = 'PASS'; result.output = output; result.bytes = (await stat(output)).size;
} catch (error) {
  result.status = 'FAIL'; result.error = error instanceof Error ? error.stack : String(error);
  if (socket?.readyState === WebSocket.OPEN) {
    try { result.ui = await js(`({status:document.querySelector('.scene-status')?.textContent,export:[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Export scene video'))?.textContent})`); } catch { /* Page closed. */ }
  }
  try { result.downloadFiles = await readdir(downloads); } catch { /* No download directory. */ }
} finally {
  await writeFile(join(root, 'browser-webm-regression.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch { /* Expected close. */ } }
  else if (chrome.exitCode === null) chrome.kill();
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}
