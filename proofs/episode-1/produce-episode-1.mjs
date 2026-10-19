// Episode 1 first cut. Every creative action below drives the visible Studio UI.
// The only browser-storage reads are verification and checkpoint inspection.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd(), out = join(root, 'proofs/episode-1/production'); mkdirSync(out, { recursive: true });
const sessionPath = join(out, 'session.json');
const session = existsSync(sessionPath) ? JSON.parse(readFileSync(sessionPath, 'utf8')) : {
  profile: mkdtempSync(join(tmpdir(), 'brighttales-episode1-profile-')),
  downloads: mkdtempSync(join(tmpdir(), 'brighttales-episode1-download-')),
  completed: [], voices: {}, steps: [], errors: [],
};
const persist = () => writeFileSync(sessionPath, JSON.stringify(session, null, 2)); persist();
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${session.profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 1; const pending = new Map(), browserErrors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
const until = async (expression, tries = 400) => { for (let i = 0; i < tries; i++) { const value = await evaluate(expression); if (value) return value; await delay(100); } throw Error(`Timed out: ${expression}`); };
const nav = label => evaluate(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
const click = (selector, label) => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing '+${JSON.stringify(label)});e.click();return true})()`);
const clickContains = (selector, label) => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.includes(${JSON.stringify(label)}));if(!e)throw Error('Missing '+${JSON.stringify(label)});e.click();return true})()`);
const setValue = (selector, value) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const choose = (selector, label) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),o=[...e.options].find(o=>o.textContent.includes(${JSON.stringify(label)}));if(!o)throw Error('Missing option '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,o.value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return o.value})()`);
const fileInput = async (selector, path) => { const { root } = await send('DOM.getDocument', { depth: -1, pierce: true }); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector }); if (!nodeId) throw Error(`Missing input ${selector}`); await send('DOM.setFileInputFiles', { nodeId, files: [path] }); };
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(data, 'base64')); };
const captureCanvas = async name => { const data = await evaluate(`document.querySelector('canvas[aria-label="Episode cartoon preview"],canvas[aria-label^="Timed scene stage"],canvas[aria-label="Intro preview stage with titles"],canvas[aria-label="Credits preview stage"]').toDataURL('image/png')`); writeFileSync(join(out, name), Buffer.from(data.split(',')[1], 'base64')); };
const stage = async (name, fn) => { if (session.completed.includes(name)) return; console.log('START', name); await fn(); session.completed.push(name); session.steps.push({ name, at: new Date().toISOString() }); persist(); console.log('PASS', name); };
const waitDownload = async suffix => { for (let i=0;i<300;i++) { const file=readdirSync(session.downloads).find(n=>n.endsWith(suffix)); if(file && statSync(join(session.downloads,file)).size>1000) { await delay(200); return join(session.downloads,file); } await delay(100); } throw Error(`Missing ${suffix} download`); };
const seek = async time => { await evaluate(`document.querySelector('.timeline-ruler').scrollIntoView({block:'center'})`); const p=await evaluate(`(()=>{const r=document.querySelector('.timeline-ruler').getBoundingClientRect();return {x:r.left+116+${time}*24,y:r.top+15}})()`); await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1}); await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1}); await delay(80); };
const action = async (character, kind, time, destination) => {
  await click('.director-cast button', character==='max'?'Max':character==='maxine'?'Maxine':character);
  await click('.scene-director .director-actions button', kind);
  await setValue('input[aria-label="Action start time"]', time);
  if (destination) { await setValue('input[aria-label="Destination X"]', destination.x); await setValue('input[aria-label="Destination Y"]', destination.y); }
};
const audioClip = async (label, kind, start, volume) => {
  await choose('select[aria-label$=" audio asset"]', label);
  await click('.audio-add button', kind === 'music' ? 'Add Music' : kind === 'effect' ? 'Add Sound Effect' : 'Add Speech');
  await setValue('input[aria-label="Audio clip start"]', start);
  await setValue('input[aria-label="Audio clip volume"]', volume);
  return evaluate(`document.querySelector('.audio-inspector strong')?.textContent`);
};
const narration = [
  ['max', "Hello, everyone! Welcome to BrightTales! Today, we're going to meet someone very special. This is Max! Max is a Brightling with a big smile and a kind heart. He notices little things, and likes to share what makes him happy. Max doesn't use spoken words. He can tell us so much with a look, a wave, and the things he chooses to show us. Let's say hello!"],
  ['maxine', "And this is Maxine! She is Max's friend. Maxine loves playful mornings and new ideas. She likes to take her time, look around, and see what the day might bring. When Max and Maxine are together, they listen to each other and find lovely ways to play. I think Maxine is ready to visit her friend."],
  ['breakfast_a', "Back at Max's house, it is nearly breakfast time. Max loves a crisp red apple. He has something he would like to tell us. He takes out his communication phone and chooses the food picture. Watch him tap the screen."],
  ['breakfast_b', "There we are! Max has told us what he needs. His phone helps his message come through clearly. Now he can look forward to breakfast, and perhaps that lovely apple."],
  ['stars', "After breakfast, Max feels proud. He has used his own way of communicating, and everyone has understood him. In Max's world, we call those happy little moments Bright Stars. A Bright Star can be for trying something new, sharing a feeling, or being kind. Max has earned a bright moment today. Shall we give him a little wave?"],
  ['garden', "Here comes Maxine! She has found Max in the garden. The two friends have room to explore. Maxine waves, and Max waves back. They notice the colours around them and take a little walk together. Sometimes friends talk with words. Sometimes a smile, a gesture, or simply being side by side says enough. Max and Maxine are having a lovely time."],
  ['goodbye', "The day has been full of small, happy moments. Max shared what he needed. Maxine came to play. And together, they found a new story to tell. Max and Maxine have lots more adventures waiting for them. But for now, it's time to say goodbye, and goodnight. See you next time!"],
  ['device', "I'm hungry!"],
];
const scenes = [
  { key:'meet-max', name:'1. Meet Max', place:"Max's bedroom", duration:36, cast:['max'], speech:[['max',1.5]], moves:[['max','Wave',6],['max','Wave',28]] },
  { key:'meet-maxine', name:'2. Meet Maxine', place:"Maxine's bedroom", duration:34, cast:['maxine'], speech:[['maxine',1.5]], moves:[['maxine','Wave',5],['maxine','Walk To',25,{x:760,y:790}]] },
  { key:'breakfast', name:'3. Breakfast Time', place:'Kitchen', duration:50, cast:['max'], speech:[['breakfast_a',1],['breakfast_b',29]], moves:[['max','Wave',43]], phone:true },
  { key:'bright-stars', name:'4. Bright Stars', place:'Living Room', duration:34, cast:['max'], speech:[['stars',1.5]], moves:[['max','Wave',6],['max','Wave',28]], effect:[20] },
  { key:'garden', name:'5. Playing Together', place:'Garden', duration:43, cast:['max','maxine'], speech:[['garden',1.5]], moves:[['maxine','Walk To',6,{x:950,y:790}],['max','Wave',11],['maxine','Wave',14],['max','Walk To',24,{x:670,y:790}]] },
  { key:'goodbye', name:'6. Goodbye for Now', place:"Front of Max's house", duration:31, cast:['max','maxine'], speech:[['goodbye',1]], moves:[['max','Wave',23],['maxine','Wave',25]] },
];

