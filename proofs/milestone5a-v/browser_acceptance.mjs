import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('proofs/milestone5a-v');
const frames = resolve(root, 'recording-frames');
await mkdir(frames, { recursive: true });
const findings = { browserErrors: [], failedRequests: [], checkpoints: [] };
const target = await fetch('http://127.0.0.1:9226/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((yes, no) => { socket.addEventListener('open', yes, { once: true }); socket.addEventListener('error', no, { once: true }); });
let id = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const action = pending.get(message.id);
    if (action) { pending.delete(message.id); message.error ? action.reject(new Error(JSON.stringify(message.error))) : action.resolve(message.result); }
  } else if (message.method === 'Runtime.exceptionThrown') findings.browserErrors.push(message.params.exceptionDetails.text);
  else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') findings.browserErrors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
  else if (message.method === 'Network.loadingFailed' && !message.params.canceled) findings.failedRequests.push(message.params.errorText);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = id++; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
const sleep = ms => new Promise(yes => setTimeout(yes, ms));
const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; };
const waitFor = async (expression, timeout = 8000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(expression)) return; await sleep(100); } throw new Error(`Timeout: ${expression}`); };
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(resolve(root, name), Buffer.from(data.data, 'base64')); findings.checkpoints.push(name); };
const click = async label => { if (!await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(label)})); if (!b || b.disabled) return false; b.click(); return true; })()`)) throw new Error(`Button unavailable: ${label}`); };
const outfit = async value => { await evaluate(`(() => { const s=document.querySelector('#max-outfit'); s.value=${JSON.stringify(value)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`); await waitFor(`document.querySelector('#max-outfit')?.value === ${JSON.stringify(value)}`); };
const stagePoint = async (x,y) => { const r=await evaluate(`(() => { const r=document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`); return {x:r.x+r.w*x/1672,y:r.y+r.h*y/941}; };
const stageClick = async (x,y) => { const p=await stagePoint(x,y); await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y}); await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1}); await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1}); };
let sequence=0;
const record = async duration => { const end=Date.now()+duration; while(Date.now()<end){ const data=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(resolve(frames,`frame-${String(sequence++).padStart(4,'0')}.png`),Buffer.from(data.data,'base64')); await sleep(130); } };
const load = async () => { await send('Page.navigate',{url:'http://127.0.0.1:5174/'}); await waitFor(`document.readyState === 'complete' && !!document.querySelector('#max-outfit')`); await sleep(500); };

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1700,height:1100,deviceScaleFactor:1,mobile:false});
await load();
await evaluate(`localStorage.clear()`); // Only this disposable profile and origin.
await load();
if (await evaluate(`document.querySelector('#max-outfit').value`) !== 'original') throw new Error('Fresh profile did not default to hoodie');
await screenshot('01-original-hoodie.png');
await outfit('tshirt-trousers'); await sleep(500);
await screenshot('02-outfit-selected.png');
await click('Playground'); await sleep(700);
await screenshot('03-candidate-idle-thumbnail.png');
await stageClick(1280,730); await click('Play scene'); await record(4100);
await waitFor(`!document.querySelector('.play-button')?.disabled`); await screenshot('04-after-walk.png');
await click('Wave Max'); await sleep(400); await screenshot('05-wave-raised.png'); await record(1500); await waitFor(`!document.querySelector('.wave-button')?.disabled`); await screenshot('05-after-wave.png');
await stageClick(320,755); await click('Play scene'); await record(4300);
await waitFor(`!document.querySelector('.play-button')?.disabled`); await screenshot('05-after-left-walk.png');
await click('Save scene');
findings.savedScene = await evaluate(`localStorage.getItem('brightsenappstales.scene.v1')`);
await load();
if (await evaluate(`document.querySelector('#max-outfit').value`) !== 'tshirt-trousers') throw new Error('Outfit did not persist after reload');
await screenshot('06-after-reload.png');
await click('Playground'); await sleep(500); await screenshot('07-playground-after-reload.png');
await click('Characters'); await outfit('original'); await sleep(500); await screenshot('08-restored-hoodie.png');
findings.restoredScene = await evaluate(`localStorage.getItem('brightsenappstales.scene.v1')`);
findings.recordedFrames = sequence;
findings.library = await evaluate(`localStorage.getItem('brightsenappstales.brightlings.v1')`);
await writeFile(resolve(root,'browser-findings.json'),JSON.stringify(findings,null,2)+'\n');
socket.close();
if(findings.browserErrors.length||findings.failedRequests.length)process.exitCode=1;
