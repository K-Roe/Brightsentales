import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone3-2');
const frames = resolve(root, 'frames');
const downloads = resolve(root, 'downloads');
await mkdir(frames, { recursive: true }); await mkdir(downloads, { recursive: true });
const target = await fetch('http://127.0.0.1:9232/json/new?http://127.0.0.1:4176/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
let sequence = 0, frame = 0, recording = false;
const pending = new Map(), errors = [], dialogs = [];
ws.addEventListener('message', async event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(new Error(data.error.message)) : callback.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
  if (data.method === 'Page.javascriptDialogOpening') { dialogs.push(data.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
  if (data.method === 'Page.screencastFrame') { if (recording) await writeFile(resolve(frames, `${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(data.params.data, 'base64')); send('Page.screencastFrameAck', { sessionId: data.params.sessionId }); }
});
function send(method, params = {}) { const id = ++sequence; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(ok => setTimeout(ok, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function waitFor(expression, message, attempts = 90) { for (let i = 0; i < attempts; i++) { if (await js(expression)) return; await pause(200); } throw new Error(message); }
async function shot(name) { const result = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(root, name), Buffer.from(result.data, 'base64')); }
async function click(selector, contains = '') {
  await waitFor(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(contains)}));return !!e&&!e.disabled})()`, `Button unavailable: ${selector} ${contains}`);
  await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(contains)}));e.scrollIntoView({block:'center'});e.click()})()`);
  await pause(240);
}
async function typeName(value) {
  await js(`(()=>{const e=document.querySelector('#brightling-name');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));e.focus()})()`);
  await send('Input.insertText', { text: value }); await pause(180);
}
async function selectTemplate(value) { await js(`(()=>{const e=document.querySelector('#template-choice');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await pause(450); }
async function mouse(x,y,type) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type==='mouseReleased'?0:1, clickCount: 1 }); }
async function point(x,y) { return js(`(()=>{const e=document.querySelector('canvas');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.left+${x}*b.width/1672,y:b.top+${y}*b.height/941}})()`); }
async function destination(x,y) { const p=await point(x,y); await mouse(p.x,p.y,'mousePressed'); await mouse(p.x,p.y,'mouseReleased'); await pause(170); }
async function drag(x1,y1,x2,y2) { const a=await point(x1,y1),b=await point(x2,y2);await mouse(a.x,a.y,'mousePressed');for(let i=1;i<=8;i++)await mouse(a.x+(b.x-a.x)*i/8,a.y+(b.y-a.y)*i/8,'mouseMoved');await mouse(b.x,b.y,'mouseReleased');await pause(300); }
async function stopWalking() { await waitFor(`!document.querySelector('.play-button').disabled`, 'Walking did not stop', 80); }
async function storage() { return js(`({library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')||'[]'),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1')||'null')})`); }
async function importJson(json, mode) {
  await js(`(()=>{const e=document.querySelector('#import-mode');e.value=${JSON.stringify(mode)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await js(`(()=>{const input=document.querySelector('.import-file input');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(json)}],'backup.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await pause(700);
}

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await pause(2000);
  assert(await js(`localStorage.getItem('brightsenappstales.brightlings.v1')===null`), 'Test profile was not empty');
  assert(await js(`document.querySelector('.studio-nav .active')?.textContent.includes('Characters')`), 'Characters was not the default section');
  assert(await js(`document.querySelectorAll('.default-character').length===2 && document.querySelectorAll('.default-character button').length===0`), 'Protected defaults missing');
  assert(await js(`!document.querySelector('.character-maker')`), 'Maker opened before Create');
  recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 68, everyNthFrame: 3 });
  await shot('desktop-overview-empty.png');
  await click('.studio-nav button','Places'); assert(await js(`document.querySelector('[aria-label="places Coming Soon"]')?.textContent.includes('Coming Soon')`),'Places placeholder missing'); await shot('places.png');
  await click('.studio-nav button','Scenes'); assert(await js(`document.querySelector('[aria-label="scenes Coming Soon"]')?.textContent.includes('Coming Soon')`),'Scenes placeholder missing'); await shot('scenes.png');
  await click('.studio-nav button','Characters');
  await click('.create-brightling'); await shot('desktop-maker.png');
  await typeName('Unsaved'); await click('.cancel-button'); assert(await js(`document.querySelectorAll('.portrait-card').length===2`),'Create Cancel changed library');
  await click('.create-brightling'); await typeName('Charlie'); await click('.maker-save','Save Brightling'); await waitFor(`document.querySelectorAll('.portrait-card').length===3`,'Male creation failed');
  await click('.create-brightling'); await selectTemplate('female'); await typeName('Lily'); await click('.maker-save','Save Brightling'); await waitFor(`document.querySelectorAll('.portrait-card').length===4`,'Female creation failed');
  const created = await storage(); const charlieId=created.library.find(x=>x.name==='Charlie')?.id, lilyId=created.library.find(x=>x.name==='Lily')?.id;
  assert(charlieId && lilyId && charlieId!==lilyId,'Stable IDs missing');
  await js(`window.scrollTo(0,0)`); await shot('desktop-overview-populated.png');
  await click('.portrait-card:nth-child(3) button','Edit'); await typeName('Discarded'); await click('.cancel-button'); assert((await storage()).library.find(x=>x.id===charlieId)?.name==='Charlie','Edit Cancel changed stored name');
  await click('.portrait-card:nth-child(3) button','Edit'); await typeName('Charles'); await click('[aria-label="hair #274B9C"]'); await click('.maker-save','Update Brightling');
  await waitFor(`document.querySelector('.portrait-card:nth-child(3) h3')?.textContent==='Charles'`,'Update failed');
  const edited=await storage(); assert(edited.library.find(x=>x.name==='Charles')?.id===charlieId,'Edit changed stable ID'); await shot('desktop-overview-edited.png');
  await click('.portrait-card:nth-child(3) button','Add to Playground'); await waitFor(`document.querySelector('.studio-nav .active')?.textContent.includes('Playground')`,'Playground not opened');
  await click('.studio-nav button','Characters'); await click('.portrait-card:nth-child(4) button','Add to Playground');
  await waitFor(`document.querySelectorAll('.character-card').length===4`,'Scene characters missing'); await shot('desktop-playground.png');
  await click('.character-card','Charles'); await destination(1260,790); await click('.play-button'); await stopWalking();
  await destination(500,790); await click('.play-button'); await stopWalking(); await click('.wave-button'); await pause(2800);
  await click('.character-card','Lily'); await drag(830,750,850,680); await destination(1150,850); await click('.play-button'); await stopWalking(); await click('.wave-button'); await pause(2800);
  await click('.save-actions button','Save scene'); const saved=await storage(); assert(saved.scene?.characters[charlieId]&&saved.scene?.characters[lilyId],'Scene did not save both IDs');
  await shot('playground-saved.png'); await send('Page.reload'); await pause(5000);
  assert(await js(`document.querySelector('.studio-nav .active')?.textContent.includes('Characters')`),'Characters not default after reload');
  assert(await js(`document.querySelectorAll('.portrait-card').length===4`),'Library did not persist');
  await click('.studio-nav button','Playground'); await waitFor(`document.querySelectorAll('.character-card').length===4`,'Scene did not persist'); await shot('playground-reloaded.png');
  await click('.studio-nav button','Characters'); await click('.overview-backup button','Export Library'); await pause(1100);
  const backup=await readFile(resolve(downloads,'brightsenappstales-brightlings.json'),'utf8'); assert(JSON.parse(backup).characters.length===2,'Export contents wrong');
  await click('.portrait-card:nth-child(4) button','Delete'); await pause(700);
  const deleted=await storage(); assert(!deleted.library.some(x=>x.id===lilyId) && !deleted.scene.characters[lilyId],'Delete left character references'); await shot('overview-after-delete.png');
  await importJson(backup,'merge'); const merged=await storage(); assert(merged.library.some(x=>x.id===lilyId),'Merge import failed');
  await click('.portrait-card:nth-child(4) button','Add to Playground'); await click('.save-actions button','Save scene');
  await click('.studio-nav button','Characters'); await importJson(JSON.stringify({version:1,characters:[edited.library.find(x=>x.id===charlieId)]}),'replace');
  const replaced=await storage(); assert(replaced.library.length===1&&!replaced.scene.characters[lilyId],'Replace did not prune scene'); await shot('overview-after-import.png');
  await js(`localStorage.setItem('brightsenappstales.scene.v1',JSON.stringify({version:1,characters:{max:{start:{x:325,y:700},destination:null},maxine:{start:{x:1280,y:820},destination:null}}}))`);
  await send('Page.reload'); await pause(2500); await click('.studio-nav button','Playground');
  assert(await js(`[...document.querySelectorAll('.character-card strong')].map(x=>x.textContent).join(',')==='Max,Maxine'`),'Old scene failed'); await shot('legacy-scene.png');
  const report={createdIds:{charlieId,lilyId},editedId:edited.library.find(x=>x.name==='Charles')?.id,afterDelete:deleted,afterMerge:merged,afterReplace:replaced,dialogs,errors,frames:frame,isolatedProfile:true,cancelVerified:true,protectedDefaultsVerified:true};
  await writeFile(resolve(root,'browser-report.json'),JSON.stringify(report,null,2));
  assert(errors.length===0,'Browser reported errors');
  console.log(JSON.stringify({result:'passed',frames:frame,errors,dialogs:dialogs.length,createdIds:report.createdIds}));
} finally { recording=false; await send('Page.stopScreencast').catch(()=>{}); ws.close(); }
