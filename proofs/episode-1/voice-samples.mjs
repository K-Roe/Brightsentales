// Generate comparative British narrator samples using the visible Voice Maker UI.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const origin = process.argv[2] || 'http://127.0.0.1:4177/';
const out = join(process.cwd(), 'proofs/episode-1');
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'brighttales-episode-voices-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws;
let serial = 1;
const pending = new Map();
const errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 600) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const click = (selector, label) => evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing '+${JSON.stringify(label)});b.click();return true})()`);
const setValue = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const results = { origin, samples: [], errors, profile };

try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Network.loadingFailed' && !/favicon/.test(m.params.errorText)) errors.push(m.params.errorText);
    if (!m.id) return;
    const item = pending.get(m.id); if (!item) return;
    pending.delete(m.id); m.error ? item.reject(Error(m.error.message)) : item.resolve(m.result);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: origin });
  await until(`!!document.querySelector('.studio-nav')`);
  await evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes('Voice Maker')).click()`);
  await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready')`);
  await until(`document.querySelectorAll('select[aria-label="AI voice"] option').length > 4`);
  results.installed = await evaluate(`[...document.querySelectorAll('select[aria-label="AI voice"] option')].map(e=>({id:e.value,name:e.textContent}))`);
  const script = "Hello, everyone! Welcome to BrightTales! Today, we're going to meet someone very special. This is Max!";
  for (const voice of ['bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily']) {
    await setValue('textarea[aria-label="Dialogue text"]', script);
    await setValue('select[aria-label="AI voice"]', `kokoro:${voice}`);
    await setValue('input[aria-label="AI speaking speed"]', '.9');
    await click('.voice-card[aria-label="AI Voices"] button', 'Generate dialogue');
    await until(`!!document.querySelector('.voice-card[aria-label="Voice Editor"] button') && !document.querySelector('.voice-primary')?.textContent.includes('Generating')`);
    await click('.voice-card[aria-label="Voice Editor"] button', 'Save original');
    const count = results.samples.length + 1;
    await until(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length>=${count}`);
    const item = await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('brightsenappstales.audio.v1',2);r.onerror=()=>reject(Error('DB open failed'));r.onsuccess=()=>{const db=r.result;const q=db.transaction('assets').objectStore('assets').getAll();q.onerror=()=>reject(Error('DB read failed'));q.onsuccess=async()=>{const used=${JSON.stringify(results.samples.map(sample => sample.id))};const a=q.result.find(asset=>!used.includes(asset.id));if(!a){reject(Error('Saved asset missing'));return}const bytes=new Uint8Array(await a.blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve({id:a.id,duration:a.duration,mime:a.mime,wav:btoa(s)});db.close()}}})`);
    const path = join(out, `narrator-${voice}.wav`);
    writeFileSync(path, Buffer.from(item.wav, 'base64'));
    results.samples.push({ id: item.id, voice, speed: .9, text: script, duration: item.duration, bytes: Buffer.byteLength(item.wav, 'base64'), path });
    console.log('SAMPLE', voice, item.duration.toFixed(2), path);
    await click('[role="tab"]', 'AI Voices');
  }
  await click('.voice-card[aria-label="AI Voices"] button', 'Save voice and pace for this speaker');
  await send('Page.reload', { ignoreCache: true });
  await until(`!!document.querySelector('.studio-nav')`);
  await evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes('Voice Maker')).click()`);
  await until(`document.querySelectorAll('select[aria-label="AI voice"] option').length > 4`);
  results.defaultAfterReload = await evaluate(`({voice:document.querySelector('select[aria-label="AI voice"]')?.value,speed:document.querySelector('input[aria-label="AI speaking speed"]')?.value})`);
  if (results.defaultAfterReload.voice !== 'kokoro:bf_lily' || results.defaultAfterReload.speed !== '0.9') throw Error('Saved narrator voice or pace did not reload');
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'voice-maker-samples.png'), Buffer.from(data, 'base64'));
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally {
  ws?.close();
  try {
    const owned = basename(profile);
    if (dirname(resolve(profile)) !== resolve(tmpdir()) || !/^brighttales-episode-voices-[A-Za-z0-9]+$/.test(owned)) throw Error('Unsafe disposable browser profile');
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*${owned}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { windowsHide: true, stdio: 'ignore' });
    chrome.kill();
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    results.cleanup = 'Disposable browser removed.';
  } catch (error) { results.cleanup = `Pending manual cleanup: ${String(error)}`; console.warn(results.cleanup); }
  writeFileSync(join(out, 'voice-samples-results.json'), JSON.stringify(results, null, 2));
}
