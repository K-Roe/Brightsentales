// M6.5 Intro Maker acceptance. Disposable Chrome profile, real local audio fixture.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-5');
mkdirSync(root, { recursive: true });
const profiles = [];
const findings = { errors: [], failedAssets: [], screenshots: [] };
let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text); return value.result.value; };
const clickText = (selector, label) => evaluate(`(()=>{const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));if(!item)throw Error('Missing ${label}');item.click()})()`);
const input = (selector, value) => evaluate(`(()=>{const item=document.querySelector(${JSON.stringify(selector)});if(!item)throw Error('Missing ${selector}');const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(item,${JSON.stringify(String(value))});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const screenshot = async name => { const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(root, name), Buffer.from(shot.data, 'base64')); findings.screenshots.push(name); };
const captureScript = `(()=>{const ctx=new AudioContext();const destination=ctx.createMediaStreamDestination();const wired=new WeakSet();window.__players=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!wired.has(this)){const source=ctx.createMediaElementSource(this);source.connect(ctx.destination);source.connect(destination);wired.add(this);window.__players.push(this);}void ctx.resume();return original.apply(this,args)};window.__captureStart=()=>{window.__chunks=[];window.__recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});window.__recorder.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data)};window.__recorder.start(200)};window.__captureStop=()=>new Promise(resolve=>{window.__recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(window.__chunks).arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(out))};window.__recorder.stop()})})()`;
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const onMessage = event => {
  const item = JSON.parse(event.data);
  if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } }
  else if (item.method === 'Runtime.exceptionThrown') findings.errors.push(item.params.exceptionDetails.text);
  else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') findings.errors.push(item.params.args.map(a => a.value ?? a.description).join(' '));
  else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);
  else if (item.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
};
const launch = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-m65-isolated-'));
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
// A short local WAV tone stands in for intro music. Windows speech synthesis is test input only.
const music = directory => {
  const path = join(directory, 'intro-theme.wav');
  const script = `Add-Type -AssemblyName System.Speech; $speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.SetOutputToWaveFile($env:M65_PATH); $speaker.Rate=1; $speaker.Speak('Welcome to the show. Today we are making a brand new cartoon together. Let us begin!'); $speaker.Dispose()`;
  const result = spawnSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env: { ...process.env, M65_PATH: path }, encoding: 'utf8' });
  if (result.status !== 0) throw Error(`Could not prepare local music fixture: ${result.stderr}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels:format=format_name,duration', '-of', 'json', path], { encoding: 'utf8' });
  return { path, probe: JSON.parse(probe.stdout) };
};

