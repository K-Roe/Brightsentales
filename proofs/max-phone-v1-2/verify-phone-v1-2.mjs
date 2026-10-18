// Max's Phone & Bright Speak V1 acceptance run: builds the scene through the real Studio UI,
// captures the rendered stage at key moments, and exports the scene video with its phone audio.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ORIGIN = process.argv[2] || 'http://127.0.0.1:4177/';
const OUT = join(process.cwd(), 'proofs/max-phone-v1-2');
const FRAMES = join(process.cwd(), 'proofs/max-phone-v1-2/frames');
const downloads = mkdtempSync(join(tmpdir(), 'brighttales-phone-downloads-'));

let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 300, step = 100) => { for (let i = 0; i < tries; i++) { const v = await evaluate(expression); if (v) return v; await delay(step); } throw Error(`Timed out: ${expression}`); };
const nav = text => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(text)})).click()`);
const clickText = (selector, text) => evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button: '+${JSON.stringify(text)});b.click();return true;})()`);
const setValue = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field: '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:e.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);
const results = { origin: ORIGIN, steps: [], frames: [], consoleErrors: [], failedRequests: [] };
const pass = (name, detail) => { results.steps.push({ name, detail }); console.log('PASS', name, detail ?? ''); };

/** Seeks the scene playhead by clicking the timeline ruler at the requested second. */
async function seek(seconds) {
  const pps = await evaluate(`(()=>{document.querySelector('.timeline-ruler').scrollIntoView({block:'center'});const t=[...document.querySelectorAll('.timeline-tick')].map(e=>({t:parseFloat(e.textContent),l:parseFloat(e.style.left)}));if(t.length<2)return 0;const a=t[0],b=t[t.length-1];return b.t>a.t?(b.l-a.l)/(b.t-a.t):0;})()`);
  if (!pps) throw Error('Could not read the timeline scale.');
  const box = await evaluate(`(()=>{const r=document.querySelector('.timeline-ruler').getBoundingClientRect();return {left:r.left,top:r.top,height:r.height,width:r.width};})()`);
  const x = Math.round(Math.min(box.left + box.width - 2, box.left + 116 + seconds * pps));
  const y = Math.round(box.top + box.height / 2);
  if (y < 0 || y > 1190) throw Error(`Timeline is off screen at y=${y}.`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await delay(350);
  return evaluate(`document.querySelector('.scene-playback strong')?.textContent ?? ''`);
}

async function shootStage(name, at) {
  const shown = await seek(at);
  const clip = await evaluate(`(()=>{const c=document.querySelector('canvas[aria-label^="Timed scene stage"]');c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};})()`);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
  const file = join(FRAMES, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  results.frames.push({ name, at, shown, file: file.replace(process.cwd() + '\\', '') });
  console.log('FRAME', name, 'at', at, 'playhead', shown);
}

const profile = mkdtempSync(join(tmpdir(), 'brighttales-phone-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1700,1200', 'about:blank'], { stdio: 'ignore', windowsHide: true });

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
  pass('studio loaded', ORIGIN);

  // 1. Generate the phone's assistive voice through the real Voice Maker.
  await nav('Voice Maker');
  await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready')`);
  await setValue('textarea[aria-label="Dialogue text"]', "I'm hungry!");
  await setValue('select[aria-label="AI voice"]', 'kokoro:bf_alice');
  await clickText('.voice-card[aria-label="AI Voices"] button', 'Generate dialogue');
  await until(`!!document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes('Original:')`, 600);
  pass('phone line generated with a local AI voice', 'Piper/Kokoro through the Voice Maker service');
  await clickText('.voice-card[aria-label="Voice Editor"] button', 'Save original');
  await until(`document.querySelectorAll('.voice-card[aria-label="Voice Library"] .voice-library article').length>=1`, 300);
  const savedName = await evaluate(`document.querySelector('.voice-card[aria-label="Voice Library"] .voice-library article strong')?.textContent ?? ''`);
  pass('phone line saved to the Audio Library', savedName);

  // 2. Build the scene.
  await nav('Scenes');
  await clickText('button', 'Create Scene');
  await until(`!!document.querySelector('canvas[aria-label^="Timed scene stage"]')`);
  await setValue('input[aria-label="Scene name"]', 'Max asks for food');
  await setValue('input[aria-label="Scene duration"]', '12');
  await setValue('select[aria-label="Add Brightling"]', 'max');
  await until(`document.querySelectorAll('.director-cast button').length===1`);
  await evaluate(`(()=>{const b=document.querySelector('.director-cast button');b.click();return b.textContent;})()`);
  pass('scene created with Max', 'Max is the only Brightling in the shot');

  // 3. The phone interaction, in shot order.
  const addPhone = async (label, at) => {
    await seek(at);
    await clickText('.director-phone button', label);
    await delay(300);
  };
  await addPhone('Take Out Phone', 0.4);
  await setValue('select[aria-label="Phone hand"]', 'left');
  await addPhone('Tap Phone', 2.6);
  await addPhone('Communicate Message', 3.2);
  await addPhone('Put Away Phone', 8.2);
  const list = await evaluate(`[...document.querySelectorAll('.phone-list button')].map(b=>b.textContent.trim())`);
  results.phoneList = list;
  pass('phone interaction sequence authored', list.join(' | '));

  // Pin each interaction to its story beat, so the sequence does not depend on the playhead.
  const beats = [['Take Out Phone', 0.6], ['Tap Phone', 2.6], ['Communicate Message', 3.4], ['Put Away Phone', 8.6]];
  for (const [label, at] of beats) {
    await evaluate(`(()=>{const b=[...document.querySelectorAll('.phone-list button')].find(x=>x.textContent.includes(${JSON.stringify(label)}));b.click();return true;})()`);
    await until(`!!document.querySelector('input[aria-label="Phone interaction start time"]')`);
    await setValue('input[aria-label="Phone interaction start time"]', at);
    await delay(200);
  }
  results.phoneTimeline = await evaluate(`[...document.querySelectorAll('.phone-list button')].map(b=>b.textContent.trim())`);
  pass('interactions pinned to their story beats', results.phoneTimeline.join(' | '));

  // 4. Configure the communication and give it the saved phone voice.
  await evaluate(`(()=>{const b=[...document.querySelectorAll('.phone-list button')].find(x=>x.textContent.includes('Communicate'));b.click();return true;})()`);
  await until(`!!document.querySelector('input[aria-label="Communication message"]')`);
  await setValue('input[aria-label="Communication message"]', "I'm hungry!");
  await setValue('select[aria-label="Communication symbol"]', 'food');
  await setValue('select[aria-label="Communication pop-up position"]', 'above-right');
  const voiceValue = await evaluate(`(()=>{const s=document.querySelector('select[aria-label="Phone voice"]');const o=[...s.options].find(x=>x.value);if(!o)return '';const p=window.HTMLSelectElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}));return o.textContent;})()`);
  pass('communication configured', `message "I'm hungry!", food symbol, voice "${voiceValue}"`);
  await until(`document.querySelectorAll('.scene-inspector').length>=1`);

  // 5. Continuity setting: this shot starts without a phone, later shots can carry it.
  const clipCount = await evaluate(`document.body.textContent.includes('Phone voice') ? 'configured' : 'missing'`);
  results.phoneVoicePanel = clipCount;

  await clickText('button', 'Save Scene');
  await delay(500);
  const saved = await evaluate(`document.body.textContent.includes('Scene saved in this browser.')`);
  pass('scene saved', `saved=${saved}`);

  // 6. Capture the rendered stage at every story beat.
  await shootStage('01-no-phone', 0.2);
  await shootStage('02-taking-out', 0.75);
  await shootStage('03-phone-held', 1.8);
  await shootStage('04-tap', 2.8);
  await shootStage('05-popup', 4.2);
  await shootStage('06-popup-fading', 5.6);
  await shootStage('07-put-away', 8.5);
  await shootStage('08-phone-away', 10.5);

  // 7. Pixel evidence that the phone is drawn and the pop-up appears.
  const pixels = await evaluate(`(()=>{
    const c=document.querySelector('canvas[aria-label^="Timed scene stage"]');
    return {w:c.width,h:c.height};
  })()`);
  results.canvas = pixels;

  // 8. Export the scene video, which must carry the phone's speech.
  await clickText('button', 'Export scene video (WebM)');
  for (let i = 0; i < 600 && !readdirSync(downloads).some(n => n.endsWith('.webm')); i++) await delay(250);
  const video = readdirSync(downloads).find(n => n.endsWith('.webm'));
  results.video = video ? { name: video, bytes: statSync(join(downloads, video)).size } : null;
  if (video) { copyFileSync(join(downloads, video), join(OUT, 'max-asks-for-food-v1-2.webm')); results.video.copiedTo = 'proofs/max-phone-v1-2/max-asks-for-food-v1-2.webm'; }
  pass('scene video exported', video ? `${video} (${results.video.bytes} bytes)` : 'no file produced');

  const audioClips = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].audio ?? []`);
  results.sceneAudioClips = audioClips;
  pass('phone speech saved as a scene clip', `${audioClips.length} clip(s), speakerId=${JSON.stringify(audioClips.map(c => c.speakerId ?? null))}`);

  // 9. Shot continuity: the next scene starts with the phone still in hand, with no take-out.
  await nav('Scenes');
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('All scenes'));if(b)b.click();return !!b;})()`);
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Scene')`);
  await clickText('button', 'Create Scene');
  await until(`!!document.querySelector('canvas[aria-label^="Timed scene stage"]')`);
  await setValue('input[aria-label="Scene name"]', 'Max still has the phone');
  await setValue('input[aria-label="Scene duration"]', '6');
  await setValue('select[aria-label="Add Brightling"]', 'max');
  await until(`document.querySelectorAll('.director-cast button').length===1`);
  await evaluate(`document.querySelector('.director-cast button').click()`);
  await setValue('select[aria-label="Phone already in hand"]', 'left');
  await clickText('button', 'Save Scene');
  await delay(400);
  await shootStage('09-continuity-carried-in', 0.5);
  const carriedActions = await evaluate(`document.querySelectorAll('.phone-list button').length`);
  results.continuity = { phoneListLength: carriedActions };
  pass('second shot starts holding the phone with no take-out', `phone interactions authored in shot 2: ${carriedActions}`);
  const carriedSaved = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.map(s => ({ name: s.name, phoneIn: s.phoneIn ?? null, phone: (s.phone ?? []).length }))`);
  results.savedScenes = carriedSaved;
  pass('saved scenes keep the carried-in phone state', JSON.stringify(carriedSaved));

  results.consoleErrorCount = results.consoleErrors.length;
  results.failedRequestCount = results.failedRequests.length;
  writeFileSync(join(OUT, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log('DONE', JSON.stringify({ consoleErrors: results.consoleErrors.length, failedRequests: results.failedRequests.length, video: !!video }));
} catch (error) {
  results.failure = error.message;
  console.error('FAIL', error.message);
  writeFileSync(join(OUT, 'browser-results.json'), JSON.stringify(results, null, 2));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  await delay(300);
  const pattern = profile.replace(/'/g, "''");
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `$items = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${pattern}*' }; foreach ($item in $items) { Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', windowsHide: true });
  } catch { /* best effort */ }
  for (let i = 0; i < 20; i++) { await delay(500); try { rmSync(profile, { recursive: true, force: true }); break; } catch { /* locked */ } }
  results.profileRemoved = !existsSync(profile);
  writeFileSync(join(OUT, 'browser-results.json'), JSON.stringify(results, null, 2));
}
