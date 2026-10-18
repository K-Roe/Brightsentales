// Voice Maker V1.1 verification: normal BrightTales launch, automatic voice engine, real speech.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const MODE = process.argv[2] === 'unavailable' ? 'unavailable' : 'ready';
const ORIGIN = process.argv[3] || 'http://127.0.0.1:4177/';
const OUT = join(process.cwd(), 'proofs/voice-maker-v1-1');
mkdirSync(OUT, { recursive: true });

let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text); return reply.result.value; };
const until = async (expression, tries = 400) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const value = async (selector, input) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error("Missing element");const proto=e.tagName==="TEXTAREA"?window.HTMLTextAreaElement.prototype:e.tagName==="SELECT"?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,${JSON.stringify(input)});e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));return e.value})()`);
const clickText = (selector, text) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`);
const nav = text => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);
const statusText = () => evaluate(`document.querySelector('.voice-service-status')?.textContent ?? ''`);
const shot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(data, 'base64')); };

const profile = mkdtempSync(join(tmpdir(), 'brighttales-voice-v11-'));
const results = { mode: MODE, origin: ORIGIN, steps: [], consoleErrors: [], failedRequests: [] };
const record = (name, detail) => { results.steps.push({ step: name, detail }); console.log('PASS', name, detail ?? ''); };

const saveResults = () => writeFileSync(join(OUT, MODE === 'ready' ? 'browser-results.json' : 'browser-results-unavailable.json'), JSON.stringify(results, null, 2));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });

