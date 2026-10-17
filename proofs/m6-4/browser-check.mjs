// Offline voice fixture acceptance. Windows speech synthesis is test input only,
// never part of the application. Both Chrome profiles are disposable.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root=resolve('proofs/m6-4');mkdirSync(root,{recursive:true});
const profiles=[];const findings={errors:[],failedAssets:[],screenshots:[]};
let ws,serial=1;const pending=new Map();
const send=(method,params={})=>new Promise((ok,fail)=>{const id=serial++;pending.set(id,{ok,fail});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(value.exceptionDetails.exception?.description??value.exceptionDetails.text);return value.result.value;};
const clickText=(selector,label)=>evaluate(`(()=>{const item=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(label)}));if(!item)throw Error('Missing ${label}');item.click()})()`);
const input=(selector,value)=>evaluate(`(()=>{const item=document.querySelector(${JSON.stringify(selector)});if(!item)throw Error('Missing ${selector}');const proto=item.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(item,${JSON.stringify(String(value))});item.dispatchEvent(new Event('input',{bubbles:true}));item.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const screenshot=async name=>{const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(root,name),Buffer.from(shot.data,'base64'));findings.screenshots.push(name);};
const captureScript=`(()=>{const ctx=new AudioContext();const destination=ctx.createMediaStreamDestination();const wired=new WeakSet();window.__players=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!wired.has(this)){const source=ctx.createMediaElementSource(this);source.connect(ctx.destination);source.connect(destination);wired.add(this);window.__players.push(this);}void ctx.resume();return original.apply(this,args)};window.__captureStart=()=>{window.__chunks=[];window.__recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});window.__recorder.ondataavailable=e=>{if(e.data.size)window.__chunks.push(e.data)};window.__recorder.start(200)};window.__captureStop=()=>new Promise(resolve=>{window.__recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(window.__chunks).arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve(btoa(out))};window.__recorder.stop()})})()`;
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const scenes={version:1,scenes:[
  {id:id(1),name:'Hello',duration:6,placeId:'living-room',characters:{max:{x:600,y:790}},actions:[{id:id(11),characterId:'max',type:'appear',start:0,duration:0,point:{x:600,y:790}}]},
  {id:id(2),name:'Listening',duration:6,placeId:'living-room',characters:{maxine:{x:1000,y:790}},actions:[{id:id(21),characterId:'maxine',type:'appear',start:0,duration:0,point:{x:1000,y:790}}]},
]};
const episodes={version:1,episodes:[{id:id(3),name:'Voice Across Scenes',sceneIds:scenes.scenes.map(item=>item.id)}]};
const voice=(directory,name,words)=>{
  const path=join(directory,name);
  const script=`Add-Type -AssemblyName System.Speech; $speaker=New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.SetOutputToWaveFile($env:M64_VOICE_PATH); $speaker.Speak($env:M64_VOICE_WORDS); $speaker.Dispose()`;
  const result=spawnSync('powershell',['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...process.env,M64_VOICE_PATH:path,M64_VOICE_WORDS:words},encoding:'utf8'});
  if(result.status!==0)throw Error(`Could not prepare local voice fixture: ${result.stderr}`);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,channels:format=format_name,duration','-of','json',path],{encoding:'utf8'});
  if(probe.status!==0)throw Error(probe.stderr);
  return {name,path,probe:JSON.parse(probe.stdout)};
};
const onMessage=event=>{const item=JSON.parse(event.data);if(item.id){const call=pending.get(item.id);if(call){pending.delete(item.id);item.error?call.fail(Error(item.error.message)):call.ok(item.result);}}else if(item.method==='Runtime.exceptionThrown')findings.errors.push(item.params.exceptionDetails.text);else if(item.method==='Runtime.consoleAPICalled'&&item.params.type==='error')findings.errors.push(item.params.args.map(arg=>arg.value??arg.description).join(' '));else if(item.method==='Network.responseReceived'&&item.params.response.status>=400)findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);else if(item.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true});};
const launch=async()=>{
  const profile=mkdtempSync(join(tmpdir(),'brightsen-m64-isolated-'));profiles.push(profile);
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1440,960','about:blank'],{stdio:'ignore'});
  const portFile=join(profile,'DevToolsActivePort');for(let i=0;i<100&&!existsSync(portFile);i++)await delay(100);if(!existsSync(portFile))throw Error('Isolated Chrome failed to start');
  const port=Number(readFileSync(portFile,'utf8').split('\n')[0]);const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
  ws.addEventListener('message',onMessage);await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source:captureScript});
  await send('Page.navigate',{url:'http://127.0.0.1:4177/'});for(let i=0;i<60&&!(await evaluate(`!!document.querySelector('.studio-nav')`));i++)await delay(100);return profile;
};
const setFile=async path=>{const doc=await send('DOM.getDocument');const file=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[aria-label="Import audio file"]'});await send('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[path]});await delay(500);};
try{
  const profile=await launch();findings.initialStorage=await evaluate('localStorage.length');
  const line=voice(profile,'max-hello.wav','Hello Maxine, welcome to our cartoon.');
  const narration=voice(profile,'narrator.wav','Now the story moves into another scene, while the narrator keeps speaking without a break.');
  findings.voices=[line,narration].map(({name,probe})=>({name,probe}));
  await evaluate(`localStorage.setItem('brightsenappstales.timed-scenes.v1',${JSON.stringify(JSON.stringify(scenes))});localStorage.setItem('brightsenappstales.episodes.v1',${JSON.stringify(JSON.stringify(episodes))})`);
  await send('Page.reload');await delay(300);await clickText('.studio-nav button','Audio');await delay(100);
  await input('select[aria-label="Imported audio type"]','speech');await setFile(line.path);await setFile(narration.path);
  findings.imported=await evaluate(`[...document.querySelectorAll('.audio-asset-list article')].map(e=>e.textContent.trim())`);await screenshot('audio-library-voices.png');
  const assets=await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('brightsenappstales.audio.v1');r.onsuccess=()=>{const q=r.result.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>resolve(q.result.map(({id,name,kind,duration,mime,size})=>({id,name,kind,duration,mime,size})));q.onerror=reject};r.onerror=reject})`);
  findings.assets=assets;const assetId=name=>assets.find(item=>item.name===name)?.id;
  await clickText('.studio-nav button','Scenes');await delay(100);await evaluate(`document.querySelectorAll('.scene-library article')[0].querySelector('button').click()`);await delay(180);
  await input('select[aria-label="Scene audio asset"]',assetId(line.name));await clickText('.audio-add button','Add Speech');await delay(80);
  await input('select[aria-label="Speech speaker"]','max');await input('input[aria-label="Audio clip start"]',1);await input('input[aria-label="Audio clip volume"]',.6);
  await evaluate(`document.querySelector('.audio-inspector details summary').click()`);await input('input[aria-label="Audio trim start"]',.2);
  await evaluate(`document.querySelector('.audio-panel').scrollIntoView({block:'start'})`);await screenshot('scene-dialogue.png');
  await clickText('.scene-heading button','Save Scene');await clickText('.scene-heading button','All scenes');
  await clickText('.studio-nav button','Episodes');await delay(100);await clickText('.scene-library button','Open');await delay(150);
  await input('input[aria-label="Episode time"]',5);await input('select[aria-label="Episode audio asset"]',assetId(narration.name));await clickText('.audio-add button','Add Speech');await delay(80);
  findings.narrationWarning=await evaluate(`document.querySelector('.audio-inspector [role=alert]')?.textContent??null`);
  await input('select[aria-label="Speech speaker"]','narrator');
  await evaluate(`document.querySelector('.audio-panel').scrollIntoView({block:'start'})`);await screenshot('episode-narration.png');
  await clickText('.scene-heading button','Save Episode');await delay(100);
  findings.saved=await evaluate(`({scene:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].audio,episode:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio})`);
  await evaluate(`document.querySelector('.episode-preview').scrollIntoView({block:'center'})`);
  await clickText('.scene-playback button','Restart');
  await evaluate('window.__captureStart()');await clickText('.scene-playback button','Play');
  const frames=[];findings.playbackSamples=[];const start=Date.now();for(let i=0;i<68;i++){await delay(Math.max(0,start+i*200-Date.now()));if([5,25,35,50].includes(i))findings.playbackSamples.push(await evaluate(`({clock:document.querySelector('.scene-playback strong').textContent,scene:document.querySelector('.scene-stage-caption strong')?.textContent,activePlayers:window.__players.filter(p=>!p.paused&&!p.ended).length})`));const shot=await send('Page.captureScreenshot',{format:'png'});const name=`frame-${String(i).padStart(3,'0')}.png`;writeFileSync(join(root,name),Buffer.from(shot.data,'base64'));frames.push(name);}
  findings.playbackEnd=await evaluate(`({clock:document.querySelector('.scene-playback strong').textContent,activePlayers:window.__players.filter(p=>!p.paused&&!p.ended).length})`);
  writeFileSync(join(root,'browser-speech.webm'),Buffer.from(await evaluate('window.__captureStop()'),'base64'));
  const video=spawnSync('ffmpeg',['-v','error','-y','-framerate','5','-i',join(root,'frame-%03d.png'),'-i',join(root,'browser-speech.webm'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p','-shortest',join(root,'dialogue-episode.mp4')],{encoding:'utf8'});
  findings.recording={created:video.status===0,frames:frames.length,error:video.status===0?undefined:video.stderr};
  if(video.status===0){const {rmSync}=await import('node:fs');frames.forEach(name=>rmSync(join(root,name)));}
  await send('Page.reload');await delay(350);await clickText('.studio-nav button','Episodes');await delay(100);await clickText('.scene-library button','Open');await delay(120);
  findings.reopened=await evaluate(`({scene:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].audio,episode:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio})`);
  const downloads=join(profile,'downloads');mkdirSync(downloads,{recursive:true});await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await clickText('.studio-nav button','Characters');await delay(100);await clickText('section[aria-label="Studio backup"] button','Export Studio Backup');
  for(let i=0;i<60&&!readdirSync(downloads).some(name=>name.endsWith('.json'));i++)await delay(100);
  const backupPath=join(downloads,readdirSync(downloads).find(name=>name.endsWith('.json'))??'missing');if(!existsSync(backupPath))throw Error('No Studio Backup download');
  const backup=JSON.parse(readFileSync(backupPath,'utf8'));findings.backup={version:backup.version,assets:backup.audioAssets.map(a=>({name:a.name,kind:a.kind})),sceneSpeaker:backup.timedScenes.scenes[0].audio[0].speakerId,episodeSpeaker:backup.episodes.episodes[0].audio[0].speakerId};
  await send('Page.navigate',{url:'about:blank'});ws.close();await launch();findings.restoreInitialStorage=await evaluate('localStorage.length');
  const doc=await send('DOM.getDocument');const file=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'section[aria-label="Studio backup"] input[type=file]'});await send('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[backupPath]});await delay(800);
  findings.restored=await evaluate(`(async()=>({assets:await new Promise((resolve,reject)=>{const r=indexedDB.open('brightsenappstales.audio.v1');r.onsuccess=()=>{const q=r.result.transaction('assets').objectStore('assets').getAll();q.onsuccess=()=>resolve(q.result.map(a=>a.name));q.onerror=reject};r.onerror=reject}),scene:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0].audio[0].speakerId,episode:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes[0].audio[0].speakerId}))()`);
  await screenshot('restored-voices.png');
}catch(error){findings.fatal=String(error?.stack??error);}
finally{try{ws?.close();}catch{/* ignore */}const removed=[];for(const profile of profiles){const target=resolve(profile);if(target.startsWith(resolve(tmpdir())+'\\')&&target.includes('brightsen-m64-isolated-')){const command=`$target=$env:M64_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;spawnSync('powershell',['-NoProfile','-Command',command],{env:{...process.env,M64_PROFILE:target},stdio:'ignore'});}removed.push(!existsSync(profile));}findings.profilesRemoved=removed;writeFileSync(join(root,'browser-results.json'),JSON.stringify(findings,null,2));process.stdout.write(JSON.stringify(findings,null,2));if(findings.fatal||findings.errors.length||findings.failedAssets.length||removed.some(value=>!value))process.exitCode=1;}
