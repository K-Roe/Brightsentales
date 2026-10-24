import { mkdtemp, readFile, writeFile, readdir, stat, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/brightling-rig-v1');
const profile = await mkdtemp(join(tmpdir(), 'max-living-rig-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'max-living-rig-downloads-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
    '--remote-debugging-port=0', '--window-size=2000,1250', 'about:blank'],
  { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++serial; pending.set(id, { resolve: resolveCall, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const js = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
async function waitFor(expression, attempts = 150) {
  for (let i = 0; i < attempts; i++) { if (await js(expression)) return; await delay(100); }
  throw Error(`Timed out: ${expression}`);
}
async function screenshot(name, time) {
  const data = await js(`(drawRigAt(${time}), document.querySelector('canvas').toDataURL('image/png'))`);
  await writeFile(join(root, name), Buffer.from(data.split(',')[1], 'base64'));
}
async function record(view, filename) {
  await js(`document.querySelector('#export').click()`);
  for (let i = 0; i < 250; i++) {
    const list = await readdir(downloads);
    const name = list.find(item => item === `max-living-rig-v1-${view}.webm`);
    if (name && !list.some(item => item.endsWith('.crdownload'))) {
      const file = join(downloads, name);
      if ((await stat(file)).size > 10_000) {
        await copyFile(file, join(root, filename)); return;
      }
    }
    await delay(200);
  }
  throw Error(`Recording ${view} did not download`);
}

try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id); pending.delete(message.id);
      message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4180/proofs/brightling-rig-v1/review.html' });
  await waitFor('window.rigReady === true');
  await screenshot('full-1-25.png', 1.25);
  await screenshot('full-5-8.png', 5.8);
  await screenshot('full-12-5.png', 12.5);
  const firstSeek = await js(`(drawRigAt(5.8), document.querySelector('canvas').toDataURL('image/png'))`);
  await js('drawRigAt(12.5)');
  const repeatSeek = await js(`(drawRigAt(5.8), document.querySelector('canvas').toDataURL('image/png'))`);
  if (firstSeek !== repeatSeek) throw Error('Scene-time seeking changed the same rendered frame');
  await send('Page.navigate', { url: 'http://127.0.0.1:4180/proofs/brightling-rig-v1/review.html?view=close' });
  await waitFor('window.rigReady === true');
  await screenshot('close-5-8.png', 5.8);
  if (process.argv.includes('--record')) {
    await send('Page.navigate', { url: 'http://127.0.0.1:4180/proofs/brightling-rig-v1/review.html' });
    await waitFor('window.rigReady === true');
    await record('full', 'standing-comparison.webm');
    await send('Page.navigate', { url: 'http://127.0.0.1:4180/proofs/brightling-rig-v1/review.html?view=close' });
    await waitFor('window.rigReady === true');
    await record('close', 'connection-closeup.webm');
  }
  await writeFile(join(root, 'browser-check.json'), JSON.stringify({ errors, ready: true }, null, 2));
  if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  console.log('Captured isolated Max rig preview; browser errors:', errors.length);
} finally { socket?.close(); chrome.kill(); }
