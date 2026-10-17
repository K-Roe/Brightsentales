// M6.6 Credits Maker acceptance. Disposable Chrome profile, real local audio fixture.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-6');
mkdirSync(root, { recursive: true });
const profiles = [];
const findings = { errors: [], failedAssets: [], screenshots: [] };
let ws, serial = 1;
let dialogAccept = true;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text); return value.result.value; };
const clickText = (selector, label) => evaluate(`(()=>{const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));if(!item)throw Error('Missing ${label}');item.click()})()`);
const input = (selector, value) => evaluate(`(()=>{const item=document.querySelector(${JSON.stringify(selector)});if(!item)throw Error('Missing ${selector}');const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(item,${JSON.stringify(String(value))});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const screenshot = async name => { const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(root, name), Buffer.from(shot.data, 'base64')); findings.screenshots.push(name); };
const captureScript = `(()=>{const ctx=new AudioContext();const destination=ctx.createMediaStreamDestination();const wired=new WeakSet();window.__players=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!wired.has(this)){const source=ctx.createMediaElementSource(this);source.connect(ctx.destination);source.connect(destination);wired.add(this);window.__players.push(this);}void ctx.resume();return original.apply(this,args)};window.__captureStart=()=>{window.__chunks=[];window.__recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});window.__recorder.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data)};window.__recorder.start(200)};window.__captureStop=()=>new Promise(resolve=>{window.__recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(window.__chunks).arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(out))};window.__recorder.stop()})})()`;
const onMessage = event => {
  const item = JSON.parse(event.data);
  if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } }
  else if (item.method === 'Runtime.exceptionThrown') findings.errors.push(item.params.exceptionDetails.text);
  else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') findings.errors.push(item.params.args.map(a => a.value ?? a.description).join(' '));
  else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);
  else if (item.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: dialogAccept });
};
const launch = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-m66-isolated-'));
  profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  if (!existsSync(portFile)) throw Error('Isolated Chrome failed to start');
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', onMessage);
  pending.clear();
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: captureScript });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  for (let i = 0; i < 60 && !(await evaluate('!!document.querySelector(".studio-nav")')); i++) await delay(100);
  return profile;
};
const setFile = async (selector, path) => { const doc = await send('DOM.getDocument'); const file = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector }); await send('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [path] }); await delay(500); };
const music = directory => {
  const path = join(directory, 'credits-theme.wav');
  const script = `Add-Type -AssemblyName System.Speech; $speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.SetOutputToWaveFile($env:M66_PATH); $speaker.Rate=1; $speaker.Speak('Thank you for watching our cartoon. Made with love by the whole team.'); $speaker.Dispose()`;
  const result = spawnSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env: { ...process.env, M66_PATH: path }, encoding: 'utf8' });
  if (result.status !== 0) throw Error(`Could not prepare local music fixture: ${result.stderr}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels:format=format_name,duration', '-of', 'json', path], { encoding: 'utf8' });
  return { path, probe: JSON.parse(probe.stdout) };
};
const playAndCapture = async (label, seconds, framesWanted) => {
  await evaluate(`document.querySelector('.scene-stage').scrollIntoView({block:'center'})`);
  await clickText('.scene-playback button', 'Restart'); await delay(150);
  await evaluate('window.__captureStart()');
  await clickText('.scene-playback button', 'Play');
  const frames = [];
  const samples = [];
  const start = Date.now();
  const total = Math.ceil(seconds * 4);
  for (let i = 0; i < total; i++) {
    await delay(Math.max(0, start + i * 250 - Date.now()));
    if (i % 4 === 1) samples.push(await evaluate(`({clock:document.querySelector('.scene-playback strong').textContent,players:window.__players.filter(p=>!p.paused&&!p.ended).length})`));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = `${label}-frame-${String(i).padStart(3, '0')}.png`;
    writeFileSync(join(root, name), Buffer.from(shot.data, 'base64'));
    frames.push(name);
  }
  const audio = Buffer.from(await evaluate('window.__captureStop()'), 'base64');
  writeFileSync(join(root, `${label}.webm`), audio);
  const video = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '4', '-start_number', '0', '-i', join(root, `${label}-frame-%03d.png`), '-i', join(root, `${label}.webm`), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest', join(root, `${label}.mp4`)], { encoding: 'utf8' });
  const loudness = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', join(root, `${label}.webm`), '-af', 'volumedetect', '-f', 'null', 'NUL'], { encoding: 'utf8', shell: true });
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(loudness.stderr ?? '');
  const peak = /max_volume: (-?[\d.]+) dB/.exec(loudness.stderr ?? '');
  if (video.status === 0) { const { rmSync } = await import('node:fs'); frames.forEach(name => rmSync(join(root, name))); }
  return { samples, created: video.status === 0, error: video.status === 0 ? undefined : video.stderr, meanDb: mean?.[1], maxDb: peak?.[1], frames: framesWanted };
};

