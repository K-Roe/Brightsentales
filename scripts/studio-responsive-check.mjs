import { writeFile } from 'node:fs/promises';
const target = await fetch('http://127.0.0.1:9229/json/new?http://127.0.0.1:4174/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let number = 0;
const waiting = new Map();
ws.addEventListener('message', event => { const data=JSON.parse(event.data); if(data.id&&waiting.has(data.id)){const done=waiting.get(data.id);waiting.delete(data.id);done(data);} });
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++number;waiting.set(id,data=>data.error?reject(new Error(data.error.message)):resolve(data.result));ws.send(JSON.stringify({id,method,params}));});
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await new Promise(ok=>setTimeout(ok,2200));
  const result=await send('Runtime.evaluate',{expression:`({active:document.querySelector('.studio-nav .active')?.textContent,documentWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,buttons:[...document.querySelectorAll('.studio-nav button')].map(x=>x.textContent)})`,returnByValue:true});
  const data=result.result.value;
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile('proofs/milestone3-1/mobile-characters.png',Buffer.from(shot.data,'base64'));
  await writeFile('proofs/milestone3-1/mobile-check.json',JSON.stringify(data,null,2));
  if(data.documentWidth>data.viewport||data.active!=='Characters')process.exitCode=1;
  console.log(JSON.stringify(data));
} finally {ws.close();}
