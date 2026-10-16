import { writeFile } from 'node:fs/promises';

const target = await fetch('http://127.0.0.1:9232/json/new?http://127.0.0.1:4176/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const waiting = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)(message);
    waiting.delete(message.id);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  waiting.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
  ws.send(JSON.stringify({ id, method, params }));
});
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(resolve => setTimeout(resolve, 1800));
  const result = (await send('Runtime.evaluate', {
    expression: `({active:document.querySelector('.studio-nav .active')?.textContent,library:JSON.parse(localStorage.getItem('brightsenappstales.brightlings.v1')),scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1')),customCards:document.querySelectorAll('.portrait-card:not(.default-character)').length})`,
    returnByValue: true,
  })).result.value;
  const passed = result.active?.includes('Characters') && result.library?.length === 1 && result.customCards === 1 && result.library[0].name === 'Charles' && result.scene?.characters?.max && result.scene?.characters?.maxine;
  await writeFile('proofs/milestone3-2/restart-check.json', JSON.stringify({ passed: !!passed, characterId: result.library?.[0]?.id, sceneIds: Object.keys(result.scene?.characters ?? {}) }, null, 2));
  console.log(JSON.stringify({ passed: !!passed, characterId: result.library?.[0]?.id }));
  if (!passed) process.exitCode = 1;
} finally {
  ws.close();
}
