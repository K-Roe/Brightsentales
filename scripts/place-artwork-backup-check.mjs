import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const proof = resolve('proofs/place-add-delete');
const downloads = resolve(proof, 'downloads');
await mkdir(downloads, { recursive: true });
const target = await fetch('http://127.0.0.1:9240/json/new?http://127.0.0.1:4181/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
const errors = [], dialogs = [];
let serial = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const done = pending.get(message.id); pending.delete(message.id); message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  if (message.method === 'Page.javascriptDialogOpening') { dialogs.push(message.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async expression => { for (let n = 0; n < 60; n++) { if (await js(expression)) return; await wait(150); } throw new Error(`Timed out: ${expression}`); };
const click = async (selector, label) => { await until(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(element => element.textContent.includes(${JSON.stringify(label)}))`); await js(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.textContent.includes(${JSON.stringify(label)})).click()`); await wait(250); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await wait(1000);
  await click('.studio-nav button', 'Characters');
  let backupFile = (await readdir(downloads)).find(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json'));
  if (!backupFile) await click('.backup-controls button', 'Export Studio Backup');
  for (let n = 0; n < 40; n++) { backupFile = (await readdir(downloads)).find(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json')); if (backupFile) break; await wait(150); }
  assert(backupFile, 'Studio Backup did not download');
  const path = resolve(downloads, backupFile);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  assert(backup.places.artwork.bedroom?.startsWith('data:image/webp;base64,'), 'Studio Backup excluded uploaded artwork');
  await writeFile(resolve(proof, 'backup-artwork-report.json'), JSON.stringify({ backupVersion: backup.version, artworkBytes: backup.places.artwork.bedroom.length, folder: backup.places.assignments.bedroom }, null, 2));
  if (await js(`localStorage.getItem('brightsenappstales.place-folders.v1') !== null`)) { await js('localStorage.clear()'); await send('Page.reload'); await wait(1200); }
  assert(await js(`localStorage.getItem('brightsenappstales.place-folders.v1') === null`), 'Isolated profile was not cleared');
  const { root: freshRoot } = await send('DOM.getDocument');
  const { nodeId: studioInput } = await send('DOM.querySelector', { nodeId: freshRoot.nodeId, selector: '[aria-label="Studio backup"] .import-file input[type=file]' });
  assert(studioInput, 'Studio Backup import input missing');
  await send('DOM.setFileInputFiles', { nodeId: studioInput, files: [path] });
  await until(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1') || '{}').artwork?.bedroom?.startsWith('data:image/webp;base64,')`);
  await click('.studio-nav button', 'Places'); await click('.folder-card', 'House');
  await until(`document.querySelector('#place-bedroom img')?.naturalWidth > 0`);
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(resolve(proof, 'restored-bedroom-artwork.png'), Buffer.from(result.data, 'base64'));
  assert(dialogs.some(dialog => dialog.includes('Restore Studio Backup')), 'Restore confirmation missing');
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  process.stdout.write(JSON.stringify({ result: 'passed', artworkRestored: true, dialogs: dialogs.length, errors }));
} finally { ws.close(); }
