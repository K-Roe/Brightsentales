import { readFile, unlink, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const proof = resolve('proofs/cartoon-foundation-p8');
const profile = process.env.P8_PROFILE;
const unityProof = process.env.CARTOON_FOUNDATION_P8_E2E_DIR;
const origin = process.env.STUDIO_URL ?? 'http://127.0.0.1:4177/';
if (!profile || !unityProof) throw Error('Set P8_PROFILE to the saved disposable Chrome profile and CARTOON_FOUNDATION_P8_E2E_DIR for Unity evidence.');
const result = { origin, profile, stages: {}, commands: [], responses: [], errors: [], failedRequests: [] };
const pending = new Map(), tracked = new Set();
let chrome, socket, serial = 0;
const wait = async (condition, ms = 20000) => { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser or Unity state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(Error(`${method} timed out`)); }, 15000);
  pending.set(id, { resolveCall: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
  socket.send(JSON.stringify({ id, method, params }));
});
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.textContent.trim()===${JSON.stringify(label)}||x.textContent.trim().endsWith(${JSON.stringify(label)}))&&x.getClientRects().length);if(!e)throw Error('Missing visible button '+${JSON.stringify(label)});if(e.disabled)throw Error('Disabled button '+${JSON.stringify(label)});e.click();return true})()`);
const screenshot = async name => { const data = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(proof, name), Buffer.from(data.data, 'base64')); };
async function openBrowser() {
  await unlink(join(profile, 'DevToolsActivePort')).catch(() => {});
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())).find(item => item.type === 'page'); } catch { return null; } }, 60000);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); }
    if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes(':17844/command')) {
      tracked.add(message.params.requestId);
      result.commands.push({ method: message.params.request.method, body: message.params.request.postData ? JSON.parse(message.params.request.postData) : null });
    }
    if (message.method === 'Network.responseReceived' && tracked.has(message.params.requestId)) result.responses.push({ requestId: message.params.requestId, status: message.params.response.status, url: message.params.response.url });
    if (message.method === 'Network.loadingFinished' && tracked.has(message.params.requestId)) void send('Network.getResponseBody', { requestId: message.params.requestId }).then(body => {
      const response = result.responses.find(item => item.requestId === message.params.requestId);
      if (response) response.body = body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body;
    }).catch(() => {});
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });
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
  await wait(() => fetch(origin).then(response => response.ok).catch(() => false), 60000);
  await wait(() => readFile(join(unityProof, 'READY.txt')).then(() => true).catch(() => false), 120000);
  await openBrowser();
  await click('Episode Maker'); await click('Open');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const episode = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
  if (episode.camera?.length !== 5 || episode.audio?.length !== 1) throw Error('The reopened disposable profile has no saved camera track or music clip.');
  await writeFile(join(unityProof, 'expected.json'), JSON.stringify({ episodeId: episode.id, duration: 9 }));
  await until(`!!document.querySelector('.episode-unity-preview button:not(:disabled)')`, 30000);
  await js(`document.querySelector('.episode-unity-preview').scrollIntoView({block:'center'})`);
  await click('Send saved episode');
  await until(`(()=>{const text=document.querySelector('.episode-unity-preview')?.textContent??'';return text.includes('Episode ready')||text.includes('Open the experimental saved scene')||text.includes('Unity returned')||text.includes('did not answer')})()`, 30000);
  await delay(200);
  result.unityMessage = await js(`document.querySelector('.episode-unity-preview')?.textContent`);
  await screenshot('07-unity-episode-camera-transfer.png');
  if (!result.unityMessage?.includes('Episode ready')) throw Error(`Unity rejected the camera episode: ${result.unityMessage}`);
  result.stages.version3CameraTransfer = 'PASS';
  if (result.commands.every(item => item.body?.command !== 'episode.load')) throw Error('No episode.load command reached the Unity bridge.');
  await click('Play / Replay');
  await wait(() => readFile(join(unityProof, 'COMPLETE.txt')).then(() => true).catch(() => false), 30000);
  await click('Play / Replay');
  await wait(() => readFile(join(unityProof, 'REPLAY.txt')).then(() => true).catch(() => false), 30000);
  await click('Reset');
  await wait(() => readFile(join(unityProof, 'RESET.txt')).then(() => true).catch(() => false), 30000);
  result.stages.unityCameraPlaybackReplayReset = 'PASS';
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) {
  result.failure = error instanceof Error ? error.stack : String(error);
  try { result.unityMessage = await js(`document.querySelector('.episode-unity-preview')?.textContent`); await screenshot('07-unity-episode-camera-transfer-failure.png'); } catch { /* Browser may already have closed. */ }
} finally {
  await delay(250);
  await writeFile(join(proof, 'unity-camera-transfer-results.json'), JSON.stringify(result, null, 2));
  if (chrome) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, unityMessage: result.unityMessage, responses: result.responses.map(item => item.status) }));
  if (result.failure) process.exitCode = 1;
}