try {
  const portFile=join(session.profile,'DevToolsActivePort');
  let targets;
  for(let i=0;i<200&&!targets;i++){
    try { if(existsSync(portFile)){const port=Number(readFileSync(portFile,'utf8').split('\n')[0]);targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();} }
    catch { await delay(100); }
  }
  if(!targets)throw Error('Chrome debugging endpoint did not become ready');
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')browserErrors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.method==='Page.javascriptDialogOpening'){void send('Page.handleJavaScriptDialog',{accept:true});return;}if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
  await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:session.downloads});
  await send('Page.navigate',{url:'http://127.0.0.1:4177/'});await until(`!!document.querySelector('.studio-nav')`);
  // Check saved items through their visible libraries. A prior interrupted run may
  // have completed a UI step but not retained that browser's local storage.
  await nav('Intros');
  const introNames=await evaluate(`[...document.querySelectorAll('.scene-library h2')].map(e=>e.textContent)`);
  if(!introNames.includes('Episode 1 opening'))session.completed=session.completed.filter(n=>n!=='create opening intro and title');
  await nav('Scenes');
  const sceneNames=await evaluate(`[...document.querySelectorAll('.scene-library h2')].map(e=>e.textContent)`);
  for(const spec of scenes)if(!sceneNames.includes(spec.name))session.completed=session.completed.filter(n=>n!==`scene ${spec.key}`);
  await nav('Credits');
  const creditNames=await evaluate(`[...document.querySelectorAll('.scene-library h2')].map(e=>e.textContent)`);
  if(!creditNames.includes('Episode 1 closing credits'))session.completed=session.completed.filter(n=>n!=='create ending credits');
  console.log('SAVED LIBRARIES',JSON.stringify({intros:introNames,scenes:sceneNames,credits:creditNames}));persist();

  await stage('restore approved places',async()=>{
    await nav('Characters');
    await fileInput('section[aria-label="Studio backup"] input[type="file"]',join(root,'proofs/episode-1/background-import/approved-episode-1-places-studio-backup.json'));
    await until(`document.body.textContent.includes('Studio Backup restored')`);
    await nav('Scenes');await click('button','Create Scene');
    const names=await evaluate(`[...document.querySelectorAll('select[aria-label="Scene place"] option')].map(o=>o.textContent)`);
    if(names.length!==6||scenes.some(s=>!names.includes(s.place)))throw Error(`Approved Places missing: ${names}`);
    await nav('Music Studio');
  });
  await stage('compose gentle music',async()=>{
    await nav('Music Studio');await clickContains('.music-big-button','Create a song');
    await setValue('input[aria-label="Song name"]','Meet Max — gentle morning theme');
    await setValue('input[aria-label="Song tempo"]','72');await setValue('input[aria-label="Song bars"]','4');await setValue('input[aria-label="Master volume"]','.45');
    await clickContains('.music-add-instrument','Add Instrument');await evaluate(`document.querySelector('button[aria-label="Add Piano instrument"]').click()`);
    await clickContains('.music-preset-card','Calm and slow');
    await clickContains('.music-save-button','Save Song');await clickContains('.music-export-button','Add to Audio Library');
    await until(`document.querySelector('.music-render-result')?.textContent.includes('in your Audio Library')`,600);
    await screenshot('music-maker.png');
  });
  await stage('make subtle star effect',async()=>{
    await nav('Audio');
    if(await evaluate(`document.body.textContent.includes('Bright Star soft sparkle')`))return;
    await nav('Music Studio');await clickContains('.music-studio-switcher button','Sound Effects');await clickContains('.music-big-button','Create a sound effect');
    await setValue('input[aria-label="Effect name"]','Bright Star soft sparkle');await clickContains('.music-effect-card','Sparkle');
    await setValue('input[aria-label="Effect duration"]','1.2');await setValue('input[aria-label="Effect volume"]','.3');
    await clickContains('.music-save-button','Save Effect');await clickContains('.music-export-button','Add to Audio Library');
    await until(`document.body.textContent.includes('is now in your Audio Library')`,600);
  });
  await stage('generate and save narration',async()=>{
    await nav('Voice Maker');await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready')`,1200);
    await until(`document.querySelectorAll('select[aria-label="AI voice"] option').length>4`);
    await setValue('select[aria-label="Dialogue speaker"]','narrator');
    await setValue('select[aria-label="AI voice"]','kokoro:bf_lily');await setValue('input[aria-label="AI speaking speed"]','.9');
    await click('.voice-card[aria-label="AI Voices"] button','Save voice and pace for this speaker');
    for(const [key,line] of narration){
      await click('.voice-tabs button','AI Voices');
      await setValue('textarea[aria-label="Dialogue text"]',line);
      await setValue('select[aria-label="AI voice"]',key==='device'?'kokoro:bm_george':'kokoro:bf_lily');
      await click('.voice-card[aria-label="AI Voices"] button','Generate dialogue');
      await until(`document.querySelector('.voice-card[aria-label="Voice Editor"] button')?.textContent==='Play original'`,1200);
      await click('.voice-card[aria-label="Voice Editor"] button','Save original');
      await until(`document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes('Original:') && ![...document.querySelectorAll('.voice-card[aria-label="Voice Editor"] button')].some(b=>b.textContent==='Save original')`,400);
      const data=await evaluate(`(()=>{const a=[...document.querySelectorAll('.voice-card[aria-label="Voice Library"] article')].at(-1);return {name:a.querySelector('strong').textContent,duration:Number(a.querySelector('small').textContent.split('s')[0])}})()`);
      session.voices[key]=data;persist();console.log('VOICE',key,data.duration);
    }
    await screenshot('narration-library.png');
  });
  await stage('create opening intro and title',async()=>{
    await nav('Intros');await click('button','Create Intro');
    await setValue('input[aria-label="Intro name"]','Episode 1 opening');
    await setValue('input[aria-label="Intro series title"]','BrightTales');
    await setValue('input[aria-label="Intro episode title"]','Meet Max');
    await choose('select[aria-label="Intro place"]',"Max's bedroom");
    await setValue('input[aria-label="Intro duration"]','14');
    await setValue('select[aria-label="Add Brightling"]','max');
    await audioClip('Meet Max — gentle morning theme','music',0,.22);
    await click('button','Save Intro');await until(`document.querySelector('.scene-status')?.textContent.includes('Intro saved')`);
    await screenshot('intro-editor.png');await captureCanvas('intro-preview.png');
  });

  for(const spec of scenes)await stage(`scene ${spec.key}`,async()=>{
    await nav('Scenes');
    if(await evaluate(`!![...document.querySelectorAll('.scene-heading button')].find(b=>b.textContent.includes('All scenes'))`))await clickContains('.scene-heading button','All scenes');
    await click('button','Create Scene');
    await setValue('input[aria-label="Scene name"]',spec.name);
    await choose('select[aria-label="Scene place"]',spec.place);
    await setValue('input[aria-label="Scene duration"]',spec.duration);
    for(const member of spec.cast)await setValue('select[aria-label="Add Brightling"]',member);
    for(const [member,kind,time,destination] of spec.moves)await action(member,kind,time,destination);
    if(spec.phone){
      await click('.director-cast button','Max');
      for(const [kind,time] of [['Take Out Phone',18],['Hold Phone',19.2],['Tap Phone',22],['Communicate Message',23.2],['Put Away Phone',35]]){
        await seek(time);await click('.director-phone .director-actions button',kind);
        if(kind==='Communicate Message'){
          await setValue('input[aria-label="Communication message"]',"I'm hungry!");
          await choose('select[aria-label="Phone voice"]',session.voices.device.name);
        }
      }
    }
    for(const [key,start] of spec.speech)await audioClip(session.voices[key].name,'speech',start,.8);
    // The same quiet phrase returns with rests; it remains below narration.
    for(let start=0;start+13.4<=spec.duration;start+=13.4)await audioClip('Meet Max — gentle morning theme','music',Number(start.toFixed(1)),.16);
    for(const start of spec.effect??[])await audioClip('Bright Star soft sparkle','effect',start,.22);
    const alert=await evaluate(`document.querySelector('.scene-maker .storage-alert')?.textContent??''`);
    if(alert)throw Error(`${spec.name} invalid: ${alert}`);
    await click('button','Save Scene');await until(`document.querySelector('.scene-status')?.textContent.includes('Scene saved')`);
    await captureCanvas(`${spec.key}-preview.png`);await screenshot(`${spec.key}-editor.png`);
    const saved=await evaluate(`document.querySelector('.scene-status')?.textContent`);
    session.steps.push({scene:spec.name,place:spec.place,duration:Number(await evaluate(`document.querySelector('input[aria-label="Scene duration"]').value`)),status:saved});persist();
  });

  await stage('create ending credits',async()=>{
    await nav('Credits');await click('button','Create Credits');
    await setValue('input[aria-label="Credits name"]','Episode 1 closing credits');
    await setValue('input[aria-label="Credits title"]','Thanks for watching');
    await setValue('select[aria-label="Credits style"]','static');
    await choose('select[aria-label="Credits background"]',"Front of Max's house");
    await setValue('input[aria-label="Credits duration"]','14');
    for(const [index,[heading,name,role]] of [['BrightTales','Meet Max','Episode 1'],['Characters','Max and Maxine','Native2D Brightlings'],['Narration','Lily','Provisional British voice'],['Made with','BrightTales Studio','BrightSenApps']].entries()){
      if(index)await clickContains('.credits-director button','Add credit line');
      await evaluate(`[...document.querySelectorAll('.credit-line-list button')].at(-1).click()`);
      await until(`!!document.querySelector('input[aria-label="Credit heading"]')`);
      await setValue('input[aria-label="Credit heading"]',heading);await setValue('input[aria-label="Credit name"]',name);await setValue('input[aria-label="Credit role"]',role);
    }
    await audioClip('Meet Max — gentle morning theme','music',0,.23);
    await click('button','Save Credits');await until(`document.querySelector('.scene-status')?.textContent.includes('Credits saved')`);
    await captureCanvas('credits-preview.png');await screenshot('credits-editor.png');
  });

  await stage('assemble and save complete episode',async()=>{
    await nav('Episodes');
    if(!await evaluate(`!!document.querySelector('input[aria-label="Episode name"]')`))await click('button','Create Episode');
    await setValue('input[aria-label="Episode name"]','Meet Max — Episode 1');
    await choose('select[aria-label="Episode intro"]','Episode 1 opening');
    await choose('select[aria-label="Episode credits"]','Episode 1 closing credits');
    if(await evaluate(`document.querySelectorAll('.episode-cards article').length`)===0)
      for(const spec of scenes)await evaluate(`(()=>{const a=[...document.querySelectorAll('.episode-scene-library article')].find(e=>e.querySelector('strong')?.textContent===${JSON.stringify(spec.name)});if(!a)throw Error('Missing saved scene '+${JSON.stringify(spec.name)});a.querySelector('button').click();return true})()`);
    if(await evaluate(`document.querySelectorAll('.episode-cards article').length`)!==6)throw Error('Episode has fewer than six scenes');
    await click('button','Save Episode');await until(`document.querySelector('.episode-save-indicator')?.textContent==='Saved'`);
    await screenshot('episode-assembled.png');
    const duration=await evaluate(`Number(document.querySelector('input[aria-label="Episode time"]').max)`);session.duration=duration;persist();
  });
  await stage('reopen saved episode',async()=>{
    await send('Page.reload',{ignoreCache:true});await until(`!!document.querySelector('.studio-nav')`);
    await nav('Episodes');await click('.scene-library button','Open');
    const names=await evaluate(`[...document.querySelectorAll('.episode-cards h3')].map(e=>e.textContent)`);
    if(names.join('|')!==scenes.map(s=>s.name).join('|'))throw Error(`Saved episode order incorrect: ${names}`);
    session.savedSceneNames=names;await screenshot('episode-reopened.png');
  });
  await stage('export editable Studio Backup',async()=>{
    await nav('Characters');await click('section[aria-label="Studio backup"] button','Export Studio Backup');
    const download=await waitDownload('.json');const target=join(out,'meet-max-episode-1-studio-backup.json');copyFileSync(download,target);
    const data=JSON.parse(readFileSync(target,'utf8'));
    if(data.version!==8||data.timedScenes.scenes.length!==6||data.episodes.episodes.length!==1||data.intros.intros.length!==1||data.credits.credits.length!==1)throw Error('Incomplete exported Studio Backup');
    session.backupSummary={version:data.version,scenes:data.timedScenes.scenes.map(s=>({name:s.name,duration:s.duration,placeId:s.placeId,characters:Object.keys(s.characters),actions:s.actions.length,phone:s.phone?.length??0,audio:s.audio?.length??0})),audioAssets:data.audioAssets.length};persist();
  });
  await stage('export full episode video',async()=>{
    await nav('Episodes');await click('.scene-library button','Open');
    await click('button','Export Episode Video');
    await until(`document.querySelector('.scene-status')?.textContent.includes('Complete episode exported')`,Math.ceil((session.duration+120)*10));
    const download=await waitDownload('.webm');const target=join(out,'meet-max-episode-1-first-cut.webm');copyFileSync(download,target);
    session.video={path:target,bytes:statSync(target).size};persist();await screenshot('episode-exported.png');
  });
  if(browserErrors.length)throw Error(`Browser exceptions: ${browserErrors.join(' | ')}`);
}catch(error){session.errors.push({at:new Date().toISOString(),error:String(error),lastStage:session.completed.at(-1)});try{session.uiText=await evaluate(`document.body.innerText.slice(-2500)`);await screenshot('failure.png');}catch{}persist();console.error(error);process.exitCode=1;}
finally{
  if(process.exitCode){session.browserPreserved='Production Chrome profile left running after failure for UI recovery.';chrome.unref();}
  else{try{await send('Browser.close');session.browserPreserved='Closed gracefully after export.';}catch(error){session.errors.push({cleanup:String(error)});}}
  ws?.close();persist();
}
