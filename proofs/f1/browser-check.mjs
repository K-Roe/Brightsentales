// F1 browser acceptance uses a new disposable Chrome profile, never Karl's profile.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/f1'); mkdirSync(root, { recursive: true });
const findings = { errors: [], failedAssets: [], screenshots: [], browserDialogs: [] };
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const scene = (n, name) => ({ id: id(n), name, duration: 6, placeId: 'living-room', characters: { max: { x: 400, y: 780 } }, actions: [{ id: id(n + 10), characterId: 'max', type: 'appear', start: 0, duration: 0, point: { x: 400, y: 780 } }, { id: id(n + 20), characterId: 'max', type: 'walk', start: 0, duration: 3, point: { x: 750, y: 780 } }] });
const scenes = { version: 1, scenes: [scene(1, 'First'), scene(2, 'Second')] };
const episodes = { version: 1, episodes: [{ id: id(3), name: 'Saved Episode', sceneIds: scenes.scenes.map(item => item.id) }] };
let profile, ws, serial = 1, dismissBrowserDialog = true;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const call = serial++; pending.set(call, { ok, fail }); ws.send(JSON.stringify({ id: call, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const waitFor = async expression => { for (let i = 0; i < 50; i++) { if (await evaluate(expression)) return; await delay(100); } throw Error(`Timed out waiting for ${expression}`); };
const clickText = (selector, label) => evaluate(`(() => {const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.textContent.trim().endsWith(${JSON.stringify(label)})); if(!item)throw Error('Missing ${label}');item.click();})()`);
const fill = (selector, value) => evaluate(`(() => {const item=document.querySelector(${JSON.stringify(selector)});if(!item)throw Error('Missing ${selector}');const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(item,${JSON.stringify(String(value))});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const screenshot = async name => { const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(root, name), Buffer.from(shot.data, 'base64')); findings.screenshots.push(name); };
const nav = label => clickText('.studio-nav button', label);
const openEpisode = async () => { await nav('Episodes'); await waitFor(`!!document.querySelector('.scene-library article')`); await clickText('.scene-library article button', 'Open'); await waitFor(`!!document.querySelector('.episode-name input')`); };
const dialogOpen = () => evaluate(`document.querySelector('.episode-leave-dialog')?.open === true`);
const savedEpisode = () => evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0]`);
const beforeUnloadPrevented = () => evaluate(`(() => {const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()`);
const trustedClick = async selector => { const point = await evaluate(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }); };

const onMessage = event => {
  const item = JSON.parse(event.data);
  if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } }
  else if (item.method === 'Runtime.exceptionThrown') findings.errors.push(item.params.exceptionDetails.text);
  else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') findings.errors.push(item.params.args.map(arg => arg.value ?? arg.description).join(' '));
  else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);
  else if (item.method === 'Page.javascriptDialogOpening') { findings.browserDialogs.push({ type: item.params.type, message: item.params.message }); void send('Page.handleJavaScriptDialog', { accept: !dismissBrowserDialog }); }
};

function makeWave(path) {
  const rate = 8000, samples = rate * 2, bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 2000), 44 + i * 2);
  writeFileSync(path, bytes);
}

