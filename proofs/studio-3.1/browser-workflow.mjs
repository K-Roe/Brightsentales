import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/studio-3.1');
const profile = await mkdtemp(join(tmpdir(), 'bright-studio31-chrome-'));
const frames = await mkdtemp(join(tmpdir(), 'bright-studio31-frames-'));
const url = process.env.STUDIO_URL ?? 'http://127.0.0.1:4178/';
const result = { url, profile, stages: {}, errors: [], requestsFailed: [] };
let chrome, socket, serial = 0, frame = 0;
let pending = new Map();
const wait = async (condition, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for UI state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}&&x.getClientRects().length);if(!b)throw Error('Missing visible button '+${JSON.stringify(label)});if(b.disabled)throw Error('Disabled button '+${JSON.stringify(label)});b.click();return true})()`);
const input = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(root, name), Buffer.from(data.data, 'base64')); };
const capture = async seconds => { for (let i = 0; i < seconds * 5; i++) { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(frames, `frame-${String(frame++).padStart(4, '0')}.png`), Buffer.from(data.data, 'base64')); await delay(200); } };
const point = (selector, x, y) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width*${x}/e.width,y:r.top+r.height*${y}/e.height}})()`);
const mouse = async (type, p, buttons = 0) => send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
const press = async p => { await mouse('mousePressed', p, 1); await mouse('mouseReleased', p, 0); };
const drag = async (from, to) => { await mouse('mousePressed', from, 1); for (let i = 1; i <= 8; i++) await mouse('mouseMoved', { x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }, 1); await mouse('mouseReleased', to); };
const sceneJson = () => js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`);

async function openBrowser() {
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(p => p.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') result.errors.push(message.params.entry.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.requestsFailed.push(message.params.errorText); if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.navigate', { url });
  await until(`!!document.querySelector('.scene-maker.scene-visual')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* socket closes */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  try { await unlink(join(profile, 'DevToolsActivePort')); } catch { /* Chrome may remove it */ }
  await delay(500);
}

