// Final first-cut editorial pass through the existing Studio UI.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root=process.cwd(),out=join(root,'proofs/episode-1/production');
const session=JSON.parse(readFileSync(join(out,'session.json'),'utf8'));
const downloads=mkdtempSync(join(tmpdir(),'brighttales-episode1-review-download-'));
const chrome=spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,['--headless=new','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',`--user-data-dir=${session.profile}`,'--remote-debugging-port=0','--window-size=1600,1100','about:blank'],{stdio:'ignore',windowsHide:true});
let ws,serial=1;const pending=new Map(),results={steps:[],errors:[]};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const until=async(expression,tries=400)=>{for(let i=0;i<tries;i++){const value=await evaluate(expression);if(value)return value;await delay(100);}throw Error(`Timed out: ${expression}`);};
const nav=label=>evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
const click=(selector,label)=>evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing '+${JSON.stringify(label)});e.click();return true})()`);
const setValue=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot=async name=>{const{data}=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,name),Buffer.from(data,'base64'));};
const download=async suffix=>{for(let i=0;i<300;i++){const n=readdirSync(downloads).find(n=>n.endsWith(suffix));if(n&&statSync(join(downloads,n)).size>1000){await delay(200);return join(downloads,n);}await delay(100);}throw Error(`Missing ${suffix} download`);};
try{
  const portFile=join(session.profile,'DevToolsActivePort');let targets;
  for(let i=0;i<200&&!targets;i++){try{if(existsSync(portFile)){const port=Number(readFileSync(portFile,'utf8').split('\n')[0]);targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();}}catch{await delay(100);}}
  if(!targets)throw Error('Chrome debugging endpoint unavailable');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening'){void send('Page.handleJavaScriptDialog',{accept:true});return;}if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
  await send('Page.enable');await send('Runtime.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await send('Page.navigate',{url:'http://127.0.0.1:4177/'});await until(`!!document.querySelector('.studio-nav')`);
  await nav('Credits');
  await evaluate(`[...document.querySelectorAll('.scene-library article')].find(e=>e.querySelector('h2')?.textContent==='Episode 1 closing credits').querySelector('button').click()`);
  await evaluate(`[...document.querySelectorAll('.credit-line-list button')].find(e=>e.querySelector('span')?.textContent==='Narration').click()`);
  await setValue('input[aria-label="Credit role"]','');await click('button','Save Credits');
  await until(`document.querySelector('.scene-status')?.textContent.includes('Credits saved')`);
  results.steps.push('Credits internal voice-status wording removed and saved through UI');
  await nav('Scenes');
  await evaluate(`[...document.querySelectorAll('.scene-library article')].find(e=>e.querySelector('h2')?.textContent==='5. Playing Together').querySelector('button').click()`);
  await click('.director-cast button','Maxine');
  await setValue('input[aria-label="Maxine initial X"]','1130');
  await evaluate(`document.querySelector('[aria-label="Maxine Walk To at 6 seconds"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(`!!document.querySelector('input[aria-label="Destination X"]')`);
  await setValue('input[aria-label="Destination X"]','900');
  await click('button','Save Scene');await until(`document.querySelector('.scene-status')?.textContent.includes('Scene saved')`);
  results.steps.push('Maxine enters from right and walks toward Max in Garden; scene saved through UI');
  await screenshot('garden-revised-editor.png');
  await send('Page.reload',{ignoreCache:true});await until(`!!document.querySelector('.studio-nav')`);
  await nav('Episodes');await evaluate(`[...document.querySelectorAll('.scene-library article')].find(e=>e.querySelector('h2')?.textContent==='Meet Max — Episode 1').querySelector('button').click()`);
  const names=await evaluate(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  if(names.join('|')!==['1. Meet Max','2. Meet Maxine','3. Breakfast Time','4. Bright Stars','5. Playing Together','6. Goodbye for Now'].join('|'))throw Error('Episode reopen lost scene order');
  results.steps.push('Reopened saved episode and verified six-scene order');
  await nav('Characters');await click('section[aria-label="Studio backup"] button','Export Studio Backup');
  const backup=await download('.json'),backupPath=join(out,'meet-max-episode-1-review-cut-studio-backup.json');copyFileSync(backup,backupPath);
  const data=JSON.parse(readFileSync(backupPath,'utf8'));
  const garden=data.timedScenes.scenes.find(s=>s.name==='5. Playing Together');
  if(garden.characters.maxine.x!==1130||garden.actions.find(a=>a.characterId==='maxine'&&a.type==='walk').point.x!==900||data.credits.credits[0].lines.find(l=>l.heading==='Narration').role!=='')throw Error('Final UI changes absent from backup');
  results.steps.push('Final UI Backup v8 contains corrected garden staging and credits');
  await nav('Episodes');await evaluate(`[...document.querySelectorAll('.scene-library article')].find(e=>e.querySelector('h2')?.textContent==='Meet Max — Episode 1').querySelector('button').click()`);
  await click('button','Export Episode Video');
  await until(`document.querySelector('.scene-status')?.textContent.includes('Complete episode exported')`,Math.ceil((session.duration+120)*10));
  const source=await download('.webm'),video=join(out,'meet-max-episode-1-review-cut.webm');copyFileSync(source,video);
  results.video={path:video,bytes:statSync(video).size};results.steps.push('Complete revised episode exported through Studio UI');
  await screenshot('review-cut-exported.png');
  console.log('PASS',results.steps.join(' | '));
}catch(error){results.errors.push(String(error));try{results.uiText=await evaluate(`document.body.innerText.slice(-2000)`);await screenshot('review-cut-failure.png');}catch{}console.error(error);process.exitCode=1;}
finally{if(!process.exitCode){try{await send('Browser.close');}catch{}}else chrome.unref();ws?.close();writeFileSync(join(out,'review-cut-results.json'),JSON.stringify(results,null,2));}
