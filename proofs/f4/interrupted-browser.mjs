// Real IndexedDB + localStorage crash-point recovery in a disposable Chrome profile.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/f4');
const profile = mkdtempSync(join(tmpdir(), 'brightsen-f4-interrupted-'));
const findings = { cases: [], errors: [], failedAssets: [] };
let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text); return value.result.value; };
const reload = async () => { await send('Page.reload'); for (let i=0;i<60 && !(await evaluate(`!!document.querySelector('.studio-nav')`));i++) await delay(100); await delay(200); };
const tone = (name, codec, frequency) => {
  const path = join(profile, name);
  const result = spawnSync('ffmpeg', ['-v','error','-y','-f','lavfi','-i',`sine=frequency=${frequency}:duration=1`,'-c:a',codec,path], {encoding:'utf8'});
  if (result.status !== 0) throw Error(result.stderr);
  const probe = spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name:format=format_name','-of','json',path],{encoding:'utf8'});
  if (probe.status !== 0) throw Error(probe.stderr);
  return {name,base64:readFileSync(path).toString('base64'),probe:JSON.parse(probe.stdout)};
};
try {
  const oldTone = tone('old.mp3','libmp3lame',330);
  const newTone = tone('new.ogg','libvorbis',550);
  findings.fixtures = [oldTone,newTone].map(({name,probe})=>({name,probe}));
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1366,900','about:blank'], {stdio:'ignore'});
  const portFile=join(profile,'DevToolsActivePort'); for(let i=0;i<100&&!existsSync(portFile);i++)await delay(100);
  if(!existsSync(portFile))throw Error('Isolated Chrome failed to start');
  const port=Number(readFileSync(portFile,'utf8').split('\n')[0]);const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',fail,{once:true});});
  ws.addEventListener('message',event=>{const item=JSON.parse(event.data);if(item.id){const call=pending.get(item.id);if(call){pending.delete(item.id);item.error?call.fail(Error(item.error.message)):call.ok(item.result);}}else if(item.method==='Runtime.exceptionThrown')findings.errors.push(item.params.exceptionDetails.text);else if(item.method==='Runtime.consoleAPICalled'&&item.params.type==='error')findings.errors.push(item.params.args.map(arg=>arg.value??arg.description).join(' '));else if(item.method==='Network.responseReceived'&&item.params.response.status>=400)findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);});
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Page.navigate',{url:'http://127.0.0.1:4177/'});
  for(let i=0;i<60&&!(await evaluate(`!!document.querySelector('.studio-nav')`));i++)await delay(100);
  const setup = async () => evaluate(`(async()=>{
    const store=await import('/src/audioStore.ts');const back=await import('/src/studioBackup.ts');const scene=await import('/src/scene.ts');const folders=await import('/src/placeFolders.ts');const maker=await import('/src/maker.ts');const timed=await import('/src/timedScenes.ts');const episodes=await import('/src/episodes.ts');const coordinator=await import('/src/restoreCoordinator.ts');
    const file=(base64,name,mime)=>new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],name,{type:mime});
    const oldAsset=await store.importAudioFile(file(${JSON.stringify(oldTone.base64)},'old.mp3','audio/mpeg'),'effect');
    const newAsset=await store.importAudioFile(file(${JSON.stringify(newTone.base64)},'new.ogg','audio/ogg'),'effect');
    const oldScene={version:1,scenes:[]};const oldEpisode={version:1,episodes:[]};
    const sceneId=crypto.randomUUID(),episodeId=crypto.randomUUID();
    const nextScene={version:1,scenes:[{id:sceneId,name:'Recovered scene',duration:10,placeId:'living-room',characters:{},actions:[],audio:[{id:crypto.randomUUID(),assetId:newAsset.id,start:2,trimStart:0,trimEnd:1,volume:.5,fadeIn:0,fadeOut:0}]}]};
    const nextEpisode={version:1,episodes:[{id:episodeId,name:'Recovered episode',sceneIds:[sceneId]}]};
    const backup=back.createStudioBackup([],scene.DEFAULT_SCENE,new Date(),folders.DEFAULT_PLACE_ORGANISATION,nextScene,nextEpisode,await store.audioBackupAssets([newAsset]));
    window.__f4={store,back,scene,folders,maker,timed,episodes,coordinator,oldAsset,newAsset,oldScene,oldEpisode,backup};
    await store.replaceAudioAssets([oldAsset]);localStorage.setItem(timed.TIMED_SCENES_KEY,JSON.stringify(oldScene));localStorage.setItem(episodes.EPISODES_KEY,JSON.stringify(oldEpisode));
    return {oldId:oldAsset.id,newId:newAsset.id,oldDuration:oldAsset.duration,newDuration:newAsset.duration};
  })()`);
  findings.setup=await setup();
  const inspect = async () => evaluate(`(async()=>({marker:localStorage.getItem('brightsenappstales.audio-restore.v1'),audio:(await (await import('/src/audioStore.ts')).listAudioAssets()).map(a=>a.name),scenes:JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes.map(s=>s.name),episodes:JSON.parse(localStorage.getItem('brightsenappstales.episodes.v1')).episodes.map(e=>e.name),error:document.querySelector('main[role=alert]')?.textContent}))()`);
  const stage = async (withLocal, commit) => evaluate(`(async()=>{const x=window.__f4;localStorage.setItem(x.coordinator.AUDIO_RESTORE_KEY,'pending');await x.store.replaceAudioAssetsWithSnapshot([x.newAsset]);if(${withLocal}){const result=x.back.restoreStudioBackup(localStorage,x.maker.LIBRARY_KEY,x.scene.STORAGE_KEY,x.backup,undefined,undefined,undefined,true);if(!result.ok)throw Error(result.error);}if(${commit})localStorage.setItem(x.coordinator.AUDIO_RESTORE_KEY,'committed');return true})()`);
  await stage(false,false);await reload();findings.cases.push({stage:'after audio swap, before local writes',...(await inspect())});
  await setup();await stage(true,false);await reload();findings.cases.push({stage:'after local writes, before commit',...(await inspect())});
  await setup();await stage(true,true);await reload();findings.cases.push({stage:'after commit, before cleanup',...(await inspect())});
  await evaluate(`([...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes('Audio'))).click()`);await delay(100);
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(root,'recovered-audio-library.png'),Buffer.from(shot.data,'base64'));
} catch(error){findings.fatal=String(error?.stack??error);}
finally{
  try{ws?.close();}catch{/* ignore */}
  const target=resolve(profile);
  if(target.startsWith(resolve(tmpdir())+'\\')&&target.includes('brightsen-f4-interrupted-')){
    const command=`$target=$env:F4_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
    spawnSync('powershell',['-NoProfile','-Command',command],{env:{...process.env,F4_PROFILE:target},stdio:'ignore'});
  }
  findings.profileRemoved=!existsSync(profile);
  writeFileSync(join(root,'interrupted-results.json'),JSON.stringify(findings,null,2));process.stdout.write(JSON.stringify(findings,null,2));
  if(findings.fatal||findings.errors.length||findings.failedAssets.length||!findings.profileRemoved||findings.cases.length!==3)process.exitCode=1;
}
