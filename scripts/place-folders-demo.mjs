import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone4a-1');
const frames = resolve(root, 'frames');
const downloads = resolve(root, 'downloads');
await mkdir(frames, { recursive: true }); await mkdir(downloads, { recursive: true });
let frame = 0;
const report = { errors: [], dialogs: [], source: {}, restored: {}, isolatedProfiles: true };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }

async function connect(port) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:4179/`, { method: 'PUT' }).then(response => response.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let serial = 0, recording = false;
  const pending = new Map();
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const done = pending.get(message.id); pending.delete(message.id); message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') report.errors.push(message.params.entry.text);
    if (message.method === 'Page.javascriptDialogOpening') { report.dialogs.push(message.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
    if (message.method === 'Page.screencastFrame') {
      if (recording) await writeFile(resolve(frames, `${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(message.params.data, 'base64'));
      send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const js = async expression => { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; };
  const until = async (expression, message) => { for (let i = 0; i < 90; i++) { if (await js(expression)) return; await wait(200); } throw new Error(message); };
  const click = async (selector, label = '') => { await until(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));return !!e&&!e.disabled})()`, `Missing ${label || selector}`); await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));e.scrollIntoView({block:'center'});e.click()})()`); await wait(250); };
  const name = async value => { await js(`(()=>{const e=document.querySelector('#folder-name');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));e.focus()})()`); await send('Input.insertText', { text: value }); await wait(120); };
  const move = async (place, destination) => { await js(`(()=>{const e=document.querySelector(${JSON.stringify(`[aria-label="Move ${place} to folder"]`)});e.value=${JSON.stringify(destination)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await wait(300); };
  const shot = async filename => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(root, filename), Buffer.from(result.data, 'base64')); };
  const importText = async contents => { await js(`(()=>{const input=document.querySelector('[aria-label="Studio backup"] input');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(contents)}],'studio.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`); await wait(800); };
  const start = async () => { recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 2 }); };
  const stop = async () => { recording = false; await send('Page.stopScreencast').catch(() => {}); ws.close(); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(1600);
  return { send, js, until, click, name, move, shot, importText, start, stop };
}

const source = await connect(9236);
try {
  assert(await source.js(`localStorage.length===0`), 'Source profile was not empty');
  await source.start();
  await source.click('.studio-nav button', 'Places');
  assert(await source.js(`document.querySelectorAll('.folder-card').length===2`), 'Default folders missing');
  await source.shot('desktop-folders-default.png');
  await source.click('.folder-card', 'House');
  assert(await source.js(`document.querySelectorAll('.place-card').length===3`), 'House does not contain three places');
  await source.shot('desktop-house.png');
  await source.click('.place-card button', 'Preview');
  await source.until(`document.querySelector('.place-preview img')?.complete`, 'Living Room preview failed');
  assert(await source.js(`document.querySelector('.place-preview img')?.naturalWidth===1672`), 'Approved Living Room art changed');
  await source.shot('living-room-preview.png');
  await source.move('Living Room', '');
  await source.click('.places-primary', 'Back to Places');
  assert(await source.js(`document.querySelector('.place-card h3')?.textContent==='Living Room'`), 'Protected Living Room did not move to top level');
  await source.shot('living-room-top-level.png');
  await source.move('Living Room', 'house');
  await source.click('.places-primary', 'New Folder'); await source.name('My Places'); await source.click('.folder-form button', 'Create Folder');
  await source.until(`document.querySelectorAll('.folder-card').length===3`, 'Folder create failed');
  const folderId = await source.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).folders.find(x=>x.name==='My Places')?.id`);
  assert(folderId?.startsWith('folder-'), 'Custom folder ID missing');
  await source.click('.folder-card', 'My Places'); await source.click('.folder-tools button', 'Rename'); await source.name('Favourites'); await source.click('.folder-form button', 'Save name');
  assert(await source.js(`document.querySelector('.overview-heading h2')?.textContent==='Favourites'`), 'Rename failed');
  await source.click('.places-primary', 'Back to Places'); await source.click('.folder-card', 'House');
  await source.move('Bedroom', folderId);
  await source.click('.places-primary', 'Back to Places'); await source.click('.folder-card', 'Favourites');
  assert(await source.js(`document.querySelectorAll('.place-card').length===1 && document.querySelector('.place-card h3')?.textContent==='Bedroom'`), 'Bedroom did not move');
  await source.shot('desktop-custom-folder.png');
  await source.send('Page.reload'); await wait(2300);
  await source.click('.studio-nav button', 'Places'); await source.click('.folder-card', 'Favourites');
  assert(await source.js(`document.querySelector('.place-card h3')?.textContent==='Bedroom' && JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).folders.find(x=>x.id==='${folderId}')?.name==='Favourites'`), 'Folder contents did not survive refresh');
  await source.move('Bedroom', 'house');
  assert(await source.js(`document.querySelectorAll('.place-card').length===0`), 'Bedroom did not leave custom folder');
  await source.click('.folder-tools button', 'Delete empty folder');
  await source.until(`document.querySelectorAll('.folder-card').length===2`, 'Empty folder delete failed');
  await source.shot('desktop-after-delete.png');
  await source.click('.places-primary', 'New Folder'); await source.name('Travel'); await source.click('.folder-form button', 'Create Folder');
  const travelId = await source.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).folders.find(x=>x.name==='Travel')?.id`);
  await source.click('.folder-card', 'House'); await source.move('Garden', travelId);
  await source.click('.studio-nav button', 'Playground'); await source.click('.save-actions button', 'Save scene');
  const sceneBefore = await source.js(`localStorage.getItem('brightsenappstales.scene.v1')`);
  await source.click('.studio-nav button', 'Characters'); await source.click('[aria-label="Studio backup"] button', 'Export Studio Backup');
  await wait(900);
  const backupName = (await readdir(downloads)).find(item => item.startsWith('brightsenappstales-studio-') && item.endsWith('.json'));
  assert(backupName, 'Studio Backup was not downloaded');
  const backupText = await readFile(resolve(downloads, backupName), 'utf8');
  const backup = JSON.parse(backupText);
  assert(backup.version === 2 && backup.places.assignments.garden === travelId, 'Folder organisation missing from backup');
  report.source = { folderId: travelId, sceneUnchanged: sceneBefore === await source.js(`localStorage.getItem('brightsenappstales.scene.v1')`), backupVersion: backup.version };
  assert(report.source.sceneUnchanged, 'Folders changed saved scene');
  await source.click('.studio-nav button', 'Places');
  await source.shot('desktop-ready-for-backup.png');
  await source.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await wait(500);
  const mobile = await source.js(`({width:document.documentElement.scrollWidth,viewport:window.innerWidth})`);
  assert(mobile.width <= mobile.viewport, 'Mobile folders overflow');
  await source.shot('mobile-folders.png');
  await source.click('.folder-card', 'House');
  const mobileHouse = await source.js(`({width:document.documentElement.scrollWidth,viewport:window.innerWidth})`);
  assert(mobileHouse.width <= mobileHouse.viewport, 'Mobile folder contents overflow');
  await source.shot('mobile-house.png');
  report.source.mobile = mobile;
  await writeFile(resolve(root, 'exported-studio-backup.json'), backupText);
} finally { await source.stop(); }

