import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const output = resolve('proofs/milestone3-maker');
await mkdir(output, { recursive: true });
const target = await fetch('http://127.0.0.1:9228/json/new?http://127.0.0.1:4173/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let serial = 0, frame = 0;
const pending = new Map();
const errors = [];
let recording = false;
ws.addEventListener('message', async event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  if (message.method === 'Page.screencastFrame') {
    if (recording) await writeFile(resolve(output, `final-frame-${String(frame++).padStart(5, '0')}.jpg`), Buffer.from(message.params.data, 'base64'));
    send('Page.screencastFrameAck', { sessionId: message.params.sessionId });
  }
});
function send(method, params = {}) { const id = ++serial; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function shot(name) { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(resolve(output, name), Buffer.from(data.data, 'base64')); }
async function sheet(kind) {
  const data = await js(`(async()=>{const m=await import('/src/maker.ts');const list=JSON.parse(localStorage.getItem(m.LIBRARY_KEY));const names=${kind === 'walking' ? "['side-0','side-v3-1','side-v3-2','side-v3-3','side-v3-4']" : "['0','wave-1','wave-2','wave-3']"};const sheet=document.createElement('canvas');sheet.width=names.length*270;sheet.height=2*435+35;const c=sheet.getContext('2d');c.fillStyle='#f7f3f8';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#302145';c.font='bold 20px Arial';c.fillText('${kind} · approved poses at editor scale',20,26);for(let row=0;row<2;row++){const person=list[row];for(let col=0;col<names.length;col++){const pic=await m.makeFrame(person,names[col]);c.drawImage(pic,col*270+16,row*435+45,names[col].includes('wave')?245:names[col]==='0'||names[col]==='side-0'?213:239,355);c.fillStyle='#302145';c.font='15px Arial';c.fillText(person.name+' · '+names[col],col*270+20,row*435+420)}}return sheet.toDataURL('image/png')})()`);
  await writeFile(resolve(output, `${kind}-contact.png`), Buffer.from(data.split(',')[1], 'base64'));
}
async function idleHash(id) { const data = await js(`(async()=>{const m=await import('/src/maker.ts');const item=JSON.parse(localStorage.getItem(m.LIBRARY_KEY)).find(x=>x.name===${JSON.stringify(id)});return (await m.makeFrame(item,'0')).toDataURL('image/png')})()`); return createHash('sha256').update(Buffer.from(data.split(',')[1], 'base64')).digest('hex'); }
async function click(text) { const okay = await js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim().includes(${JSON.stringify(text)}) && !x.disabled);if(!b)return false;b.click();return true})()`); if (!okay) throw new Error(`Button not found: ${text}`); await pause(350); }
async function typeName(name) { await js(`(()=>{const el=document.querySelector('.maker-fields input');el.focus();el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await send('Input.insertText', { text: name }); await pause(200); }
async function mouse(x, y, type) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function stagePoint(x, y) { return js(`(()=>{const b=document.querySelector('canvas').getBoundingClientRect();return {x:b.left+${x}*b.width/1672,y:b.top+${y}*b.height/941}})()`); }
async function destination(x, y) { const p = await stagePoint(x, y); await mouse(p.x, p.y, 'mousePressed'); await mouse(p.x, p.y, 'mouseReleased'); await pause(200); }
async function drag(x1, y1, x2, y2) { const a = await stagePoint(x1, y1), b = await stagePoint(x2, y2); await mouse(a.x, a.y, 'mousePressed'); for(let i=1;i<=8;i++) await mouse(a.x+(b.x-a.x)*i/8,a.y+(b.y-a.y)*i/8,'mouseMoved'); await mouse(b.x,b.y,'mouseReleased'); await pause(250); }
async function waitForWalk() { for(let i=0;i<60;i++) { if (await js(`!document.querySelector('.play-button').disabled`)) return; await pause(200); } throw new Error('Walking did not finish'); }

try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await pause(2000);
  await js(`localStorage.removeItem('brightsenappstales.brightlings.v1');localStorage.removeItem('brightsenappstales.scene.v1')`);
  await send('Page.reload', { ignoreCache: true }); await pause(1600);
  recording = true; await send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 3 });
  await click('Brightling Maker'); await pause(2200); await shot('maker.png');
  await typeName('Charlie'); await click('Save Brightling'); await pause(1200);
  await click('Brightling Maker'); await js(`(()=>{const el=document.querySelector('.maker-fields select');el.value='female';el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await pause(2200);
  await typeName('Lily'); await shot('female-preview.png'); await click('Save Brightling'); await pause(1200);
  await click('Charlie'); await click('Lily'); await pause(1800); await shot('living-room.png');
  await sheet('walking'); await sheet('waving');
  const beforeHashes = { Charlie: await idleHash('Charlie'), Lily: await idleHash('Lily') };
  await click('Charlie'); await destination(1440, 790); await click('Play scene'); await waitForWalk();
  await destination(330, 780); await click('Play scene'); await waitForWalk();
  await click('Wave Charlie'); await pause(3000);
  await click('Lily'); await destination(1220, 700); await click('Play scene'); await waitForWalk();
  await destination(700, 840); await click('Play scene'); await waitForWalk();
  await click('Wave Lily'); await pause(3000);
  await drag(720, 730, 1100, 800); await click('Save scene'); await pause(450);
  await send('Page.reload', { ignoreCache: true }); await pause(6000); await shot('reopened-scene.png');
  await click('Open saved'); await pause(500);
  const afterHashes = { Charlie: await idleHash('Charlie'), Lily: await idleHash('Lily') };
  const state = await js(`({cards:[...document.querySelectorAll('.character-card strong')].map(x=>x.textContent),library:localStorage.getItem('brightsenappstales.brightlings.v1'),scene:localStorage.getItem('brightsenappstales.scene.v1'),status:document.querySelector('[role=status]')?.textContent})`);
  await writeFile(resolve(output, 'browser-state.json'), JSON.stringify({ state, errors, frames: frame, beforeHashes, afterHashes }, null, 2));
  console.log(JSON.stringify({ cards: state.cards, frames: frame, errors, hashesMatch: JSON.stringify(beforeHashes) === JSON.stringify(afterHashes), status: state.status }));
} finally { recording = false; await send('Page.stopScreencast').catch(()=>{}); ws.close(); }
