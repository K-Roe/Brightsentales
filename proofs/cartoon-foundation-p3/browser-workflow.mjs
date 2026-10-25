import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const proof = resolve('proofs/cartoon-foundation-p3');
const disposable = await mkdtemp(join(tmpdir(), 'brighttales-p3-audio-'));
const origin = process.env.STUDIO_URL ?? 'http://127.0.0.1:4179/';
const result = { origin, disposable, stages: {}, errors: [], failedRequests: [] };
let chrome, socket, serial = 0;
const pending = new Map();
const wait = async (condition, ms = 20000) => { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP ${method} timed out`)); }, 15000); pending.set(id, { resolveCall: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.textContent.trim()===${JSON.stringify(label)}||x.title===${JSON.stringify(label)})&&x.getClientRects().length);if(!e)throw Error('Missing visible button '+${JSON.stringify(label)});if(e.disabled)throw Error('Disabled button '+${JSON.stringify(label)});e.click();return true})()`);
const change = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field '+${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(proof, name), Buffer.from(data.data, 'base64')); };

function wave(seconds, hz) {
  const rate = 16000, samples = Math.round(rate * seconds), bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples * 2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 2500), 44 + i * 2);
  return bytes;
}
async function attach(path) {
  const root = await send('DOM.getDocument');
  const found = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[aria-label="Import audio file"]' });
  if (!found.nodeId) throw Error('Audio import input is missing.');
  await send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [path] });
}
async function openBrowser() {
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${disposable}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(disposable, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(p => p.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText); if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable');
  await send('Page.navigate', { url: origin });
  await until(`!!document.querySelector('.scene-maker.scene-visual')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Browser closing. */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  const stop = '$target=$env:BRIGHTTALES_OWNED_PROFILE; Get-CimInstance Win32_Process -Filter "name=\'chrome.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  spawnSync('powershell.exe', ['-NoProfile', '-Command', stop], { env: { ...process.env, BRIGHTTALES_OWNED_PROFILE: disposable }, windowsHide: true });
}

try {
  const speech = join(disposable, 'p3-speech.wav'), music = join(disposable, 'p3-music.wav');
  await writeFile(speech, wave(2, 440)); await writeFile(music, wave(3, 220));
  await openBrowser();
  console.log('Browser opened');
  console.log('CDP evaluation', await js('1+1'));
  // The generated, unique Chrome profile starts empty; the saved scene is checked below.
  await click('Audio Library');
  console.log('Audio Library opened');
  await until(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  await change('select[aria-label="Imported audio type"]', 'speech'); await attach(speech);
  await until(`document.querySelector('.audio-asset-list')?.textContent?.includes('p3-speech.wav')`);
  console.log('Speech imported');
  await change('select[aria-label="Imported audio type"]', 'music'); await attach(music);
  await until(`document.querySelector('.audio-asset-list')?.textContent?.includes('p3-music.wav')`);
  console.log('Music imported');
  await screenshot('01-audio-library.png'); result.stages.import = 'PASS';
  await click('Cartoon Editor');
  console.log('Cartoon Editor opened');
  await until(`!!document.querySelector('input[aria-label="Scene name"]')`);
  await change('input[aria-label="Scene name"]', 'P3 local speech and music');
  await change('input[aria-label="Scene duration"]', 6);
  await change('select[aria-label="Add Brightling"]', 'max');
  await until(`!!document.querySelector('.scene-hierarchy button.active')`);
  await click('Add Music');
  await click('Add Speech');
  await until(`document.querySelectorAll('.audio-block').length===2`);
  await change('input[aria-label="Audio clip start"]', 1);
  await change('input[aria-label="Audio clip volume"]', .5);
  await click('Save Scene');
  console.log('Scene save clicked');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const saved = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0]`);
  if (saved.audio.length !== 2 || !saved.audio.some(c => c.start === 1 && c.volume === .5)) throw Error('Saved scene clips do not match the UI edit.');
  await js(`document.querySelector('.audio-panel').scrollIntoView({block:'center'})`);
  await screenshot('02-scene-audio-timeline.png'); result.stages.authorSave = 'PASS';
  await closeBrowser(); await openBrowser();
  await until(`document.querySelectorAll('.audio-block').length===2`);
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0]`);
  if (reopened.id !== saved.id || reopened.audio.some((c, i) => c.id !== saved.audio[i].id)) throw Error('Saved audio clip IDs changed after reopening.');
  await click('Play');
  await delay(2000);
  result.playbackDebug = await js(`({clock:document.querySelector('.scene-playback')?.innerText,status:document.querySelector('.scene-status')?.innerText,buttons:[...document.querySelectorAll('.scene-playback button')].map(x=>x.textContent.trim())})`);
  await until(`Number.parseFloat(document.querySelector('.scene-playback strong')?.textContent ?? '0') > 1.5`);
  await screenshot('03-reopened-browser-playback.png');
  await click('Replay'); result.stages.reopenPlayback = 'PASS';
  const frames = join(disposable, 'review-frames'); await mkdir(frames);
  for (let index = 0; index < 30; index++) {
    const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(frames, `frame-${String(index).padStart(4, '0')}.png`), Buffer.from(capture.data, 'base64'));
    await delay(180);
  }
  const recording = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '5', '-i', join(frames, 'frame-%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(proof, 'studio-audio-workflow.mp4')], { encoding: 'utf8', windowsHide: true });
  if (recording.status !== 0) throw Error(`Review recording failed: ${recording.stderr}`);
  result.stages.reviewRecording = 'PASS';
  result.sceneId = saved.id;
  result.audio = saved.audio.map(c => ({ id: c.id, assetId: c.assetId, start: c.start, volume: c.volume }));
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) { result.failure = error instanceof Error ? error.stack : String(error); }
finally {
  await writeFile(join(proof, 'browser-workflow-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, disposable }));
  if (result.failure) process.exitCode = 1;
}
