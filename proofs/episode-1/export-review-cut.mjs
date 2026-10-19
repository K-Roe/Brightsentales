// Restore the editable Studio backup through the visible UI, then export.
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const out=join(process.cwd(),'proofs/episode-1/production');
const profile=mkdtempSync(join(tmpdir(),'brighttales-episode1-final-profile-'));
const downloads=mkdtempSync(join(tmpdir(),'brighttales-episode1-final-download-'));
const chrome=spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,[
  '--headless=new','--no-first-run','--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling',
  '--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
  `--user-data-dir=${profile}`,'--remote-debugging-port=0','--window-size=1600,1100','about:blank',
],{stdio:'ignore',windowsHide:true});
let ws,serial=1;const pending=new Map(),results={profile,steps:[],errors:[]};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=serial++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const until=async(expression,tries=400)=>{for(let i=0;i<tries;i++){const value=await evaluate(expression);if(value)return value;await delay(100);}throw Error(`Timed out: ${expression}`);};
const nav=label=>evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
const fileInput=async(selector,path)=>{const {root}=await send('DOM.getDocument',{depth:-1,pierce:true});const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector});if(!nodeId)throw Error(`Missing input ${selector}`);await send('DOM.setFileInputFiles',{nodeId,files:[path]});};
try{
  let targets;const portFile=join(profile,'DevToolsActivePort');
  for(let i=0;i<200&&!targets;i++){try{if(existsSync(portFile)){const port=Number(readFileSync(portFile,'utf8').split('\n')[0]);targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();}}catch{}if(!targets)await delay(100);}
  if(!targets)throw Error('Chrome debugging endpoint unavailable');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening'){void send('Page.handleJavaScriptDialog',{accept:true});return;}if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
  await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await send('Page.navigate',{url:'http://127.0.0.1:4177/'});await until(`!!document.querySelector('.studio-nav')`);
  await nav('Characters');await fileInput('section[aria-label="Studio backup"] input[type="file"]',join(out,'meet-max-episode-1-review-cut-studio-backup.json'));
  await until(`document.body.textContent.includes('Studio Backup restored')`,1200);
  results.steps.push('Restored final editable backup through Studio UI');
  await nav('Episodes');
  await evaluate(`[...document.querySelectorAll('.scene-library article')].find(e=>e.querySelector('h2')?.textContent.startsWith('Meet Max'))?.querySelector('button').click()`);
  const sceneNames=await evaluate(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
  if(sceneNames.length!==6)throw Error(`Expected six scenes, found ${sceneNames.length}`);
  results.sceneNames=sceneNames;results.steps.push('Reopened six-scene episode in Episode Maker');
  await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Export Episode Video').click()`);
  await until(`document.querySelector('.scene-status')?.textContent.includes('Complete episode exported')`,4100);
  let source;for(let i=0;i<300;i++){const name=readdirSync(downloads).find(n=>n.endsWith('.webm'));if(name&&statSync(join(downloads,name)).size>1000){source=join(downloads,name);break;}await delay(100);}
  if(!source)throw Error('Export download missing');
  const target=join(out,'meet-max-episode-1-review-cut-reexport.webm');copyFileSync(source,target);
  results.video={path:target,bytes:statSync(target).size};results.steps.push('Full episode downloaded from Studio UI');
  const {data}=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'review-cut-reexport-ui.png'),Buffer.from(data,'base64'));
  console.log('PASS',JSON.stringify(results));
}catch(error){results.errors.push(String(error));console.error(error);process.exitCode=1;}
finally{if(!process.exitCode){try{await send('Browser.close');}catch{}}else chrome.unref();ws?.close();writeFileSync(join(out,'reexport-results.json'),JSON.stringify(results,null,2));}
