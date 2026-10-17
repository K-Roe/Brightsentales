// Documentation milestone: disposable profile smoke check of documented Studio sections.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/f3');
const profile = mkdtempSync(join(tmpdir(), 'brightsen-f3-isolated-'));
const findings = { tabs: [], errors: [], failedAssets: [] };
let ws, serial = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((ok, fail) => { const id = serial++; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.text); return value.result.value; };
try {
  spawn(String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1366,900', 'about:blank'], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await delay(100);
  if (!existsSync(portFile)) throw Error('Isolated Chrome did not start');
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
  ws.addEventListener('message', event => {
    const item = JSON.parse(event.data);
    if (item.id) { const call = pending.get(item.id); if (call) { pending.delete(item.id); item.error ? call.fail(Error(item.error.message)) : call.ok(item.result); } }
    else if (item.method === 'Runtime.exceptionThrown') findings.errors.push(item.params.exceptionDetails.text);
    else if (item.method === 'Runtime.consoleAPICalled' && item.params.type === 'error') findings.errors.push(item.params.args.map(arg => arg.value ?? arg.description).join(' '));
    else if (item.method === 'Network.responseReceived' && item.params.response.status >= 400) findings.failedAssets.push(`${item.params.response.status} ${item.params.response.url}`);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  for (let i = 0; i < 50 && !(await evaluate(`!!document.querySelector('.studio-nav')`)); i++) await delay(100);
  findings.initialStorage = await evaluate('localStorage.length');
  findings.defaultTab = await evaluate(`document.querySelector('.studio-nav button.active')?.textContent.trim()`);
  for (const tab of ['Characters', 'Places', 'Scenes', 'Episodes', 'Audio', 'Playground']) {
    await evaluate(`(() => {const item=[...document.querySelectorAll('.studio-nav button')].find(button=>button.textContent.trim().endsWith(${JSON.stringify(tab)}));if(!item)throw Error('Missing ${tab}');item.click()})()`);
    await delay(100);
    findings.tabs.push({ tab, active: await evaluate(`document.querySelector('.studio-nav button.active')?.textContent.trim()`), heading: await evaluate(`document.querySelector('main h1')?.textContent.trim()`) });
    if (tab === 'Characters') { const shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(root, 'characters-overview.png'), Buffer.from(shot.data, 'base64')); }
  }
  findings.finalStorage = await evaluate('localStorage.length');
} catch (error) { findings.fatal = String(error?.stack ?? error); }
finally {
  try { ws?.close(); } catch { /* ignore */ }
  const target = resolve(profile);
  if (target.startsWith(resolve(tmpdir()) + '\\') && target.includes('brightsen-f3-isolated-')) {
    const command = `$target=$env:F3_PROFILE; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 300; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue`;
    spawnSync('powershell', ['-NoProfile', '-Command', command], { env: { ...process.env, F3_PROFILE: target }, stdio: 'ignore' });
  }
  findings.profileRemoved = !existsSync(profile);
  writeFileSync(join(root, 'browser-results.json'), JSON.stringify(findings, null, 2));
  process.stdout.write(JSON.stringify(findings, null, 2));
  if (findings.fatal || findings.errors.length || findings.failedAssets.length || !findings.profileRemoved || findings.tabs.length !== 6) process.exitCode = 1;
}
