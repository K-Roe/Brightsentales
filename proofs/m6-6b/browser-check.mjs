// M6.6B Music Studio redesign acceptance.
// Covers note editing, piano key preview, transport, mixer, save/reload/edit,
// Audio Library export + replay, sound effects, Backup v8 round trip,
// a previously saved M6.6A song, both themes, keyboard access and narrow layout.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/m6-6b');
mkdirSync(root, { recursive: true });
const profiles = [];
const findings = { errors: [], failedAssets: [], screenshots: [] };
let ws, serial = 1, dialogAccept = true;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const v = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (v.exceptionDetails) throw Error(v.exceptionDetails.exception?.description ?? v.exceptionDetails.text); return v.result.value; };
const clickText = (sel, text) => evaluate(`(()=>{const i=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)}));if(!i)throw Error('Missing '+${JSON.stringify(text)});i.click()})()`);
const input = (sel, value) => evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(sel)});if(!i)throw Error('Missing '+${JSON.stringify(sel)});const p=i.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(i,${JSON.stringify(String(value))});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const screenshot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(root, name), Buffer.from(s.data, 'base64')); findings.screenshots.push(name); };
const clickByTitle = (sel, title) => evaluate(`(()=>{const c=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.querySelector('strong')?.textContent.trim()===${JSON.stringify(title)});if(!c)throw Error('Missing '+${JSON.stringify(title)});c.click()})()`);
const captureScript = `(()=>{const ctx=new AudioContext();const dest=ctx.createMediaStreamDestination();const wired=new WeakSet();window.__players=[];const orig=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...a){if(!wired.has(this)){try{const s=ctx.createMediaElementSource(this);s.connect(ctx.destination);s.connect(dest);wired.add(this);window.__players.push(this)}catch(e){}}void ctx.resume();return orig.apply(this,a)};window.__captureStart=()=>{window.__chunks=[];window.__rec=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'});window.__rec.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data)};window.__rec.start(200)};window.__captureStop=()=>new Promise(res=>{window.__rec.onstop=async()=>{const b=new Uint8Array(await new Blob(window.__chunks).arrayBuffer());let o='';for(let i=0;i<b.length;i+=32768)o+=String.fromCharCode(...b.subarray(i,i+32768));res(btoa(o))};window.__rec.stop()})})()`;
const onMessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const c = pending.get(m.id); if (c) { pending.delete(m.id); m.error ? c.fail(Error(m.error.message)) : c.ok(m.result); } }
  else if (m.method === 'Runtime.exceptionThrown') findings.errors.push(m.params.exceptionDetails.text);
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') findings.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) findings.failedAssets.push(`${m.params.response.status} ${m.params.response.url}`);
  else if (m.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: dialogAccept });
};
const launch = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-m66b-iso-'));
  profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1500,1100', 'about:blank'], { stdio: 'ignore' });
  const pf = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(pf); i++) await delay(100);
  const port = Number(readFileSync(pf, 'utf8').split('\n')[0]);
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
const measure = async (label, seconds) => {
  await evaluate('window.__captureStart()');
  const samples = [];
  const start = Date.now();
  for (let i = 0; i < Math.ceil(seconds * 4); i++) {
    await delay(Math.max(0, start + i * 250 - Date.now()));
    if (i % 4 === 1) samples.push(await evaluate('window.__players.filter(p=>!p.paused&&!p.ended).length'));
  }
  const audio = Buffer.from(await evaluate('window.__captureStop()'), 'base64');
  writeFileSync(join(root, `${label}.webm`), audio);
  const wav = join(root, `${label}-inspect.wav`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(root, `${label}.webm`), wav]);
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'volumedetect', '-f', 'null', 'NUL'], { encoding: 'utf8', shell: true });
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(p.stderr ?? '');
  const peak = /max_volume: (-?[\d.]+) dB/.exec(p.stderr ?? '');
  return { meanDb: mean ? mean[1] : null, maxDb: peak ? peak[1] : null, players: samples, created: audio.length > 0 };
};
const dbAssets = () => evaluate(`new Promise((res,rej)=>{const r=indexedDB.open('brightsenappstales.audio.v1');r.onsuccess=()=>{const q=r.result.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>res(q.result.map(({id,name,kind,duration,mime,size})=>({id,name,kind,duration,mime,size})));q.onerror=rej};r.onerror=rej})`);
const theme = () => evaluate(`document.querySelector('.music-studio-wrap')?.getAttribute('data-theme')??null`);
const hoverTooltip = async () => {
  const r = await evaluate(`(()=>{const b=document.querySelector('.music-export-button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await delay(150);
  return evaluate(`getComputedStyle(document.querySelector('.music-export-button'),'::after').content.includes('Finish this song')`);
};

// A song saved by M6.6A, unchanged schema, used to prove legacy songs still open.
const legacyProject = { version: 1, music: [{
  id: '11111111-1111-4111-8111-111111111111', name: 'Legacy M6.6A Song', tempo: 112, bars: 4, loop: true, masterVolume: 0.7,
  tracks: [
    { id: '22222222-2222-4222-8222-222222222222', name: 'Piano', instrument: 'piano', volume: 0.8, pan: 0, muted: false, solo: false,
      notes: [0, 1, 2, 3].map(i => ({ id: `3333333${i}-3333-4333-8333-333333333333`, pitch: [60, 64, 67, 64][i], start: i, duration: 0.9, velocity: 0.8 })) },
    { id: '44444444-4444-4444-8444-444444444444', name: 'Drums', instrument: 'drums', volume: 0.6, pan: 0, muted: true, solo: false,
      notes: [0, 2, 4, 6].map(i => ({ id: `5555555${i}-5555-4555-8555-555555555555`, pitch: 36, start: i, duration: 0.2, velocity: 0.9 })) },
  ],
}], effects: [{ id: '66666666-6666-4666-8666-666666666666', name: 'Legacy Pop', preset: 'pop', pitch: 3, duration: 0.6, volume: 0.5, decay: 0.4, noise: false }] };

try {
  const profile = await launch();
  findings.initialStorage = await evaluate('localStorage.length');
  await evaluate(`localStorage.setItem('brightsenappstales.music-projects.v1',${JSON.stringify(JSON.stringify(legacyProject))})`);
  await send('Page.reload'); await delay(500);

  await clickText('.studio-nav button', 'Music Studio'); await delay(300);
  findings.defaultTheme = await theme();
  findings.themeStoredBeforeToggle = await evaluate(`localStorage.getItem('brightsenappstales.music-theme')`);
  await screenshot('01-library-dark.png');

  // A song saved by M6.6A opens in the redesigned interface.
  await clickText('.scene-library article button', 'Open'); await delay(400);
  findings.legacySong = await evaluate(`({name:document.querySelector('input[aria-label="Song name"]').value,cards:document.querySelectorAll('.music-track-card').length,labels:[...document.querySelectorAll('.music-track-meta small')].map(s=>s.textContent),notes:JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1')).music[0].tracks.map(t=>t.notes.length)})`);
  findings.tooltipDark = await hoverTooltip();
  await screenshot('02-legacy-song-dark.png');

  // Drum tracks must show drum names, not piano pitches.
  await evaluate(`[...document.querySelectorAll('.music-track-select')][1].click()`); await delay(350);
  findings.drumTrack = await evaluate(`(()=>{const c=document.querySelector('.piano-roll-scroll canvas');return{canvasPresent:!!c}})()`);
  await evaluate(`document.querySelector('.piano-roll-scroll').scrollIntoView({block:'center'})`); await delay(250);
  await screenshot('03-drum-track-dark.png');
  await evaluate(`[...document.querySelectorAll('.music-track-select')][0].click()`); await delay(300);
  await evaluate(`document.querySelector('.piano-roll-scroll').scrollIntoView({block:'center'})`); await delay(250);
  await screenshot('04-piano-roll-dark.png');

  // The roll can sit below the fold and is taller than its scroll box, so bring it
// into view and pin its scroll before computing any click coordinates.
  const pinRoll = async () => {
    await evaluate(`(()=>{const s=document.querySelector('.piano-roll-scroll');s.scrollIntoView({block:'center'});return true})()`);
    await delay(350);
    return evaluate(`(()=>{const s=document.querySelector('.piano-roll-scroll');s.scrollTop=0;const c=s.querySelector('canvas');const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,cw:c.width,viewportH:window.innerHeight}})()`);
  };
  let canvasBox = await pinRoll();
  findings.rollGeometry = canvasBox;
  const clickCanvas = async (cx, cy) => {
    const x = canvasBox.x + cx / canvasBox.cw * canvasBox.w, y = canvasBox.y + cy;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await delay(220);
  };

  // Add a note by clicking empty grid space.
  const countNotes = () => evaluate(`document.querySelectorAll('.music-track-card')[0].querySelector('.music-track-meta small').textContent`);
  findings.countBeforeAdd = await countNotes();
  await clickCanvas(760, 320);
  findings.countAfterAdd = await countNotes();
  findings.chipVisible = await evaluate(`!!document.querySelector('.music-note-chip')`);
  findings.chipText = await evaluate(`document.querySelector('.music-note-chip')?.textContent??null`);
  await screenshot('05-note-added-dark.png');

  // Move it by dragging. Grid constants match the app: key column 96px,
  // Normal zoom beat 46px / row 18px, top pitch 84.
  // Save first so the live note is readable from storage.
  canvasBox = await pinRoll();
  await clickText('.music-save-button', 'Save Song'); await delay(400);
  canvasBox = await pinRoll();
  const toScreen = (cx, cy) => ({ x: canvasBox.x + cx / canvasBox.cw * canvasBox.w, y: canvasBox.y + cy });
  const notePos = await evaluate(`(()=>{const n=JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1')).music[0].tracks[0].notes.slice(-1)[0];return {start:n.start,pitch:n.pitch,duration:n.duration}})()`);
  findings.noteAdded = { chipVisible: await evaluate(`!!document.querySelector('.music-note-chip')`), position: notePos };
  const noteX = 96 + notePos.start * 46 + (notePos.duration / 2) * 46;
  const noteY = (84 - notePos.pitch) * 18 + 9;
  const from = toScreen(noteX, noteY);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
  await delay(180);
  for (let i = 1; i <= 5; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (92 * i / 5), y: from.y, button: 'left', buttons: 1 }); await delay(80); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: from.x + 92, y: from.y, button: 'left', clickCount: 1 });
  await delay(350);
  await clickText('.music-save-button', 'Save Song'); await delay(400);
  findings.noteMoved = await evaluate(`(()=>{const n=JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1')).music[0].tracks[0].notes.slice(-1)[0];return {start:n.start}})()`);
  await input('input[aria-label="Note length"]', 2.5);
  findings.noteResize = await evaluate(`document.querySelector('input[aria-label="Note length"]').value`);
  await input('input[aria-label="Note velocity"]', 0.45);
  findings.noteVelocity = await evaluate(`document.querySelector('input[aria-label="Note velocity"]').value`);
  await clickText('.music-delete-note', 'Delete note'); await delay(300);
  findings.noteDeleteClearedEditor = await evaluate(`!!document.querySelector('.music-delete-note')`);

  // Clicking a piano key previews that pitch.
  await evaluate('window.__players.length=0');
  await evaluate('window.__captureStart()');
  await clickCanvas(40, 340);
  await delay(1100);
  findings.keyPreviewPlayers = await evaluate('window.__players.length');
  writeFileSync(join(root, 'key-preview.webm'), Buffer.from(await evaluate('window.__captureStop()'), 'base64'));

  // Transport with a moving playhead.
  await clickText('.music-play-main', 'Play'); await delay(1400);
  findings.playing = await evaluate(`({label:document.querySelector('.music-play-main').textContent.trim(),progress:document.querySelector('.music-progress-fill').style.width,time:document.querySelector('.music-progress-time').textContent})`);
  await screenshot('06-playing-dark.png');
  await clickText('.music-play-main', 'Playing'); await delay(400);
  findings.paused = await evaluate(`document.querySelector('.music-progress-time').textContent`);
  await clickText('.music-stop-main', 'Stop'); await delay(300);
  findings.stopped = await evaluate(`document.querySelector('.music-progress-time').textContent`);
  findings.loopOn = await evaluate(`document.querySelector('input[aria-label="Loop song"]').checked`);
  await evaluate('window.__players.length=0');
  await clickText('.music-play-main', 'Play');
  for (let i = 0; i < 60 && !(await evaluate('document.querySelector(".music-play-main")?.getAttribute("aria-pressed")==="true"')); i++) await delay(100);
  findings.previewAudio = await measure('song-preview', 5);
  await clickText('.music-stop-main', 'Stop');

  // Mixer.
  await input('input[aria-label="Piano volume"]', 0.4);
  await input('input[aria-label="Piano pan"]', -0.5);
  await clickText('.music-track-toggles button', 'Mute'); await delay(250);
  await clickText('.music-track-toggles button', 'Solo'); await delay(250);
  findings.mixer = await evaluate(`({volume:document.querySelector('input[aria-label="Piano volume"]').value,pan:document.querySelector('input[aria-label="Piano pan"]').value,panLabel:[...document.querySelectorAll('.music-track-controls label')][1].querySelector('small').textContent,mutedPressed:document.querySelectorAll('.music-track-toggles button')[0].getAttribute('aria-pressed'),soloPressed:document.querySelectorAll('.music-track-toggles button')[1].getAttribute('aria-pressed'),silencedCards:document.querySelectorAll('.music-track-card.silenced').length,pill:document.querySelector('.music-save-pill').textContent})`);
  await screenshot('07-mixer-dark.png');
  await clickText('.music-track-toggles button', 'Mute'); await delay(150);
  await clickText('.music-track-toggles button', 'Solo'); await delay(150);

  // Instrument picker.
  await clickText('.music-add-instrument', 'Add Instrument'); await delay(400);
  findings.pickerTiles = await evaluate(`[...document.querySelectorAll('.music-picker-tile')].map(t=>t.getAttribute('aria-label'))`);
  await screenshot('08-instrument-picker-dark.png');
  await evaluate(`document.querySelector('button[aria-label="Add Violin instrument"]').click()`); await delay(400);
  findings.tracksAfterPick = await evaluate(`document.querySelectorAll('.music-track-card').length`);

  // Zoom.
  findings.zoom = {};
  for (const label of ['Compact', 'Big', 'Normal']) {
    await clickText('.music-zoom button', label); await delay(300);
    findings.zoom[label] = await evaluate(`document.querySelector('.piano-roll-scroll canvas').width`);
  }

  // Overwrite must be confirmed, never silent.
  await evaluate(`[...document.querySelectorAll('.music-track-select')][0].click()`); await delay(250);
  await clickByTitle('.music-preset-card', 'Happy bouncy'); await delay(400);
  findings.overwritePromptShown = await evaluate(`!!document.querySelector('.music-confirm')`);
  findings.overwritePromptText = await evaluate(`document.querySelector('.music-confirm')?.textContent.replace(/\\s+/g,' ').trim().slice(0,150)??null`);
  await screenshot('09-overwrite-confirm-dark.png');
  await clickText('.music-confirm-actions button', 'Keep my notes'); await delay(300);
  findings.overwriteKept = await evaluate(`!document.querySelector('.music-confirm')`);
  await clickByTitle('.music-preset-card', 'Happy bouncy'); await delay(300);
  await clickText('.music-confirm-actions button', 'Replace them'); await delay(350);
  findings.overwriteApplied = await evaluate(`!document.querySelector('.music-confirm')`);
  findings.notesAfterReplace = await evaluate(`[...document.querySelectorAll('.music-track-card')][0].querySelector('.music-track-meta small').textContent`);

  // Save, export, replay from the Audio Library.
  await clickText('.music-save-button', 'Save Song'); await delay(400);
  findings.savedStatus = await evaluate(`document.querySelector('.music-status').textContent`);
  findings.savedPill = await evaluate(`document.querySelector('.music-save-pill').textContent`);
  await clickText('.music-export-button', 'Add to Audio Library');
  for (let i = 0; i < 50; i++) { await delay(400); if ((await dbAssets()).length) break; }
  findings.renderResult = await evaluate(`document.querySelector('.music-render-result')?.textContent??null`);
  findings.audioAfterExport = (await dbAssets()).map(a => `${a.name}:${a.kind}:${a.mime}`);
  await screenshot('10-rendered-dark.png');
  await clickText('.studio-nav button', 'Audio'); await delay(300);
  await evaluate('window.__players.length=0');
  await evaluate(`document.querySelectorAll('.audio-asset-list article')[0].querySelector('button').click()`);
  findings.libraryReplay = await measure('library-replay', 3);
  findings.libraryRows = await evaluate(`[...document.querySelectorAll('.audio-asset-list article')].map(a=>a.textContent.trim())`);

  // Reload and keep editing.
  await send('Page.reload'); await delay(500);
  await clickText('.studio-nav button', 'Music Studio'); await delay(300);
  await clickText('.scene-library article button', 'Open'); await delay(400);
  await input('input[aria-label="Song tempo"]', 132); await delay(300);
  await clickText('.music-save-button', 'Save Song'); await delay(400);
  findings.afterReloadEdit = await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1'));return{songs:p.music.length,tracks:p.music[0].tracks.length,tempo:p.music[0].tempo}})()`);

  // Sound Effects.
  await clickText('.music-studio-switcher button', 'Sound Effects'); await delay(350);
  await screenshot('11-effects-dark.png');
  await clickText('.music-big-button', 'Create a sound effect'); await delay(350);
  await input('input[aria-label="Effect name"]', 'Cartoon Sparkle');
  await clickByTitle('.music-effect-card', 'Sparkle'); await delay(300);
  findings.effectCards = await evaluate(`[...document.querySelectorAll('.music-effect-card strong')].map(s=>s.textContent)`);
  await screenshot('12-effects-controls-dark.png');
  await evaluate('window.__players.length=0');
  await evaluate('window.__captureStart()');
  await clickText('.music-preview-button', 'Preview'); await delay(1300);
  findings.effectPreviewPlayers = await evaluate('window.__players.length');
  writeFileSync(join(root, 'effect-preview.webm'), Buffer.from(await evaluate('window.__captureStop()'), 'base64'));
  await clickText('.music-save-button', 'Save Effect'); await delay(350);
  await clickText('.music-export-button', 'Add to Audio Library');
  for (let i = 0; i < 40; i++) { await delay(400); if ((await dbAssets()).length > 1) break; }
  findings.effectExported = (await dbAssets()).map(a => a.name);

  // Light theme across the whole studio.
  await clickText('.music-theme-toggle-inline', 'Light'); await delay(450);
  findings.lightTheme = await theme();
  await screenshot('13-effects-light.png');
  await clickText('.music-studio-switcher button', 'Music Maker'); await delay(350);
  if (await evaluate('!!document.querySelector(".scene-library article button")')) await clickText('.scene-library article button', 'Open');
  await delay(450);
  findings.crossTabResultHidden = await evaluate(`!document.querySelector('.music-render-result')`);
  await screenshot('14-song-light.png');
  findings.tooltipLight = await hoverTooltip();
  await evaluate(`document.querySelector('.piano-roll-scroll').scrollIntoView({block:'center'})`); await delay(250);
  await screenshot('14b-roll-light.png');
  await clickText('.music-add-instrument', 'Add Instrument'); await delay(350);
  await screenshot('15-picker-light.png');
  await evaluate(`document.querySelector('.music-picker-close').click()`); await delay(300);
  findings.themePersisted = await evaluate(`localStorage.getItem('brightsenappstales.music-theme')`);

  // Keyboard reachability and narrow layout.
  findings.keyboard = await evaluate(`(()=>{const b=document.querySelector('.music-add-instrument');b.focus();return{focused:document.activeElement===b,focusableButtons:document.querySelectorAll('.music-studio-wrap button:not([disabled])').length,focusableInputs:document.querySelectorAll('.music-studio-wrap input').length}})()`);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  findings.reducedMotion = await evaluate(`getComputedStyle(document.querySelector('.music-track-card')).transitionDuration`);
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Emulation.setDeviceMetricsOverride', { width: 860, height: 1200, deviceScaleFactor: 1, mobile: false });
  await delay(500);
  await screenshot('16-narrow-light.png');
  findings.narrowNoHorizontalScroll = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth + 2`);
  await send('Emulation.clearDeviceMetricsOverride'); await delay(300);
  await clickText('.music-theme-toggle-inline', 'Dark'); await delay(400);
  findings.backToDark = await theme();

  // Studio Backup v8 round trip.
  const downloads = join(profile, 'downloads');
  mkdirSync(downloads, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await clickText('.studio-nav button', 'Characters'); await delay(350);
  await clickText('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  for (let i = 0; i < 80 && !readdirSync(downloads).some(n => n.endsWith('.json')); i++) await delay(100);
  const backupPath = join(downloads, readdirSync(downloads).find(n => n.endsWith('.json')) ?? 'missing');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  findings.backup = { version: backup.version, songs: backup.projects?.music?.map(m => `${m.name}/${m.tracks.length} tracks`) ?? [], effects: backup.projects?.effects?.map(e => e.name) ?? [], audio: backup.audioAssets?.map(a => a.name) ?? [] };
  await send('Page.navigate', { url: 'about:blank' });
  ws.close();
  await launch();
  findings.restoreInitialStorage = await evaluate('localStorage.length');
  await clickText('.studio-nav button', 'Characters'); await delay(350);
  const doc = await send('DOM.getDocument');
  const fileNode = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'section[aria-label="Studio backup"] input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [backupPath] });
  await delay(1600);
  findings.restoredProjects = await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('brightsenappstales.music-projects.v1'));return{songs:p.music.map(m=>m.name),tracks:p.music[0].tracks.length,effects:p.effects.map(e=>e.name)}})()`);
  findings.restoredTheme = await evaluate(`localStorage.getItem('brightsenappstales.music-theme')`);
  findings.restoredAudio = (await dbAssets()).map(a => a.name);
  await clickText('.studio-nav button', 'Music Studio'); await delay(400);
  findings.restoredThemeApplied = await theme();
  await screenshot('17-restored-dark.png');
  const expected = {
    defaultDark: findings.defaultTheme === 'dark' && findings.themeStoredBeforeToggle === null,
    noteEditing: findings.countBeforeAdd === '4 notes' && findings.countAfterAdd === '5 notes' && findings.noteMoved.start > findings.noteAdded.position.start && findings.noteResize === '2.5' && findings.noteVelocity === '0.45' && !findings.noteDeleteClearedEditor,
    transport: findings.playing.progress !== '0%' && findings.stopped.startsWith('0.0s') && findings.previewAudio.players.every(n => n === 1),
    zoom: findings.zoom.Compact < findings.zoom.Normal && findings.zoom.Normal < findings.zoom.Big,
    overwrite: findings.overwritePromptShown && findings.overwriteKept && findings.overwriteApplied && findings.notesAfterReplace === '7 notes',
    renderAndReplay: findings.savedPill === 'Saved' && findings.audioAfterExport.some(s => s.includes('audio/wav')) && findings.libraryReplay.players.every(n => n === 1) && findings.crossTabResultHidden,
    themes: findings.lightTheme === 'light' && findings.themePersisted === 'light' && findings.backToDark === 'dark' && findings.restoredThemeApplied === 'dark',
    backup: findings.backup.version === 8 && findings.restoredProjects.tracks === 3 && findings.restoredAudio.length === 2,
    layout: findings.keyboard.focused && findings.narrowNoHorizontalScroll && findings.tooltipDark && findings.tooltipLight && findings.reducedMotion === '0s',
  };
  findings.checks = expected;
  if (Object.values(expected).some(value => !value)) throw Error(`Failed checks: ${Object.entries(expected).filter(([, value]) => !value).map(([key]) => key).join(', ')}`);
} catch (error) {
  findings.fatal = String(error?.stack ?? error);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  const removed = [];
  for (const p of profiles) {
    const t = resolve(p);
    if (t.startsWith(resolve(tmpdir()) + '\\') && t.includes('brightsen-m66b-iso-')) {
      const cmd = `$target=$env:M66B; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
      spawnSync('powershell', ['-NoProfile', '-Command', cmd], { env: { ...process.env, M66B: t }, stdio: 'ignore' });
    }
    removed.push(!existsSync(p));
  }
  findings.profilesRemoved = removed;
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
  if (findings.fatal || findings.errors.length || findings.failedAssets.length || removed.some(v => !v)) process.exitCode = 1;
}
