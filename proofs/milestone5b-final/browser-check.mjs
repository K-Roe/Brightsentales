// Disposable Chrome/CDP acceptance check. Never opens Karl's normal profile.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/milestone5b-final');
const profile = mkdtempSync(join(tmpdir(), 'brightsen-wardrobe-isolated-'));
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,960', 'about:blank'], { stdio: 'ignore' });
let ws;
const pending = new Map();
const errors = [];
let nextId = 1;

async function connect() {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  if (!existsSync(portFile)) throw new Error('Chrome debugging port did not open');
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find(item => item.type === 'page');
  if (!target) throw new Error('No isolated Chrome page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', rejectOpen, { once: true });
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
  });
}

function send(method, params = {}) {
  return new Promise((resolveCall, rejectCall) => {
    const id = nextId++;
    pending.set(id, { resolve: resolveCall, reject: rejectCall });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(root, name), Buffer.from(result.data, 'base64'));
}

async function clickStage(stageX, stageY) {
  const box = await evaluate(`(() => { const c = document.querySelector('canvas'); c.scrollIntoView({block:'center'}); const r = c.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  const x = box.x + stageX * box.width / 1672;
  const y = box.y + stageY * box.height / 941;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

const findings = { profile: 'isolated temporary Chrome profile', screenshots: [], errors };
try {
  await connect();
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await delay(200);
    ready = await evaluate(`!!document.querySelector('#max-outfit')`);
    if (ready) break;
  }
  if (!ready) throw new Error(`Studio did not render: ${JSON.stringify(await evaluate(`({ url: location.href, title: document.title, body: document.body?.innerText?.slice(0,300) })`))}; console: ${errors.join(' | ')}`);
  findings.defaultTab = await evaluate(`document.querySelector('.studio-nav button.active')?.textContent?.trim()`);
  findings.initialStorage = await evaluate(`localStorage.length`);
  await screenshot('characters-original-desktop.png'); findings.screenshots.push('characters-original-desktop.png');

  findings.maxChange = await evaluate(`(() => { const s=document.querySelector('#max-outfit'); s.value='tshirt-trousers'; s.dispatchEvent(new Event('change',{bubbles:true})); return s.value; })()`);
  findings.maxineChange = await evaluate(`(() => { const s=document.querySelector('#maxine-outfit'); s.value='tshirt-leggings'; s.dispatchEvent(new Event('change',{bubbles:true})); return s.value; })()`);
  await delay(700);
  findings.savedScene = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))`);
  findings.cardImages = await evaluate(`[...document.querySelectorAll('.default-character .portrait-art img')].map(i=>i.getAttribute('src'))`);
  await screenshot('characters-alternative-outfits-desktop.png'); findings.screenshots.push('characters-alternative-outfits-desktop.png');

  await evaluate(`document.querySelectorAll('.studio-nav button')[3].click()`);
  await delay(600);
  findings.playgroundImages = await evaluate(`[...document.querySelectorAll('.character-card img')].map(i=>i.getAttribute('src'))`);
  await screenshot('playground-alternative-outfits.png'); findings.screenshots.push('playground-alternative-outfits.png');
  await evaluate(`[...document.querySelectorAll('.character-card')].find(b=>b.textContent.includes('Maxine')).click()`);
  await evaluate(`document.querySelector('.wave-button').click()`);
  await delay(550);
  await screenshot('maxine-waving.png'); findings.screenshots.push('maxine-waving.png');
  await delay(1500);
  findings.waveReturnNotice = await evaluate(`document.querySelector('.tip [role=status]')?.textContent`);

  await clickStage(1450, 800);
  findings.rightDestinationNotice = await evaluate(`document.querySelector('.tip [role=status]')?.textContent`);
  await evaluate(`document.querySelector('.play-button').click()`);
  await delay(500);
  await screenshot('maxine-walking-right.png'); findings.screenshots.push('maxine-walking-right.png');
  await delay(1900);
  await clickStage(720, 800);
  await evaluate(`document.querySelector('.play-button').click()`);
  await delay(500);
  await screenshot('maxine-walking-left.png'); findings.screenshots.push('maxine-walking-left.png');
  await delay(3000);
  await evaluate(`[...document.querySelectorAll('.save-actions button')].find(b=>b.textContent.includes('Save scene')).click()`);
  await send('Page.reload', { ignoreCache: true });
  await delay(1200);
  findings.reloadedScene = await evaluate(`JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))`);
  findings.reloadedMaxineCard = await evaluate(`document.querySelectorAll('.default-character .portrait-art img')[1]?.getAttribute('src')`);
  await screenshot('characters-after-reload.png'); findings.screenshots.push('characters-after-reload.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(400);
  await screenshot('characters-mobile.png'); findings.screenshots.push('characters-mobile.png');
} catch (error) {
  findings.failure = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (ws) ws.close();
  const resolved = resolve(profile);
  const allowed = resolve(tmpdir()) + '\\brightsen-wardrobe-isolated-';
  if (!resolved.startsWith(allowed)) throw new Error('Refusing to remove an unexpected browser profile path');
  const profileLiteral = resolved.replaceAll("'", "''");
  const cleanup = `$profilePath='${profileLiteral}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -like '*${profileLiteral.split('\\').pop()}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 600; Remove-Item -LiteralPath $profilePath -Recurse -Force -ErrorAction Stop`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', cleanup], { encoding: 'utf8' });
  findings.profileRemoved = result.status === 0 && !existsSync(resolved);
  if (!findings.profileRemoved) { console.error('Disposable profile cleanup failed:', result.stderr); process.exitCode = 1; }
  writeFileSync(join(root, 'browser-check.json'), JSON.stringify(findings, null, 2));
}