try {
  const profile = await launch();
  findings.initialStorage = await evaluate('localStorage.length');
  const theme = music(profile);
  findings.music = theme.probe;
  await clickText('.studio-nav button', 'Audio'); await delay(150);
  await input('select[aria-label="Imported audio type"]', 'music');
  await setFile('input[aria-label="Import audio file"]', theme.path);

  await clickText('.studio-nav button', 'Credits'); await delay(150);
  await screenshot('credits-library-empty.png');
  await clickText('button', 'Create Credits'); await delay(200);
  await input('input[aria-label="Credits name"]', 'Closing Credits');
  await input('input[aria-label="Credits title"]', 'Thank You');
  await input('input[aria-label="Credits duration"]', 12);
  await delay(200);

  // Build a realistic credit list through the real UI: select a line, fill it, add more.
  const fillLine = async (index, heading, name, role) => {
    await evaluate(`document.querySelectorAll('.credit-line-list button')[${index}].click()`); await delay(120);
    await input('input[aria-label="Credit heading"]', heading);
    await input('input[aria-label="Credit name"]', name);
    if (role !== '') await input('input[aria-label="Credit role"]', role);
    await delay(120);
  };
  await fillLine(0, 'Created by', 'Karl', 'Story and artwork');
  await clickText('button', '+ Add credit line'); await delay(150);
  await fillLine(1, 'Voices', 'Max and Maxine', 'Recorded dialogue');
  await clickText('button', '+ Add credit line'); await delay(150);
  await fillLine(2, 'Music', 'BrightBeats Theme', 'Original score');
  await clickText('button', '+ Add credit line'); await delay(150);
  await fillLine(3, 'Thanks to', 'Everyone at home', '');
  await delay(150);
  findings.lineLabels = await evaluate(`[...document.querySelectorAll('.credit-line-list button span')].map(e=>e.textContent.trim())`);
  await screenshot('credits-editor-static.png');

  // Reorder proof: move the third line up and confirm the list order changed.
  await evaluate(`document.querySelectorAll('.credit-line-list button')[2].click()`); await delay(120);
  await clickText('.credit-line-actions button', 'Move up'); await delay(150);
  findings.orderAfterMoveUp = await evaluate(`[...document.querySelectorAll('.credit-line-list button span')].map(e=>e.textContent.trim())`);

  // Add credits music and check it is scheduled on the credits clock.
  await input('select[aria-label="Credits audio asset"]', await evaluate(`document.querySelector('select[aria-label="Credits audio asset"] option:nth-child(2)')?.value??''`));
  await clickText('.audio-add button', 'Add Music'); await delay(200);
  await input('input[aria-label="Audio clip start"]', 0);
  findings.savedMusic = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.credits.v1')??'{}')`);
  await evaluate(`document.querySelector('.audio-panel').scrollIntoView({block:'center'})`);
  await screenshot('credits-editor-music.png');

  // Static presentation first.
  await input('select[aria-label="Credits style"]', 'static'); await delay(200);
  findings.staticSamples = await playAndCapture('static-credits', 6, 24);
  await screenshot('credits-static-preview.png');

  // Scrolling presentation with music running across the whole sequence.
  await input('select[aria-label="Credits style"]', 'scroll'); await delay(200);
  await input('input[aria-label="Credits scroll speed"]', 2); await delay(150);
  findings.scrollSamples = await playAndCapture('scroll-credits', 6, 24);
  findings.scrollState = await evaluate(`({style:document.querySelector('select[aria-label="Credits style"]').value,speed:document.querySelector('input[aria-label="Credits scroll speed"]').value,clips:document.querySelectorAll('.audio-lane .audio-block').length})`);

  // Save, reload, confirm retention.
  await clickText('.scene-heading button', 'Save Credits'); await delay(250);
  findings.saveMessage = await evaluate(`document.querySelector('.scene-status')?.textContent??null`);
  findings.saved = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.credits.v1'))`);
  await clickText('.scene-heading button', '← All credits'); await delay(200);
  findings.libraryCards = await evaluate(`[...document.querySelectorAll('.scene-library article h2')].map(h=>h.textContent.trim())`);
  await screenshot('credits-library-saved.png');
  await clickText('.scene-library article button', 'Open'); await delay(250);
  findings.reopened = await evaluate(`({name:document.querySelector('input[aria-label="Credits name"]').value,title:document.querySelector('input[aria-label="Credits title"]').value,style:document.querySelector('select[aria-label="Credits style"]').value,lines:[...document.querySelectorAll('.credit-line-list button span')].map(e=>e.textContent.trim()),clips:document.querySelectorAll('.audio-lane .audio-block').length,indicator:document.querySelector('.episode-save-indicator')?.textContent?.trim()??null})`);

  // Unsaved-change protection: edit, then try to leave and cancel the confirmation.
  await input('input[aria-label="Credits title"]', 'Thank You (edited)'); await delay(250);
  findings.dirtyIndicator = await evaluate(`document.querySelector('.episode-save-indicator')?.textContent?.trim()??null`);
  dialogAccept = false;
  await clickText('.studio-nav button', 'Characters'); await delay(350);
  findings.leaveGuardCancelled = await evaluate(`({stayedOnCredits:!!document.querySelector('input[aria-label="Credits title"]'),title:document.querySelector('input[aria-label="Credits title"]')?.value??null})`);
  await screenshot('credits-unsaved-guard.png');
  // Save the edit, confirm the indicator returns to Saved, then leave without a prompt.
  await clickText('button', 'Save Credits'); await delay(250);
  findings.indicatorAfterSave = await evaluate(`document.querySelector('.episode-save-indicator')?.textContent?.trim()??null`);
  await clickText('.studio-nav button', 'Characters'); await delay(300);
  findings.leftCleanly = await evaluate(`!!document.querySelector('section[aria-label="Studio backup"]')`);
  await clickText('.studio-nav button', 'Credits'); await delay(200);
  dialogAccept = true;

  // Reload retention, then Studio Backup v7 round-trip into an empty profile.
  await send('Page.reload'); await delay(400);
  await clickText('.studio-nav button', 'Credits'); await delay(200);
  findings.afterReload = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.credits.v1')).credits.map(c=>({name:c.name,title:c.title,mode:c.mode,lines:c.lines.length,audio:c.audio?.length??0}))`);
  const downloads = join(profile, 'downloads');
  mkdirSync(downloads, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await clickText('.studio-nav button', 'Characters'); await delay(200);
  await clickText('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  for (let i = 0; i < 60 && !readdirSync(downloads).some(name => name.endsWith('.json')); i++) await delay(100);
  const backupPath = join(downloads, readdirSync(downloads).find(name => name.endsWith('.json')) ?? 'missing');
  if (!existsSync(backupPath)) throw Error('No Studio Backup download');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  findings.backup = { version: backup.version, credits: backup.credits?.credits?.[0]?.title ?? null, lines: backup.credits?.credits?.[0]?.lines?.length ?? 0, audio: backup.audioAssets?.map(a => a.name) ?? [] };

  await send('Page.navigate', { url: 'about:blank' });
  ws.close();
  await launch();
  findings.restoreInitialStorage = await evaluate('localStorage.length');
  await clickText('.studio-nav button', 'Credits'); await delay(200);
  await screenshot('credits-library-empty-fresh.png');
  await clickText('.studio-nav button', 'Characters'); await delay(200);
  const doc = await send('DOM.getDocument');
  const file = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [backupPath] });
  await delay(1200);
  findings.restoreDiagnostics = await evaluate(`({keys:Object.keys(localStorage),notice:document.querySelector('[role=alert]')?.textContent??null,fileInputs:document.querySelectorAll('section[aria-label="Studio backup"] input[type=file]').length})`);
  findings.restored = await evaluate(`(()=>{const raw=localStorage.getItem('brightsenappstales.credits.v1');if(!raw)return null;return JSON.parse(raw).credits.map(c=>({name:c.name,title:c.title,mode:c.mode,lines:c.lines.length,audio:c.audio?.length??0}))})()`);
  await clickText('.studio-nav button', 'Credits'); await delay(200);
  await screenshot('credits-restored.png');
} catch (error) {
  findings.fatal = String(error?.stack ?? error);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  const removed = [];
  for (const p of profiles) {
    const target = resolve(p);
    if (target.startsWith(resolve(tmpdir()) + '\\') && target.includes('brightsen-m66-isolated-')) {
      const command = `$target=$env:M66_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
      spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, M66_PROFILE: target }, stdio: 'ignore' });
    }
    removed.push(!existsSync(p));
  }
  findings.profilesRemoved = removed;
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
  if (findings.fatal || findings.errors.length || findings.failedAssets.length || removed.some(v => !v)) process.exitCode = 1;
}