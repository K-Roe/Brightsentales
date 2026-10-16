import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone4a-1-move-fix');
const frames = resolve(root, 'frames');
const downloads = resolve(root, 'downloads');
await mkdir(frames, { recursive: true }); await mkdir(downloads, { recursive: true });
let frame = 0;
const report = { errors: [], dialogs: [], moves: [], isolatedProfiles: true };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }

async function connect(port) {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:4180/`, { method: 'PUT' }).then(response => response.json());
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
  const click = async (selector, label = '') => { await until(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));return !!e&&!e.disabled})()`, `Missing ${label || selector}`); await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));e.scrollIntoView({block:'center'});e.click()})()`); await wait(230); };
  const shot = async filename => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(root, filename), Buffer.from(result.data, 'base64')); };
  const move = async (place, destinationLabel, expectedFolderId) => {
    await click(`#place-${place} .place-move-button`, 'Move');
    await click(`#move-options-${place} button`, destinationLabel);
    await until(`document.querySelector('.place-notice')?.textContent.includes('moved to')`, 'Move confirmation missing');
    const state = await js(`({assignment:JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).assignments[${JSON.stringify(place)}],visible:!!document.querySelector(${JSON.stringify(`#place-${place}`)}),notice:document.querySelector('.place-notice')?.textContent})`);
    assert(state.assignment === expectedFolderId && state.visible, `${place} did not appear in destination`);
    report.moves.push({ place, destination: expectedFolderId, notice: state.notice });
    return state;
  };
  const start = async () => { recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 2 }); };
  const stop = async () => { recording = false; await send('Page.stopScreencast').catch(() => {}); ws.close(); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(1500);
  return { send, js, until, click, shot, move, start, stop };
}

