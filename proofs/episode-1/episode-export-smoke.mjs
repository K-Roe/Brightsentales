// Disposable UI smoke for intro -> scene -> credits assembly and full WebM export.
// This is a technical check, not Episode 1 production acceptance.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.argv.find(arg => /^https?:\/\//.test(arg)) || 'http://127.0.0.1:4177/';
const long = process.argv.includes('--long');
const stem = long ? 'long-export-smoke' : 'episode-export-smoke';
const out = join(process.cwd(), 'proofs/episode-1'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'brighttales-episode-smoke-'));
const downloads = mkdtempSync(join(tmpdir(), 'brighttales-episode-download-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 1; const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 600) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const nav = label => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
const click = (selector, label) => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing '+${JSON.stringify(label)});e.click();return true})()`);
const setValue = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const results = { origin, profile, downloads, steps: [], errors };
const pass = (name, detail) => { results.steps.push({ name, detail }); console.log('PASS', name, detail ?? ''); };
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); if (m.method === 'Network.loadingFailed' && !/favicon/.test(m.params.errorText)) errors.push(m.params.errorText); if (m.method === 'Page.javascriptDialogOpening') { void send('Page.handleJavaScriptDialog', { accept: true }); return; } if (!m.id) return; const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: origin }); await until(`!!document.querySelector('.studio-nav')`);

  await nav('Intros'); await click('button', 'Create Intro');
  await setValue('input[aria-label="Intro name"]', 'Episode smoke intro');
  await setValue('input[aria-label="Intro series title"]', 'BrightTales');
  await setValue('input[aria-label="Intro episode title"]', 'Meet Max and Maxine');
  await setValue('input[aria-label="Intro duration"]', '3');
  await click('button', 'Save Intro'); pass('intro saved through UI');

  await nav('Voice Maker');
  await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready')`);
  await until(`document.querySelectorAll('select[aria-label="AI voice"] option').length > 4`);
  await setValue('textarea[aria-label="Dialogue text"]', "Hello, everyone! Welcome to BrightTales! Today, we're going to meet someone very special. This is Max!");
  await setValue('select[aria-label="AI voice"]', 'kokoro:bf_alice');
  await setValue('input[aria-label="AI speaking speed"]', '.9');
  await click('.voice-card[aria-label="AI Voices"] button', 'Generate dialogue');
  await until(`!!document.querySelector('.voice-card[aria-label="Voice Editor"] button')`);
  await click('.voice-card[aria-label="Voice Editor"] button', 'Save original');
  await until(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length===1`);
  pass('narration generated and saved through UI');

  await nav('Scenes'); await click('button', 'Create Scene');
  await setValue('input[aria-label="Scene name"]', 'Max appears');
  await setValue('input[aria-label="Scene duration"]', '3');
  await setValue('select[aria-label="Add Brightling"]', 'max');
  await click('section[aria-label="Scene audio timeline"] button', 'Add Speech');
  const extended = await evaluate(`document.querySelector('input[aria-label="Scene duration"]')?.value`);
  if (Number(extended) <= 3) throw Error('Scene did not extend for narration');
  pass('shot automatically extended for narration', extended);
  if (long) await setValue('input[aria-label="Scene duration"]', '180');
  await click('button', 'Save Scene'); pass('scene saved through UI');

  await nav('Credits'); await click('button', 'Create Credits');
  await setValue('input[aria-label="Credits name"]', 'Episode smoke credits');
  await setValue('input[aria-label="Credits title"]', 'Thanks for watching');
  await setValue('input[aria-label="Credits duration"]', '3');
  await evaluate(`document.querySelector('.credit-line-list button').click()`);
  await setValue('input[aria-label="Credit name"]', 'BrightSenApps');
  await click('button', 'Save Credits'); pass('credits saved through UI');

  await nav('Episodes'); await click('button', 'Create Episode');
  await setValue('input[aria-label="Episode name"]', 'Production export smoke');
  const refs = await evaluate(`({intro:[...document.querySelectorAll('select[aria-label="Episode intro"] option')].map(e=>({id:e.value,name:e.textContent})),credits:[...document.querySelectorAll('select[aria-label="Episode credits"] option')].map(e=>({id:e.value,name:e.textContent}))})`);
  await setValue('select[aria-label="Episode intro"]', refs.intro[1].id);
  await setValue('select[aria-label="Episode credits"]', refs.credits[1].id);
  await click('.episode-scene-library button', 'Add Scene');
  await click('button', 'Save Episode');
  await until(`document.querySelector('.episode-save-indicator')?.textContent==='Saved'`);
  pass('episode saved through UI', await evaluate(`document.querySelector('.scene-heading strong')?.textContent`));
  const frame = async (time, name) => { await setValue('input[aria-label="Episode time"]', String(time)); await delay(250); const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `${stem}-${name}.png`), Buffer.from(data, 'base64')); return evaluate(`document.querySelector('.episode-preview .scene-stage-caption')?.textContent`); };
  pass('intro preview', await frame(1, 'intro'));
  pass('scene preview', await frame(4, 'scene'));
  pass('credits preview', await frame(long ? 184 : 11, 'credits'));
  await click('button', 'Export Episode Video');
  await until(`document.querySelector('.scene-status')?.textContent.includes('Complete episode exported')`, long ? 3000 : 300);
  let video;
  for (let i = 0; i < 100 && !video; i++) { video = readdirSync(downloads).find(name => name.endsWith('.webm')); if (!video) await delay(100); }
  if (!video) throw Error('Downloaded episode video missing');
  copyFileSync(join(downloads, video), join(out, `${stem}.webm`));
  pass('episode exported through UI', video);
  await send('Page.reload', { ignoreCache: true }); await until(`!!document.querySelector('.studio-nav')`);
  await nav('Episodes'); await click('.scene-library button', 'Open');
  pass('saved episode reopened', await evaluate(`document.querySelector('.episode-name input')?.value`));
  await nav('Characters'); await click('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  let backup;
  for (let i = 0; i < 100 && !backup; i++) { backup = readdirSync(downloads).find(name => name.endsWith('.json')); if (!backup) await delay(100); }
  if (!backup) throw Error('Studio Backup download missing');
  const saved = JSON.parse(readFileSync(join(downloads, backup), 'utf8'));
  if (saved.episodes?.episodes?.[0]?.introId !== refs.intro[1].id || saved.episodes?.episodes?.[0]?.creditsId !== refs.credits[1].id) throw Error('Intro or credits reference missing from Studio Backup');
  copyFileSync(join(downloads, backup), join(out, `${stem}-backup.json`));
  pass('Studio Backup v8 keeps production references and narration', { version: saved.version, scenes: saved.timedScenes.scenes.length, intros: saved.intros.intros.length, credits: saved.credits.credits.length, audio: saved.audioAssets.length });
  if (errors.length) throw Error(`Browser errors: ${errors.join(' | ')}`);
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally {
  ws?.close();
  try {
    const owned = basename(profile);
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !/^brighttales-episode-smoke-[A-Za-z0-9]+$/.test(owned)) throw Error('Unsafe disposable browser profile');
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*${owned}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { windowsHide: true, stdio: 'ignore' });
    chrome.kill();
    for (const path of [profile, downloads]) {
      if (dirname(resolve(path)) !== resolve(tmpdir()) || !/^brighttales-episode-(smoke|download)-[A-Za-z0-9]+$/.test(basename(path))) throw Error('Unsafe disposable browser path');
      rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    results.cleanup = 'Disposable browser and downloads removed.';
  } catch (error) {
    results.cleanup = `Pending manual cleanup: ${String(error)}`;
    console.warn(results.cleanup);
  }
  writeFileSync(join(out, `${stem}-results.json`), JSON.stringify(results, null, 2));
}
