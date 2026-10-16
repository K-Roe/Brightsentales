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
const inspect = async () => (await send('Runtime.evaluate', {
  expression: `({active:document.querySelector('.studio-nav .active')?.textContent,documentWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,buttons:[...document.querySelectorAll('.studio-nav button')].map(x=>x.textContent)})`,
  returnByValue: true,
})).result.value;
const screenshot = async name => {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`proofs/milestone3-2/${name}`, Buffer.from(result.data, 'base64'));
};
const click = async selector => {
  const result = await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})?.click()`, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Could not click ${selector}`);
  await new Promise(resolve => setTimeout(resolve, 250));
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 1800));
  const overview = await inspect();
  await screenshot('mobile-characters.png');
  await click('.create-brightling');
  const maker = await inspect();
  await screenshot('mobile-maker.png');
  await click('.studio-nav button:nth-child(4)');
  const playground = await inspect();
  await screenshot('mobile-playground.png');
  await click('.studio-nav button:first-child');
  const returnedToOverview = (await send('Runtime.evaluate', { expression: `!!document.querySelector('.overview-heading') && !document.querySelector('.character-maker')`, returnByValue: true })).result.value;
  const result = { overview, maker, playground, returnedToOverview };
  await writeFile('proofs/milestone3-2/mobile-check.json', JSON.stringify(result, null, 2));
  if ([overview, maker, playground].some(item => item.documentWidth > item.viewport) || !overview.active?.includes('Characters') || !playground.active?.includes('Playground') || !returnedToOverview) process.exitCode = 1;
  console.log(JSON.stringify(result));
} finally {
  ws.close();
}
