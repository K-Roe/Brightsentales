import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

let ws, serial = 1;
const errors = [];
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = serial++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; };
const profile = mkdtempSync(join(tmpdir(), 'brighttales-ui-b-'));
const chrome = spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => { const reply = JSON.parse(event.data); if (!reply.id) { if (reply.method === 'Runtime.exceptionThrown' || reply.method === 'Network.loadingFailed' || reply.method === 'Runtime.consoleAPICalled' && reply.params.type === 'error') errors.push(reply); return; } const waiter = pending.get(reply.id); if (!waiter) return; pending.delete(reply.id); reply.error ? waiter.reject(Error(reply.error.message)) : waiter.resolve(reply.result); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  for (let i = 0; i < 100 && !(await evaluate('!!document.querySelector(".studio-nav")')); i++) await delay(100);
  const sections = ['characters','places','scenes','intros','episodes','credits','music','audio','playground'];
  const results = [];
  mkdirSync('proofs/ui-package-b', { recursive: true });
  for (const theme of ['dark','light']) {
    await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    for (const section of sections) {
      await evaluate(`[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.toLowerCase().includes('${section === 'music' ? 'music studio' : section}')).click()`);
      await delay(180);
      const state = await evaluate(`({theme:document.documentElement.dataset.theme,section:document.querySelector('.studio-nav button.active')?.textContent.trim(),bodyWidth:document.body.scrollWidth,viewport:innerWidth,background:getComputedStyle(document.querySelector('.app-shell')).backgroundColor,text:getComputedStyle(document.querySelector('.main')).color})`);
      const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
      writeFileSync(`proofs/ui-package-b/${theme}-${section}.png`, Buffer.from(shot.data,'base64'));
      results.push({ requested:theme, section, ...state });
      if (section === 'characters') {
        await evaluate(`document.querySelector('.create-brightling')?.click()`);
        await delay(120);
        const detail = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        writeFileSync(`proofs/ui-package-b/${theme}-character-form.png`, Buffer.from(detail.data,'base64'));
      }
      if (section === 'scenes') {
        await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Create Scene')?.click()`);
        await delay(120);
        const detail = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        writeFileSync(`proofs/ui-package-b/${theme}-scene-editor.png`, Buffer.from(detail.data,'base64'));
      }
      if (section === 'music') {
        await evaluate(`document.querySelector('.music-big-button')?.click()`);
        await evaluate(`document.querySelector('.music-add-instrument')?.click()`);
        await delay(100);
        const picker = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        writeFileSync(`proofs/ui-package-b/${theme}-instrument-picker.png`, Buffer.from(picker.data,'base64'));
        await evaluate(`document.querySelector('button[aria-label="Add Piano instrument"]')?.click()`);
        await delay(100);
        const detail = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        writeFileSync(`proofs/ui-package-b/${theme}-music-editor.png`, Buffer.from(detail.data,'base64'));
        await evaluate(`[...document.querySelectorAll('.music-studio-switcher button')].find(button=>button.textContent.includes('Sound Effects'))?.click()`);
        const effects = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
        writeFileSync(`proofs/ui-package-b/${theme}-sound-effects.png`, Buffer.from(effects.data,'base64'));
      }
    }
  }
  await send('Page.reload');
  await delay(250);
  const persisted = await evaluate(`({theme:document.documentElement.dataset.theme,choice:document.querySelector('.appearance-control select')?.value})`);
  await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='system';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await send('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'dark'}] });
  await delay(150);
  const systemDark = await evaluate(`document.documentElement.dataset.theme`);
  await send('Emulation.setEmulatedMedia', { features:[{name:'prefers-color-scheme',value:'light'}] });
  await delay(150);
  const systemLight = await evaluate(`document.documentElement.dataset.theme`);
  await evaluate(`localStorage.removeItem('brightsenappstales.appearance');localStorage.setItem('brightsenappstales.music-theme','light')`);
  await send('Page.reload'); await delay(250);
  const legacy = await evaluate(`document.documentElement.dataset.theme`);
  await evaluate(`localStorage.removeItem('brightsenappstales.music-theme')`);
  await send('Page.reload'); await delay(250);
  const defaultTheme = await evaluate(`document.documentElement.dataset.theme`);
  await send('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
  await delay(150);
  const mobile = await evaluate(`({width:document.body.scrollWidth,viewport:innerWidth})`);
  const mobileShot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
  writeFileSync('proofs/ui-package-b/dark-mobile.png',Buffer.from(mobileShot.data,'base64'));
  const preferenceResults = { persisted, systemDark, systemLight, legacy, defaultTheme, mobile };
  writeFileSync('proofs/ui-package-b/preference-results.json',JSON.stringify(preferenceResults,null,2));
  writeFileSync('proofs/ui-package-b/browser-results.json',JSON.stringify(results,null,2));
  writeFileSync('proofs/ui-package-b/browser-errors.json',JSON.stringify(errors,null,2));
  console.log(JSON.stringify(results.map(({ requested,section,theme,bodyWidth,viewport })=>({requested,section,theme,overflow:bodyWidth>viewport})),null,2));
  console.log(JSON.stringify(preferenceResults,null,2));
  if (results.some(result=>result.theme!==result.requested || result.bodyWidth>result.viewport) || errors.length || persisted.theme!=='light' || persisted.choice!=='light' || systemDark!=='dark' || systemLight!=='light' || legacy!=='light' || defaultTheme!=='dark' || mobile.width>mobile.viewport) process.exitCode=1;
} finally { ws?.close(); const cleanup = spawnSync('powershell',['-NoProfile','-File','proofs/ui-package-a/cleanup.ps1'],{env:{...process.env,BRIGHTTALES_TEST_PROFILE:profile},windowsHide:true}); if (cleanup.status !== 0) console.warn('Temporary browser profile cleanup needs attention:',profile); }
