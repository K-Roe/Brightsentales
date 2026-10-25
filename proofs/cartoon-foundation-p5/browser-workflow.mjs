import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const proof = resolve('proofs/cartoon-foundation-p5');
const profile = await mkdtemp(join(tmpdir(), 'brighttales-p5-episode-'));
const origin = process.env.STUDIO_URL ?? 'http://127.0.0.1:4179/';
const result = { origin, profile, stages: {}, errors: [], failedRequests: [] };
const pending = new Map();
let chrome, socket, serial = 0;
const wait = async (condition, ms = 20000) => { const until = Date.now() + ms; while (Date.now() < until) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(Error(`${method} timed out`)); }, 15000); pending.set(id, { resolveCall: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = (label, index = 0) => js(`(()=>{const a=[...document.querySelectorAll('button')].filter(x=>(x.textContent.trim()===${JSON.stringify(label)}||x.textContent.trim().endsWith(${JSON.stringify(label)}))&&x.getClientRects().length);const e=a[${index}];if(!e)throw Error('Missing visible button '+${JSON.stringify(label)}+' #'+${index});if(e.disabled)throw Error('Disabled button '+${JSON.stringify(label)});e.click();return true})()`);
const change = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field '+${JSON.stringify(selector)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(proof, name), Buffer.from(data.data, 'base64')); };

function wave(seconds) {
  const rate = 16000, samples = Math.round(rate * seconds), bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples * 2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / rate) * 2500), 44 + i * 2);
  return bytes;
}
async function attach(path) {
  const root = await send('DOM.getDocument');
  const found = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[aria-label="Import audio file"]' });
  if (!found.nodeId) throw Error('Audio import field is missing.');
  await send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [path] });
}
async function openBrowser() {
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(p => p.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText); if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable');
  await send('Page.navigate', { url: origin });
  await until(`!!document.querySelector('.scene-maker.scene-visual')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Browser is closing. */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  const stop = '$target=$env:BRIGHTTALES_OWNED_PROFILE; Get-CimInstance Win32_Process -Filter "name=\'chrome.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  spawnSync('powershell.exe', ['-NoProfile', '-Command', stop], { env: { ...process.env, BRIGHTTALES_OWNED_PROFILE: profile }, windowsHide: true });
}

try {
  const music = join(profile, 'p5-episode-music.wav'); await writeFile(music, wave(9));
  await openBrowser();
  await click('Audio Library');
  await until(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  await change('select[aria-label="Imported audio type"]', 'music'); await attach(music);
  await until(`document.querySelector('.audio-asset-list')?.textContent?.includes('p5-episode-music.wav')`);
  result.stages.audioImport = 'PASS';
  await click('Cartoon Editor');
  await change('input[aria-label="Scene name"]', 'P5 Max opening');
  await change('input[aria-label="Scene duration"]', 3);
  await change('select[aria-label="Add Brightling"]', 'max');
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const first = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0]`);
  await click('← All scenes'); await click('Create Scene');
  await change('input[aria-label="Scene name"]', 'P5 Maxine response');
  await change('input[aria-label="Scene duration"]', 3);
  await change('select[aria-label="Add Brightling"]', 'maxine');
  await click('Wave');
  await click('Save Scene');
  await until(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.length===2`);
  const second = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[1]`);
  if (first.id === second.id || !second.actions.some(action => action.type === 'wave')) throw Error('Scene authoring failed.');
  result.stages.twoSavedScenes = 'PASS';
  await click('Episode Maker'); await click('Create Episode');
  await change('input[aria-label="Episode name"]', 'P5 Max and Maxine episode');
  await click('Add Scene', 0); await click('Add Scene', 1); await click('Add Scene', 0);
  await js(`document.querySelector('[aria-label="Select scene 2: P5 Maxine response"]').click()`);
  if (!await js(`document.querySelector('.episode-inspector')?.textContent?.includes('Occurrence 2 of 3')`)) throw Error('Scene inspector did not follow selection.');
  await screenshot('02-selected-scene-inspector.png');
  await js(`document.querySelector('.episode-timeline-track').scrollIntoView({block:'center'})`);
  await screenshot('03-sequence-timeline.png');
  await js(`document.querySelector('.episode-preview').scrollIntoView({block:'start'})`);
  await click('Duplicate in episode');
  if (!await js(`document.querySelectorAll('.episode-cards article').length === 4`)) throw Error('Duplicate occurrence failed.');
  await click('Remove from episode');
  if (!await js(`document.querySelectorAll('.episode-cards article').length === 3`)) throw Error('Remove occurrence failed.');
  result.stages.occurrenceEdit = 'PASS';
  await js(`document.querySelector('[aria-label="Select scene 2: P5 Maxine response"]').click()`);
  await click('Move later');
  if (!await js(`document.querySelectorAll('.episode-cards article')[2]?.textContent?.includes('P5 Maxine response')`)) throw Error('Scene reorder failed.');
  await click('Move earlier');
  if (!await js(`document.querySelectorAll('.episode-cards article')[1]?.textContent?.includes('P5 Maxine response')`)) throw Error('Scene reorder reversal failed.');
  result.stages.reorder = 'PASS';
  await click('Add Music');
  await click('Save Episode');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const saved = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
  if (saved.sceneIds.join(',') !== [first.id, second.id, first.id].join(',') || saved.audio?.length !== 1) throw Error('Saved episode sequence/music differs from UI.');
  result.stages.episodeSave = 'PASS';
  await js(`window.scrollTo(0,0)`);
  await screenshot('00-episode-workspace-top.png');
  await js(`document.querySelector('.episode-preview').scrollIntoView({block:'start'})`);
  await screenshot('01-episode-editor.png');
  await click('Preview Episode');
  await until(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'0') > 3.2`, 10000);
  if (!await js(`document.querySelector('.episode-preview .scene-stage-caption')?.textContent?.includes('P5 Maxine response')`)) throw Error('Browser episode did not advance to the second scene.');
  await screenshot('04-scene-boundary.png'); result.stages.browserBoundary = 'PASS';
  await click('Stop');
  if (!await js(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'1') === 0`)) throw Error('Stop did not reset episode time.');
  result.stages.stop = 'PASS';
  await closeBrowser(); await openBrowser();
  await click('Episode Maker');
  await click('Open');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
  if (reopened.id !== saved.id || reopened.sceneIds.join(',') !== saved.sceneIds.join(',') || reopened.audio[0].id !== saved.audio[0].id) throw Error('Episode changed after browser reopen.');
  await until(`!!document.querySelector('.episode-preview .scene-playback button.scene-primary:not(:disabled)')`);
  await click('Play');
  await until(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'0') > .5`);
  await screenshot('05-reopened-playback.png'); result.stages.reopenReplay = 'PASS';
  if (!await js(`!!document.querySelector('.episode-unity-preview button')`)) throw Error('Unity episode preview controls are missing.');
  const frames = join(profile, 'frames'); await mkdir(frames);
  for (let index = 0; index < 45; index++) { const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(frames, `frame-${String(index).padStart(4, '0')}.png`), Buffer.from(capture.data, 'base64')); await delay(180); }
  const recording = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', join(frames, 'frame-%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(proof, 'episode-workflow.mp4')], { encoding: 'utf8', windowsHide: true });
  if (recording.status !== 0) throw Error(`Review recording failed: ${recording.stderr}`);
  result.stages.reviewRecording = 'PASS';
  await js(`document.querySelector('.episode-unity-preview').scrollIntoView({block:'center'})`);
  await screenshot('06-unity-episode-controls.png');
  result.sceneIds = saved.sceneIds; result.episodeId = saved.id;
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) { result.failure = error instanceof Error ? error.stack : String(error); try { result.debug = await js(`({url:location.href,buttons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).map(x=>x.textContent.trim()).slice(0,45),body:document.body.textContent.slice(0,600)})`); await screenshot('failure.png'); } catch { /* Browser may already be closed. */ } }
finally {
  await writeFile(join(proof, 'browser-workflow-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, profile }));
  if (result.failure) process.exitCode = 1;
}