try {
  const profile = await launch();
  findings.initialStorage = await evaluate('localStorage.length');
  const theme = music(profile);
  findings.music = theme.probe;
  await clickText('.studio-nav button', 'Audio'); await delay(150);
  await input('select[aria-label="Imported audio type"]', 'music');
  await setFile('input[aria-label="Import audio file"]', theme.path);
  findings.library = await evaluate(`[...document.querySelectorAll('.audio-asset-list article')].map(e=>e.textContent.trim())`);
  await clickText('.studio-nav button', 'Intros'); await delay(150);
  await screenshot('intro-library-empty.png');
  await clickText('button', 'Create Intro'); await delay(200);
  await input('input[aria-label="Intro name"]', 'Opening Titles');
  await input('input[aria-label="Intro series title"]', 'The Little Living Room');
  await input('input[aria-label="Intro episode title"]', 'Episode One: The New Sofa');
  await input('input[aria-label="Intro duration"]', 8);
  await delay(200);
  await screenshot('intro-editor-titles.png');
  // Add both default Brightlings, then a wave action so the intro animates.
  await input('select[aria-label="Add Brightling"]', 'max'); await delay(150);
  await input('select[aria-label="Add Brightling"]', 'maxine'); await delay(150);
  findings.castAfterAdd = await evaluate(`[...document.querySelectorAll('.director-cast button')].map(b=>b.textContent.trim())`);
  await clickText('.director-cast button', 'Max');
  await clickText('.director-actions button', 'Wave'); await delay(150);
  await input('input[aria-label="Intro series title"]', 'Intro Music');
  await input('select[aria-label="Intro audio asset"]', await evaluate(`document.querySelector('select[aria-label="Intro audio asset"] option:nth-child(2)')?.value??''`));
  await clickText('.audio-add button', 'Add Music'); await delay(200);
  findings.introAudio = await evaluate(`[...document.querySelectorAll('.audio-lane .audio-block')].map(b=>b.textContent.trim())`);
  await evaluate(`document.querySelector('.audio-panel').scrollIntoView({block:'center'})`);
  await screenshot('intro-editor-full.png');
  await clickText('.scene-heading button', 'Save Intro'); await delay(200);
  findings.savedMessage = await evaluate(`document.querySelector('.scene-status')?.textContent??null`);
  findings.saved = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.introductions.v1'))`);
  await clickText('.scene-heading button', '← All intros'); await delay(200);
  findings.libraryCards = await evaluate(`[...document.querySelectorAll('.scene-library article h2')].map(h=>h.textContent.trim())`);
  await screenshot('intro-library-saved.png');
  await clickText('.scene-library article button', 'Open'); await delay(250);
  findings.reopened = await evaluate(`({name:document.querySelector('input[aria-label="Intro name"]').value,series:document.querySelector('input[aria-label="Intro series title"]').value,episode:document.querySelector('input[aria-label="Intro episode title"]').value,cast:[...document.querySelectorAll('.director-cast button')].map(b=>b.textContent.trim()),clips:document.querySelectorAll('.audio-lane .audio-block').length})`);
  // Play the intro and capture real browser sound.
  await evaluate(`document.querySelector('.scene-stage').scrollIntoView({block:'center'})`);
  await evaluate('window.__captureStart()');
  await clickText('.scene-playback button', 'Play');
  const frames = [];
  findings.playbackSamples = [];
  const start = Date.now();
  for (let i = 0; i < 40; i++) {
    await delay(Math.max(0, start + i * 250 - Date.now()));
    if ([4, 12, 20, 30].includes(i)) findings.playbackSamples.push(await evaluate(`({clock:document.querySelector('.scene-playback strong').textContent,players:window.__players.filter(p=>!p.paused&&!p.ended).length})`));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = `frame-${String(i).padStart(3, '0')}.png`;
    writeFileSync(join(root, name), Buffer.from(shot.data, 'base64'));
    frames.push(name);
  }
  findings.playbackEnd = await evaluate(`({clock:document.querySelector('.scene-playback strong').textContent,players:window.__players.filter(p=>!p.paused&&!p.ended).length})`);
  writeFileSync(join(root, 'intro-browser.webm'), Buffer.from(await evaluate('window.__captureStop()'), 'base64'));
  const video = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '4', '-i', join(root, 'frame-%03d.png'), '-i', join(root, 'intro-browser.webm'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest', join(root, 'intro-playback.mp4')], { encoding: 'utf8' });
  findings.recording = { created: video.status === 0, frames: frames.length, error: video.status === 0 ? undefined : video.stderr };
  if (video.status === 0) { const { rmSync } = await import('node:fs'); frames.forEach(name => rmSync(join(root, name))); }
  // Reload retention, then Studio Backup v6 round-trip into an empty profile.
  await send('Page.reload'); await delay(400);
  await clickText('.studio-nav button', 'Intros'); await delay(200);
  findings.afterReload = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.introductions.v1')).intros.map(i=>({name:i.name,series:i.seriesTitle,episode:i.episodeTitle,cast:Object.keys(i.characters).length,actions:i.actions.length}))`);
  const downloads = join(profile, 'downloads');
  mkdirSync(downloads, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await clickText('.studio-nav button', 'Characters'); await delay(150);
  await clickText('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  for (let i = 0; i < 60 && !readdirSync(downloads).some(name => name.endsWith('.json')); i++) await delay(100);
  const backupPath = join(downloads, readdirSync(downloads).find(name => name.endsWith('.json')) ?? 'missing');
  if (!existsSync(backupPath)) throw Error('No Studio Backup download');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  findings.backup = { version: backup.version, intro: backup.intros?.intros?.[0]?.episodeTitle ?? null, audio: backup.audioAssets?.map(a => a.name) ?? [] };
  await send('Page.navigate', { url: 'about:blank' });
  ws.close();
  await launch();
  findings.restoreInitialStorage = await evaluate('localStorage.length');
  await clickText('.studio-nav button', 'Intros'); await delay(150);
  await screenshot('intro-library-empty-fresh.png');
  // The Studio Backup import control lives on the Characters section.
  await clickText('.studio-nav button', 'Characters'); await delay(200);
  const doc = await send('DOM.getDocument');
  const file = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [backupPath] });
  await delay(1000);
  findings.restored = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.introductions.v1')).intros.map(i=>({name:i.name,series:i.seriesTitle,episode:i.episodeTitle,cast:Object.keys(i.characters).length}))`);
  await clickText('.studio-nav button', 'Intros'); await delay(200);
  await screenshot('intro-restored.png');
} catch (error) {
  findings.fatal = String(error?.stack ?? error);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  const removed = [];
  for (const p of profiles) {
    const target = resolve(p);
    if (target.startsWith(resolve(tmpdir()) + '\\') && target.includes('brightsen-m65-isolated-')) {
      const command = `$target=$env:M65_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
      spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, M65_PROFILE: target }, stdio: 'ignore' });
    }
    removed.push(!existsSync(p));
  }
  findings.profilesRemoved = removed;
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
  if (findings.fatal || findings.errors.length || findings.failedAssets.length || removed.some(v => !v)) process.exitCode = 1;
}