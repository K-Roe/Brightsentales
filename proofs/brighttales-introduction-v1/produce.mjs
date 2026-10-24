import { copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/brighttales-introduction-v1');
const downloads = await mkdtemp(join(tmpdir(), 'bright-intro-download-'));
const profile = await mkdtemp(join(tmpdir(), 'bright-intro-profile-'));
await mkdir(root, { recursive: true });
const source = JSON.parse(await readFile(resolve('proofs/episode-1/background-import/approved-episode-1-places-studio-backup.json'), 'utf8'));
const places = Object.fromEntries(source.places.customPlaces.map(place => [place.name, place.id]));
places.Garden = 'garden'; places['Living Room'] = 'living-room';
let serial = 0;
const id = () => `70000000-7000-4000-8000-${String(++serial).padStart(12, '0')}`;
const point = (x, y = 790) => ({ x, y });
const scene = (name, duration, place, cast, spec) => ({
  id: id(), name, duration, placeId: places[place], characters: cast,
  actions: [...Object.entries(cast).map(([characterId, at]) => ({ id: id(), characterId, type: 'appear', start: 0, duration: 0, point: at })), ...spec.map(([characterId, type, start, actionDuration, destination]) => ({ id: id(), characterId, type, start, duration: actionDuration, ...(destination ? { point: destination } : {}) }))],
});
const scenes = [
  scene('Welcome to BrightTales', 6, 'Living Room', { max: point(575), maxine: point(1090) }, [['max', 'wave', 1.7, 1.62], ['maxine', 'wave', 3.7, 1.62]]),
  scene('Meet Max', 8, "Max's bedroom", { max: point(560) }, [['max', 'wave', 0.8, 1.62], ['max', 'walk', 3, 5, point(850)]]),
  scene('Meet Maxine', 8, "Maxine's bedroom", { maxine: point(1110) }, [['maxine', 'wave', 0.8, 1.62], ['maxine', 'walk', 3, 5, point(820)]]),
  scene('Bright Speak', 19, 'Living Room', { max: point(690) }, []),
  scene('Together', 8, 'Garden', { max: point(580), maxine: point(1070) }, [['maxine', 'wave', 1, 1.62], ['max', 'wave', 3.4, 1.62]]),
  scene('Goodbye', 7, "Front of Max's house", { max: point(570), maxine: point(1080) }, [['max', 'wave', 1, 1.62], ['maxine', 'wave', 3.25, 1.62]]),
];
const phone = scenes[3];
phone.phone = [
  { id: id(), characterId: 'max', type: 'take-out', start: 0.7, duration: 0.55, hand: 'left' },
  { id: id(), characterId: 'max', type: 'tap', start: 1.7, duration: 0.7 },
  { id: id(), characterId: 'max', type: 'communicate', start: 2.5, duration: 3.1, message: 'Welcome to BrightTales!', symbol: 'love', position: 'above-right' },
  { id: id(), characterId: 'max', type: 'tap', start: 5.9, duration: 0.7 },
  { id: id(), characterId: 'max', type: 'communicate', start: 6.7, duration: 3.5, message: 'Maxine is my sister.', symbol: 'love', position: 'above-right' },
  { id: id(), characterId: 'max', type: 'tap', start: 10.5, duration: 0.7 },
  { id: id(), characterId: 'max', type: 'communicate', start: 11.3, duration: 5.1, message: 'Bright Speak helps kids talk.', symbol: 'help', position: 'above-right' },
  { id: id(), characterId: 'max', type: 'put-away', start: 17.2, duration: 0.55 },
];
const episode = { id: id(), name: 'BrightTales — Meet Max & Maxine', sceneIds: scenes.map(item => item.id) };
const backup = { ...source, createdAt: new Date().toISOString(), timedScenes: { version: 1, scenes }, episodes: { version: 1, episodes: [episode] } };
const input = join(root, 'introduction-studio-backup-v8.json');
await writeFile(input, JSON.stringify(backup, null, 2) + '\n');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0;
const pending = new Map(), errors = [], checks = {};
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const callId = ++seq; pending.set(callId, { resolve: resolveCall, reject }); ws.send(JSON.stringify({ id: callId, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, tries = 300) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const nav = name => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);
const click = (label) => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();return true})()`);
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, name), Buffer.from(data, 'base64')); };
const captureCanvas = async name => { const data = await evaluate(`document.querySelector('canvas[aria-label="Episode cartoon preview"],canvas[aria-label^="Timed scene stage"]').toDataURL('image/png')`); await writeFile(join(root, name), Buffer.from(data.split(',')[1], 'base64')); };
try {
  let port;
  for (let i = 0; i < 100; i++) { try { const raw = await readFile(join(profile, 'DevToolsActivePort'), 'utf8'); port = Number(raw.split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); } if (data.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text); if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  await nav('Characters');
  const { root: dom } = await send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await send('DOM.querySelector', { nodeId: dom.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  if (!nodeId) throw Error('Backup import control is missing');
  await send('DOM.setFileInputFiles', { nodeId, files: [input] });
  await until(`!!document.querySelector('.form-message')?.textContent.includes('restored')`, 300);
  checks.imported = true;
  await nav('Scenes');
  checks.sceneCount = await evaluate(`document.querySelectorAll('.scene-library article').length`);
  if (checks.sceneCount !== scenes.length) throw Error(`Expected ${scenes.length} scenes, saw ${checks.sceneCount}`);
  await evaluate(`([...document.querySelectorAll('.scene-library article')].find(a=>a.textContent.includes('Bright Speak'))).querySelector('button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(700);
  await screenshot('scene-maker-phone.png');
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await send('Page.reload');
  await until(`!!document.querySelector('.studio-nav')`);
  checks.savedScenesReopened = (await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1'))?.scenes?.length`)) === scenes.length;
  await nav('Episodes');
  await evaluate(`document.querySelector('.scene-library button').click()`);
  await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  checks.episodeOrder = await evaluate(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  if (checks.episodeOrder.join('|') !== scenes.map(s => s.name).join('|')) throw Error('Episode order mismatch');
  await screenshot('episode-maker.png');
  // Scene Maker and episode preview use the same drawScenePreview function. Capture the
  // episode preview at a phone pop-up beat and later compare it to the exported frame.
  await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Episode time"]'); const p=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;p.call(e,'35');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await delay(400);
  await captureCanvas('preview-phone.png');
  await nav('Characters'); await click('Export Studio Backup');
  let backupDownload;
  for (let i = 0; i < 100; i++) { backupDownload = (await readdir(downloads)).find(name => name.endsWith('.json')); if (backupDownload) break; await delay(100); }
  if (!backupDownload) throw Error('Studio Backup was not downloaded');
  const roundTrip = JSON.parse(await readFile(join(downloads, backupDownload), 'utf8'));
  if (roundTrip.timedScenes.scenes.length !== scenes.length || roundTrip.episodes.episodes.length !== 1) throw Error('Studio Backup round-trip lost content');
  await copyFile(join(downloads, backupDownload), join(root, 'introduction-studio-backup-v8.json'));
  checks.studioBackupRoundTrip = true;
  await nav('Episodes'); await evaluate(`document.querySelector('.scene-library button').click()`);
  await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  await click('Export Episode Video');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 1200);
  let video;
  for (let i = 0; i < 100; i++) { video = (await readdir(downloads)).find(name => name.endsWith('.webm')); if (video && (await stat(join(downloads, video))).size > 1000) break; await delay(100); }
  if (!video) throw Error('Episode video was not downloaded');
  await copyFile(join(downloads, video), join(root, 'brighttales-meet-max-and-maxine.webm'));
  checks.videoBytes = (await stat(join(root, 'brighttales-meet-max-and-maxine.webm'))).size;
  checks.consoleErrors = errors;
  await writeFile(join(root, 'production-checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify(checks));
} catch (error) {
  await writeFile(join(root, 'production-failure.json'), JSON.stringify({ error: String(error), checks, errors }, null, 2) + '\n');
  throw error;
} finally {
  try { if (ws) await send('Browser.close'); } catch { chrome.kill(); }
  ws?.close();
}
