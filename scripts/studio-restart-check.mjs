import { writeFile } from 'node:fs/promises';
const phase = process.argv[2];
if (phase !== 'write' && phase !== 'read') throw new Error('Use write or read');
const tab = await fetch('http://127.0.0.1:9230/json/new?http://127.0.0.1:4175/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', event => { const result=JSON.parse(event.data);if(result.id&&pending.has(result.id)){const callback=pending.get(result.id);pending.delete(result.id);result.error?callback.reject(new Error(result.error.message)):callback.resolve(result.result);} });
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const js=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
async function until(expression){for(let i=0;i<70;i++){if(await js(expression))return;await wait(200);}throw new Error(`Timed out: ${expression}`);}
try {
  await send('Page.enable');await send('Runtime.enable');await wait(1800);
  if(phase==='write'){
    if(await js(`localStorage.getItem('brightsenappstales.brightlings.v1')!==null`))throw new Error('Test profile was not empty');
    await js(`(()=>{const e=document.querySelector('#brightling-name');e.focus()})()`);await send('Input.insertText',{text:'Restart Check'});
    await until(`!document.querySelector('.maker-save').disabled`);
    await js(`document.querySelector('.maker-save').click()`);
    await until(`document.querySelectorAll('.library-card').length===1`);
    await js(`document.querySelector('.library-card-actions button:last-child').click()`);
    await until(`document.querySelectorAll('.character-card').length===3`);
    await js(`document.querySelector('.save-actions button').click()`);
    const result=await js(`({library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))})`);
    await writeFile('proofs/milestone3-1/restart-before.json',JSON.stringify({id:result.library[0].id,sceneHasCharacter:!!result.scene.characters[result.library[0].id]},null,2));
    console.log(JSON.stringify({phase,id:result.library[0].id,sceneHasCharacter:!!result.scene.characters[result.library[0].id]}));
  } else {
    await until(`document.querySelector('.studio-nav .active')?.textContent==='Characters'`);
    const result=await js(`({library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1')),cards:document.querySelectorAll('.library-card').length})`);
    await js(`[...document.querySelectorAll('.studio-nav button')].find(x=>x.textContent==='Playground').click()`);
    await until(`document.querySelectorAll('.character-card').length===3`);
    const okay=result.library.length===1&&result.cards===1&&!!result.scene.characters[result.library[0].id];
    await writeFile('proofs/milestone3-1/restart-after.json',JSON.stringify({okay,id:result.library[0].id,sceneHasCharacter:!!result.scene.characters[result.library[0].id]},null,2));
    console.log(JSON.stringify({phase,okay,id:result.library[0].id}));
    if(!okay)process.exitCode=1;
  }
}finally{ws.close();}
