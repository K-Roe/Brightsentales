import { mkdtemp, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/brightling-life-v2');
const profile = await mkdtemp(join(tmpdir(), 'bright-life-v2-profile-'));
const downloads = await mkdtemp(join(tmpdir(), 'bright-life-v2-downloads-'));
const library = JSON.parse(await readFile(join(root, 'demo-scenes.json'), 'utf8'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map(), errors = [], checks = {};
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, attempts = 240) => { for (let i = 0; i < attempts; i++) { const value = await js(expression); if (value) return value; await delay(200); } throw Error(`Timed out: ${expression}`); };
const click = label => js(`(()=>{const item=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!item)throw Error('Missing '+${JSON.stringify(label)});item.click();return true})()`);
const nav = label => js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`);
async function screenshot(filename) { const data = await js(`document.querySelector('.scene-stage canvas').toDataURL('image/png')`); await writeFile(join(root, filename), Buffer.from(data.split(',')[1], 'base64')); }
async function seek(time) {
  const position = await js(`(()=>{const el=document.querySelector('.timeline-ruler');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+116+${time}*24,y:r.top+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: position.x, y: position.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
  await delay(300);
}
async function takeDownload(extension, filename) {
  for (let i = 0; i < 240; i++) {
    const names = await readdir(downloads);
    const name = names.find(file => file.endsWith(extension));
    if (name && !names.some(file => file.endsWith('.crdownload')) && (await stat(join(downloads, name))).size > 1000) {
      await writeFile(join(root, filename), await readFile(join(downloads, name)));
      await unlink(join(downloads, name));
      return (await stat(join(root, filename))).size;
    }
    await delay(250);
  }
  throw Error(`Missing ${extension} download`);
}
async function openScene(index) {
  await until(`document.querySelectorAll('.scene-library article').length===2`);
  await js(`document.querySelectorAll('.scene-library article')[${index}].querySelector('button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  await delay(900);
}
async function exportScene() {
  await until(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export scene video (WebM)');return button && !button.disabled})()`);
  await click('Export scene video (WebM)');
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Exporting'))`);
  for (let i = 0; i < 300; i++) {
    const state = await js(`({button:[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Export'))?.textContent,status:document.querySelector('.scene-status')?.textContent})`);
    if (state.button === 'Export scene video (WebM)') break;
    if (i % 50 === 0) console.log(`export ${i / 5}s: ${JSON.stringify(state)}`);
    await delay(200);
  }
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export scene video (WebM)')`, 5);
  const status = await js(`document.querySelector('.scene-status')?.textContent ?? ''`);
  if (!status.includes('Scene video exported')) throw Error(`Scene export status: ${status}`);
}
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Profile was not empty');
  await js(`localStorage.setItem('brightsenappstales.timed-scenes.v1', ${JSON.stringify(JSON.stringify(library))})`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  await nav('Scenes'); await openScene(0);
  checks.v2Checked = await js(`document.querySelector('input[aria-label="Brightling Life V2 experimental"]')?.checked`);
  checks.v1Unchecked = !(await js(`document.querySelector('input[aria-label="Cartoon Life experimental"]')?.checked`));
  checks.validation = await js(`document.querySelector('.storage-alert')?.textContent ?? ''`);
  for (const time of [2.9, 3.4, 6.5, 8.1, 10.5, 11.4, 14.7]) { await seek(time); await screenshot(`v2-preview-${String(time).replace('.', '-')}.png`); }
  await click('Save Scene'); await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  await send('Page.reload'); await until(`!!document.querySelector('.studio-nav')`);
  checks.savedMode = await js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].life.mode`);
  await nav('Scenes'); await openScene(0);
  await exportScene(); checks.v2VideoBytes = await takeDownload('.webm', 'brightling-life-v2-scene.webm');
  await click('← All scenes'); await openScene(1);
  checks.v1Checked = await js(`document.querySelector('input[aria-label="Cartoon Life experimental"]')?.checked`);
  for (const time of [3.4, 6.5, 11.4]) { await seek(time); await screenshot(`v1-preview-${String(time).replace('.', '-')}.png`); }
  await exportScene(); checks.v1VideoBytes = await takeDownload('.webm', 'cartoon-life-v1-comparison.webm');
  await nav('Episodes'); await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Episode')`);
  await click('Create Episode'); await until(`!!document.querySelector('input[aria-label="Episode name"]')`);
  await js(`(()=>{const input=document.querySelector('input[aria-label="Episode name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Brightling Life V2 review');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await until(`!!document.querySelector('.episode-scene-library article button')`);
  await js(`document.querySelector('.episode-scene-library article button').click()`);
  await click('Save Episode'); await until(`document.querySelector('.episode-save-indicator')?.textContent?.includes('Saved')`);
  await click('Export Episode Video'); await until(`document.querySelector('.scene-status')?.textContent?.includes('Complete episode exported')`, 300);
  checks.episodeVideoBytes = await takeDownload('.webm', 'brightling-life-v2-episode.webm');
  await nav('Characters'); await click('Export Studio Backup');
  checks.backupBytes = await takeDownload('.json', 'brightling-life-v2-studio-backup.json');
  checks.consoleErrors = errors;
  await writeFile(join(root, 'browser-results.json'), JSON.stringify(checks, null, 2) + '\n');
  if (!checks.v2Checked || !checks.v1Unchecked || !checks.v1Checked || checks.savedMode !== 'v2' || errors.length) throw Error(`Browser checks failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify(checks));
} finally { socket?.close(); chrome.kill(); }
