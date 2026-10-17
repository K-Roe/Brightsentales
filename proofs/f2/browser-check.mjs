// F2 codec acceptance. Self-created tones and disposable browser profiles only.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/f2'); mkdirSync(root, { recursive: true });
const profiles = [];
const errors = [], failedAssets = [], findings = { errors, failedAssets, screenshots: [] };
let ws, serial = 1, dialogDecision = true;
const pending = new Map();
const specifications = [
  { name: 'mp3-music.mp3', codec: 'libmp3lame', frequency: 220, seconds: 33, channels: 2, kind: 'music' },
  { name: 'mp3-effect.mp3', codec: 'libmp3lame', frequency: 880, seconds: 2, channels: 1, kind: 'effect' },
  { name: 'vorbis-music.ogg', codec: 'libvorbis', frequency: 440, seconds: 6, channels: 2, kind: 'music' },
  { name: 'vorbis-effect.ogg', codec: 'libvorbis', frequency: 660, seconds: 2, channels: 1, kind: 'effect' },
  { name: 'opus-effect.ogg', codec: 'libopus', frequency: 990, seconds: 2, channels: 1, kind: 'effect' },
];
const files = new Map();
const fixture = (directory, item) => {
  const path = join(directory, item.name);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${item.frequency}:duration=${item.seconds}`, '-ac', String(item.channels), '-c:a', item.codec, '-b:a', item.channels === 2 ? '96k' : '64k', path], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(`Could not create ${item.name}: ${result.stderr}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate', '-show_entries', 'format=format_name,duration,size', '-of', 'json', path], { encoding: 'utf8' });
  if (probe.status !== 0) throw Error(`Could not inspect ${item.name}: ${probe.stderr}`);
  files.set(item.name, path);
  return { name: item.name, kind: item.kind, frequency: item.frequency, ...JSON.parse(probe.stdout), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
};
const captureScript = `(() => {
  const ctx = new AudioContext(); const output = ctx.createMediaStreamDestination(); const wired = new WeakSet();
  window.__players = [];
  const original = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    if (!wired.has(this)) { const source = ctx.createMediaElementSource(this); source.connect(ctx.destination); source.connect(output); wired.add(this); window.__players.push(this); }
    void ctx.resume(); return original.apply(this, args);
  };
  window.__audioCaptureStart = () => { window.__audioChunks = []; window.__audioRecorder = new MediaRecorder(output.stream, { mimeType: 'audio/webm;codecs=opus' }); window.__audioRecorder.ondataavailable = e => { if (e.data.size) window.__audioChunks.push(e.data); }; window.__audioRecorder.start(200); };
  window.__audioCaptureStop = () => new Promise(resolve => { window.__audioRecorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(window.__audioChunks).arrayBuffer()); let binary=''; for(let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768)); resolve(btoa(binary)); }; window.__audioRecorder.stop(); });
})()`;
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(join(root, name), Buffer.from(result.data, 'base64')); findings.screenshots.push(name); };
const click = (selector) => evalJs(`(() => {const item=document.querySelector(${JSON.stringify(selector)}); if(!item) throw Error('Missing ${selector}'); item.click();})()`);
const clickText = (selector, text) => evalJs(`(() => {const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)})); if(!item) throw Error('Missing ${text}'); item.click();})()`);
const input = (selector, value) => evalJs(`(() => {const item=document.querySelector(${JSON.stringify(selector)}); if(!item) throw Error('Missing input ${selector}'); const type=item.tagName==='SELECT'?'value':item.type==='range'?'value':'value'; const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,type).set.call(item,${JSON.stringify(String(value))}); item.dispatchEvent(new Event('input',{bubbles:true})); item.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const action = (n, characterId, type, start, duration, point) => ({ id: id(n), characterId, type, start, duration, ...(point ? { point } : {}) });
const scenes = { version: 1, scenes: [
  { id: id(1), name: 'Max Arrives', duration: 10, placeId: 'living-room', characters: { max: { x: 300, y: 790 } }, actions: [action(11, 'max', 'appear', 0, 0, { x: 300, y: 790 }), action(12, 'max', 'walk', 0, 6, { x: 900, y: 790 })] },
  { id: id(2), name: 'Maxine Joins', duration: 15, placeId: 'living-room', characters: { maxine: { x: 1100, y: 790 } }, actions: [action(21, 'maxine', 'appear', 0, 0, { x: 1100, y: 790 }), action(22, 'maxine', 'walk', 1, 5, { x: 720, y: 790 }), action(23, 'maxine', 'wave', 7, 3)] },
  { id: id(3), name: 'Goodbye', duration: 8, placeId: 'living-room', characters: { max: { x: 300, y: 790 }, maxine: { x: 1100, y: 790 } }, actions: [action(31, 'max', 'appear', 0, 0, { x: 300, y: 790 }), action(32, 'maxine', 'appear', 0, 0, { x: 1100, y: 790 }), action(33, 'max', 'walk', 0, 7, { x: 1820, y: 790 }), action(34, 'maxine', 'walk', 0, 7, { x: 1820, y: 820 })] },
] };
const episodes = { version: 1, episodes: [{ id: id(4), name: 'Our First Episode', sceneIds: scenes.scenes.map(scene => scene.id) }] };
const onMessage = event => { const item = JSON.parse(event.data); if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } } else if (item.method === 'Runtime.exceptionThrown') errors.push(item.params.exceptionDetails.text); else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') errors.push(item.params.args.map(arg => arg.value ?? arg.description).join(' ')); else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) failedAssets.push(`${item.params.response.status} ${item.params.response.url}`); else if (item.method === 'Page.javascriptDialogOpening') { findings.deletionWarning = item.params.message; void send('Page.handleJavaScriptDialog', { accept: dialogDecision }); } };
const launch = async () => {
  const profile = mkdtempSync(join(tmpdir(), 'brightsen-f2-isolated-')); profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort'); for (let i=0;i<100&&!existsSync(portFile);i++) await delay(100);
  if (!existsSync(portFile)) throw Error('Isolated Chrome failed to start');
  const port=Number(readFileSync(portFile,'utf8').split('\n')[0]); const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ ws.addEventListener('open',ok,{once:true}); ws.addEventListener('error',fail,{once:true}); });
  ws.addEventListener('message',onMessage); await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:captureScript});
  await send('Page.navigate',{url:'http://127.0.0.1:4177/'});
  for(let i=0;i<30&&!(await evalJs(`!!document.querySelector('.studio-nav')`));i++) await delay(200);
  return profile;
};
const setFile = async path => { const doc=await send('DOM.getDocument'); const file=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[aria-label="Import audio file"]'}); await send('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[path]}); await delay(500); };
const openScene = async index => { await clickText('.studio-nav button','Scenes'); await delay(100); await evalJs(`document.querySelectorAll('.scene-library article')[${index}].querySelector('button').click()`); await delay(150); };
const sceneBack = async () => { await clickText('.scene-heading button','Save Scene'); await delay(80); await clickText('.scene-heading button','All scenes'); await delay(80); };
const openAdvanced=async()=>{if(!(await evalJs(`document.querySelector('.audio-inspector details')?.open`)))await click('details summary');};

try {
  const firstProfile=await launch(); findings.initialStorage=await evalJs('localStorage.length');
  findings.browser=await send('Browser.getVersion');
  findings.browserDecodeSupport=await evalJs(`({mp3:document.createElement('audio').canPlayType('audio/mpeg'),vorbis:document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'),opus:document.createElement('audio').canPlayType('audio/ogg; codecs="opus"')})`);
  findings.fixtures=specifications.map(item=>fixture(firstProfile,item));
  await evalJs(`localStorage.setItem('brightsenappstales.timed-scenes.v1',${JSON.stringify(JSON.stringify(scenes))});localStorage.setItem('brightsenappstales.episodes.v1',${JSON.stringify(JSON.stringify(episodes))})`);
  await send('Page.reload'); await delay(300); await clickText('.studio-nav button','Audio'); await delay(150);
  findings.importResults=[];
  for(const item of specifications){
    await input('select[aria-label="Imported audio type"]',item.kind);
    await setFile(files.get(item.name));
    const result=await evalJs(`({count:document.querySelectorAll('.audio-asset-list article').length,status:document.querySelector('.audio-library-page [role=status]')?.textContent})`);
    findings.importResults.push({name:item.name,...result});
    if(result.count!==findings.importResults.length)throw Error(`Import failed for ${item.name}: ${result.status}`);
  }
  findings.imported=await evalJs(`[...document.querySelectorAll('.audio-asset-list strong')].map(e=>e.textContent)`);
  await screenshot('audio-library-desktop.png');
  await evalJs('window.__audioCaptureStart()'); findings.previews=[];
  for(let i=0;i<specifications.length;i++){
    await evalJs(`document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('button').click()`);await delay(350);
    findings.previews.push(await evalJs(`({name:document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('strong').textContent,button:document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('button').textContent,position:window.__players.at(-1)?.currentTime,paused:window.__players.at(-1)?.paused})`));
    await evalJs(`document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('button').click()`);
  }
  const previewAudio=await evalJs('window.__audioCaptureStop()');writeFileSync(join(root,'preview-audio.webm'),Buffer.from(previewAudio,'base64'));
  writeFileSync(join(firstProfile,'corrupt.mp3'),'This is not an MP3 audio stream.');
  await setFile(join(firstProfile,'corrupt.mp3'));findings.corruptImport=await evalJs(`({count:document.querySelectorAll('.audio-asset-list article').length,status:document.querySelector('.audio-library-page [role=status]')?.textContent})`);
  writeFileSync(join(firstProfile,'unsupported.flac'),'This is not a supported audio stream.');
  await setFile(join(firstProfile,'unsupported.flac'));findings.unsupportedImport=await evalJs(`({count:document.querySelectorAll('.audio-asset-list article').length,status:document.querySelector('.audio-library-page [role=status]')?.textContent})`);
  await send('Page.reload');await delay(350);await clickText('.studio-nav button','Audio');await delay(150);
  findings.afterReload=await evalJs(`[...document.querySelectorAll('.audio-asset-list strong')].map(e=>e.textContent)`);
  const assets=await evalJs(`new Promise((resolve,reject)=>{const r=indexedDB.open('brightsenappstales.audio.v1');r.onsuccess=()=>{const q=r.result.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>resolve(q.result.map(({id,name,duration,kind,mime,size,blob})=>({id,name,duration,kind,mime,size,blobType:blob.type,blobSize:blob.size})));q.onerror=reject;};r.onerror=reject;})`);
  findings.indexedDbAssets=assets;
  const assetId=name=>assets.find(item=>item.name===name)?.id;
  await openScene(0);
  await input('select[aria-label="Scene audio asset"]',assetId('mp3-effect.mp3'));
  await clickText('.audio-add button','Add Sound Effect'); await delay(80);
  await input('input[aria-label="Audio clip start"]',2);await input('input[aria-label="Audio clip volume"]',.5);await openAdvanced();await input('input[aria-label="Audio trim start"]',.2);
  await evalJs(`document.querySelector('.audio-panel').scrollIntoView({block:'start'})`); await screenshot('scene-audio-timeline.png');
  await clickText('.scene-playback button','Play');await delay(2450);
  findings.scenePlay=await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,players:window.__players.filter(item=>!item.paused&&!item.ended).length})`);
  await clickText('.scene-playback button','Pause');findings.scenePause=await evalJs(`document.querySelector('.scene-playback strong').textContent`);
  await evalJs(`document.querySelector('.scene-timeline').scrollIntoView({block:'center'})`);
  const ruler=await evalJs(`(() => {const bounds=document.querySelector('.timeline-ruler').getBoundingClientRect();return {x:bounds.left+116+5*24,y:bounds.top+15}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:ruler.x,y:ruler.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:ruler.x,y:ruler.y,button:'left',clickCount:1});
  findings.sceneSeek=await evalJs(`document.querySelector('.scene-playback strong').textContent`);
  await clickText('.scene-playback button','Play');await delay(350);findings.sceneResume=await evalJs(`document.querySelector('.scene-playback strong').textContent`);
  await clickText('.scene-playback button','Pause');await sceneBack();
  await openScene(1);
  await input('select[aria-label="Scene audio asset"]',assetId('vorbis-effect.ogg'));
  await clickText('.audio-add button','Add Sound Effect'); await delay(80); await input('input[aria-label="Audio clip start"]',4);await openAdvanced();await input('input[aria-label="Audio trim start"]',.2);
  await input('select[aria-label="Scene audio asset"]',assetId('vorbis-music.ogg'));
  await clickText('.audio-add button','Add Music'); await delay(80);await openAdvanced();await input('input[aria-label="Audio trim start"]',1);await input('input[aria-label="Audio trim end"]',5);await input('input[aria-label="Audio clip volume"]',.4);await input('input[aria-label="Audio fade in"]',.5); await input('input[aria-label="Audio fade out"]',.5); await sceneBack();
  await openScene(2);await input('select[aria-label="Scene audio asset"]',assetId('opus-effect.ogg'));await clickText('.audio-add button','Add Sound Effect');await delay(80);await input('input[aria-label="Audio clip start"]',2);await sceneBack();
  await clickText('.studio-nav button','Episodes'); await delay(100); await clickText('.scene-library button','Open'); await delay(160);
  await input('select[aria-label="Episode audio asset"]',assetId('mp3-music.mp3'));
  await clickText('.audio-add button','Add Music'); await delay(80); await input('input[aria-label="Audio fade in"]',1); await input('input[aria-label="Audio fade out"]',2);
  await clickText('.scene-heading button','Save Episode'); await delay(80);
  await evalJs(`document.querySelector('.audio-panel').scrollIntoView({block:'start'})`); await screenshot('episode-audio-timeline.png');
  findings.clips=await evalJs(`({scene:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.map(s=>s.audio?.length??0),episode:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio?.length??0})`);
  await evalJs(`document.querySelector('.episode-preview').scrollIntoView({block:'center'})`);
  await evalJs('window.__audioCaptureStart()');
  await clickText('.scene-playback button','Play');
  const frames=[]; const start=Date.now();
  for(let i=0;i<174;i++) { await delay(Math.max(0,start+i*200-Date.now())); if(i===25){await clickText('.scene-playback button','Pause');findings.paused=await evalJs(`document.querySelector('.scene-playback strong').textContent`);await delay(500);await clickText('.scene-playback button','Play');} const shot=await send('Page.captureScreenshot',{format:'png'});const name=`frame-${String(i).padStart(3,'0')}.png`;writeFileSync(join(root,name),Buffer.from(shot.data,'base64'));frames.push(name); }
  findings.end=await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,button:document.querySelector('.scene-playback button:nth-child(2)').textContent})`);
  findings.activePlayersAtEnd=await evalJs(`window.__players.filter(item=>!item.paused&&!item.ended).length`);
  const audioBase64=await evalJs('window.__audioCaptureStop()'); writeFileSync(join(root,'browser-audio.webm'),Buffer.from(audioBase64,'base64'));
  const video=spawnSync('ffmpeg',['-y','-framerate','5','-i',join(root,'frame-%03d.png'),'-i',join(root,'browser-audio.webm'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p','-movflags','+faststart','-shortest',join(root,'episode-with-audio.mp4')],{encoding:'utf8'});
  findings.recording={frames:frames.length,created:video.status===0,error:video.status===0?undefined:video.stderr?.slice(-500)};if(video.status===0) frames.forEach(name=>rmSync(join(root,name)));
  await evalJs(`document.querySelector('.audio-panel').scrollIntoView({block:'start'})`);
  await click('details summary');
  await input('input[aria-label="Audio trim start"]',1);
  findings.trimmed=await evalJs(`document.querySelector('input[aria-label="Audio trim start"]').value`);
  await input('input[aria-label="Audio trim start"]',0);
  await input('input[aria-label="Audio clip volume"]',.25);
  findings.volume=await evalJs(`document.querySelector('input[aria-label="Audio clip volume"]').value`);
  await input('input[aria-label="Audio clip volume"]',.35);
  await clickText('.scene-heading button','Save Episode');
  await evalJs(`document.querySelector('.episode-preview').scrollIntoView({block:'center'})`);
  findings.boundarySeek=[];
  for(const stamp of [10,25]){await input('input[aria-label="Episode time"]',stamp);await delay(100);findings.boundarySeek.push(await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,scene:document.querySelector('.scene-stage-caption strong')?.textContent})`));}
  await input('input[aria-label="Episode time"]',30);
  findings.seekBefore=await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,button:document.querySelector('.scene-playback button:nth-child(2)').textContent,disabled:document.querySelector('.scene-playback button:nth-child(2)').disabled})`);
  await evalJs('window.__audioCaptureStart()'); findings.seekCaptureStarted=true;
  await clickText('.scene-playback button','Play'); findings.seekPlayStarted=true;
  await delay(1800); findings.seekAfter=await evalJs(`({clock:document.querySelector('.scene-playback strong').textContent,button:document.querySelector('.scene-playback button:nth-child(2)').textContent})`);
  if(findings.seekAfter.button==='Pause') await clickText('.scene-playback button','Pause');
  findings.seeked=await evalJs(`document.querySelector('.scene-playback strong').textContent`);
  const seekAudio=await evalJs('window.__audioCaptureStop()');writeFileSync(join(root,'seek-past-effects.webm'),Buffer.from(seekAudio,'base64'));
  await clickText('.scene-playback button','Restart');
  for(let i=0;i<30&&await evalJs(`document.querySelector('.scene-playback button:nth-child(2)').disabled`);i++) await delay(100);
  await clickText('.scene-playback button','Play'); await delay(550);
  findings.restartButton=await evalJs(`document.querySelector('.scene-playback button:nth-child(2)').textContent`);
  findings.activePlayersAfterRestart=await evalJs(`window.__players.filter(item=>!item.paused&&!item.ended).length`);
  if(findings.restartButton==='Pause') await clickText('.scene-playback button','Pause');
  findings.restarted=await evalJs(`document.querySelector('.scene-playback strong').textContent`);
  const downloads=join(root,'downloads');mkdirSync(downloads,{recursive:true});const before=new Map(readdirSync(downloads).map(name=>[name,statSync(join(downloads,name)).mtimeMs]));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await clickText('.studio-nav button','Characters');await delay(100);await clickText('section[aria-label="Studio backup"] button','Export Studio Backup');
  const fresh=()=>readdirSync(downloads).find(name=>name.endsWith('.json')&&statSync(join(downloads,name)).mtimeMs>(before.get(name)??0));for(let i=0;i<60&&!fresh();i++) await delay(100);if(!fresh()) throw Error('Studio Backup did not download');const backupPath=join(downloads,fresh());const backup=JSON.parse(readFileSync(backupPath,'utf8'));
  findings.backup={version:backup.version,assets:backup.audioAssets.length,sceneClips:backup.timedScenes.scenes.map(s=>s.audio?.length??0),episodeClips:backup.episodes.episodes[0].audio?.length??0,
    content:backup.audioAssets.map(asset=>({name:asset.name,shaMatchesFixture:createHash('sha256').update(Buffer.from(asset.data,'base64')).digest('hex')===findings.fixtures.find(item=>item.name===asset.name)?.sha256}))};
  await send('Page.navigate',{url:'about:blank'});ws.close();await launch();findings.restoreInitialStorage=await evalJs('localStorage.length');
  const doc=await send('DOM.getDocument');const file=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'section[aria-label="Studio backup"] input[type=file]'});await send('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[backupPath]});await delay(800);
  findings.restored=await evalJs(`({scenes:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.length,episodes:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes.length})`);
  await clickText('.studio-nav button','Audio');await delay(100);findings.restoredAudio=await evalJs(`[...document.querySelectorAll('.audio-asset-list strong')].map(e=>e.textContent)`);await screenshot('backup-restored-audio.png');
  findings.restoredPlayback=[];
  for(let i=0;i<findings.restoredAudio.length;i++){
    await evalJs(`document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('button').click()`);await delay(350);
    findings.restoredPlayback.push(await evalJs(`({name:document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('strong').textContent,playing:!window.__players.at(-1)?.paused,position:window.__players.at(-1)?.currentTime})`));
    await evalJs(`document.querySelectorAll('.audio-asset-list article')[${i}].querySelector('button').click()`);
  }
  dialogDecision=false;await evalJs(`document.querySelectorAll('.audio-asset-list article button')[1].click()`);await delay(150);findings.afterCancelledDelete=await evalJs(`document.querySelectorAll('.audio-asset-list article').length`);
  dialogDecision=true;await evalJs(`document.querySelectorAll('.audio-asset-list article button')[1].click()`);await delay(250);findings.afterConfirmedDelete=await evalJs(`({assets:document.querySelectorAll('.audio-asset-list article').length,sceneClips:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.map(scene=>(scene.audio??[]).length),episodeClips:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio?.length??0})`);
} catch(error) { findings.fatal=String(error?.stack??error); }
finally {
  try { ws?.close(); } catch { /* ignore */ }
  const cleanup=path=>{if(!resolve(path).startsWith(resolve(tmpdir())+'\\')||!path.includes('brightsen-f2-isolated-'))return false;const command=`$target=$env:F2_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;spawnSync('powershell',['-NoProfile','-Command',command],{env:{...process.env,F2_PROFILE:path},stdio:'ignore'});return !existsSync(path);};
  findings.profilesRemoved=profiles.map(cleanup);
  writeFileSync(join(root,'browser-results.json'),JSON.stringify(findings,null,2));process.stdout.write(JSON.stringify(findings,null,2));
}
