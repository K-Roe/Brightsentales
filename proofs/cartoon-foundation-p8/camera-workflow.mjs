import { mkdtemp, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const proof = resolve('proofs/cartoon-foundation-p8');
const profile = await mkdtemp(join(tmpdir(), 'brighttales-p8-camera-'));
const unityProof = process.env.CARTOON_FOUNDATION_P8_E2E_DIR;
if (!unityProof) throw Error('Set CARTOON_FOUNDATION_P8_E2E_DIR for the isolated Unity test.');
const origin = process.env.STUDIO_URL ?? 'http://127.0.0.1:4177/';
const result = { origin, profile, stages: {}, errors: [], failedRequests: [], unityCommands: [] };
const pending = new Map();
let chrome, socket, serial = 0;
const wait = async (condition, ms = 20000) => { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = await condition(); if (value) return value; await delay(100); } throw Error('Timed out waiting for browser or Unity state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(Error(`${method} timed out`)); }, 15000);
  pending.set(id, { resolveCall: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
  socket.send(JSON.stringify({ id, method, params }));
});
const js = async expression => {
  const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text);
  return data.result.value;
};
const until = (expression, ms) => wait(() => js(expression), ms);
const click = (label, index = 0) => js(`(()=>{const a=[...document.querySelectorAll('button')].filter(x=>(x.textContent.trim()===${JSON.stringify(label)}||x.textContent.trim().endsWith(${JSON.stringify(label)}))&&x.getClientRects().length);const e=a[${index}];if(!e)throw Error('Missing visible button '+${JSON.stringify(label)}+' #'+${index});if(e.disabled)throw Error('Disabled button '+${JSON.stringify(label)});e.click();return true})()`);
const change = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field '+${JSON.stringify(selector)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => {
  const data = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(proof, name), Buffer.from(data.data, 'base64'));
};
function wave(seconds) {
  const rate = 16000, samples = Math.round(rate * seconds), bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + samples * 2, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / rate) * 1800), 44 + i * 2);
  return bytes;
}
async function attachAudio(path) {
  const root = await send('DOM.getDocument');
  const field = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: 'input[aria-label="Import audio file"]' });
  if (!field.nodeId) throw Error('Audio Library import field is missing.');
  await send('DOM.setFileInputFiles', { nodeId: field.nodeId, files: [path] });
}
async function openBrowser() {
  await unlink(join(profile, 'DevToolsActivePort')).catch(() => {});
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,950', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => {
    try {
      const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      return (await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())).find(item => item.type === 'page');
    } catch { return null; }
  }, 60000);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id); pending.delete(message.id);
      message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.failedRequests.push(message.params.errorText);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes(':17844/command')) {
      const body = message.params.request.postData ? JSON.parse(message.params.request.postData) : null;
      result.unityCommands.push(body?.command ?? 'command');
      if (body?.command === 'episode.load') result.transferredEpisode = {
        version: body.config.version, duration: body.config.duration,
        camera: body.config.camera, scenes: body.config.scenes.map(scene => ({ start: scene.start, duration: scene.duration })),
      };
    }
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
async function createScene(name, create = false) {
  await click('Cartoon Editor');
  if (create) await click('Create Scene');
  await change('input[aria-label="Scene name"]', name);
  await change('input[aria-label="Scene duration"]', 3);
  await change('select[aria-label="Add Brightling"]', 'max');
  await change('select[aria-label="Add Brightling"]', 'maxine');
  await click('Save Scene');
  await wait(() => js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.some(scene=>scene.name===${JSON.stringify(name)})`));
}
async function addCameraShot(start, { shot, target, movement, duration, zoom }) {
  await change('input[aria-label="Scrub episode timeline"]', start);
  await until(`document.querySelector('input[aria-label="Episode time"]')?.value===${JSON.stringify(String(start))}`);
  const point = await js(`(()=>{const e=[...document.querySelectorAll('[aria-label="Add camera shot at playhead"]')].find(x=>x.getClientRects().length);if(!e)throw Error('Camera shot button is missing from the timeline.');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{x,y,disabled:e.disabled,html:e.outerHTML,hit:document.elementFromPoint(x,y)?.outerHTML??'none'}})()`);
  result.lastCameraButton = point;
  if (point.disabled) throw Error('Camera shot button is disabled.');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await until(`!!document.querySelector('select[aria-label="Episode camera shot"]')`, 5000);
  await change('select[aria-label="Episode camera shot"]', shot);
  if (shot !== 'wide') await change('select[aria-label="Episode camera target"]', target);
  await change('select[aria-label="Episode camera movement"]', movement);
  if (zoom !== undefined) await change('input[aria-label="Camera zoom"]', zoom);
  await change('input[aria-label="Camera shot duration"]', duration);
}

try {
  await wait(() => fetch(origin).then(response => response.ok).catch(() => false), 120000);
  await openBrowser();
  const music = join(profile, 'p8-camera-workflow.wav'); await writeFile(music, wave(9));
  await click('Audio Library');
  await until(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  await change('select[aria-label="Imported audio type"]', 'music'); await attachAudio(music);
  await until(`document.querySelector('.audio-asset-list')?.textContent?.includes('p8-camera-workflow.wav')`);
  result.stages.localMusicAsset = 'PASS';
  await createScene('P8 Max and Maxine establishing');
  await click('← All scenes'); await createScene('P8 Max and Maxine close-ups', true);
  result.stages.twoSavedScenesWithBothCharacters = 'PASS';

  await click('Episode Maker'); await click('Create Episode');
  await change('input[aria-label="Episode name"]', 'P8 Camera directing workflow');
  await click('Add Scene', 0); await click('Add Scene', 1); await click('Add Scene', 0);
  await js(`document.querySelector('[aria-label="Select scene 1: P8 Max and Maxine establishing"]').click()`);
  await change('input[aria-label="Episode scene duration"]', 3);
  await js(`document.querySelector('[aria-label="Select scene 2: P8 Max and Maxine close-ups"]').click()`);
  await change('input[aria-label="Episode scene duration"]', 3);
  await js(`document.querySelector('[aria-label="Select scene 3: P8 Max and Maxine establishing"]').click()`);
  await change('input[aria-label="Episode scene duration"]', 3);
  await change('input[aria-label="Episode time"]', 0);
  await click('Add Music');
  await until(`document.querySelectorAll('.episode-audio-clip').length===1`);
  result.stages.episodeSequence = 'PASS';

  await addCameraShot(0, { shot: 'wide', target: 'max', movement: 'static', duration: 1 });
  await addCameraShot(1, { shot: 'medium', target: 'max', movement: 'static', duration: 1.5 });
  await addCameraShot(2.5, { shot: 'close-up', target: 'maxine', movement: 'static', duration: 1.5 });
  await addCameraShot(4, { shot: 'medium', target: 'max', movement: 'pan', duration: 1.5 });
  await addCameraShot(5.5, { shot: 'custom', target: 'maxine', movement: 'follow', duration: 3.5, zoom: 2.5 });
  await js(`document.querySelector('[aria-label^="Camera shot Wide Shot"]').click()`);
  await js(`document.querySelector('.episode-camera-lane').scrollIntoView({block:'center'})`);
  await screenshot('01-camera-timeline-and-wide-inspector.png');
  await click('Save Episode');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const savedBefore = await js(`(()=>{const e=JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0];return e})()`);
  if (savedBefore.camera?.length !== 5 || savedBefore.camera[0].shot !== 'wide' || savedBefore.camera[1].target !== 'max' || savedBefore.camera[2].target !== 'maxine' || savedBefore.camera[3].movement !== 'pan' || savedBefore.camera[4].movement !== 'follow' || savedBefore.camera[4].zoom !== 2.5 || savedBefore.audio?.length !== 1) throw Error('Saved episode camera or music track does not match the UI-authored shot list.');
  result.stages.cameraShotsSaved = 'PASS';

  await change('input[aria-label="Episode time"]', 1.8);
  await screenshot('02-medium-shot-preview.png');
  await change('input[aria-label="Episode time"]', 3.2);
  await screenshot('03-close-up-preview.png');
  await change('input[aria-label="Episode time"]', 4.7);
  await screenshot('04-pan-preview.png');
  await change('input[aria-label="Episode time"]', 7.2);
  await screenshot('05-follow-preview.png');
  result.stages.scrubAndPreviewFraming = 'PASS';

  await change('input[aria-label="Episode time"]', 0);
  await click('Preview Episode');
  await until(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'0') > 1.2`, 12000);
  await click('Stop');
  await click('Preview Episode');
  await until(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'0') > 0.2`, 10000);
  await click('Stop');
  result.stages.playbackReplayAndReset = 'PASS';

  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: profile });
  await click('Export WebM');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 90000);
  const webm = await wait(async () => (await readdir(profile)).find(name => name.endsWith('.webm')), 30000);
  await writeFile(join(proof, 'camera-directed-episode.webm'), await readFile(join(profile, webm)));
  result.stages.completeEpisodeWebM = 'PASS';

  await closeBrowser(); await delay(1200); await openBrowser();
  await click('Episode Maker'); await click('Open');
  await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  const reopened = await js(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
  if (reopened.id !== savedBefore.id || JSON.stringify(reopened.camera) !== JSON.stringify(savedBefore.camera) || JSON.stringify(reopened.audio) !== JSON.stringify(savedBefore.audio)) throw Error('Saved camera or music track changed after closing and reopening the disposable browser.');
  await js(`document.querySelector('[aria-label="Select scene 3: P8 Max and Maxine establishing"]').click()`);
  await change('input[aria-label="Episode time"]', 0);
  await until(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Preview Episode'&&button.getClientRects().length)?.disabled===false`, 15000);
  await click('Preview Episode');
  await until(`Number.parseFloat(document.querySelector('.episode-preview .scene-playback strong')?.textContent??'0') > 0.2`, 10000);
  await screenshot('06-reopened-episode-replay.png');
  await click('Stop');
  result.stages.closeReopenAndReplay = 'PASS';

  if (process.env.P8_BROWSER_ONLY !== '1') {
    await writeFile(join(unityProof, 'expected.json'), JSON.stringify({ episodeId: reopened.id, duration: 9 }));
    await until(`!!document.querySelector('.episode-unity-preview button:not(:disabled)')`, 30000);
    await js(`document.querySelector('.episode-unity-preview').scrollIntoView({block:'center'})`);
    await click('Send saved episode');
    await until(`document.querySelector('.episode-unity-preview')?.textContent?.includes('Episode ready')`, 30000);
    await wait(() => existsSync(join(unityProof, 'LOADED.txt')), 30000);
    if (result.transferredEpisode?.version !== 3 || result.transferredEpisode.camera?.length !== 5) throw Error('Unity did not receive the version 3 camera track.');
    await screenshot('07-unity-episode-camera-loaded.png');
    await click('Play / Replay');
    await wait(() => existsSync(join(unityProof, 'COMPLETE.txt')), 30000);
    await click('Play / Replay');
    await wait(() => existsSync(join(unityProof, 'REPLAY.txt')), 30000);
    await click('Reset');
    await wait(() => existsSync(join(unityProof, 'RESET.txt')), 30000);
    result.stages.unityV3TransferPlaybackReplayReset = 'PASS';
  } else result.stages.unityV3TransferPlaybackReplayReset = 'DEFERRED';
  result.episodeId = reopened.id;
  if (result.errors.length || result.failedRequests.length) throw Error(`Browser errors: ${result.errors.join(' | ')}; failed requests: ${result.failedRequests.join(' | ')}`);
} catch (error) {
  result.failure = error instanceof Error ? error.stack : String(error);
  try { result.debug = await js(`({url:location.href,buttons:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).map(x=>x.textContent.trim()).slice(0,50),selects:[...document.querySelectorAll('select')].map(x=>x.getAttribute('aria-label')),cameraLane:document.querySelector('.episode-camera-lane')?.outerHTML,status:[...document.querySelectorAll('.episode-save-indicator,.episode-inspector')].map(x=>x.textContent.slice(0,400)),message:document.querySelector('.scene-status')?.textContent,body:document.body.textContent.slice(0,900)})`); await screenshot('failure.png'); } catch { /* Browser may already have closed. */ }
} finally {
  await writeFile(join(proof, 'camera-workflow-results.json'), JSON.stringify(result, null, 2));
  if (chrome) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, profile }));
  if (result.failure) process.exitCode = 1;
}
