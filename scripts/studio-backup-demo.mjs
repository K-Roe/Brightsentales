import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone3-3');
const frames = resolve(root, 'frames');
const downloads = resolve(root, 'downloads');
await mkdir(frames, { recursive: true });
await mkdir(downloads, { recursive: true });
const resume = process.argv.includes('--resume');
let frameNumber = resume ? (await readdir(frames)).filter(name => name.endsWith('.jpg')).length : 0;
const report = { source: {}, restored: {}, dialogs: [], errors: [], isolatedProfiles: true };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }

async function connect(port) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:4177/`, { method: 'PUT' }).then(response => response.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let serial = 0, recording = false;
  const pending = new Map();
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const done = pending.get(message.id); pending.delete(message.id); message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') report.errors.push(message.params.entry.text);
    if (message.method === 'Page.javascriptDialogOpening') { report.dialogs.push(message.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
    if (message.method === 'Page.screencastFrame') {
      if (recording) await writeFile(resolve(frames, `${String(frameNumber++).padStart(5, '0')}.jpg`), Buffer.from(message.params.data, 'base64'));
      send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const until = async (expression, message) => { for (let i = 0; i < 90; i++) { if (await js(expression)) return; await pause(200); } throw new Error(message); };
  const click = async (selector, label = '') => { await until(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));return !!e&&!e.disabled})()`, `Missing ${label || selector}`); await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));e.scrollIntoView({block:'center'});e.click()})()`); await pause(240); };
  const shot = async name => { const image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(root, name), Buffer.from(image.data, 'base64')); };
  const start = async () => { recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 68, everyNthFrame: 3 }); };
  const stop = async () => { recording = false; await send('Page.stopScreencast'); ws.close(); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await pause(1800);
  return { send, js, until, click, shot, start, stop };
}

if (!resume) {
const source = await connect(9233);
try {
  assert(await source.js(`localStorage.getItem('brightsenappstales.brightlings.v1')===null`), 'Source profile was not empty');
  await source.start();
  await source.shot('source-empty.png');
  await source.click('.create-brightling');
  await source.js(`document.querySelector('#brightling-name').focus()`);
  await source.send('Input.insertText', { text: 'Backup Charlie' });
  await source.click('.maker-save', 'Save Brightling');
  await source.until(`document.querySelectorAll('.portrait-card').length===3`, 'Character was not saved');
  await source.click('.portrait-card:nth-child(3) button', 'Add to Playground');
  await source.until(`document.querySelectorAll('.character-card').length===3`, 'Character was not added');
  const drag = await source.js(`(()=>{const e=document.querySelector('canvas');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {from:{x:b.left+720*b.width/1672,y:b.top+700*b.height/941},to:{x:b.left+900*b.width/1672,y:b.top+745*b.height/941}}})()`);
  await source.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: drag.from.x, y: drag.from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 8; i++) await source.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: drag.from.x + (drag.to.x - drag.from.x) * i / 8, y: drag.from.y + (drag.to.y - drag.from.y) * i / 8, button: 'left', buttons: 1 });
  await source.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: drag.to.x, y: drag.to.y, button: 'left', buttons: 0, clickCount: 1 });
  await pause(250);
  await source.click('.save-actions button', 'Save scene');
  const saved = await source.js(`({library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))})`);
  assert(saved.scene.characters[saved.library[0].id].start.x > 800, 'Character was not repositioned before saving');
  report.source = { id: saved.library[0].id, name: saved.library[0].name, colours: { body: saved.library[0].body, hair: saved.library[0].hair, clothing: saved.library[0].clothing }, position: saved.scene.characters[saved.library[0].id].start };
  await source.shot('source-playground.png');
  await source.click('.studio-nav button', 'Characters');
  await source.click('[aria-label="Studio backup"] button', 'Export Studio Backup');
  await source.until(`document.querySelector('.form-message')?.textContent.includes('downloaded')`, 'Export did not complete');
  await source.shot('export-studio-backup.png');
  await pause(1200);
} finally { await source.stop(); }
}

const files = (await readdir(downloads)).filter(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json'));
assert(files.length === 1, 'Studio Backup was not downloaded');
const backupText = await readFile(resolve(downloads, files[0]), 'utf8');
const backup = JSON.parse(backupText);
if (resume) report.source = { id: backup.characters[0].id, name: backup.characters[0].name, colours: { body: backup.characters[0].body, hair: backup.characters[0].hair, clothing: backup.characters[0].clothing }, position: backup.scene.characters[backup.characters[0].id].start };
assert(backup.version === 1 && backup.createdAt && backup.characters[0].id === report.source.id, 'Backup metadata or identity missing');
assert(backup.scene.characters[report.source.id].start.x === report.source.position.x, 'Backup position missing');

const restored = await connect(9234);
try {
  assert(await restored.js(`localStorage.getItem('brightsenappstales.brightlings.v1')===null && localStorage.getItem('brightsenappstales.scene.v1')===null`), 'Restore profile was not empty');
  await restored.start();
  await restored.shot('restore-empty.png');
  async function importText(contents) {
    await restored.js(`(()=>{const input=document.querySelector('[aria-label="Studio backup"] input');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(contents)}],'backup.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await pause(700);
  }
  await importText('{broken');
  assert(await restored.js(`localStorage.getItem('brightsenappstales.brightlings.v1')===null && !!document.querySelector('.form-message').textContent`), 'Malformed backup changed data');
  await importText(JSON.stringify({ ...backup, version: 99 }));
  assert(await restored.js(`localStorage.getItem('brightsenappstales.brightlings.v1')===null && document.querySelector('.form-message').textContent.includes('Unsupported')`), 'Unsupported backup changed data');
  await restored.shot('invalid-backup-rejected.png');
  await importText(backupText);
  await restored.until(`document.querySelectorAll('.portrait-card').length===3`, 'Restore did not populate library');
  const after = await restored.js(`({library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))})`);
  assert(JSON.stringify(after.library) === JSON.stringify(backup.characters), 'Restored character identity or colours differ');
  assert(JSON.stringify(after.scene) === JSON.stringify(backup.scene), 'Restored scene positions differ');
  assert(report.dialogs.some(dialog => dialog.includes('replaces the current custom Brightling library')), 'Restore confirmation missing');
  report.restored = { id: after.library[0].id, position: after.scene.characters[after.library[0].id].start, sceneIds: Object.keys(after.scene.characters) };
  await restored.shot('restored-library.png');
  await restored.click('.studio-nav button', 'Playground');
  await restored.until(`document.querySelectorAll('.character-card').length===3`, 'Restored scene did not appear');
  await restored.shot('restored-playground.png');
  await restored.click('.character-card', 'Backup Charlie');
  await restored.click('.wave-button');
  await pause(2800);
  await restored.shot('restored-after-wave.png');
  await restored.js(`(()=>{const e=document.querySelector('canvas');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();window.__testPoint={x:b.left+1100*b.width/1672,y:b.top+800*b.height/941}})()`);
  const point = await restored.js(`window.__testPoint`);
  await restored.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await restored.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  await restored.click('.play-button');
  await restored.until(`!document.querySelector('.play-button').disabled`, 'Restored Brightling did not finish walking');
  await restored.shot('restored-after-walk.png');
  await restored.send('Page.reload'); await pause(3000);
  assert(await restored.js(`document.querySelectorAll('.character-card').length===3`), 'Restored data did not survive reload');
  assert(report.errors.length === 0, 'Browser console errors occurred');
} finally { await restored.stop(); }

report.backupFile = files[0];
report.frames = frameNumber;
await writeFile(resolve(root, 'browser-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: 'passed', frames: frameNumber, errors: report.errors, id: report.source.id }));
