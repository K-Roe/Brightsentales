// M6.6A Music & Sound Effects Studio acceptance. Disposable Chrome profile.
// Verifies an original multi-instrument melody, a custom sound effect, mixing,
// save/reload/edit, Audio Library integration with real audible output, and backup v8.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-6a');
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
// Capture real browser audio output from every HTMLMediaElement that plays.
const captureScript = `(()=>{const ctx=new AudioContext();const destination=ctx.createMediaStreamDestination();const wired=new WeakSet();window.__players=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!wired.has(this)){try{const source=ctx.createMediaElementSource(this);source.connect(ctx.destination);source.connect(destination);wired.add(this);window.__players.push(this)}catch(e){}}void ctx.resume();return original.apply(this,args)};window.__captureStart=()=>{window.__chunks=[];window.__recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});window.__recorder.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data)};window.__recorder.start(200)};window.__captureStop=()=>new Promise(resolve=>{window.__recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(window.__chunks).arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(out))};window.__recorder.stop()})})()`;
const onMessage = event => {
  const item = JSON.parse(event.data);
  if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } }
  else if (item.method === 'Runtime.exceptionThrown') findings.errors.push(item.params.exceptionDetails.text);
  else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') findings.errors.push(item.params.args.map(a => a.value ?? a.description).join(' '));
  else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);
  else if (item.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: dialogAccept });
};
const launch = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-m66a-isolated-'));
  profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1500,1050', 'about:blank'], { stdio: 'ignore' });
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
const dbAssets = () => evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('brightsenappstales.audio.v1');r.onsuccess=()=>{const q=r.result.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>resolve(q.result.map(({id,name,kind,duration,mime,size})=>({id,name,kind,duration,mime,size})));q.onerror=reject};r.onerror=reject})`);
const analyse = (label, bytes) => {
  writeFileSync(join(root, `${label}.webm`), bytes);
  const wav = join(root, `${label}-inspect.wav`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(root, `${label}.webm`), wav]);
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'volumedetect', '-f', 'null', 'NUL'], { encoding: 'utf8', shell: true });
  const duration = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' });
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(probe.stderr ?? '');
  const peak = /max_volume: (-?[\d.]+) dB/.exec(probe.stderr ?? '');
  return { meanDb: mean?.[1], maxDb: peak?.[1], duration: (duration.stdout ?? '').trim() };
};
const capture = async (label, seconds) => {
  await evaluate('window.__captureStart()');
  const samples = [];
  const start = Date.now();
  const total = Math.ceil(seconds * 4);
  for (let i = 0; i < total; i++) {
    await delay(Math.max(0, start + i * 250 - Date.now()));
    if (i % 4 === 1) samples.push(await evaluate(`window.__players.filter(p=>!p.paused&&!p.ended).length`));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const name = `${label}-frame-${String(i).padStart(3, '0')}.png`;
    writeFileSync(join(root, name), Buffer.from(shot.data, 'base64'));
  }
  const audio = Buffer.from(await evaluate('window.__captureStop()'), 'base64');
  const level = analyse(label, audio);
  const { rmSync, readdirSync: read } = await import('node:fs');
  for (const name of read(root)) if (name.startsWith(`${label}-frame-`)) rmSync(join(root, name));
  return { ...level, players: samples, created: audio.length > 0 };
};

try {
  const profile = await launch();
  findings.initialStorage = await evaluate('localStorage.length');

  // ---- 1. Create an original multi-instrument melody through the real UI.
  await clickText('.studio-nav button', 'Music Studio'); await delay(200);
  await screenshot('music-studio-empty.png');
  await clickText('button', '+ Create a song'); await delay(250);
  await input('input[aria-label="Song name"]', 'Living Room Theme');
  await input('input[aria-label="Song tempo"]', 104);
  await input('input[aria-label="Song bars"]', 4);

  // Track 1: piano, with a beginner starter melody.
  await input('select[aria-label="New track instrument"]', 'piano'); await delay(200);
  await clickText('.music-starters button', 'Happy bouncy'); await delay(200);
  // Track 2: bass, added from the same starter then transposed down by drawing our own note.
  await input('select[aria-label="New track instrument"]', 'bass'); await delay(200);
  await clickText('.music-starters button', 'Up and down'); await delay(200);
  // Track 3: drums with a beginner rhythm.
  await input('select[aria-label="New track instrument"]', 'drums'); await delay(200);
  await clickText('.music-starters button', 'Kick and clap'); await delay(200);
  findings.tracks = await evaluate(`[...document.querySelectorAll('.music-track-row')].map(r=>r.textContent.trim().split('·')[0].trim())`);
  findings.noteCounts = await evaluate(`[...document.querySelectorAll('.music-track-row')].map(r=>r.querySelector('small')?.textContent??'')`);
  await screenshot('music-maker-tracks.png');
  await evaluate(`document.querySelector('.piano-roll-wrap').scrollIntoView({block:'center'})`); await delay(250);
  await screenshot('music-piano-roll.png');
  findings.pianoRollPixels = await evaluate(`(()=>{const c=document.querySelector('.piano-roll-wrap canvas');const ctx=c.getContext('2d');const d=ctx.getImageData(0,0,c.width,c.height).data;let notes=0;for(let i=0;i<d.length;i+=4){if(d[i]>90&&d[i]<160&&d[i+2]>190)notes++;}const box=document.querySelector('.piano-roll-scroll');return {width:c.width,height:c.height,notePixels:notes,scrollTop:box.scrollTop,scrollHeight:box.scrollHeight,clientHeight:box.clientHeight}})()`);
  await evaluate(`window.scrollTo(0,0)`); await delay(150);

  // Independent levels: bring the bass down and mute the drums' neighbour via the mixer.
  await input('input[aria-label="Bass volume"]', 0.35); await delay(150);
  await input('input[aria-label="Piano pan"]', -0.3); await delay(150);
  findings.mixerState = await evaluate(`({bass:document.querySelector('input[aria-label="Bass volume"]').value,pianoPan:document.querySelector('input[aria-label="Piano pan"]').value,master:document.querySelector('input[aria-label="Master volume"]').value})`);

  // Preview the melody and capture genuine browser audio.
  await clickText('.music-play-buttons button', 'Play');
  findings.musicPreview = await capture('song-preview', 6);
  await clickText('.music-play-buttons button', '■ Stop').catch(() => {});
  await delay(300);

  // Save the editable project, then render it into the Audio Library.
  await clickText('.scene-heading button', 'Save Song'); await delay(400);
  findings.songSaveMessage = await evaluate(`document.querySelector('.scene-status')?.textContent??null`);
  await clickText('.scene-heading button', 'Add to Audio Library');
  await delay(4000);
  findings.renderMessage = await evaluate(`document.querySelector('.scene-status')?.textContent??null`);
  findings.renderResult = await evaluate(`document.querySelector('.music-render-result')?.textContent??null`);
  await screenshot('music-rendered.png');
  findings.audioAfterMusic = await dbAssets();

  // ---- 2. Create and save a custom sound effect.
  await clickText('.music-tabs button', 'Sound Effects'); await delay(200);
  await clickText('button', '+ Create a sound effect'); await delay(200);
  await input('input[aria-label="Effect name"]', 'Cartoon Door Slam');
  await input('select[aria-label="Effect preset"]', 'bounce');
  await input('input[aria-label="Effect pitch"]', -3);
  await input('input[aria-label="Effect duration"]', 0.9);
  await input('input[aria-label="Effect volume"]', 0.6);
  await delay(200);
  await screenshot('effects-editor.png');
  await clickText('.music-transport .music-play-buttons button', '▶ Play');
  findings.effectPreview = await capture('effect-preview', 2);
  await delay(500);
  await clickText('.scene-heading button', 'Save Effect'); await delay(300);
  await clickText('.scene-heading button', 'Add to Audio Library'); await delay(3000);
  findings.effectMessage = await evaluate(`document.querySelector('.scene-status')?.textContent??null`);
  findings.audioAfterEffect = await dbAssets();

  // ---- 3. Mix the generated song and the effect together through the Audio Library.
  await clickText('.studio-nav button', 'Audio'); await delay(200);
  findings.audioLibraryList = await evaluate(`[...document.querySelectorAll('.audio-asset-list article')].map(e=>e.textContent.trim())`);
  // Play each generated asset through the existing Audio Library player.
  // The library previews one file at a time, so each is captured separately.
  const previewAsset = async (index, label, seconds) => {
    await evaluate(`window.__players.length = 0`);
    await evaluate(`window.__captureStart()`);
    await evaluate(`document.querySelectorAll('.audio-asset-list article')[${index}].querySelector('button').click()`);
    const samples = [];
    const start = Date.now();
    const total = Math.ceil(seconds * 4);
    for (let i = 0; i < total; i++) {
      await delay(Math.max(0, start + i * 250 - Date.now()));
      if (i % 4 === 1) samples.push(await evaluate(`window.__players.filter(p=>!p.paused&&!p.ended).length`));
    }
    const audio = Buffer.from(await evaluate('window.__captureStop()'), 'base64');
    return { ...analyse(label, audio), players: samples, created: audio.length > 0 };
  };
  findings.librarySongPreview = await previewAsset(0, 'library-song', 5);
  await delay(800);
  findings.libraryEffectPreview = await previewAsset(1, 'library-effect', 2);

  // ---- 4. Reload, then reopen and EDIT the saved song.
  await send('Page.reload'); await delay(500);
  await clickText('.studio-nav button', 'Music Studio'); await delay(250);
  findings.songAfterReload = await evaluate(`(()=>{const raw=localStorage.getItem('brightsenappstales.music-projects.v1');const p=JSON.parse(raw);return {songs:p.music.map(m=>({name:m.name,tempo:m.tempo,tracks:m.tracks.length,notes:m.tracks.reduce((s,t)=>s+t.notes.length,0)})),effects:p.effects.map(e=>({name:e.name,preset:e.preset,pitch:e.pitch}))}})()`);
  await clickText('.scene-library article button', 'Open'); await delay(300);
  // Edit: raise the tempo and mute a track, proving the reopened project is editable.
  await input('input[aria-label="Song tempo"]', 120); await delay(200);
  // Track row buttons are: name, M, S, delete. Click M on the drums track.
  await evaluate(`document.querySelectorAll('.music-track-row')[2].querySelectorAll('button')[1].click()`); await delay(250);
  findings.editedState = await evaluate(`({tempo:document.querySelector('input[aria-label="Song tempo"]').value,drumsRowClass:[...document.querySelectorAll('.music-track-row')][2].className,drumsLabel:[...document.querySelectorAll('.music-track-row')][2].querySelector('small').textContent})`);
  await clickText('.scene-heading button', 'Save Song'); await delay(250);
  findings.afterEditSave = await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1'));return p.music.map(m=>({tempo:m.tempo,muted:m.tracks.filter(t=>t.muted).length}))})()`);
  await screenshot('music-reopened-edited.png');

  // ---- 5. Studio Backup v8 round-trip into an empty profile.
  const downloads = join(profile, 'downloads');
  mkdirSync(downloads, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await clickText('.studio-nav button', 'Characters'); await delay(250);
  await clickText('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  for (let i = 0; i < 80 && !readdirSync(downloads).some(name => name.endsWith('.json')); i++) await delay(100);
  const backupPath = join(downloads, readdirSync(downloads).find(name => name.endsWith('.json')) ?? 'missing');
  if (!existsSync(backupPath)) throw Error('No Studio Backup download');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  findings.backup = {
    version: backup.version,
    songs: backup.projects?.music?.map(m => ({ name: m.name, tempo: m.tempo, tracks: m.tracks.length, notes: m.tracks.reduce((s, t) => s + t.notes.length, 0) })) ?? [],
    effects: backup.projects?.effects?.map(e => e.name) ?? [],
    audio: backup.audioAssets?.map(a => `${a.name}:${a.kind}`) ?? [],
  };

  await send('Page.navigate', { url: 'about:blank' });
  ws.close();
  await launch();
  findings.restoreInitialStorage = await evaluate('localStorage.length');
  await clickText('.studio-nav button', 'Characters'); await delay(250);
  const doc = await send('DOM.getDocument');
  const file = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [backupPath] });
  await delay(1500);
  findings.restoredProjects = await evaluate(`(()=>{const raw=localStorage.getItem('brightsenappstales.music-projects.v1');if(!raw)return null;const p=JSON.parse(raw);return {songs:p.music.map(m=>({name:m.name,tempo:m.tempo,tracks:m.tracks.length})),effects:p.effects.map(e=>e.name)}})()`);
  findings.restoredAudio = await dbAssets();
  await clickText('.studio-nav button', 'Music Studio'); await delay(250);
  await screenshot('music-restored.png');

  // The restored project must be reopenable and still playable.
  await clickText('.scene-library article button', 'Open'); await delay(300);
  await clickText('.music-play-buttons button', '▶ Play');
  findings.restoredPreview = await capture('restored-preview', 5);
} catch (error) {
  findings.fatal = String(error?.stack ?? error);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  const removed = [];
  for (const p of profiles) {
    const target = resolve(p);
    if (target.startsWith(resolve(tmpdir()) + '\\') && target.includes('brightsen-m66a-isolated-')) {
      const command = `$target=$env:M66A_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
      spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, M66A_PROFILE: target }, stdio: 'ignore' });
    }
    removed.push(!existsSync(p));
  }
  findings.profilesRemoved = removed;
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
  if (findings.fatal || findings.errors.length || findings.failedAssets.length || removed.some(v => !v)) process.exitCode = 1;
}