const source = await connect(9238);
try {
  assert(await source.js(`localStorage.length===0`), 'Source profile was not empty');
  await source.start();
  await source.click('.create-brightling');
  await source.js(`document.querySelector('#brightling-name').focus()`);
  await source.send('Input.insertText', { text: 'Movement Check' });
  await source.click('.maker-save', 'Save Brightling');
  await source.until(`document.querySelectorAll('.portrait-card').length===3`, 'Character create failed');
  await source.click('.portrait-card:nth-child(3) button', 'Add to Playground');
  await source.click('.save-actions button', 'Save scene');
  const before = await source.js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1')})`);
  await source.click('.studio-nav button', 'Places'); await source.click('.folder-card', 'House');
  await source.shot('before-fix-house-with-select.png');
  assert(await source.js(`!!document.querySelector('#place-bedroom .place-move-button') && !document.querySelector('#place-bedroom select')`), 'Explicit Move control missing');
  await source.click('#place-bedroom .place-move-button', 'Move');
  await source.shot('desktop-move-choices.png');
  assert(await source.js(`!!document.querySelector('#move-options-bedroom button') && document.querySelector('#move-options-bedroom').textContent.includes('Move to Places (top level)')`), 'Destination choices missing');
  await source.click('#move-options-bedroom button', 'Move to Places (top level)');
  assert(await source.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).assignments.bedroom===null && !!document.querySelector('#place-bedroom')`), 'Initial top-level move failed');
  await source.shot('bedroom-top-level.png');
  await source.move('bedroom', 'Move to House', 'house');
  await source.shot('bedroom-in-house.png');
  await source.move('bedroom', 'Move to Places (top level)', null);
  await source.shot('bedroom-back-top-level.png');
  await source.click('.places-primary', 'New Folder');
  await source.js(`document.querySelector('#folder-name').focus()`);
  await source.send('Input.insertText', { text: 'Story Places' });
  await source.click('.folder-form button', 'Create Folder');
  const customId = await source.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).folders.find(x=>x.name==='Story Places')?.id`);
  assert(customId?.startsWith('folder-'), 'Custom folder not created');
  await source.move('bedroom', 'Move to Story Places', customId);
  await source.shot('bedroom-in-custom-folder.png');
  await source.send('Page.reload'); await wait(2300);
  await source.click('.studio-nav button', 'Places'); await source.click('.folder-card', 'Story Places');
  assert(await source.js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')).assignments.bedroom==='${customId}' && !!document.querySelector('#place-bedroom')`), 'Custom folder move did not survive refresh');
  await source.shot('bedroom-custom-after-refresh.png');
  await source.move('bedroom', 'Move to House', 'house');
  await source.shot('bedroom-custom-to-house.png');
  await source.move('living-room', 'Move to Park', 'park');
  await source.move('living-room', 'Move to House', 'house');
  await source.click('#place-living-room button', 'Preview');
  await source.until(`document.querySelector('.place-preview img')?.naturalWidth===1672`, 'Living Room preview changed');
  await source.shot('living-room-preview-preserved.png');
  await source.move('bedroom', 'Move to Story Places', customId);
  const after = await source.js(`({library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1')})`);
  assert(JSON.stringify(after) === JSON.stringify(before), 'Movement changed character or scene storage');
  await source.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await wait(400);
  await source.click('#place-bedroom .place-move-button', 'Move');
  const mobile = await source.js(`({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,options:[...document.querySelectorAll('#move-options-bedroom button')].map(x=>x.textContent)})`);
  assert(mobile.scrollWidth <= mobile.viewport && mobile.options.some(x=>x.includes('Move to Places (top level)')), 'Mobile Move choices unusable');
  await source.shot('mobile-move-choices.png');
  await source.click('#move-options-bedroom button', 'Cancel');
  await source.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
  await source.click('.studio-nav button', 'Characters');
  await source.click('[aria-label="Studio backup"] button', 'Export Studio Backup'); await wait(900);
  const filename = (await readdir(downloads)).find(name => name.startsWith('brightsenappstales-studio-') && name.endsWith('.json'));
  assert(filename, 'Studio Backup export missing');
  const backupText = await readFile(resolve(downloads, filename), 'utf8');
  const backup = JSON.parse(backupText);
  assert(backup.places.assignments.bedroom === customId && backup.scene && backup.characters.length === 1, 'Backup lost folder, scene or character data');
  await writeFile(resolve(root, 'example-movement-backup.json'), backupText);
  report.source = { customId, mobile, storageUnchanged: true, backupVersion: backup.version };
} finally { await source.stop(); }

const backupText = await readFile(resolve(root, 'example-movement-backup.json'), 'utf8');
const destination = await connect(9239);
try {
  assert(await destination.js(`localStorage.length===0`), 'Restore profile was not empty');
  await destination.start();
  await destination.js(`(()=>{const input=document.querySelector('[aria-label="Studio backup"] input');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(backupText)}],'backup.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await destination.until(`localStorage.getItem('brightsenappstales.place-folders.v1')!==null`, 'Backup restore failed');
  const restored = await destination.js(`({places:JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1')),library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1'))})`);
  const expected = JSON.parse(backupText);
  assert(JSON.stringify(restored.places) === JSON.stringify(expected.places) && JSON.stringify(restored.scene) === JSON.stringify(expected.scene) && JSON.stringify(restored.library) === JSON.stringify(expected.characters), 'Restore changed folder, scene or character data');
  await destination.click('.studio-nav button', 'Places'); await destination.click('.folder-card', 'Story Places');
  assert(await destination.js(`!!document.querySelector('#place-bedroom')`), 'Restored Bedroom missing from custom folder');
  await destination.shot('restored-custom-folder.png');
  report.restored = { customId: restored.places.folders.find(x => x.name === 'Story Places')?.id, bedroomFolder: restored.places.assignments.bedroom };
  assert(report.errors.length === 0, 'Browser console errors');
} finally { await destination.stop(); }
report.frames = frame;
await writeFile(resolve(root, 'browser-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: 'passed', frames: frame, moves: report.moves.length, errors: report.errors }));
