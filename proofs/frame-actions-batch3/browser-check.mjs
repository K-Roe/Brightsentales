import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Use only the disposable Chrome profile started on port 9243 and local Vite on 4178.
const root = resolve('proofs/frame-actions-batch3');
const downloads = resolve(root, 'videos');
await mkdir(downloads, { recursive: true });
const pages = await fetch('http://127.0.0.1:9243/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:4178'));
if (!page) throw Error('Disposable browser page is unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
});
function send(method, params = {}) { const id = ++sequence; ws.send(JSON.stringify({ id, method, params })); return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject })); }
async function js(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; }
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
async function waitFor(expression, message, attempts = 200) { for (let i = 0; i < attempts; i++) { if (await js(expression)) return; await pause(200); } throw Error(message); }
async function reload() { try { await send('Page.reload'); } catch (error) { if (!String(error).includes('Inspected target navigated')) throw error; } await pause(350); }
async function clickText(text) {
  const bounds = await js(`(()=>{const element=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()===${JSON.stringify(text)});if(!element)throw Error('Missing button: '+${JSON.stringify(text)});element.scrollIntoView({block:'center'});const b=element.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x, y: bounds.y, button: 'left', buttons: 0, clickCount: 1 });
}
const id = n => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
let serial = 0;
const action = (characterId, type, start, duration, extra = {}) => ({ id: id(++serial + 100), characterId, type, start, duration, ...extra });
const makeScene = (name, duration, characters, actions, objects = []) => ({ id: id(++serial), name, duration, placeId: 'living-room', characters, actions, objects });
const art = { artwork: 'provisional-v1' };
const maxChair = makeScene('B3 Max Chair', 7, { max: { x: 600, y: 790 } }, [
  action('max','appear',0,0,{point:{x:600,y:790}}), action('max','sit-down',1,1.5,{...art,seat:'chair'}), action('max','stand-up',4,1.5,{...art,seat:'chair'}),
]);
const maxineSofa = makeScene('B3 Maxine Sofa', 7, { maxine: { x: 860, y: 505 } }, [
  action('maxine','appear',0,0,{point:{x:860,y:505}}), action('maxine','sit-down',1,1.5,{...art,seat:'sofa'}), action('maxine','stand-up',4,1.5,{...art,seat:'sofa'}),
]);
const maxineChair = makeScene('B3 Maxine Chair', 7, { maxine: { x: 860, y: 790 } }, [
  action('maxine','appear',0,0,{point:{x:860,y:790}}), action('maxine','sit-down',1,1.5,{...art,seat:'chair'}), action('maxine','stand-up',4,1.5,{...art,seat:'chair'}),
]);
const maxBall = id(900), maxineBall = id(901);
const maxToy = makeScene('B3 Max Toy', 9, { max: { x: 700, y: 790 } }, [
  action('max','appear',0,0,{point:{x:700,y:790}}), action('max','pick-up',1,1.5,{...art,objectId:maxBall}),
  action('max','walk',3,2,{point:{x:1000,y:790}}), action('max','put-down',5.5,1.5,{...art,objectId:maxBall,point:{x:928,y:790}}),
], [{id:maxBall,kind:'toy-ball',point:{x:628,y:790}}]);
const maxineToy = makeScene('B3 Maxine Toy', 9, { maxine: { x: 900, y: 790 } }, [
  action('maxine','appear',0,0,{point:{x:900,y:790}}), action('maxine','pick-up',1,1.5,{...art,objectId:maxineBall}),
  action('maxine','walk',3,2,{point:{x:1200,y:790}}), action('maxine','put-down',5.5,1.5,{...art,objectId:maxineBall,point:{x:1128,y:790}}),
], [{id:maxineBall,kind:'toy-ball',point:{x:828,y:790}}]);
const combined = makeScene('B3 Walk Wave Sit Toy', 17, { max: { x: 400, y: 790 } }, [
  action('max','appear',0,0,{point:{x:400,y:790}}), action('max','walk',0,2,{point:{x:650,y:790}}), action('max','wave',2,2),
  action('max','sit-down',4,1.5,{...art,seat:'chair'}), action('max','stand-up',6,1.5,{...art,seat:'chair'}),
  action('max','walk',7.5,2,{point:{x:850,y:790}}), action('max','pick-up',10,1.5,{...art,objectId:id(902)}),
  action('max','walk',11.5,2,{point:{x:1100,y:790}}), action('max','put-down',14,1.5,{...art,objectId:id(902),point:{x:1028,y:790}}),
  action('max','wave',15.5,1.5),
], [{id:id(902),kind:'toy-ball',point:{x:778,y:790}}]);
const scenes = [maxChair, process.argv.includes('--working-only') ? maxineChair : maxineSofa, maxToy, maxineToy, combined];
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not load');
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`) && !process.argv.includes('--replace-disposable')) throw Error('Disposable profile already has timed scenes');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify({version:1,scenes}))})`);
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reopen');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Scenes')).click()`);
  await waitFor(`document.querySelectorAll('.scene-library article').length===5`, 'Five scenes did not load');
  const results = [];
  for (const scene of scenes) {
    await js(`(()=>{const a=[...document.querySelectorAll('.scene-library article')].find(a=>a.querySelector('h2')?.textContent===${JSON.stringify(scene.name)});a.querySelector('button').click()})()`);
    await waitFor(`!!document.querySelector('.scene-stage canvas')`, `${scene.name} did not open`);
    await pause(1500);
    const warning = await js(`document.querySelector('.storage-alert')?.textContent ?? null`);
    if (warning) throw Error(`${scene.name}: ${warning}`);
    await js(`document.querySelector('.director-cast button').click()`);
    const available = await js(`['Sit down','Stand up','Pick up toy','Put down toy'].every(name=>[...document.querySelectorAll('.director-actions button')].some(b=>b.textContent===name))`);
    if (!available) throw Error(`${scene.name} is missing Batch 3 Scene Maker controls`);
    if (scene === maxChair) {
      await js(`document.querySelector('.scene-stage-main').scrollIntoView({block:'start'})`);
      await pause(250);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(resolve(root, 'scene-maker-controls.png'), Buffer.from(screenshot.data, 'base64'));
    }
    await clickText('Export scene video (WebM)');
    await waitFor(`document.querySelector('.scene-heading button:last-child')?.textContent==='Export scene video (WebM)'`, `${scene.name} export did not finish`, Math.ceil((scene.duration+25)*5));
    const fileName = `${scene.name.replace(/[^a-z0-9_-]/gi,'_')}.webm`;
    for (let i=0;i<40;i++) { if ((await readdir(downloads)).includes(fileName)) break; await pause(250); }
    const video = await readFile(resolve(downloads, fileName));
    if (video.length < 1000) throw Error(`${scene.name} WebM was empty`);
    await clickText('Save Scene');
    await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('saved')`, `${scene.name} did not save`);
    results.push({name:scene.name,seconds:scene.duration,bytes:video.length,controlsVisible:available});
    await clickText('← All scenes');
    await waitFor(`document.querySelectorAll('.scene-library article').length===5`, 'Scene library did not reopen');
  }
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not survive reload');
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))`);
  if (JSON.stringify(reopened)!==JSON.stringify({version:1,scenes})) throw Error('Saved scenes changed after reopening');
  await js(`localStorage.setItem('brightsenappstales.episodes.v1', ${JSON.stringify(JSON.stringify({version:1,episodes:[{id:id(950),name:'B3 Episode Export',sceneIds:[combined.id]}]}))})`);
  await reload();
  await waitFor(`!!document.querySelector('.studio-nav')`, 'Studio did not reopen for episode');
  await js(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.includes('Episodes')).click()`);
  await waitFor(`!!document.querySelector('.scene-library article')`, 'Episode did not load');
  await js(`document.querySelector('.scene-library article button').click()`);
  await waitFor(`!!document.querySelector('.episode-preview canvas')`, 'Episode editor did not open');
  await clickText('Export Episode Video');
  await waitFor(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 'Episode export did not finish', 230);
  for (let i=0;i<40;i++) { if ((await readdir(downloads)).includes('B3_Episode_Export.webm')) break; await pause(250); }
  const episode = await readFile(resolve(downloads,'B3_Episode_Export.webm'));
  await writeFile(resolve(root,'browser-check.json'),JSON.stringify({results,episodeBytes:episode.length,saveReload:true,errors,disposableProfile:true},null,2));
  if(errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
  process.stdout.write(JSON.stringify({result:'passed',results,episodeBytes:episode.length,errors})+'\n');
} finally { ws.close(); }