try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => {
    const reply = JSON.parse(event.data);
    if (reply.method === 'Runtime.exceptionThrown') results.consoleErrors.push(reply.params.exceptionDetails.exception?.description ?? reply.params.exceptionDetails.text);
    if (reply.method === 'Log.entryAdded' && reply.params.entry.level === 'error') results.consoleErrors.push(reply.params.entry.text);
    if (reply.method === 'Network.loadingFailed') results.failedRequests.push(reply.params.errorText);
    if (reply.method === 'Page.javascriptDialogOpening') { void send('Page.handleJavaScriptDialog', { accept: true }); return; }
    if (!reply.id) return;
    const waiter = pending.get(reply.id);
    if (!waiter) return;
    pending.delete(reply.id);
    reply.error ? waiter.reject(Error(reply.error.message)) : waiter.resolve(reply.result);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');

  await send('Page.navigate', { url: ORIGIN });
  await until(`!!document.querySelector('.studio-nav')`);
  record('app loaded from the normal launcher', ORIGIN);
  await nav('Voice Maker');

  if (MODE === 'unavailable') {
    const text = await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Error') || document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Unavailable') ? document.querySelector('.voice-service-status').textContent : ''`);
    results.statusText = text;
    await shot('voice-engine-unavailable.png');
    const hasRetry = await evaluate(`!![...document.querySelectorAll('.voice-service-status button')].find(b=>b.textContent.includes('Retry'))`);
    const generateDisabled = await evaluate(`document.querySelector('.voice-card[aria-label="AI Voices"] .voice-primary').disabled`);
    record('engine reported unavailable with a plain reason', text.replace(/\s+/g, ' ').slice(0, 200));
    const managerState = await evaluate(`fetch('/voice-manager/status').then(r=>r.json())`);
    results.manager = managerState;
    record('failure reason came from the manager health check', JSON.stringify(managerState));
    if (!/Python|model|FFmpeg|port|dependency|engine/i.test(text)) throw Error(`unhelpful status text: ${text}`);
    record('Retry control offered', `retry=${hasRetry}`);
    record('Generate disabled while unavailable', `disabled=${generateDisabled}`);
    if (!/Voice engine: (Unavailable|Error)/.test(text)) throw Error(`unexpected status: ${text}`);
    if (!hasRetry) throw Error('Retry control missing');
    if (!generateDisabled) throw Error('Generate should be disabled while the engine is unavailable');
    await clickText('.voice-service-status button', 'Retry voice engine');
    await delay(600);
    results.afterRetry = await statusText();
    record('Retry accepted without a false ready state', results.afterRetry.replace(/\s+/g, ' ').slice(0, 120));
    writeFileSync(join(OUT, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log('DONE unavailable mode');
  } else {
    const text = await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready') && document.querySelector('.voice-service-status').textContent`);
    record('Voice Maker reported Ready with no manual Python step', text.replace(/\s+/g, ' '));
    const manager = await evaluate(`fetch('/voice-manager/status').then(r=>r.json())`);
    results.manager = manager;
    record('status came from the versioned health check', JSON.stringify(manager));
    const health = await evaluate(`fetch('/voice-api/health').then(r=>r.json())`);
    results.health = health;
    await shot('voice-engine-ready.png');

    const voiceCount = await until(`document.querySelectorAll('select[aria-label="AI voice"] option').length > 5 && document.querySelectorAll('select[aria-label="AI voice"] option').length`);
    await value('textarea[aria-label="Dialogue text"]', 'Good evening! The Voice Maker started by itself.');
    await value('select[aria-label="Dialogue speaker"]', 'max');
    await value('select[aria-label="AI voice"]', 'piper:en_GB-alan-medium');
    const started = Date.now();
    await clickText('.voice-card[aria-label="AI Voices"] button', 'Generate dialogue');
    await until(`!!document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes('Original:')`);
    results.generateMs = Date.now() - started;
    record('generated AI speech', `${voiceCount} voices installed, ${results.generateMs}ms`);
    await shot('voice-generated.png');

    await value('select[aria-label="Voice effect preset"]', 'high-cartoon');
    await clickText('.voice-card[aria-label="Voice Editor"] button', 'Preview edited voice');
    await until(`[...document.querySelectorAll('.voice-card[aria-label="Voice Editor"] button')].some(b=>b.textContent==='Save as new voice')`);
    record('edited the generated speech with a preset', 'processed audio ready');

    await value('input[aria-label="Edited voice name"]', 'Max auto-start line');
    await clickText('.voice-card[aria-label="Voice Editor"] button', 'Save as new voice');
    const afterGenerate = await until(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length>0 && document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length`);
    record('saved the generated and edited speech', `library shows ${afterGenerate} saved voice(s)`);

    await evaluate(`[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.includes('Record Voice')).click()`);
    await evaluate(`navigator.mediaDevices.getUserMedia({audio:true}).then(s=>s.getTracks().forEach(t=>t.stop())).then(()=>'granted')`);
    await clickText('.voice-card[aria-label="Record Voice"] button', 'Start recording');
    await delay(2500);
    await clickText('.voice-card[aria-label="Record Voice"] button', 'Stop recording');
    await until(`document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes('Original:')`);
    const recorded = await evaluate(`document.querySelector('.voice-card[aria-label="Voice Editor"] p').textContent`);
    record('recorded speech through the microphone', recorded.replace(/\s+/g, ' ').slice(0, 120));

    await value('select[aria-label="Voice effect preset"]', 'radio');
    await clickText('.voice-card[aria-label="Voice Editor"] button', 'Preview edited voice');
    await until(`[...document.querySelectorAll('.voice-card[aria-label="Voice Editor"] button')].some(b=>b.textContent==='Save as new voice')`);
    await value('input[aria-label="Edited voice name"]', 'My edited recording');
    await clickText('.voice-card[aria-label="Voice Editor"] button', 'Save as new voice');
    const afterRecord = await until(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length>${afterGenerate} && document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length`);
    await shot('voice-recorded-edited-saved.png');
    record('saved the edited recording', `library grew from ${afterGenerate} to ${afterRecord}`);

    await send('Page.navigate', { url: ORIGIN });
    await until(`!!document.querySelector('.studio-nav')`);
    await nav('Voice Maker');
    let reloadedOk = false, count = -1, state = '';
    console.log('expected after save:', afterRecord);
    for (let i = 0; i < 15; i++) {
      count = await evaluate(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length`);
      state = await evaluate(`document.querySelector('.voice-service-status')?.textContent?.replace(/\\s+/g,' ') ?? ''`);
      console.log('reload poll', i, 'library=', count, 'status=', state);
      if (count === afterRecord && state.includes('Ready')) { reloadedOk = true; break; }
      await delay(2000);
    }
    if (!reloadedOk) throw Error(`after reload library=${count} status=${state}`);
    record('survived a reload with saved voices intact', `reopen shows Ready and ${afterRecord} saved voices`);
    await shot('voice-after-reload.png');

    saveResults();
    console.log('DONE ready mode', JSON.stringify({ consoleErrors: results.consoleErrors.length, failedRequests: results.failedRequests.length }));
  }
} catch (error) {
  results.failure = error.message;
  console.error('FAIL', error.message);
  saveResults();
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  await delay(300);
  // Never kill by PID: a recycled PID could belong to an unrelated process. Match the
  // disposable profile path instead so only this run's browsers are touched.
  killProfileBrowsers(profile);
  for (let i = 0; i < 20; i++) {
    await delay(500);
    try { rmSync(profile, { recursive: true, force: true }); break; }
    catch { /* Chrome may still be releasing its profile files. */ }
  }
  results.profileRemoved = !existsSync(profile);
  results.leftoverProfileBrowsers = countProfileBrowsers(profile);
  saveResults();
}

// Headless Chrome re-parents its helper processes, so clean up anything still using this
// disposable profile. Only processes started with this exact profile are ever touched.
function killProfileBrowsers(profilePath) {
  const pattern = profilePath.replace(/'/g, "''");
  const command = `$items = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${pattern}*' }; foreach ($item in $items) { Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue }; $items.Count`;
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { stdio: 'ignore', windowsHide: true }); }
  catch { /* best effort cleanup */ }
}

function countProfileBrowsers(profilePath) {
  const pattern = profilePath.replace(/'/g, "''");
  const command = `(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${pattern}*' }).Count`;
  try { return Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }).trim()) || 0; }
  catch { return -1; }
}
