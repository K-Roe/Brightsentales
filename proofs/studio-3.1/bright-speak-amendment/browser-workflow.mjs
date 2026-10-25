import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/studio-3.1/bright-speak-amendment');
const profile = await mkdtemp(join(tmpdir(), 'bright-speak-amendment-'));
const frames = await mkdtemp(join(tmpdir(), 'bright-speak-frames-'));
const url = process.env.STUDIO_URL ?? 'http://127.0.0.1:4178/';
const result = { url, profile, stages: {}, errors: [], requestsFailed: [] };
let chrome, socket, serial = 0, frame = 0;
let pending = new Map();
const wait = async (condition, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}&&x.getClientRects().length);if(!b)throw Error('Missing visible button '+${JSON.stringify(label)});if(b.disabled)throw Error('Disabled button '+${JSON.stringify(label)});b.click();return true})()`);
const input = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(root, name), Buffer.from(data.data, 'base64')); };
const capture = async seconds => { for (let i = 0; i < seconds * 5; i++) { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(frames, `frame-${String(frame++).padStart(4, '0')}.png`), Buffer.from(data.data, 'base64')); await delay(200); } };
const toggle = label => js(`(()=>{const s=[...document.querySelectorAll('summary')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!s)throw Error('Missing disclosure '+${JSON.stringify(label)});s.click();return s.parentElement.open})()`);
const scene = () => js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0]`);
const messageInput = () => js(`document.querySelector('input[aria-label="Communication message"]')?.value`);
const phoneBlock = id => js(`(()=>{const e=[...document.querySelectorAll('.timeline-phone')].find(x=>x.getAttribute('data-phone-id')===${JSON.stringify(id)});if(!e)throw Error('Missing Bright Speak timeline block');e.click();return true})()`);

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
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Closing the socket is expected. */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  try { await unlink(join(profile, 'DevToolsActivePort')); } catch { /* Chrome may have removed it. */ }
  await delay(500);
}

try {
  await openBrowser();
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`) !== null) throw Error('Disposable profile was not empty.');
  await input('input[aria-label="Scene name"]', 'Bright Speak editable messages');
  await input('input[aria-label="Scene duration"]', 10);
  await js(`(()=>{const e=document.querySelector('select[aria-label="Add Brightling"]');e.value='max';e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(`!!document.querySelector('.scene-hierarchy button.active')`);
  await toggle('Bright Speak interactions');
  await click('Take Out Bright Speak');
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('0.6s')`);
  await click('Communicate Message');
  await until(`!!document.querySelector('input[aria-label="Communication message"]')`);
  if (await messageInput() !== '') throw Error('New communication should invite a free-text message.');
  await input('input[aria-label="Communication message"]', 'Can I have a drink?');
  await until(`!!document.querySelector('.scene-heading-actions button.scene-primary:not(:disabled)')`);
  const first = { id: await js(`document.querySelector('.timeline-phone[aria-label*="Can I have a drink?"]')?.dataset.phoneId`), message: 'Can I have a drink?' };
  if (!first.id) throw Error('First custom text did not appear on its timeline block.');
  await js(`document.querySelector('input[aria-label="Communication message"]').scrollIntoView({block:'center'})`);
  await screenshot('01-editable-message-inspector.png');
  await click('Preview message on stage');
  await js(`document.querySelector('.scene-stage').scrollIntoView({block:'center'})`);
  await screenshot('02-first-message-preview.png');
  result.stages.firstCustomMessage = 'PASS';
  await click('Communicate Message');
  await until(`document.querySelectorAll('.timeline-phone[aria-label*="Communicate Message"]').length===2`);
  await input('input[aria-label="Communication message"]', 'I need a break.');
  const second = { id: await js(`document.querySelector('.timeline-phone[aria-label*="I need a break."]')?.dataset.phoneId`), message: 'I need a break.' };
  if (!second.id || second.id === first.id || !await js(`!!document.querySelector('.timeline-phone[aria-label*="Can I have a drink?"]')`)) throw Error('Two actions did not retain independent text.');
  await js(`document.querySelector('.scene-timeline').scrollIntoView({block:'center'})`);
  await screenshot('03-independent-timeline-actions.png');
  await click('Preview message on stage');
  await js(`document.querySelector('.scene-stage').scrollIntoView({block:'center'})`);
  await screenshot('04-second-message-preview.png');
  result.stages.independentMessages = 'PASS';
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const saved = await scene();
  const originalId = saved.id;
  if (saved.phone.find(action => action.id === first.id)?.message !== first.message || saved.phone.find(action => action.id === second.id)?.message !== second.message || saved.phone.some(action => action.type === 'communicate' && (action.assetId || action.clipId))) throw Error('Saved text-only actions are incomplete or gained a voice clip.');
  await closeBrowser();
  await openBrowser();
  await until(`document.querySelector('input[aria-label="Scene name"]')?.value==='Bright Speak editable messages'`);
  if ((await scene()).id !== originalId) throw Error('Scene ID changed after reopen.');
  await phoneBlock(first.id);
  await until(`document.querySelector('input[aria-label="Communication message"]')?.value==='Can I have a drink?'`);
  await phoneBlock(second.id);
  await until(`document.querySelector('input[aria-label="Communication message"]')?.value==='I need a break.'`);
  result.stages.reopenAndSelect = 'PASS';
  await input('input[aria-label="Communication message"]', 'Thank you!');
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const edited = await scene();
  if (edited.phone.find(action => action.id === first.id)?.message !== first.message || edited.phone.find(action => action.id === second.id)?.message !== 'Thank you!') throw Error('Edited message or earlier message did not persist.');
  await click('Preview message on stage');
  await js(`document.querySelector('.scene-stage').scrollIntoView({block:'center'})`);
  await screenshot('05-edited-message-preview.png');
  await click('Replay');
  await capture(10);
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('10.0s')`, 5000);
  result.stages.editSaveReplay = 'PASS';
  await click('Classic Studio');
  await until(`document.querySelector('.app-shell')?.classList.contains('classic-shell')`);
  await click('Restart'); await click('Play');
  await until(`Number.parseFloat(document.querySelector('.scene-playback strong')?.textContent ?? '0') > 1.0`);
  await screenshot('06-classic-playback.png');
  await click('Restart');
  result.stages.classicPlayback = 'PASS';
  if (result.errors.length || result.requestsFailed.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.requestsFailed.join(' | ')}`);
  result.sceneId = originalId;
  result.phoneActions = edited.phone.map(action => ({ id: action.id, type: action.type, start: action.start, duration: action.duration, message: action.message }));
} catch (error) {
  result.failure = error instanceof Error ? error.stack : String(error);
} finally {
  await writeFile(join(root, 'browser-workflow-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, profile }));
  if (result.failure) process.exitCode = 1;
}
if (!result.failure && frame) {
  const output = join(root, 'bright-speak-editable-playback.mp4');
  const encoded = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', join(frames, 'frame-%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-movflags', '+faststart', output], { encoding: 'utf8' });
  if (encoded.status !== 0) throw Error(encoded.stderr || 'FFmpeg failed.');
  console.log(JSON.stringify({ video: output, frames: frame }));
}
