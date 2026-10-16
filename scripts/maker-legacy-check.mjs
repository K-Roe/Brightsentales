import { writeFile } from 'node:fs/promises';

const tab = await fetch('http://127.0.0.1:9228/json/new?http://127.0.0.1:4173/', { method: 'PUT' }).then(response => response.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const waiting = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; waiting.set(next, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await send('Page.enable'); await send('Runtime.enable'); await pause(1800);
  const oldScene = { version: 1, characters: { max: { start: { x: 325, y: 700 }, destination: null }, maxine: { start: { x: 1280, y: 820 }, destination: { x: 900, y: 810 } } } };
  await evaluate(`localStorage.setItem('brightsenappstales.scene.v1',${JSON.stringify(JSON.stringify(oldScene))})`);
  await send('Page.reload'); await pause(2200);
  const result = await evaluate(`({names:[...document.querySelectorAll('.character-card strong')].map(x=>x.textContent),status:document.querySelector('[role=status]')?.textContent,scene:JSON.parse(localStorage.getItem('brightsenappstales.scene.v1'))})`);
  const passed = result.names.includes('Max') && result.names.includes('Maxine') && !result.names.includes('Charlie') && result.scene.characters.max.start.x === 325 && errors.length === 0;
  await writeFile('proofs/milestone3-maker/legacy-scene-check.json', JSON.stringify({ passed, errors, result }, null, 2));
  console.log(JSON.stringify({ passed, names: result.names, errors }));
  if (!passed) process.exitCode = 1;
} finally { ws.close(); }
