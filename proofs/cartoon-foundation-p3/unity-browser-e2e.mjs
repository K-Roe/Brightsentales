import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const proof = resolve('proofs/cartoon-foundation-p3');
const unityProof = resolve('../BrightTalesP3Unity/P3BrowserReview');
const prior = JSON.parse(await readFile(join(proof, 'browser-workflow-results.json'), 'utf8'));
const profile = prior.disposable, url = prior.origin;
const result = { profile, url, stages: {}, errors: [], failedRequests: [], audioUploads: 0, unityCommands: 0 };
let chrome, socket, serial = 0;
const pending = new Map();
const exists = path => stat(path).then(() => true, () => false);
const wait = async (condition, ms = 20000) => { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser or Unity.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP ${method} timed out`)); }, 15000); pending.set(id, { resolveCall: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)}&&x.getClientRects().length);if(!e)throw Error('Missing visible button '+${JSON.stringify(label)});if(e.disabled)throw Error('Disabled button '+${JSON.stringify(label)});e.click();return true})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(proof, name), Buffer.from(data.data, 'base64')); };
async function openBrowser() {
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()); return pages.find(p => p.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText); if (message.method === 'Network.requestWillBeSent') { if (message.params.request.url.includes('/api/studio-audio') && message.params.request.method === 'POST') result.audioUploads++; if (message.params.request.url.endsWith(':17844/command')) result.unityCommands++; } if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url });
  await until(`!!document.querySelector('.scene-maker.scene-visual')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) { try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Browser closing. */ } socket.close(); }
  if (chrome?.exitCode === null) { await wait(() => chrome.exitCode !== null, 1500).catch(() => {}); if (chrome.exitCode === null) chrome.kill(); }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  const stop = '$target=$env:BRIGHTTALES_OWNED_PROFILE; Get-CimInstance Win32_Process -Filter "name=\'chrome.exe\'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }';
  spawnSync('powershell.exe', ['-NoProfile', '-Command', stop], { env: { ...process.env, BRIGHTTALES_OWNED_PROFILE: profile }, windowsHide: true });
}

try {
  await wait(() => exists(join(unityProof, 'READY.txt')), 120000);
  await openBrowser();
  await until(`document.querySelector('input[aria-label="Scene name"]')?.value==='P3 local speech and music'`);
  await click('Preview in Unity');
  await until(`!!document.querySelector('button')&&document.body.textContent.includes('Connect preview')`);
  await click('Connect preview');
  await until(`document.querySelector('.unity-connection-status')?.textContent?.includes('Connected')`);
  const selected = await js(`document.querySelector('select[aria-label="Saved scene for Unity"]')?.value`);
  if (selected !== prior.sceneId) throw Error('Unity preview did not select the saved scene.');
  await click('Send scene to preview');
  await until(`document.querySelector('#studio-unity-heading')?.parentElement?.textContent?.includes('ready to play')`, 30000);
  await wait(() => exists(join(unityProof, 'LOADED.txt')), 10000);
  await screenshot('04-unity-audio-loaded.png'); result.stages.transferAndDecode = 'PASS';
  await click('Play');
  await wait(() => exists(join(unityProof, 'AUDIO.txt')), 15000);
  await screenshot('05-unity-audio-playing.png');
  await wait(() => exists(join(unityProof, 'COMPLETE.txt')), 15000);
  await click('Reset');
  await wait(() => exists(join(unityProof, 'RESET.txt')), 15000);
  await screenshot('06-unity-audio-reset.png'); result.stages.playAndReset = 'PASS';
  result.unityAudioSample = (await readFile(join(unityProof, 'AUDIO.txt'), 'utf8')).trim();
  if (result.audioUploads !== 2 || result.unityCommands < 3) throw Error(`Expected two binary asset uploads and Unity commands, got ${result.audioUploads} and ${result.unityCommands}.`);
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) { result.failure = error instanceof Error ? error.stack : String(error); }
finally {
  await writeFile(join(proof, 'unity-browser-e2e-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, audioUploads: result.audioUploads, unityCommands: result.unityCommands }));
  if (result.failure) process.exitCode = 1;
}
