import { writeFile } from 'node:fs/promises';
const root = 'proofs/milestone4a-1-move-fix/';
const target = await fetch('http://127.0.0.1:9238/json/new?http://127.0.0.1:4180/', { method: 'PUT' }).then(result => result.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let serial = 0;
const pending = new Map();
ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, data => data.error ? reject(new Error(data.error.message)) : resolve(data.result)); ws.send(JSON.stringify({ id, method, params })); });
const js = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const shot = async filename => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(root + filename, Buffer.from(result.data, 'base64')); };
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 900, deviceScaleFactor: 1, mobile: false });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await js(`[...document.querySelectorAll('.studio-nav button')].find(e=>e.textContent.includes('Places')).click()`);
  await js(`[...document.querySelectorAll('.folder-card')].find(e=>e.textContent.includes('House')).click()`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const desktop = await js(`({cards:[...document.querySelectorAll('.place-card')].map(card=>({name:card.querySelector('h3').textContent,buttons:[...card.querySelectorAll('button')].map(x=>({text:x.textContent,disabled:x.disabled})),select:card.querySelector('select')?.outerHTML})),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth})`);
  await shot('before-desktop-house.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 350));
  const mobile = await js(`({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth})`);
  await shot('before-mobile-house.png');
  await writeFile(root + 'before-inspection.json', JSON.stringify({ desktop, mobile }, null, 2));
  console.log(JSON.stringify({ desktopButtons: desktop.cards[1].buttons, select: desktop.cards[1].select, mobile }));
} finally { ws.close(); }
