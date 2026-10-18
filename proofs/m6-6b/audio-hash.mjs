// Audio-render regression baseline for M6.6B.
// Drives the real UI, then hashes the exact bytes the app stores in the Audio Library.
// Run before the redesign and again after; the SHA-256 must be identical.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-6b');
mkdirSync(root, { recursive: true });
const label = process.argv[2] ?? 'current';
const profiles = [];
let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text); return value.result.value; };
const log = m => process.stderr.write('[step] ' + m + '\n');
const clickText = (selector, text) => evaluate(`(()=>{const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)}));if(!item)throw Error('Missing ${text}');item.click()})()`);
const input = (selector, value) => evaluate(`(()=>{const item=document.querySelector(${JSON.stringify(selector)});if(!item)throw Error('Missing ${selector}');const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(item,${JSON.stringify(String(value))});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const isNewUI = () => evaluate(`!!document.querySelector('.music-studio-switcher')`);
/** Adds an instrument through the redesigned picker or the original select. */
const addInstrument = async (name, id) => {
  if (await isNewUI()) {
    await clickText('.music-add-instrument', 'Add Instrument'); await delay(200);
    await evaluate(`document.querySelector('button[aria-label="Add ${name} instrument"]').click()`);
  } else {
    await input('select[aria-label="New track instrument"]', id);
  }
  await delay(300);
};
const clickSave = async (label) => {
  if (await isNewUI()) await clickText('.music-save-button', label);
  else await clickText('.scene-heading button', label);
  await delay(300);
};
const clickExport = async () => {
  if (await isNewUI()) await clickText('.music-export-button', 'Add to Audio Library');
  else await clickText('.scene-heading button', 'Add to Audio Library');
};
const clickPreset = async (title) => {
  if (await isNewUI()) await evaluate(`(()=>{const card=[...document.querySelectorAll('.music-preset-card')].find(c=>c.querySelector('strong')?.textContent.trim()===${JSON.stringify(title)});if(!card)throw Error('Missing preset '+${JSON.stringify(title)});card.click()})()`);
  else await clickText('.music-starters button', title);
};
const clickEffect = async (title, id) => {
  if (await isNewUI()) await evaluate(`(()=>{const card=[...document.querySelectorAll('.music-effect-card')].find(c=>c.querySelector('strong')?.textContent.trim()===${JSON.stringify(title)});if(!card)throw Error('Missing effect '+${JSON.stringify(title)});card.click()})()`);
  else await input('select[aria-label="Effect preset"]', id);
};
const hashOf = async (name) => evaluate(`(async()=>{const r=indexedDB.open('brightsenappstales.audio.v1');const db=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=rej});const all=await new Promise((res,rej)=>{const q=db.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>res(q.result);q.onerror=rej});const a=all.find(x=>x.name===${JSON.stringify(name)});if(!a)return null;const bytes=new Uint8Array(await a.blob.arrayBuffer());const d=await crypto.subtle.digest('SHA-256',bytes);return {size:bytes.length,sha256:Array.from(new Uint8Array(d)).map(n=>n.toString(16).padStart(2,'0')).join(''),duration:a.duration}})()`);

try {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-m66b-hash-'));
  profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1500,1050', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  // Without this listener every send() promise would never resolve.
  ws.addEventListener('message', event => {
    const item = JSON.parse(event.data);
    if (!item.id) return;
    const call = pending.get(item.id);
    if (!call) return;
    pending.delete(item.id);
    item.error ? call.fail(Error(item.error.message)) : call.ok(item.result);
  });
  pending.clear();
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  for (let i = 0; i < 60 && !(await evaluate('!!document.querySelector(".studio-nav")')); i++) await delay(100);

  // Canonical song: three instruments, fixed settings. Must be reproducible byte for byte.
  log('nav');
  await clickText('.studio-nav button', 'Music Studio'); await delay(200);
  log('create song');
  await clickText('button', '+ Create a song'); await delay(250);
  await input('input[aria-label="Song name"]', 'Hash Baseline Song');
  await input('input[aria-label="Song tempo"]', 100);
  await input('input[aria-label="Song bars"]', 4);
  await addInstrument('Piano', 'piano');
  await clickPreset('Up and down'); await delay(300);
  await addInstrument('Xylophone', 'xylophone');
  await clickPreset('Twinkle melody'); await delay(300);
  await addInstrument('Drums', 'drums');
  await clickPreset('Steady beat'); await delay(300);
  log('save song');
  await clickSave('Save Song'); await delay(300);
  log('render song');
  await clickExport();
  for (let i = 0; i < 60; i++) { await delay(400); if (await hashOf('Hash Baseline Song')) { log('song hashed'); break; } }

  // Canonical sound effect.
  log('effects tab');
  if (await isNewUI()) await clickText('.music-studio-switcher button', 'Sound Effects'); else await clickText('.music-tabs button', 'Sound Effects'); await delay(200);
  await clickText('button', '+ Create a sound effect'); await delay(250);
  await input('input[aria-label="Effect name"]', 'Hash Baseline Effect');
  await clickEffect('Bell', 'bell');
  await input('input[aria-label="Effect pitch"]', -2);
  await input('input[aria-label="Effect duration"]', 1.2);
  await input('input[aria-label="Effect volume"]', 0.65);
  log('save effect');
  await clickSave('Save Effect'); await delay(300);
  log('render song');
  await clickExport();
  for (let i = 0; i < 60; i++) { await delay(400); if (await hashOf('Hash Baseline Effect')) { log('effect hashed'); break; } }

  log('all hashed');
  const result = {
    label,
    song: await hashOf('Hash Baseline Song'),
    effect: await hashOf('Hash Baseline Effect'),
    projectJson: await evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1')))`),
  };
  // Save the exact rendered WAV bytes so two builds can be compared sample by sample.
  for (const [name, file] of [['Hash Baseline Song', 'song'], ['Hash Baseline Effect', 'effect']]) {
    const base64 = await evaluate(`(async()=>{const r=indexedDB.open('brightsenappstales.audio.v1');const db=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=rej});const all=await new Promise((res,rej)=>{const q=db.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>res(q.result);q.onerror=rej});const a=all.find(x=>x.name===${JSON.stringify(name)});if(!a)return null;const bytes=new Uint8Array(await a.blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)})()`);
    if (base64) writeFileSync(join(root, `render-${label}-${file}.wav`), Buffer.from(base64, 'base64'));
  }
  writeFileSync(join(root, `audio-hash-${label}.json`), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify({ label, song: result.song, effect: result.effect }, null, 2));
} catch (error) {
  process.stdout.write(String(error?.stack ?? error));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  for (const p of profiles) {
    const target = resolve(p);
    if (target.startsWith(resolve(tmpdir()) + '\\') && target.includes('brightsen-m66b-hash-')) {
      const command = `$target=$env:M66B_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
      spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, M66B_PROFILE: target }, stdio: 'ignore' });
    }
  }
}