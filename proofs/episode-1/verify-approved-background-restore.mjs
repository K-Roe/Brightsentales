// Restore the UI-exported backup in a fresh disposable Studio browser and check Scene Maker.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const out = join(process.cwd(), 'proofs/episode-1/background-import');
const backup = join(out, 'approved-episode-1-places-studio-backup.json');
const profile = mkdtempSync(join(tmpdir(), 'brighttales-places-restore-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 1; const pending = new Map(), results = { steps: [], errors: [] };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async expression => { for (let i = 0; i < 300; i++) { const value = await evalJs(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') results.errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') { void send('Page.handleJavaScriptDialog', { accept: true }); return; } if (!m.id) return; const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' }); await until(`!!document.querySelector('.studio-nav')`);
  await evalJs(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes('Characters')).click()`);
  const { root } = await send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  if (!nodeId) throw Error('Studio Backup import input missing');
  await send('DOM.setFileInputFiles', { nodeId, files: [backup] });
  await until(`document.body.textContent.includes('Studio Backup restored')`);
  results.steps.push('Studio Backup restored through Characters UI into fresh browser');
  await evalJs(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes('Scenes')).click()`);
  await evalJs(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Create Scene').click()`);
  const names = await evalJs(`[...document.querySelectorAll('select[aria-label="Scene place"] option')].map(e=>e.textContent)`);
  const expected = ['Living Room', 'Garden', "Max's bedroom", "Maxine's bedroom", 'Kitchen', "Front of Max's house"];
  if (names.length !== 6 || expected.some(name => !names.includes(name))) throw Error(`Restored Scene Maker places: ${names}`);
  results.locations = names;
  results.steps.push('All six locations available in fresh Scene Maker');
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'restored-scene-maker.png'), Buffer.from(data, 'base64'));
  if (results.errors.length) throw Error(`Browser errors: ${results.errors.join(' | ')}`);
  console.log('PASS restored Studio Backup and six Scene Maker locations', names);
} catch (error) {
  results.errors.push(String(error));
  try {
    results.uiText = await evalJs(`document.querySelector('section[aria-label="Studio backup"]')?.innerText ?? document.body.innerText.slice(0,2000)`);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, 'restore-failure.png'), Buffer.from(data, 'base64'));
  } catch { /* Browser may already be unavailable. */ }
  process.exitCode = 1;
}
finally {
  ws?.close();
  try {
    const owned = basename(profile);
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !/^brighttales-places-restore-[A-Za-z0-9]+$/.test(owned)) throw Error('Unsafe disposable browser profile');
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*${owned}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { windowsHide: true, stdio: 'ignore' });
    chrome.kill(); rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    results.cleanup = 'Disposable browser removed.';
  } catch (error) { results.cleanup = `Pending manual cleanup: ${String(error)}`; }
  writeFileSync(join(out, 'restore-results.json'), JSON.stringify(results, null, 2));
}
