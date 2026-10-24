import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('proofs/cartoon-life-v1');
const max = (await readFile('public/art/max-0.png')).toString('base64');
const maxine = (await readFile('public/art/maxine-0.png')).toString('base64');
const profile = await mkdtemp(join(tmpdir(), 'bright-blink-study-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let socket, serial = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolveCall, reject) => { const id = ++serial; pending.set(id, { resolve: resolveCall, reject }); socket.send(JSON.stringify({ id, method, params })); });
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); } }
  if (!port) throw Error('Chrome did not start');
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolveOpen => socket.addEventListener('open', resolveOpen, { once: true }));
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(Error(message.error.message)) : callback.resolve(message.result); } });
  const source = `data:image/png;base64,${max}`;
  const other = `data:image/png;base64,${maxine}`;
  const expression = `(async()=>{
    const load=url=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.src=url});
    const [max,maxine]=await Promise.all([load(${JSON.stringify(source)}),load(${JSON.stringify(other)})]);
    const canvas=document.createElement('canvas');canvas.width=1736;canvas.height=724;
    const c=canvas.getContext('2d');
    c.drawImage(max,0,0);c.drawImage(maxine,434,0);
    c.drawImage(max,868,0);c.drawImage(maxine,1302,0);
    function eye(x,y,rx,ry,top,bottom,line,lashes){
      c.save();c.shadowColor=top;c.shadowBlur=6;
      const fill=c.createLinearGradient(0,y-ry,0,y+ry);fill.addColorStop(0,top);fill.addColorStop(1,bottom);
      c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.restore();
      c.strokeStyle=line;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(x-rx+6,y+1);c.quadraticCurveTo(x,y+19,x+rx-6,y+1);c.stroke();
      if(lashes){for(const side of [-1,1]){const end=x+side*(rx-7);c.beginPath();c.moveTo(end,y+2);c.lineTo(end+side*7,y-5);c.stroke();}}
    }
    eye(868+158,254,42,46,'#50d7c9','#60d3c4','#20686d',false);
    eye(868+287,254,42,46,'#50d7c9','#60d3c4','#20686d',false);
    eye(1302+158,315,37,40,'#f59db7','#f59ebd','#71305d',true);
    eye(1302+258,315,37,40,'#f59db7','#f59ebd','#71305d',true);
    return canvas.toDataURL('image/png');
  })()`;
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
  await writeFile(join(root, 'blink-study.png'), Buffer.from(result.result.value.split(',')[1], 'base64'));
} finally { socket?.close(); chrome.kill(); }