const backupText = await readFile(resolve(root, 'exported-studio-backup.json'), 'utf8');
const backup = JSON.parse(backupText);
const restore = await connect(9237);
try {
  assert(await restore.js(`localStorage.length===0`), 'Restore profile was not empty');
  await restore.start();
  await restore.importText(backupText);
  await restore.until(`localStorage.getItem('brightsenappstales.place-folders.v1')!==null`, 'Folder restore failed');
  const restored = await restore.js(`({places:JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))})`);
  assert(JSON.stringify(restored.places) === JSON.stringify(backup.places) && JSON.stringify(restored.scene) === JSON.stringify(backup.scene), 'Restored folder or scene data differs');
  report.restored.folderId = restored.places.folders.find(item => item.name === 'Travel')?.id;
  await restore.click('.studio-nav button', 'Places'); await restore.shot('desktop-restored-folders.png');
  await restore.click('.folder-card', 'Travel');
  assert(await restore.js(`document.querySelector('.place-card h3')?.textContent==='Garden'`), 'Restored folder contents missing');
  await restore.shot('desktop-restored-travel.png');
  await restore.click('.studio-nav button', 'Characters');
  const beforeInvalid = await restore.js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1'),places:localStorage.getItem('brightsenappstales.place-folders.v1')})`);
  await restore.importText(JSON.stringify({ ...backup, places: { ...backup.places, assignments: { ...backup.places.assignments, bedroom: 'unknown' } } }));
  const afterInvalid = await restore.js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1'),places:localStorage.getItem('brightsenappstales.place-folders.v1')})`);
  assert(JSON.stringify(afterInvalid) === JSON.stringify(beforeInvalid), 'Invalid folder backup changed storage');
  const { places: _unused, ...oldBackup } = backup;
  await restore.importText(JSON.stringify({ ...oldBackup, version: 1 }));
  await restore.until(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).folders.length===2`, 'Older backup did not restore defaults');
  const legacyPlaces = await restore.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1'))`);
  assert(legacyPlaces.assignments['living-room'] === 'house' && legacyPlaces.assignments.bedroom === 'house' && legacyPlaces.assignments.garden === 'house', 'Older backup folder defaults wrong');
  report.restored.olderBackupDefaulted = true;
  assert(report.errors.length === 0, 'Browser console errors');
  assert(report.dialogs.some(item => item.includes('Places folders')), 'Restore confirmation omitted folders');
} finally { await restore.stop(); }

report.frames = frame;
await writeFile(resolve(root, 'browser-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: 'passed', frames: frame, errors: report.errors, folderId: report.restored.folderId }));
