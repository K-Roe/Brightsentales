// Disposable Chrome profile. All seeded scenes and episodes exist only in this profile.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-2'); mkdirSync(root, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'brightsen-m62-isolated-'));
let restoreProfile = null, restoreChrome = null;
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
let ws, serial = 1, recording = false;
const pending = new Map(), errors = [], failedAssets = [], frames = [], findings = { profile: 'isolated temporary Chrome profile', errors, failedAssets, screenshots: [] };
const send = (method, params = {}) => new Promise((resolveCall, rejectCall) => { const id = serial++; pending.set(id, { resolveCall, rejectCall }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; };
const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(join(root, name), Buffer.from(result.data, 'base64')); findings.screenshots.push(name); };
const clickText = async (selector, label) => evalJs(`(() => {const x=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)})); if(!x) throw Error('Missing '+${JSON.stringify(label)}); x.click();})()`);
const input = async (selector, value) => evalJs(`(() => {const x=document.querySelector(${JSON.stringify(selector)}); if(!x) throw Error('Missing input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(x,${JSON.stringify(String(value))}); x.dispatchEvent(new Event('input',{bubbles:true})); x.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const max = { x: 300, y: 790 }, maxine = { x: 1100, y: 790 };
const action = (n, characterId, type, start, duration, point) => ({ id: id(n), characterId, type, start, duration, ...(point ? { point } : {}) });
const scenes = { version: 1, scenes: [
  { id: id(1), name: 'Max Arrives', duration: 10, placeId: 'living-room', characters: { max }, actions: [action(11, 'max', 'appear', 0, 0, max), action(12, 'max', 'walk', 0, 6, { x: 900, y: 790 })] },
  { id: id(2), name: 'Maxine Joins', duration: 15, placeId: 'living-room', characters: { maxine }, actions: [action(21, 'maxine', 'appear', 0, 0, maxine), action(22, 'maxine', 'walk', 1, 5, { x: 720, y: 790 }), action(23, 'maxine', 'wave', 7, 3, undefined)] },
  { id: id(3), name: 'Goodbye', duration: 8, placeId: 'living-room', characters: { max, maxine }, actions: [action(31, 'max', 'appear', 0, 0, max), action(32, 'maxine', 'appear', 0, 0, maxine), action(33, 'max', 'walk', 0, 7, { x: 1820, y: 790 }), action(34, 'maxine', 'walk', 0, 7, { x: 1820, y: 820 }), action(35, 'max', 'disappear', 8, 0), action(36, 'maxine', 'disappear', 8, 0)] },
] };

try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  if (!existsSync(portFile)) throw Error('Chrome debugging port did not open');
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => { ws.addEventListener('open', done, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', event => { const item = JSON.parse(event.data); if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.rejectCall(Error(item.error.message)) : call.resolveCall(item.result); } } else if (item.method === 'Runtime.exceptionThrown') errors.push(item.params.exceptionDetails.text); else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') errors.push(item.params.args.map(arg => arg.value ?? arg.description).join(' ')); else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) failedAssets.push(`${item.params.response.status} ${item.params.response.url}`); else if (item.method === 'Page.screencastFrame') { if (recording && frames.length < 170) { const name = `frame-${String(frames.length).padStart(3, '0')}.png`; writeFileSync(join(root, name), Buffer.from(item.params.data, 'base64')); frames.push(name); } void send('Page.screencastFrameAck', { sessionId: item.params.sessionId }); } });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4176/' });
  for (let i = 0; i < 30 && !(await evalJs(`!!document.querySelector('.studio-nav')`)); i++) await delay(200);
  findings.initialStorage = await evalJs('localStorage.length');
  await evalJs(`localStorage.setItem('brightsenappstales.timed-scenes.v1',${JSON.stringify(JSON.stringify(scenes))})`);
  await send('Page.reload'); await delay(450);
  await clickText('.studio-nav button', 'Episodes'); await delay(150); await screenshot('episode-library-empty-desktop.png');
  await clickText('.scene-heading button', 'Create Episode'); await delay(100);
  await input('input[aria-label="Episode name"]', 'Our First Episode');
  for (let i = 0; i < 3; i++) await evalJs(`document.querySelectorAll('.episode-scene-library article button')[${i * 2}].click()`);
  await delay(250); await screenshot('episode-editor-three-scenes-desktop.png');
  await evalJs(`document.querySelector('.episode-sequence').scrollIntoView({block:'start'})`); await delay(100); await screenshot('three-scene-sequence-desktop.png');
  findings.total = await evalJs(`document.querySelector('.episode-section-heading strong').textContent`);
  findings.sequence = await evalJs(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  await clickText('.scene-heading button', 'Save Episode'); await delay(130);
  await input('input[aria-label="Episode time"]', 10); await delay(250); await screenshot('playback-scene-2.png');
  findings.seek10 = await evalJs(`document.querySelector('.scene-stage-caption').textContent`);
  await input('input[aria-label="Episode time"]', 25); await delay(250); await screenshot('playback-scene-3.png');
  findings.seek25 = await evalJs(`document.querySelector('.scene-stage-caption').textContent`);
  await input('input[aria-label="Episode time"]', 5); await delay(200); await screenshot('playback-scene-1.png');
  findings.seek5 = await evalJs(`document.querySelector('.scene-stage-caption').textContent`);
  await evalJs(`document.querySelector('.episode-card-actions button').click()`); await delay(50); // first left is disabled
  await evalJs(`document.querySelectorAll('.episode-card-actions')[1].querySelector('button').click()`); await delay(120);
  findings.reordered = await evalJs(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  await evalJs(`document.querySelectorAll('.episode-card-actions')[0].querySelectorAll('button')[1].click()`); await delay(120); // restore order
  await evalJs(`document.querySelectorAll('.episode-scene-library article button')[0].click()`); await delay(100);
  findings.duplicateTotal = await evalJs(`document.querySelector('.episode-section-heading strong').textContent`);
  await evalJs(`document.querySelectorAll('.episode-card-actions')[3].querySelector('button:last-child').click()`); await delay(100);
  await clickText('.scene-heading button', 'Save Episode'); await delay(100);
  await send('Page.reload'); await delay(400); await clickText('.studio-nav button', 'Episodes'); await delay(100); await screenshot('episode-library-saved-desktop.png');
  await clickText('.scene-library button', 'Open'); await delay(250);
  findings.reloadedSequence = await evalJs(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await delay(250); await screenshot('episode-editor-mobile.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false }); await delay(150);
  await evalJs(`document.querySelector('.episode-preview').scrollIntoView({block:'center'})`);
  await clickText('.scene-playback button', 'Restart');
  await clickText('.scene-playback button', 'Play');
  const startRecording = Date.now();
  for (let i = 0; i < 174; i++) {
    await delay(Math.max(0, startRecording + i * 200 - Date.now()));
    if (i === 18) { findings.pauseAt = await evalJs(`document.querySelector('.scene-playback strong').textContent`); await clickText('.scene-playback button', 'Pause'); await delay(500); findings.pausedAt = await evalJs(`document.querySelector('.scene-playback strong').textContent`); await clickText('.scene-playback button', 'Play'); }
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const name = `frame-${String(i).padStart(3, '0')}.png`;
    writeFileSync(join(root, name), Buffer.from(result.data, 'base64')); frames.push(name);
  }
  findings.end = await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,button:document.querySelector('.scene-playback button:nth-child(2)').textContent})`);
  await screenshot('episode-playback-end.png');
  const video = spawnSync('ffmpeg', ['-y', '-framerate', '5', '-i', join(root, 'frame-%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(root, 'episode-playback.mp4')], { encoding: 'utf8' });
  findings.recording = { frames: frames.length, created: video.status === 0, error: video.status === 0 ? undefined : video.stderr?.slice(-500) };
  if (video.status === 0) frames.forEach(name => rmSync(join(root, name)));
  findings.savedEpisodes = await evalJs(`JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1'))`);
  findings.savedScenes = await evalJs(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.length`);
  const downloads = join(root, 'downloads'); mkdirSync(downloads, { recursive: true });
  const beforeDownloads = new Map(readdirSync(downloads).map(name => [name, statSync(join(downloads, name)).mtimeMs]));
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await clickText('.studio-nav button', 'Characters'); await delay(180);
  await clickText('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  const currentDownload = () => readdirSync(downloads).find(name => name.endsWith('.json') && statSync(join(downloads, name)).mtimeMs > (beforeDownloads.get(name) ?? 0));
  for (let i = 0; i < 40 && !currentDownload(); i++) await delay(100);
  const exported = currentDownload();
  if (!exported) throw Error('Studio Backup did not download');
  const backupPath = join(downloads, exported);
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  findings.backupExport = { file: exported, version: backup.version, scenes: backup.timedScenes.scenes.length, episodes: backup.episodes.episodes.length, episodeId: backup.episodes.episodes[0].id, references: backup.episodes.episodes[0].sceneIds };
  await send('Page.navigate', { url: 'about:blank' }); ws.close();
  restoreProfile = mkdtempSync(join(tmpdir(), 'brightsen-m62-isolated-'));
  restoreChrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${restoreProfile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
  const secondPortFile = join(restoreProfile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(secondPortFile); i++) await delay(100);
  if (!existsSync(secondPortFile)) throw Error('Restore browser did not open');
  const secondPort = Number(readFileSync(secondPortFile, 'utf8').split('\n')[0]);
  const secondTargets = await (await fetch(`http://127.0.0.1:${secondPort}/json`)).json();
  ws = new WebSocket(secondTargets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => { ws.addEventListener('open', done, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', event => { const item = JSON.parse(event.data); if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.rejectCall(Error(item.error.message)) : call.resolveCall(item.result); } } else if (item.method === 'Runtime.exceptionThrown') errors.push(item.params.exceptionDetails.text); else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') errors.push(item.params.args.map(arg => arg.value ?? arg.description).join(' ')); else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) failedAssets.push(`${item.params.response.status} ${item.params.response.url}`); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4176/' });
  for (let i = 0; i < 30 && !(await evalJs(`!!document.querySelector('.studio-nav')`)); i++) await delay(200);
  findings.restoreInitialStorage = await evalJs('localStorage.length');
  await send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  await send('Page.enable');
  ws.addEventListener('message', event => { const item = JSON.parse(event.data); if (item.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); });
  const doc = await send('DOM.getDocument');
  const file = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [backupPath] }); await delay(650);
  await clickText('.studio-nav button', 'Episodes'); await delay(120);
  await clickText('.scene-library button', 'Open'); await delay(250);
  findings.restored = await evalJs(`({scenes:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.length, episodes:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes.length, episodeId:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].id, order:[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent),total:document.querySelector('.episode-section-heading strong').textContent})`);
  if (findings.restored.episodeId !== findings.backupExport.episodeId) throw Error('Restored episode ID changed');
  await screenshot('backup-restored-episode.png');
  await evalJs(`document.querySelectorAll('.episode-card-actions')[0].querySelectorAll('button')[2].click()`); await delay(200);
  findings.editSceneOpened = await evalJs(`document.querySelector('input[aria-label="Scene name"]')?.value`);
  await input('input[aria-label="Scene duration"]', 12);
  await clickText('.scene-heading button', 'Save Scene'); await delay(120);
  await clickText('.studio-nav button', 'Episodes'); await delay(120);
  await clickText('.scene-library button', 'Open'); await delay(150);
  findings.updatedSceneTotal = await evalJs(`document.querySelector('.episode-section-heading strong').textContent`);
  await screenshot('episode-updated-scene.png');
  await clickText('.studio-nav button', 'Scenes'); await delay(120);
  await evalJs(`document.querySelectorAll('.scene-library article')[1].querySelectorAll('button')[2].click()`); await delay(140);
  await clickText('.studio-nav button', 'Episodes'); await delay(120);
  await clickText('.scene-library button', 'Open'); await delay(150);
  findings.missingScene = await evalJs(`({warning:document.querySelector('.episode-warning')?.textContent, playDisabled:document.querySelector('.scene-playback button:nth-child(2)')?.disabled, blocks:[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)})`);
  await screenshot('episode-missing-scene-warning.png');
  await clickText('.scene-heading button', 'Back to Episodes'); await delay(100);
  await evalJs(`document.querySelector('.scene-library article .scene-actions button:nth-child(2)').click()`); await delay(100);
  await clickText('.scene-heading button', 'Save Episode'); await delay(100);
  await clickText('.scene-heading button', 'Back to Episodes'); await delay(100);
  findings.duplicateEpisodes = await evalJs(`[...document.querySelectorAll('.scene-library h2')].map(e=>e.textContent)`);
  await evalJs(`document.querySelectorAll('.scene-library article')[1].querySelector('.scene-actions button:nth-child(3)').click()`); await delay(100);
  findings.afterDeleteEpisodes = await evalJs(`[...document.querySelectorAll('.scene-library h2')].map(e=>e.textContent)`);
} catch (error) { findings.fatal = String(error?.stack ?? error); }
finally {
  try { ws?.close(); } catch { /* ignore */ }
  const cleanup = path => {
    if (!path || !resolve(path).startsWith(resolve(tmpdir()) + '\\') || !path.includes('brightsen-m62-isolated-')) return false;
    const command = `$target=$env:M62_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
    spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, M62_PROFILE: path }, stdio: 'ignore' });
    return !existsSync(path);
  };
  findings.profileRemoved = cleanup(profile);
  if (restoreProfile) findings.restoreProfileRemoved = cleanup(restoreProfile);
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
}
