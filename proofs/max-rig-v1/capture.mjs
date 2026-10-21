import { writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9252/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('/proofs/max-rig-v1/review.html'));
if (!page) throw Error('Disposable review page is unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let serial = 0;
const pending = new Map();
const failures = [];
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.exceptionThrown') failures.push({ type: 'exception', message: data.params.exceptionDetails.text });
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') failures.push({ type: 'console', message: data.params.entry.text });
  if (data.method === 'Network.loadingFailed') failures.push({ type: 'request', message: data.params.errorText });
  if (data.id && pending.has(data.id)) { const callback = pending.get(data.id); pending.delete(data.id); data.error ? callback.reject(Error(data.error.message)) : callback.resolve(data.result); }
});
function send(method, params = {}) { const id = ++serial; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); }
async function evalJs(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
  return result.result.value;
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(name, import.meta.url), Buffer.from(result.data, 'base64'));
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1704, height: 1150, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4182/proofs/max-rig-v1/review.html' });
  const ready = await evalJs(`(async () => { for (let i=0;i<100;i++) { if (window.maxRigReview) return true; await new Promise(resolve=>setTimeout(resolve,100)); } return false; })()`);
  if (!ready) throw Error('Rig review did not load');
  const neutralPixels = await evalJs(`(async () => {
    const { drawMaxRigSource, sitPoseAt } = await import('/src/experimental/maxSitRig.ts');
    const original = new Image(); original.src = '/art/max-0.png'; await original.decode();
    const canvasA = document.createElement('canvas'), canvasB = document.createElement('canvas');
    canvasA.width = canvasB.width = 434; canvasA.height = canvasB.height = 724;
    const a = canvasA.getContext('2d'), b = canvasB.getContext('2d');
    a.drawImage(original, 0, 0); drawMaxRigSource(b, window.maxRigReview.assets, sitPoseAt(0));
    const p = a.getImageData(0,0,434,724).data, q = b.getImageData(0,0,434,724).data;
    let visibleDifferences = 0, largestChannelDifference = 0;
    for(let i=0;i<p.length;i+=4) if(p[i+3] || q[i+3]) {
      const d = Math.max(Math.abs(p[i]-q[i]), Math.abs(p[i+1]-q[i+1]), Math.abs(p[i+2]-q[i+2]), Math.abs(p[i+3]-q[i+3]));
      if(d) visibleDifferences++; largestChannelDifference = Math.max(largestChannelDifference,d);
    }
    return { visibleDifferences, largestChannelDifference };
  })()`);
  await evalJs(`(window.maxRigReview.setMode('comparison'), true)`);
  await screenshot('standing-comparison.png');
  await evalJs(`(window.maxRigReview.setMode('joints'), true)`);
  await screenshot('joint-diagram.png');
  for (const [time, name] of [[1.15, 'knee-bend.png'], [2.8, 'seated-contact.png'], [4.45, 'standing-up.png']]) {
    await evalJs(`(window.maxRigReview.setMode('motion'), window.maxRigReview.renderAt(${time}), true)`);
    await screenshot(name);
  }
  const video = await evalJs(`(async () => {
    window.maxRigReview.start();
    const stream = window.maxRigReview.canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 });
    const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const done = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 6800)); recorder.stop(); await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ data: reader.result.split(',')[1], bytes: blob.size }); reader.readAsDataURL(blob); });
  })()`);
  await writeFile(new URL('max-sit-cycle.webm', import.meta.url), Buffer.from(video.data, 'base64'));
  await writeFile(new URL('browser-check.json', import.meta.url), JSON.stringify({ ready, neutralPixels, videoBytes: video.bytes, failures }, null, 2));
  if (failures.length) throw Error(`Browser errors: ${JSON.stringify(failures)}`);
} finally { socket.close(); }
