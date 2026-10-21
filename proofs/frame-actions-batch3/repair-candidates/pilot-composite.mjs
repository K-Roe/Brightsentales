import { writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9247/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('127.0.0.1:4178'));
if (!page) throw Error('Disposable pilot browser is unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0;
const pending = new Map();
socket.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); } });
function send(method, params = {}) { const id = ++serial; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evalJs(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; }
const code = `async (mode) => {
  const load = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
  const [room, chair, max, maxine, maxIdle, maxineIdle, maxAnticipation, maxineAnticipation, maxLower, maxineLower] = await Promise.all([
    '/art/living-room.png',
    '/art/provisional-actions/repair-candidates/wide-chair-pilot.png',
    '/art/provisional-actions/repair-candidates/max-seated-pilot.png',
    '/art/provisional-actions/repair-candidates/maxine-seated-pilot.png',
    '/art/max-0.png', '/art/maxine-0.png',
    '/art/provisional-actions/repair-candidates/max-sit-anticipation.png',
    '/art/provisional-actions/repair-candidates/maxine-sit-anticipation.png',
    '/art/provisional-actions/max/sit-lowering.png',
    '/art/provisional-actions/maxine/sit-lowering.png',
  ].map(load));
  document.body.innerHTML = '<canvas id="pilot" width="1672" height="941"></canvas>';
  document.body.style.cssText = 'margin:0;background:black';
  const context = document.getElementById('pilot').getContext('2d');
  context.drawImage(room,0,0,1672,941);
  const draw = (sprite, x, y, furniture) => {
    const cw=230,ch=180,left=x-cw/2,top=y-ch;
    context.drawImage(chair,left,top,cw,ch);
    context.drawImage(sprite,x-106.5,y-355*.96,213,355);
    // Additive front chair pass: only the inner cushion lip and outside arms.
    context.save(); context.beginPath();
    context.rect(left,top+ch*.35,cw*.19,ch*.55);
    context.rect(left+cw*.81,top+ch*.35,cw*.19,ch*.55);
    // Keep the seated legs in front of the cushion; the padded outer arms
    // provide the necessary foreground edge without slicing through knees.
    context.clip(); context.drawImage(chair,left,top,cw,ch); context.restore();
  };
  if(mode==='chair'){ draw(max,600,790); draw(maxine,1030,790); }
  if(mode==='sofa'){
    context.drawImage(maxine,860-106.5,448-355*.96,213,355);
    // Trial only: copy exact approved sofa pixels over outer arms and front cushion lip.
    context.save(); context.beginPath();
    context.rect(520,285,90,160); context.rect(1120,285,130,160);
    context.rect(590,401,530,24); context.clip();
    context.drawImage(room,0,0,1672,941); context.restore();
    context.save(); context.beginPath(); context.rect(770,368,180,85); context.clip();
    context.drawImage(maxine,860-106.5,448-355*.96,213,355); context.restore();
  }
  if(mode==='sequence'){
    context.fillStyle='#f6f0ff'; context.fillRect(0,0,1672,941);
    const frames=[[maxIdle,maxAnticipation,maxLower,max],[maxineIdle,maxineAnticipation,maxineLower,maxine]];
    for(let row=0;row<2;row++) for(let column=0;column<4;column++){
      const cx=205+column*410, floor=440+row*435, item=frames[row][column];
      context.drawImage(chair,cx-115,floor-180,230,180);
      context.drawImage(item,cx-106.5,floor-355*.96,213,355);
      context.fillStyle='#33224f'; context.font='28px Arial';
      context.fillText(['Idle','Anticipation','Lower','Seated'][column],cx-90,floor+45);
    }
  }
  return { ok:true, mode };
}`;
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1672, height: 941, deviceScaleFactor: 1, mobile: false });
  for (const mode of ['chair', 'sofa', 'sequence']) {
    await evalJs(`(${code})(${JSON.stringify(mode)})`);
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL(`./pilot-${mode}.png`, import.meta.url), Buffer.from(image.data, 'base64'));
  }
} finally { socket.close(); }