try {
  await openBrowser();
  if (!await js(`document.querySelector('.app-shell')?.classList.contains('editor-active')`)) throw Error('Studio did not open the editor.');
  if (await sceneJson() !== null) throw Error('Disposable profile was not empty.');
  result.stages.editorDefault = 'PASS';
  await screenshot('01-editor-empty.png');
  await js(`document.querySelector('.studio31-left-tabs button:last-child').click()`);
  await until(`!!document.querySelector('.studio31-assets')`);
  await js(`document.querySelectorAll('.studio31-assets button')[0].click()`);
  await js(`document.querySelectorAll('.studio31-assets button')[1].click()`);
  await input('input[aria-label="Scene name"]', 'Max and Maxine — Living Room');
  await input('input[aria-label="Scene duration"]', 9);
  await until(`document.querySelector('.scene-stage canvas') && document.querySelectorAll('.studio31-assets button:disabled').length >= 2`);
  await delay(800);
  const maxBody = await point('.scene-stage canvas', 520, 650);
  const maxStart = await point('.scene-stage canvas', 380, 790);
  await drag(maxBody, maxStart);
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Starting position updated')`);
  result.stages.directPlacement = 'PASS';
  await screenshot('02-direct-placement.png');
  await click('Walk To');
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Walk To')`);
  const destination = await point('.scene-stage canvas', 710, 790);
  await mouse('mouseMoved', destination);
  await screenshot('03-walk-destination-preview.png');
  await press(destination);
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Destination set')`);
  await screenshot('04-walk-path.png');
  result.stages.walkDestination = 'PASS';
  const maxineBody = await point('.scene-stage canvas', 750, 650);
  await press(maxineBody);
  await until(`document.querySelector('.scene-director .director-tip')?.textContent?.includes('Maxine')`);
  const ruler = await js(`(()=>{document.querySelector('.scene-timeline').scrollIntoView({block:'center'});const e=document.querySelector('.timeline-ruler');const r=e.getBoundingClientRect();const ticks=[...e.querySelectorAll('.timeline-tick')];return {x:r.left+Number(ticks.find(x=>x.textContent==='2s')?.style.left.replace('px','')||180),y:r.top+r.height/2}})()`);
  await press(ruler);
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('2.')`);
  await click('Wave');
  await until(`!!document.querySelector('.timeline-block[aria-label^="Maxine Wave"]')`);
  await screenshot('05-wave-timeline.png');
  result.stages.waveAtPlayhead = 'PASS';
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const saved = JSON.parse(await sceneJson());
  const made = saved.scenes[0];
  result.sceneId = made.id;
  if (made.characters.max.x >= made.characters.maxine.x || !made.actions.some(a => a.characterId === 'max' && a.type === 'walk' && a.point.x > 600) || !made.actions.some(a => a.characterId === 'maxine' && a.type === 'wave' && a.start >= 1.5 && a.start <= 2.5)) throw Error('Saved demonstration does not match the mouse-created scene.');
  await click('Stop'); await click('Play');
  await capture(9);
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('9.0s')`, 5000);
  result.stages.fullBrowserPlayback = 'PASS';
  await closeBrowser();
  await openBrowser();
  await until(`document.querySelector('input[aria-label="Scene name"]')?.value === 'Max and Maxine — Living Room'`);
  if (JSON.parse(await sceneJson()).scenes[0].id !== made.id) throw Error('Reopen changed the scene ID.');
  await screenshot('06-reopened-scene.png');
  result.stages.saveCloseReopen = 'PASS';
  await js(`document.querySelector('.timeline-block[aria-label^="Maxine Wave"]').scrollIntoView({block:'center'})`);
  await delay(600);
  const wave = await js(`(()=>{const e=document.querySelector('.timeline-block[aria-label^="Maxine Wave"]');const r=e.getBoundingClientRect();return {x:r.left+Math.min(25,r.width/3),y:r.top+r.height/2}})()`);
  const halfSecond = await js(`(()=>{const ticks=[...document.querySelectorAll('.timeline-tick')];const zero=Number(ticks.find(x=>x.textContent==='0s')?.style.left.replace('px',''));const two=Number(ticks.find(x=>x.textContent==='2s')?.style.left.replace('px',''));return (two-zero)/4})()`);
  await press(wave);
  await delay(500);
  const selectedWave = await js(`(()=>{const r=document.querySelector('.timeline-block[aria-label^="Maxine Wave"]').getBoundingClientRect();return {x:r.left+Math.min(25,r.width/3),y:r.top+r.height/2}})()`);
  await drag(selectedWave, { x: selectedWave.x + halfSecond, y: selectedWave.y });
  result.timelineDrag = { wave, selectedWave, halfSecond, label: await js(`document.querySelector('.timeline-block[aria-label^="Maxine Wave"]')?.getAttribute('aria-label')`), status: await js(`document.querySelector('.scene-status')?.textContent`) };
  await click('Save Scene');
  const edited = JSON.parse(await sceneJson()).scenes[0];
  const beforeWave = made.actions.find(a => a.characterId === 'maxine' && a.type === 'wave');
  const afterWave = edited.actions.find(a => a.id === beforeWave.id);
  result.timelineDrag = { ...result.timelineDrag, before: beforeWave.start, after: afterWave?.start };
  if (afterWave.start <= beforeWave.start || afterWave.id !== beforeWave.id) throw Error('Timeline drag did not persist the same action at a later time.');
  await screenshot('07-edited-timeline.png');
  await click('Stop'); await click('Replay');
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('0.')`);
  result.stages.editSaveReplay = 'PASS';
  await click('Classic Studio');
  await until(`document.querySelector('.app-shell')?.classList.contains('classic-shell')`);
  if (!await js(`!!document.querySelector('.scene-maker.scene-visual')`)) throw Error('Classic lost the editor.');
  await click('Restart'); await click('Play');
  await until(`Number.parseFloat(document.querySelector('.scene-playback strong')?.textContent ?? '0') > 0.2`);
  await click('Restart');
  await screenshot('08-classic-editor.png');
  result.stages.classicRegression = 'PASS';
  if (result.errors.length) throw Error('Browser console errors: ' + result.errors.join(' | '));
  if (result.requestsFailed.length) throw Error('Failed requests: ' + result.requestsFailed.join(' | '));
} catch (error) {
  result.failure = error instanceof Error ? error.stack : String(error);
} finally {
  await writeFile(join(root, 'browser-workflow-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, profile }));
  if (result.failure) process.exitCode = 1;
}
if (!result.failure && frame) {
  const output = join(root, 'direct-animation-walkthrough.mp4');
  const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', join(frames, 'frame-%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-movflags', '+faststart', output], { encoding: 'utf8' });
  if (encoded.status !== 0) throw Error(encoded.stderr || 'FFmpeg failed.');
  console.log(JSON.stringify({ video: output, frames: frame }));
}
