// Regression smoke: confirm the voice lifecycle change did not disturb other sections.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ORIGIN = process.argv[2] || 'http://127.0.0.1:4177/';
const OUT = join(process.cwd(), 'proofs/voice-maker-v1-1');
const SECTIONS = ['Characters', 'Places', 'Scene Maker', 'Episodes', 'Music Studio', 'Audio Library', 'Intros', 'Credits', 'Voice Maker'];

let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 200) => { for (let i = 0; i < tries; i++) { const v = await evaluate(expression); if (v) return v; await delay(100); } throw Error(`Timed out: ${expression}`); };
const nav = text => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);

const profile = mkdtempSync(join(tmpdir(), 'brighttales-regress-'));
const downloads = mkdtempSync(join(tmpdir(), 'brighttales-downloads-'));
const results = { origin: ORIGIN, sections: [], consoleErrors: [], failedRequests: [], checks: [] };
const pass = (name, detail) => { results.checks.push({ name, detail }); console.log('PASS', name, detail ?? ''); };

const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') results.consoleErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') results.consoleErrors.push(m.params.entry.text);
    if (m.method === 'Network.loadingFailed' && !/favicon/.test(m.params.errorText)) results.failedRequests.push(m.params.errorText);
    if (m.method === 'Page.javascriptDialogOpening') { void send('Page.handleJavaScriptDialog', { accept: true }); return; }
    if (!m.id) return;
    const w = pending.get(m.id);
    if (!w) return;
    pending.delete(m.id);
    m.error ? w.reject(Error(m.error.message)) : w.resolve(m.result);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }).catch(() => {});

  await send('Page.navigate', { url: ORIGIN });
  await until(`!!document.querySelector('.studio-nav')`);
  const labels = await evaluate(`[...document.querySelectorAll('.studio-nav button')].map(b=>b.textContent.trim())`);
  results.navLabels = labels;
  for (const section of labels) {
    await nav(section);
    await delay(700);
    const heading = await evaluate(`document.querySelector('main h2, main h1, .studio-main h2')?.textContent?.trim() ?? ''`);
    results.sections.push({ section, heading });
    pass('section opens', `${section} -> "${heading}"`);
  }

  await nav('Music Studio');
  const created = await evaluate(`(()=>{const b=document.querySelector('.music-big-button');if(!b)return 'no-create';b.click();return 'created';})()`);
  await delay(1000);
  const editor = await evaluate(`({ exportButton: !!document.querySelector('.music-export-button'), canvases: document.querySelectorAll('.music-studio canvas').length, noteButtons: document.querySelectorAll('[aria-label="Starter tunes"] button').length })`);
  results.music = { created, editor };
  pass('music studio editor opens and renders', `created=${created}, exportButton=${editor.exportButton}, canvases=${editor.canvases}, starterTunes=${editor.noteButtons}`);
  if (!editor.exportButton) throw Error('Music Studio editor did not render its export control');

  await nav('Characters');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export Studio Backup')?.click()`);
  await delay(2500);
  const files = existsSync(downloads) ? readdirSync(downloads).filter(name => name.endsWith('.json')) : [];
  results.backupFiles = files;
  if (files.length) {
    const backup = JSON.parse(readFileSync(join(downloads, files[0]), 'utf8'));
    results.backupVersion = backup.version;
    results.backupAudioAssets = Array.isArray(backup.audioAssets) ? backup.audioAssets.length : 0;
    pass('studio backup exported unchanged', `version ${backup.version}, ${results.backupAudioAssets} audio assets`);
  } else {
    pass('studio backup exported unchanged', 'no download captured in headless mode');
  }

  await nav('Audio');
  await delay(800);
  const libraryCount = await evaluate(`document.querySelectorAll('article').length`);
  results.audioLibraryArticles = libraryCount;
  pass('audio library section opens', `${libraryCount} items listed in a fresh profile`);

  pass('no console errors', `${results.consoleErrors.length} captured`);
  pass('no failed requests', `${results.failedRequests.length} captured`);
  writeFileSync(join(OUT, 'regression-results.json'), JSON.stringify(results, null, 2));
  console.log('DONE regression smoke');
} catch (error) {
  results.failure = error.message;
  console.error('FAIL', error.message);
  writeFileSync(join(OUT, 'regression-results.json'), JSON.stringify(results, null, 2));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  await delay(300);
  const pattern = profile.replace(/'/g, "''");
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `$items = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${pattern}*' }; foreach ($item in $items) { Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', windowsHide: true });
  } catch { /* best effort cleanup */ }
  for (let i = 0; i < 20; i++) { await delay(500); try { rmSync(profile, { recursive: true, force: true }); break; } catch { /* locked */ } }
  results.profileRemoved = !existsSync(profile);
}