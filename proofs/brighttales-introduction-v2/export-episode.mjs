import { copyFile, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/brighttales-introduction-v2');
const profile = await mkdtemp(join(tmpdir(), 'bright-v2-export-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'bright-v2-export-download-'));
const input = join(root, 'v2-import-backup.json');
const expected = JSON.parse(await readFile(input, 'utf8'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 0;
const pending = new Map(), errors = [], failedRequests = [], checks = {};
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, tries = 400) => { for (let i = 0; i < tries; i++) { if (await js(expression)) return; await delay(100); } throw Error(`Timed out: ${expression}; status=${await js(`document.querySelector('.scene-status')?.textContent`)}`); };
const nav = name => js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);
const click = (label) => js(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click();return true})()`);
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, name), Buffer.from(data, 'base64')); };
const canvas = async name => { const data = await js(`document.querySelector('canvas[aria-label="Episode cartoon preview"],canvas[aria-label^="Timed scene stage"]').toDataURL('image/png')`); await writeFile(join(root, name), Buffer.from(data.split(',')[1], 'base64')); };
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const call = pending.get(data.id); pending.delete(data.id); data.error ? call.reject(Error(data.error.message)) : call.resolve(data.result); } if (data.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text); if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text); if (data.method === 'Network.loadingFailed' && !data.params.canceled) failedRequests.push(data.params.errorText); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  await nav('Characters');
  const { root: dom } = await send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await send('DOM.querySelector', { nodeId: dom.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [input] });
  await until(`document.querySelector('.form-message')?.textContent.includes('restored')`, 500);
  checks.imported = true;
  await nav('Scenes');
  checks.sceneCount = await js(`document.querySelectorAll('.scene-library article').length`);
  if (checks.sceneCount !== 6) throw Error('Six scenes did not restore');
  await js(`[...document.querySelectorAll('.scene-library article')].find(a=>a.textContent.includes('Bright Speak')).querySelector('button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(700);
  await screenshot('scene-maker.png');
  await nav('Episodes');
  await js(`document.querySelector('.scene-library button').click()`);
  await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  checks.duration = await js(`Number(document.querySelector('input[aria-label="Episode time"]').max)`);
  checks.sceneOrder = await js(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  if (checks.duration !== 84 || checks.sceneOrder.join('|') !== expected.timedScenes.scenes.map(s => s.name).join('|')) throw Error('Episode timeline mismatch');
  checks.credits = await js(`document.querySelector('select[aria-label="Episode credits"]')?.value`);
  if (checks.credits !== expected.episodes.episodes[0].creditsId) throw Error('Closing title reference missing');
  await screenshot('episode-maker.png');
  // Probe real Episode Maker playback. The canonical hook creates detached
  // HTMLAudioElements, so document.querySelectorAll('audio') cannot see them.
  await js(`(()=>{window.__audioProbe=[];window.__oldPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audioProbe.push(this);return window.__oldPlay.call(this)}})()`);
  await click('Play');
  await delay(3200);
  checks.player = await js(`({created:window.__audioProbe.length,progress:window.__audioProbe.map(a=>({time:a.currentTime,paused:a.paused,volume:a.volume,ready:a.readyState,error:a.error?.message??null})),ui:document.querySelector('.scene-status')?.textContent})`);
  if (!checks.player.progress.some(item => item.time > 0.4 && !item.paused && item.ready >= 2 && !item.error)) throw Error('Episode player did not play narration audio');
  await click('Pause');
  await js(`HTMLMediaElement.prototype.play=window.__oldPlay`);
  // The downloaded backup proves generated assets and clip metadata survive UI restore.
  await nav('Characters'); await click('Export Studio Backup');
  let backupFile;
  for (let i = 0; i < 300; i++) { backupFile = (await readdir(downloads)).find(name => name.endsWith('.json')); if (backupFile && (await stat(join(downloads, backupFile))).size > 1000) break; await delay(100); }
  if (!backupFile) throw Error('Backup download missing');
  const saved = JSON.parse(await readFile(join(downloads, backupFile), 'utf8'));
  if (saved.audioAssets.length !== 11 || saved.timedScenes.scenes.length !== 6 || saved.credits.credits.length !== 1) throw Error('Studio Backup lost narration or scenes');
  await copyFile(join(downloads, backupFile), join(root, 'brighttales-introduction-v2-studio-backup.json'));
  checks.savedAudioAssets = saved.audioAssets.length;
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  await nav('Episodes'); await js(`document.querySelector('.scene-library button').click()`);
  await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  if (await js(`Number(document.querySelector('input[aria-label="Episode time"]').max)`) !== 84) throw Error('Reopened episode duration changed');
  checks.episodeReopened = true;
  await click('Export Episode Video');
  console.log('EXPORTING 84 SECOND EPISODE');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 1500);
  let videoFile;
  for (let i = 0; i < 300; i++) { videoFile = (await readdir(downloads)).find(name => name.endsWith('.webm')); if (videoFile && (await stat(join(downloads, videoFile))).size > 1000) break; await delay(100); }
  if (!videoFile) throw Error('Video download missing');
  await copyFile(join(downloads, videoFile), join(root, 'brighttales-meet-max-and-maxine-narrated-v2.webm'));
  checks.videoBytes = (await stat(join(root, 'brighttales-meet-max-and-maxine-narrated-v2.webm'))).size;
  checks.errors = errors; checks.failedRequests = failedRequests;
  await screenshot('episode-exported.png');
  await writeFile(join(root, 'browser-checks.json'), JSON.stringify(checks, null, 2) + '\n');
  console.log(JSON.stringify(checks));
} catch (error) { await writeFile(join(root, 'export-failure.json'), JSON.stringify({ error: String(error), checks, errors, failedRequests }, null, 2) + '\n'); throw error; }
finally { try { if (ws) await send('Browser.close'); } catch { chrome.kill(); } ws?.close(); }
