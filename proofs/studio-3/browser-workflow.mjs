import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/studio-3');
const profile = await mkdtemp(join(tmpdir(), 'bright-studio3-chrome-'));
const url = process.env.STUDIO_URL ?? 'http://127.0.0.1:5177/';
const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const result = { url, profile, stages: {}, errors: [], requestsFailed: [] };
let chrome, socket, serial = 0, cancelNextDialog = false;
let pending = new Map();
const wait = async (condition, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { const value = await condition(); if (value) return value; await delay(120); } throw Error('Timed out waiting for UI state.'); };
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw Error(data.exceptionDetails.exception?.description ?? data.exceptionDetails.text); return data.result.value; };
const until = (expression, ms) => wait(() => js(expression), ms);
const click = label => js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button: '+${JSON.stringify(label)});if(b.disabled)throw Error('Disabled button: '+${JSON.stringify(label)});b.click();return true})()`);
const nav = label => js(`(()=>{const b=[...document.querySelectorAll('nav button,.studio3-sidebar-footer button')].find(x=>x.textContent.trim().endsWith(${JSON.stringify(label)}));if(!b)throw Error('Missing navigation: '+${JSON.stringify(label)});b.click();return true})()`);
const input = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input: '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const select = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing select: '+${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async filename => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(join(root, filename), Buffer.from(data.data, 'base64')); };
const sceneJson = () => js(`localStorage.getItem('brightsenappstales.timed-scenes.v1')`);

async function openBrowser() {
  chrome = spawn(chromeExe, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1050', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => { try { const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()); return pages.find(item => item.type === 'page'); } catch { return null; } });
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result); } if (message.method === 'Runtime.exceptionThrown') result.errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') result.errors.push(message.params.entry.text); if (message.method === 'Network.loadingFailed' && !message.params.canceled) result.requestsFailed.push(message.params.errorText); if (message.method === 'Page.javascriptDialogOpening') { const accept = !cancelNextDialog; if (cancelNextDialog) { cancelNextDialog = false; result.dialogsCanceled = (result.dialogsCanceled ?? 0) + 1; } void send('Page.handleJavaScriptDialog', { accept }).catch(() => {}); } });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.navigate', { url });
  await until(`!!document.querySelector('.app-shell')`);
}
async function closeBrowser() {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* close ends the socket */ }
    socket.close();
  }
  if (chrome?.exitCode === null) {
    await wait(() => chrome.exitCode !== null, 1500).catch(() => {});
    if (chrome.exitCode === null) chrome.kill();
  }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  try { await unlink(join(profile, 'DevToolsActivePort')); } catch { /* may already be removed by Chrome */ }
  await delay(500);
}

