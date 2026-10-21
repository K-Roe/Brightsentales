import { writeFile } from 'node:fs/promises';

const pages = await fetch('http://127.0.0.1:9253/json/list').then(response => response.json());
const page = pages.find(item => item.type === 'page' && item.url.includes('/proofs/max-rig-v1/review.html'));
if (!page) throw Error('Disposable repair review page is unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(Error(data.error.message)) : resolve(data.result);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
  return result.result.value;
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  const loaded = new Promise(resolve => {
    const onMessage = event => {
      if (JSON.parse(event.data).method === 'Page.loadEventFired') {
        socket.removeEventListener('message', onMessage);
        resolve();
      }
    };
    socket.addEventListener('message', onMessage);
  });
  await send('Page.reload', { ignoreCache: true });
  await loaded;
  const ready = await evaluate(`(async () => { for (let i = 0; i < 100; i++) {
    if (window.maxRigReview) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  } return false; })()`);
  if (!ready) throw Error('Rig assets did not load');
  const neutralVisibleDifferences = await evaluate(`(async () => {
    const { drawMaxRigSource, sitPoseAt } = await import('/src/experimental/maxSitRig.ts');
    const approved = new Image(); approved.src = '/art/max-0.png'; await approved.decode();
    const a = document.createElement('canvas'), b = document.createElement('canvas');
    a.width = b.width = 434; a.height = b.height = 724;
    a.getContext('2d').drawImage(approved, 0, 0);
    drawMaxRigSource(b.getContext('2d'), window.maxRigReview.assets, sitPoseAt(0));
    const p = a.getContext('2d').getImageData(0, 0, 434, 724).data;
    const q = b.getContext('2d').getImageData(0, 0, 434, 724).data;
    let differences = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] !== q[i] || p[i+1] !== q[i+1] || p[i+2] !== q[i+2] || p[i+3] !== q[i+3]) differences++;
    }
    return differences;
  })()`);
  for (const [name, time, chair] of [
    ['repair-standing.png', 0, 'full'],
    ['repair-halfway.png', 1.55, 'full'],
    ['repair-seated.png', 2.8, 'full'],
    ['repair-seated-no-front.png', 2.8, 'back'],
    ['repair-seated-anatomy.png', 2.8, 'none'],
  ]) {
    const data = await evaluate(`(async () => {
      const { drawMaxRigSource, sitPoseAt } = await import('/src/experimental/maxSitRig.ts');
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff9ee'; ctx.fillRect(0, 0, 1200, 1100);
      ctx.fillStyle = '#ebd3a9'; ctx.fillRect(0, 934, 1200, 166);
      ctx.strokeStyle = '#986b70'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 934); ctx.lineTo(1200, 934); ctx.stroke();
      const assets = window.maxRigReview.assets;
      const scale = 1.25, center = 600, floor = 934;
      const chairScale = scale / (355 / 724);
      const chairX = center - 115 * chairScale, chairY = floor - 140 * chairScale * (1029 / 1080);
      if ('${chair}' !== 'none') ctx.drawImage(assets['chair-back'], chairX, chairY, 230 * chairScale, 140 * chairScale);
      const body = document.createElement('canvas'); body.width = 434; body.height = 724;
      drawMaxRigSource(body.getContext('2d'), assets, sitPoseAt(${time}));
      ctx.drawImage(body, center - 217 * scale, floor - 684 * scale, 434 * scale, 724 * scale);
      if ('${chair}' === 'full') ctx.drawImage(assets['chair-front'], chairX, chairY, 230 * chairScale, 140 * chairScale);
      return canvas.toDataURL('image/png').split(',')[1];
    })()`);
    await writeFile(new URL(name, import.meta.url), Buffer.from(data, 'base64'));
  }
  await writeFile(new URL('repair-check.json', import.meta.url), JSON.stringify({
    neutralVisibleDifferences,
    poseTimes: { standing: 0, halfway: 1.55, seated: 2.8 },
    fullMotionRendered: false,
    reason: 'Focused seated pose still fails visual coherence; stopped before full animation.',
  }, null, 2));
} finally {
  socket.close();
}
