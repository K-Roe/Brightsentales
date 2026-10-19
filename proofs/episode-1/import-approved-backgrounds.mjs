// Disposable Chrome drives the visible Places and Scene Maker controls.
// This produces a Studio Backup through the UI; it does not edit browser storage.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, unlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd(), out = join(root, 'proofs/episode-1/background-import');
mkdirSync(out, { recursive: true });
const candidates = join(root, 'proofs/episode-1/background-candidates');
const artwork = [
  ['Max\'s bedroom', 'max-bedroom-candidate.png'],
  ['Maxine\'s bedroom', 'maxine-bedroom-candidate.png'],
  ['Kitchen', 'max-kitchen-candidate.png'],
  ['Garden', 'garden-candidate.png'],
  ['Front of Max\'s house', 'house-front-candidate.png'],
];
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const originalHashes = Object.fromEntries(artwork.map(([name, file]) => [name, hash(join(candidates, file))]));
const livingRoomHash = hash(join(root, 'public/art/living-room.png'));
const profile = mkdtempSync(join(tmpdir(), 'brighttales-places-profile-'));
const downloads = mkdtempSync(join(tmpdir(), 'brighttales-places-download-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 1;
const pending = new Map(), errors = [];
const result = { sourceHashes: originalHashes, livingRoomHash, steps: [], exports: [], errors };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 300) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const click = (selector, label) => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing '+${JSON.stringify(label)});e.click();return true})()`);
const nav = label => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
const setValue = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const fileInput = async (selector, path) => { const { root } = await send('DOM.getDocument', { depth: -1, pierce: true }); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector }); if (!nodeId) throw Error(`Missing file input ${selector}`); await send('DOM.setFileInputFiles', { nodeId, files: [path] }); };
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(join(out, name), Buffer.from(data, 'base64')); };
const pass = (name, detail) => { result.steps.push({ name, detail }); console.log('PASS', name, detail ?? ''); };
const waitDownload = async suffix => { for (let i = 0; i < 300; i++) { const found = readdirSync(downloads).find(name => name.endsWith(suffix)); if (found && statSync(join(downloads, found)).size > 1000) { await delay(200); return join(downloads, found); } await delay(100); } throw Error(`Missing ${suffix} download`); };
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') { void send('Page.handleJavaScriptDialog', { accept: true }); return; } if (!m.id) return; const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' }); await until(`!!document.querySelector('.studio-nav')`);
  await nav('Places'); await evaluate(`[...document.querySelectorAll('.folder-card')].find(e=>e.querySelector('strong')?.textContent==='House').click()`);
  await fileInput('#place-garden input[type="file"]', join(candidates, 'garden-candidate.png'));
  await until(`document.querySelector('.place-notice')?.textContent.includes('Garden artwork uploaded and saved')`);
  pass('Garden imported through Places');
  await evaluate(`document.querySelector('#place-bedroom .place-delete-button').click()`);
  await until(`!document.querySelector('#place-bedroom')`);
  pass('unused Bedroom placeholder removed through Places');
  await click('.places-heading-actions button', '← Back to Places');
  for (const [name, file] of artwork.filter(([name]) => name !== 'Garden')) {
    await click('.places-heading-actions button', '+ Add Place');
    await setValue('#place-name', name);
    await fileInput('#place-image', join(candidates, file));
    await click('.folder-form button', 'Add Place');
    await until(`document.querySelector('.place-notice')?.textContent.includes(${JSON.stringify(name + ' and its artwork added')})`);
    pass(`${name} imported through Places`);
  }
  await screenshot('places-after-import.png');
  const storedBefore = await evaluate(`localStorage.getItem('brightsenappstales.place-folders.v1')`);
  const org = JSON.parse(storedBefore);
  if (org.customPlaces.length !== 4 || Object.keys(org.artwork).length !== 5 || org.removedDefaultPlaceIds.join() !== 'bedroom') throw Error('Imported Places state differs from six ready locations');
  const artworkHashes = Object.fromEntries(Object.entries(org.artwork).map(([id, value]) => [id, createHash('sha256').update(value).digest('hex')]));
  result.savedArtworkHashes = artworkHashes;
  await send('Page.reload', { ignoreCache: true }); await until(`!!document.querySelector('.studio-nav')`);
  if (await evaluate(`localStorage.getItem('brightsenappstales.place-folders.v1')`) !== storedBefore) throw Error('Places changed after reload');
  await nav('Scenes'); await click('button', 'Create Scene');
  const options = await evaluate(`[...document.querySelectorAll('select[aria-label="Scene place"] option')].map(e=>({id:e.value,name:e.textContent}))`);
  const expected = ['Living Room', ...artwork.map(([name]) => name)];
  if (options.length !== 6 || expected.some(name => !options.some(option => option.name === name))) throw Error(`Scene Maker locations: ${JSON.stringify(options)}`);
  result.sceneMakerLocations = options;
  await setValue('input[aria-label="Scene duration"]', '2');
  await setValue('select[aria-label="Add Brightling"]', 'max');
  await setValue('select[aria-label="Add Brightling"]', 'maxine');
  pass('six ready locations and both Native2D Brightlings available in Scene Maker', options.map(o => o.name));
  for (const option of options) {
    const slug = option.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await setValue('select[aria-label="Scene place"]', option.id);
    await until(`document.querySelector('.scene-stage-caption strong')?.textContent===${JSON.stringify(option.name)} && !document.querySelector('.scene-heading button:last-child')?.disabled`);
    await delay(250);
    const canvas = await evaluate(`document.querySelector('canvas[aria-label^="Timed scene stage"]').toDataURL('image/png')`);
    writeFileSync(join(out, `${slug}-preview.png`), Buffer.from(canvas.split(',')[1], 'base64'));
    await screenshot(`${slug}-studio.png`);
    await click('.scene-heading button', 'Export scene video (WebM)');
    await until(`document.querySelector('.scene-status')?.textContent.includes('exported')`, 300);
    const download = await waitDownload('.webm');
    const videoPath = join(out, `${slug}-export.webm`);
    copyFileSync(download, videoPath); unlinkSync(download);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', videoPath, '-frames:v', '1', join(out, `${slug}-export.png`)], { stdio: 'pipe' });
    result.exports.push({ place: option.name, video: basename(videoPath), bytes: statSync(videoPath).size });
    pass(`${option.name} previewed and exported with Max and Maxine`);
  }
  if (await evaluate(`localStorage.getItem('brightsenappstales.place-folders.v1')`) !== storedBefore) throw Error('Places changed during scene export');
  await nav('Characters'); await click('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  const backup = await waitDownload('.json');
  const backupPath = join(out, 'approved-episode-1-places-studio-backup.json');
  copyFileSync(backup, backupPath);
  const saved = JSON.parse(readFileSync(backupPath, 'utf8'));
  if (JSON.stringify(saved.places) !== storedBefore) throw Error('Studio Backup Places differ from saved UI state');
  if (saved.version !== 8) throw Error(`Unexpected Studio Backup version ${saved.version}`);
  pass('Studio Backup v8 exported through UI with unchanged imported artwork');
  for (const [name, file] of artwork) if (hash(join(candidates, file)) !== originalHashes[name]) throw Error(`Source artwork changed: ${name}`);
  if (hash(join(root, 'public/art/living-room.png')) !== livingRoomHash) throw Error('Living Room artwork changed');
  pass('five approved source PNGs and protected Living Room remain byte unchanged');
  if (errors.length) throw Error(`Browser errors: ${errors.join(' | ')}`);
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally {
  ws?.close();
  try {
    const owned = basename(profile);
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !/^brighttales-places-profile-[A-Za-z0-9]+$/.test(owned)) throw Error('Unsafe disposable browser profile');
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*${owned}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { windowsHide: true, stdio: 'ignore' });
    chrome.kill();
    for (const path of [profile, downloads]) {
      if (dirname(resolve(path)) !== resolve(tmpdir()) || !/^brighttales-places-(profile|download)-[A-Za-z0-9]+$/.test(basename(path))) throw Error('Unsafe disposable browser path');
      rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    result.cleanup = 'Disposable browser and downloads removed.';
  } catch (error) { result.cleanup = `Pending manual cleanup: ${String(error)}`; }
  writeFileSync(join(out, 'results.json'), JSON.stringify(result, null, 2));
}
