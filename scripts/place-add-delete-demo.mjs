import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const proof = resolve('proofs/place-add-delete');
await mkdir(proof, { recursive: true });
const errors = [];
const target = await fetch('http://127.0.0.1:9240/json/new?http://127.0.0.1:4181/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const done = pending.get(message.id);
    pending.delete(message.id);
    message.error ? done.reject(new Error(message.error.message)) : done.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async expression => { for (let n = 0; n < 60; n++) { if (await js(expression)) return; await wait(150); } throw new Error(`Timed out: ${expression}`); };
const click = async (selector, label) => { await until(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(element => element.textContent.includes(${JSON.stringify(label)}) && !element.disabled)`); await js(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(element => element.textContent.includes(${JSON.stringify(label)})).click()`); await wait(200); };
const shot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(resolve(proof, name), Buffer.from(result.data, 'base64')); };
const organisation = () => js(`JSON.parse(localStorage.getItem('brightsenappstales.place-folders.v1'))`);
const upload = async (selector, file) => {
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`Missing upload input: ${selector}`);
  await send('DOM.setFileInputFiles', { nodeId, files: [file] });
  await wait(350);
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1450, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(1200);
  assert(await js('localStorage.length === 0'), 'Test profile was not empty');
  await click('.studio-nav button', 'Places');
  await click('.folder-card', 'House');
  await shot('before-house.png');
  await click('.places-heading-actions button', 'Add Place');
  await js(`document.querySelector('#place-name').focus()`);
  await send('Input.insertText', { text: 'Treehouse' });
  await upload('#place-image', resolve('public/art/living-room.png'));
  await shot('add-place-form.png');
  await click('.folder-form button', 'Add Place');
  await until(`!![...document.querySelectorAll('.place-card h3')].find(element => element.textContent === 'Treehouse')`);
  const added = await organisation();
  const custom = added.customPlaces.find(place => place.name === 'Treehouse');
  assert(custom && added.assignments[custom.id] === 'house', 'Added place missing or outside House');
  assert(added.artwork[custom.id]?.startsWith('data:image/webp;base64,'), 'Uploaded artwork was not stored');
  assert(await js(`document.querySelector(${JSON.stringify(`#place-${custom.id} img`)})?.naturalWidth > 0`), 'Uploaded artwork did not render');
  assert(await js(`document.querySelector('#place-living-room .place-delete-button') === null`), 'Protected Living Room has Delete');
  assert(await js(`document.querySelector('#place-living-room input[type=file]') === null`), 'Protected Living Room has artwork upload');
  await shot('place-added-in-house.png');
  await send('Page.reload'); await wait(1200);
  await click('.studio-nav button', 'Places'); await click('.folder-card', 'House');
  assert(await js(`document.querySelector(${JSON.stringify(`#place-${custom.id} img`)})?.naturalWidth > 0`), 'Artwork did not survive refresh');
  await upload('#place-bedroom input[type=file]', resolve('public/art/living-room.png'));
  await until(`document.querySelector('#place-bedroom img')?.naturalWidth > 0`);
  assert((await organisation()).artwork.bedroom?.startsWith('data:image/webp;base64,'), 'Bedroom artwork was not stored');
  await shot('bedroom-artwork-uploaded.png');
  await click(`#place-${custom.id} .place-move-button`, 'Move');
  await click(`#move-options-${custom.id} button`, 'Move to Park');
  assert((await organisation()).assignments[custom.id] === 'park', 'Custom place did not move');
  await shot('place-moved-to-park.png');
  await click(`#place-${custom.id} .place-delete-button`, 'Delete');
  assert(!(await organisation()).customPlaces.some(place => place.id === custom.id), 'Delete did not remove place');
  await shot('place-deleted.png');
  await send('Page.reload'); await wait(1200);
  assert(await js(`document.querySelector('#place-living-room') === null`), 'Characters default tab changed');
  assert(!(await organisation()).customPlaces.some(place => place.id === custom.id), 'Delete did not survive refresh');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('.studio-nav button', 'Places'); await click('.folder-card', 'House');
  await click('.places-heading-actions button', 'Add Place');
  await shot('mobile-add-place.png');
  const width = await js('({scroll:document.documentElement.scrollWidth,viewport:innerWidth})');
  assert(width.scroll <= width.viewport, 'Mobile layout overflows horizontally');
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  const report = { result: 'passed', isolatedProfile: true, customId: custom.id, artworkPersistedAndMoved: true, existingPlaceArtworkUploaded: true, deletedAfterConfirmation: true, protectedLivingRoom: true, mobile: width, errors };
  await writeFile(resolve(proof, 'browser-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report));
} finally { ws.close(); }