try {
  profile = mkdtempSync(join(tmpdir(), 'brightsen-f1-isolated-'));
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort'); for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  if (!existsSync(portFile)) throw Error('Disposable Chrome profile did not start');
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', onMessage); await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' }); await waitFor(`!!document.querySelector('.studio-nav')`);
  findings.initialStorage = await evaluate('localStorage.length');
  await evaluate(`localStorage.setItem('brightsenappstales.timed-scenes.v1',${JSON.stringify(JSON.stringify(scenes))});localStorage.setItem('brightsenappstales.episodes.v1',${JSON.stringify(JSON.stringify(episodes))})`);
  await send('Page.reload'); await delay(350); await waitFor(`!!document.querySelector('.studio-nav')`); await openEpisode();
  findings.oldEpisodeClean = await evaluate(`({indicator:document.querySelector('.episode-save-indicator')?.textContent,dialog:document.querySelector('.episode-leave-dialog')?.open??false})`);
  await waitFor(`!!document.querySelector('.scene-playback button:nth-child(2):not(:disabled)')`);
  await clickText('.scene-playback button', 'Play'); await delay(650); findings.playback = await evaluate(`document.querySelector('.scene-playback strong').textContent`); await clickText('.scene-playback button', 'Pause');
  await fill('.episode-name input', 'Changed Episode'); await waitFor(`document.querySelector('.episode-save-indicator')?.textContent==='Unsaved changes'`); await screenshot('unsaved-indicator.png');
  await clickText('.scene-heading button', 'Back to Episodes'); await waitFor(`document.querySelector('.episode-leave-dialog')?.open===true`); await screenshot('navigation-dialog.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await delay(100); await screenshot('navigation-dialog-mobile.png'); await send('Emulation.clearDeviceMetricsOverride');
  findings.dialogButtons = await evaluate(`[...document.querySelectorAll('.episode-leave-actions button')].map(item=>item.textContent)`);
  await clickText('.episode-leave-actions button', 'Cancel'); findings.cancel = await evaluate(`({name:document.querySelector('.episode-name input').value,dialog:document.querySelector('.episode-leave-dialog').open})`);
  await nav('Places'); await waitFor(`document.querySelector('.episode-leave-dialog')?.open===true`);
  await clickText('.episode-leave-actions button', 'Discard Changes'); await waitFor(`!!document.querySelector('.places-page')`);
  findings.discard = { name: (await savedEpisode()).name, beforeUnloadBlocked: await beforeUnloadPrevented() };
  await openEpisode();
  await clickText('.episode-card-actions button', '→'); await waitFor(`document.querySelector('.episode-save-indicator')?.textContent==='Unsaved changes'`);
  await clickText('.episode-card-actions button', 'Edit Scene'); await waitFor(`document.querySelector('.episode-leave-dialog')?.open===true`);
  await clickText('.episode-leave-actions button', 'Save and Continue'); await waitFor(`!!document.querySelector('.scene-visual')`);
  findings.saveContinueOrder = (await savedEpisode()).sceneIds;
  await nav('Episodes'); await openEpisode();
  findings.reopenedOrder = await evaluate(`([...document.querySelectorAll('.episode-cards h3')].map(item=>item.textContent))`);
  await clickText('.scene-heading button', 'Back to Episodes'); findings.cleanBack = await evaluate(`({dialog:document.querySelector('.episode-leave-dialog')?.open??false,library:!!document.querySelector('.scene-library')})`);
  const waveFile = join(profile, 'disposable-tone.wav'); makeWave(waveFile);
  await nav('Audio'); await waitFor(`!!document.querySelector('input[aria-label="Import audio file"]')`);
  const doc = await send('DOM.getDocument'); const input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[aria-label="Import audio file"]' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [waveFile] }); await waitFor(`!!document.querySelector('.audio-asset-list article')`);
  const audioId = await evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('brightsenappstales.audio.v1');request.onsuccess=()=>{const item=request.result.transaction('assets').objectStore('assets').getAll();item.onsuccess=()=>resolve(item.result[0].id);item.onerror=reject;};request.onerror=reject;})`);
  await openEpisode(); await fill('select[aria-label="Episode audio asset"]', audioId); await clickText('.audio-add button', 'Add Music');
  await waitFor(`document.querySelector('.episode-save-indicator')?.textContent==='Unsaved changes'`); await fill('input[aria-label="Audio clip volume"]', .25);
  await fill('input[aria-label="Audio trim start"]', .5); await fill('input[aria-label="Audio fade in"]', .25);
  findings.audioDirty = await evaluate(`({indicator:document.querySelector('.episode-save-indicator').textContent,volume:document.querySelector('input[aria-label="Audio clip volume"]').value,trim:document.querySelector('input[aria-label="Audio trim start"]').value})`);
  await clickText('.scene-heading button', 'Save Episode'); await waitFor(`document.querySelector('.episode-save-indicator')?.textContent==='Saved'`);
  findings.audioSaved = (await savedEpisode()).audio;
  await fill('.episode-name input', 'Failed Save Draft');
  await evaluate(`window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='brightsenappstales.episodes.v1')throw Error('Simulated quota failure');return window.__originalSetItem.call(this,key,value);}`);
  await nav('Characters'); await waitFor(`document.querySelector('.episode-leave-dialog')?.open===true`);
  await clickText('.episode-leave-actions button', 'Save and Continue'); await delay(150);
  findings.failedSave = await evaluate(`({dialog:document.querySelector('.episode-leave-dialog').open,dirty:document.querySelector('.episode-save-indicator').textContent,name:document.querySelector('.episode-name input').value,persisted:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].name,error:document.querySelector('.episode-save-error')?.textContent})`);
  await evaluate(`Storage.prototype.setItem=window.__originalSetItem`);
  await clickText('.episode-leave-actions button', 'Cancel');
  findings.beforeUnloadHandlerDirty = await beforeUnloadPrevented();
  await trustedClick('.episode-name input');
  const beforeDialogs = findings.browserDialogs.length; dismissBrowserDialog = true;
  await send('Page.reload'); await delay(350);
  findings.beforeUnloadDirty = findings.browserDialogs.slice(beforeDialogs);
  findings.afterDismissedRefresh = await evaluate(`document.querySelector('.episode-name input')?.value`);
  if (!findings.afterDismissedRefresh) await openEpisode();
  await fill('.episode-name input', 'Failed Save Draft');
  await clickText('.scene-heading button', 'Save Episode'); await waitFor(`document.querySelector('.episode-save-indicator')?.textContent==='Saved'`);
  findings.beforeUnloadHandlerAfterSave = await beforeUnloadPrevented();
  const afterSaveDialogs = findings.browserDialogs.length;
  await send('Page.reload'); await delay(350); await waitFor(`!!document.querySelector('.studio-nav')`);
  findings.beforeUnloadAfterSave = findings.browserDialogs.slice(afterSaveDialogs);
  await openEpisode(); findings.reloaded = await evaluate(`({name:document.querySelector('.episode-name input').value,indicator:document.querySelector('.episode-save-indicator').textContent,audio:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio?.length??0})`);
} catch (error) { findings.fatal = String(error?.stack ?? error); }
finally {
  try { ws?.close(); } catch { /* already closed */ }
  if (profile && resolve(profile).startsWith(resolve(tmpdir()) + '\\') && profile.includes('brightsen-f1-isolated-')) {
    const command = `$target=$env:F1_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
    spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, F1_PROFILE: profile }, stdio: 'ignore' });
    findings.profileRemoved = !existsSync(profile);
  }
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
}
