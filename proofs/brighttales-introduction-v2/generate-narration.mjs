import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/brighttales-introduction-v2');
const onlyMaxine = process.argv.includes('--maxine-only');
const relation = process.argv.includes('--friend') ? 'friend' : 'sister';
const source = onlyMaxine ? join(root, 'narration-interim-backup.json') : resolve('proofs/brighttales-introduction-v1/introduction-studio-backup-v8.json');
const destination = join(root, onlyMaxine ? 'narration-library-backup.json' : 'narration-interim-backup.json');
const downloads = await mkdtemp(join(tmpdir(), 'bright-v2-audio-download-'));
const profile = await mkdtemp(join(tmpdir(), 'bright-v2-audio-profile-'));
await mkdir(join(root, 'narration'), { recursive: true });
const lines = [
  ['welcome', 'Hello, everyone! Welcome to BrightTales! A wonderful little world where we can learn, play and have fun together!'],
  ['max_1', 'Everyone, meet Max! Max is a friendly Brightling who loves exploring and discovering new things!'],
  ['max_2', "Max doesn't use spoken words to communicate, but he has lots of wonderful things to say!"],
  ['maxine', `And this is Maxine! She's Max's ${relation}, and together they love going on little adventures!`],
  ['speak_1', 'Sometimes, telling someone what you want or how you feel can be difficult.'],
  ['speak_2', "That's where Bright Speak comes in!"],
  ['speak_3', 'Bright Speak helps children communicate, using pictures and words to help share what they want to say.'],
  ['world_1', 'In BrightTales, Max and Maxine will explore, learn and discover new things together!'],
  ['world_2', "And there's always something exciting waiting around the corner!"],
  ['goodbye_1', "Thank you for joining us! We can't wait to see you again!"],
  ['goodbye_2', 'Bye-bye, everyone!'],
];
const selected = lines.filter(([key]) => onlyMaxine ? key === 'maxine' : key !== 'maxine');
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, serial = 0;
const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result.value; };
const until = async (expression, tries = 1200) => { for (let i = 0; i < tries; i++) { if (await js(expression)) return; await delay(100); } throw Error(`Timed out: ${expression}; message=${await js(`document.querySelector('.form-message')?.textContent??document.querySelector('.voice-message')?.textContent`)}`); };
const click = (selector, label) => js(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});b.click();return true})()`);
const setValue = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input '+${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const nav = name => js(`[...document.querySelectorAll('.studio-nav button')].find(b=>b.textContent.includes(${JSON.stringify(name)})).click()`);
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Disposable Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const call = pending.get(data.id); pending.delete(data.id); data.error ? call.reject(Error(data.error.message)) : call.resolve(data.result); } if (data.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true }); if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text); if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Page.navigate', { url: 'http://127.0.0.1:4177/' });
  await until(`!!document.querySelector('.studio-nav')`);
  await nav('Characters');
  const { root: dom } = await send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await send('DOM.querySelector', { nodeId: dom.nodeId, selector: 'section[aria-label="Studio backup"] input[type="file"]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [source] });
  await until(`document.querySelector('.form-message')?.textContent.includes('restored')`, 500);
  await nav('Voice Maker');
  await until(`document.querySelector('.voice-service-status')?.textContent.includes('Voice engine: Ready')`);
  await until(`!![...document.querySelectorAll('select[aria-label="AI voice"] option')].find(o=>o.value==='kokoro:bf_lily')`);
  await setValue('select[aria-label="Dialogue speaker"]', 'narrator');
  await setValue('select[aria-label="AI voice"]', 'kokoro:bf_lily');
  await setValue('input[aria-label="AI speaking speed"]', '0.9');
  await click('.voice-card[aria-label="AI Voices"] button', 'Save voice and pace for this speaker');
  for (const [key, line] of selected) {
    console.log('GENERATING', key);
    await click('.voice-tabs button', 'AI Voices');
    await setValue('textarea[aria-label="Dialogue text"]', line);
    await click('.voice-card[aria-label="AI Voices"] button', 'Generate dialogue');
    await until(`document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes(${JSON.stringify(line.slice(0, 25))}) && !![...document.querySelectorAll('.voice-card[aria-label="Voice Editor"] button')].find(b=>b.textContent==='Save original')`);
    await click('.voice-card[aria-label="Voice Editor"] button', 'Save original');
    await until(`document.querySelector('.voice-card[aria-label="Voice Editor"]')?.textContent.includes(${JSON.stringify(line.slice(0, 25))}) && ![...document.querySelectorAll('.voice-card[aria-label="Voice Editor"] button')].some(b=>b.textContent==='Save original')`, 500);
    console.log('SAVED', key);
  }
  await nav('Characters');
  await click('section[aria-label="Studio backup"] button', 'Export Studio Backup');
  let file;
  for (let i = 0; i < 300; i++) { file = (await readdir(downloads)).find(name => name.endsWith('.json')); if (file && (await stat(join(downloads, file))).size > 1000) break; await delay(100); }
  if (!file) throw Error('Studio Backup download missing');
  const backup = JSON.parse(await readFile(join(downloads, file), 'utf8'));
  await writeFile(destination, JSON.stringify(backup, null, 2) + '\n');
  const manifest = [];
  for (const [key, line] of lines) {
    const asset = backup.audioAssets.find(item => item.name.includes(line.slice(0, 40)));
    if (!asset) { if (onlyMaxine) throw Error(`Missing narration asset: ${key}`); else continue; }
    const name = `${key}.wav`;
    await writeFile(join(root, 'narration', name), Buffer.from(asset.data, 'base64'));
    manifest.push({ key, line, assetId: asset.id, name: asset.name, duration: asset.duration, size: asset.size, file: `narration/${name}` });
  }
  await writeFile(join(root, onlyMaxine ? 'narration-manifest.json' : 'narration-interim-manifest.json'), JSON.stringify({ voice: 'kokoro:bf_lily', speed: 0.9, relation, lines: manifest, browserErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify({ saved: manifest.length, backup: destination, errors }));
} catch (error) { await writeFile(join(root, 'narration-generation-failure.json'), JSON.stringify({ error: String(error), errors }, null, 2) + '\n'); throw error; }
finally { try { if (ws) await send('Browser.close'); } catch { chrome.kill(); } ws?.close(); }
