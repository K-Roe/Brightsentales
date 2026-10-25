import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';

const proof = resolve('proofs/cartoon-foundation-p4');
const profile = await mkdtemp(join(tmpdir(), 'brighttales-p4-unity-'));
const unityProof = process.env.CARTOON_FOUNDATION_P4_E2E_DIR;
if (!unityProof) throw Error('Set CARTOON_FOUNDATION_P4_E2E_DIR for the isolated Unity test.');
const origin = process.env.STUDIO_URL ?? 'http://127.0.0.1:4179/';
const result = { origin, profile, stages: {}, errors: [], failedRequests: [], audioUploads: 0, unityCommands: [] };
let chrome, socket, serial = 0;
const pending = new Map();
const wait = async (condition, ms = 20000) => { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser or Unity state.'); };
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
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText); if (message.method === 'Network.requestWillBeSent') { const request = message.params.request; if (request.url.includes('/api/studio-audio') && request.method === 'POST') result.audioUploads++; if (request.url.includes(':17844/command')) result.unityCommands.push(request.postData ? JSON.parse(request.postData).command : 'command'); } if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: origin });
  await until(`!!document.querySelector('.scene-maker.scene-visual')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Closing. */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  const stop = '$target=$env:BRIGHTTALES_OWNED_PROFILE; Get-CimInstance Win32_Process -Filter "name=\'chrome.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  spawnSync('powershell.exe', ['-NoProfile', '-Command', stop], { env: { ...process.env, BRIGHTTALES_OWNED_PROFILE: profile }, windowsHide: true });
}

try {
  await wait(() => existsSync(join(unityProof, 'READY.txt')), 120000);
  const music = join(profile, 'p4-unity-music.wav'); await writeFile(music, wave(9));
  await openBrowser();
  await click('Audio Library');
  await until(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  await change('select[aria-label="Imported audio type"]', 'music'); await attach(music);
  await until(`document.querySelector('.audio-asset-list')?.textContent?.includes('p4-unity-music.wav')`);
  await click('Cartoon Editor');
  await change('input[aria-label="Scene name"]', 'P4 Unity Max opening');
  await change('input[aria-label="Scene duration"]', 3);
  await change('select[aria-label="Add Brightling"]', 'max');
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await click('← All scenes'); await click('Create Scene');
  await change('input[aria-label="Scene name"]', 'P4 Unity Maxine response');
  await change('input[aria-label="Scene duration"]', 3);
  await change('select[aria-label="Add Brightling"]', 'maxine');
  await click('Wave'); await click('Save Scene');
  await until(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.length===2`);
  await click('Episode Maker'); await click('Create Episode');
  await change('input[aria-label="Episode name"]', 'P4 Unity episode');
  await click('Add Scene', 0); await click('Add Scene', 1); await click('Add Scene', 0);
  await click('Add Music'); await click('Save Episode');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const saved = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
  await writeFile(join(unityProof, 'expected.json'), JSON.stringify({ episodeId: saved.id, duration: 9 }));
  await until(`!!document.querySelector('.episode-unity-preview button:not(:disabled)')`, 30000);
  await click('Send saved episode');
  await until(`document.querySelector('.episode-unity-preview')?.textContent?.includes('Episode ready')`, 30000);
  await wait(() => existsSync(join(unityProof, 'LOADED.txt')));
  await js(`document.querySelector('.episode-unity-preview').scrollIntoView({block:'center'})`);
  await screenshot('05-unity-episode-loaded.png'); result.stages.transferAndDecode = 'PASS';
  await click('Play / Replay');
  await until(`document.querySelector('.episode-unity-preview')?.textContent?.includes('scene 2 of 3')`, 15000);
  await screenshot('06-unity-episode-playing.png');
  await wait(() => existsSync(join(unityProof, 'COMPLETE.txt')), 20000);
  await until(`document.querySelector('.episode-unity-preview')?.textContent?.includes('Episode complete')`);
  result.stages.playAllScenes = 'PASS';
  await click('Play / Replay');
  await wait(() => existsSync(join(unityProof, 'REPLAY.txt')), 20000);
  await click('Reset');
  await wait(() => existsSync(join(unityProof, 'RESET.txt')), 20000);
  await screenshot('07-unity-episode-reset.png'); result.stages.replayAndReset = 'PASS';
  if (result.audioUploads !== 1 || result.unityCommands.length < 4)
    throw Error(`Missing expected relay/Unity commands: uploads=${result.audioUploads}, commands=${result.unityCommands.join(',')}`);
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) { result.failure = error instanceof Error ? error.stack : String(error); try { result.debug = await js(`document.querySelector('.episode-unity-preview')?.textContent`); } catch { /* Browser may have closed. */ } }
finally {
  await writeFile(join(proof, 'unity-browser-e2e-results.json'), JSON.stringify(result, null, 2));
  if (chrome) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, audioUploads: result.audioUploads, unityCommands: result.unityCommands.length }));
  if (result.failure) process.exitCode = 1;
}