try {
  await openBrowser();
  if (!await js(`document.querySelector('.app-shell')?.classList.contains('studio3-shell')`)) throw Error('First launch did not default to Studio 3.0.');
  if (await sceneJson() !== null) throw Error('Disposable profile was not empty.');
  result.stages.defaultStudio3 = 'PASS';
  await screenshot('01-overall.png');

  await nav('Settings');
  await until(`!!document.querySelector('.studio3-settings')`);
  await screenshot('02-workspace-settings.png');
  await js(`document.querySelectorAll('input[name="preferred-studio"]')[1].click()`);
  await until(`document.querySelector('.app-shell')?.classList.contains('classic-shell')`);
  if (await sceneJson() !== null) throw Error('Workspace switch wrote scene storage.');
  await nav('Characters');
  await until(`!!document.querySelector('.characters-page')`);
  await screenshot('03-classic-mode.png');
  result.stages.classicSwitch = 'PASS';

  await nav('Playground');
  await until(`document.querySelector('.playground-page')?.hidden === false && !!document.querySelector('.playground-page canvas')`);
  result.stages.classicPlayground = 'PASS';

  await nav('Scenes');
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Scene')`);
  await click('Create Scene');
  await input('input[aria-label="Scene name"]', 'Studio 3 Review Scene');
  await input('input[aria-label="Scene duration"]', 9);
  await select('select[aria-label="Add Brightling"]', 'max');
  await select('select[aria-label="Add Brightling"]', 'maxine');
  await js(`document.querySelector('.director-cast button').click()`);
  await click('Walk To');
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Walk To')`);
  await input('input[aria-label="Action start time"]', .7);
  await input('input[aria-label="Selected action duration"]', 2.2);
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  let saved = await sceneJson();
  const id = JSON.parse(saved).scenes[0].id;
  result.sceneId = id;
  await click('Play');
  await until(`document.querySelector('.scene-playback strong')?.textContent?.startsWith('0.')`);
  result.stages.classicSceneAndPlayback = 'PASS';

  await click('Settings · Workspace');
  await until(`!!document.querySelector('.studio3-settings')`);
  await js(`document.querySelectorAll('input[name="preferred-studio"]')[0].click()`);
  await until(`document.querySelector('.app-shell')?.classList.contains('studio3-shell')`);
  if (await sceneJson() !== saved) throw Error('Mode switch changed saved scene data.');
  await nav('Projects');
  await until(`!![...document.querySelectorAll('.studio3-project-grid button')].find(b=>b.textContent.includes('Studio 3 Review Scene'))`);
  await js(`document.querySelector('.studio3-project-grid button').click()`);
  await until(`!!document.querySelector('.scene-hierarchy')`);
  await screenshot('04-cartoon-editor.png');
  await js(`document.querySelector('.scene-hierarchy > button').click()`);
  await js(`document.querySelector('.timeline-block[aria-label^="Max Walk To"]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Walk To')`);
  await screenshot('05-character-inspector.png');
  await js(`document.querySelector('.camera-panel').scrollIntoView({block:'center'})`);
  await select('select[aria-label="Camera shot"]', 'medium');
  await select('select[aria-label="Camera focus"]', 'group');
  await click('Add camera keyframe at 0.7s');
  await click('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  saved = await sceneJson();
  await screenshot('06-timeline-camera.png');
  await js(`document.querySelector('.scene-timeline').scrollIntoView({block:'center'})`);
  await screenshot('06b-timeline-tracks.png');
  result.stages.sharedSceneInStudio3 = 'PASS';

  await input('input[aria-label="Scene name"]', 'Unsaved layout switch');
  await until(`document.querySelector('.studio3-save-status')?.textContent?.includes('Changes to save')`);
  cancelNextDialog = true;
  await nav('Projects');
  if (!await js(`!!document.querySelector('.scene-maker.scene-visual')`)) throw Error('Canceled unsaved-scene navigation still left the editor.');
  result.stages.unsavedNavigationGuard = 'PASS';
  await click('Classic Studio');
  await until(`document.querySelector('.app-shell')?.classList.contains('classic-shell')`);
  if (await js(`document.querySelector('input[aria-label="Scene name"]')?.value`) !== 'Unsaved layout switch') throw Error('Switching layouts lost the unsaved editor state.');
  if (await sceneJson() !== saved) throw Error('Switching layouts wrote the unsaved scene.');
  await input('input[aria-label="Scene name"]', 'Studio 3 Review Scene');
  await click('Save Scene');
  await click('Settings · Workspace');
  await js(`document.querySelectorAll('input[name="preferred-studio"]')[0].click()`);
  await until(`document.querySelector('.app-shell')?.classList.contains('studio3-shell')`);
  result.stages.unsavedStateSurvivesSwitch = 'PASS';

  await nav('Cartoon Preview');
  await until(`!!document.querySelector('.unity-connection-status')`);
  await screenshot('07-unity-connection.png');
  if (!await js(`document.querySelector('.unity-connection-status')?.textContent?.includes('Disconnected')`)) throw Error('Unity offline state was hidden.');
  result.stages.unityOffline = 'PASS';
  await closeBrowser();
  await openBrowser();
  if (!await js(`document.querySelector('.app-shell')?.classList.contains('studio3-shell')`)) throw Error('Preferred workspace was lost after browser restart.');
  if (await sceneJson() !== saved) throw Error('Saved scene changed after browser restart.');
  result.stages.persistence = 'PASS';
  await nav('Audio Studio');
  await until(`!!document.querySelector('.music-studio') || !!document.querySelector('.music-studio-wrap')`);
  await nav('Voice Maker');
  await until(`!!document.querySelector('.voice-maker')`);
  result.stages.existingAudioTools = 'PASS';
  await nav('Asset Library');
  await until(`!!document.querySelector('.characters-page')`);
  const downloadDir = await mkdtemp(join(tmpdir(), 'bright-studio3-backup-'));
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await click('Export Studio Backup');
  const backupPath = await wait(async () => { const names = await (await import('node:fs/promises')).readdir(downloadDir); return names.find(name => name.endsWith('.json')) ? join(downloadDir, names.find(name => name.endsWith('.json'))) : null; });
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  if (backup.version !== 8 || backup.timedScenes?.scenes?.[0]?.id !== id) throw Error('Studio Backup v8 did not retain the scene ID.');
  await nav('Cartoon Editor');
  await until(`!!document.querySelector('.scene-library')`);
  await js(`document.querySelector('.scene-library .scene-actions button').click()`);
  await input('input[aria-label="Scene name"]', 'Temporary changed name');
  await click('Save Scene');
  await nav('Asset Library');
  const fileInput = await send('DOM.getDocument');
  const fileNode = await send('DOM.querySelector', { nodeId: fileInput.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  if (!fileNode.nodeId) throw Error('Studio Backup import input was not found.');
  await send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [backupPath] });
  await js(`document.querySelector('section[aria-label="Studio backup"] input[type="file"]').dispatchEvent(new Event('change',{bubbles:true}))`);
  await delay(3000);
  result.backupImportState = await js(`({message:document.querySelector('.form-message')?.textContent,files:document.querySelector('section[aria-label="Studio backup"] input[type="file"]')?.files?.length})`);
  if (!result.backupImportState.message?.includes('Studio Backup restored')) throw Error('Backup import did not complete: ' + JSON.stringify(result.backupImportState));
  const restored = JSON.parse(await sceneJson());
  if (restored.scenes[0].id !== id || restored.scenes[0].name !== 'Studio 3 Review Scene') throw Error('Studio Backup v8 restore did not recover the saved scene.');
  result.stages.backupV8RoundTrip = 'PASS';
  if (result.errors.length) throw Error('Browser console errors: ' + result.errors.join(' | '));
  if (result.requestsFailed.length) throw Error('Failed browser requests: ' + result.requestsFailed.join(' | '));
} catch (error) {
  result.failure = error instanceof Error ? error.stack : String(error);
} finally {
  await writeFile(join(root, 'browser-workflow-results.json'), JSON.stringify(result, null, 2));
  if (socket?.readyState === WebSocket.OPEN) await closeBrowser();
  console.log(JSON.stringify({ stages: result.stages, failure: result.failure, profile }));
  if (result.failure) process.exitCode = 1;
}
