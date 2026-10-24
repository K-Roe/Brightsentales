import { mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Real UI operations in a fresh Chrome profile. Unity is a separate Play mode test on port 17844.
const root = resolve('proofs/studio-3');
const profile = await mkdtemp(join(tmpdir(), 'bright-foundation-phase2-chrome-'));
const unityProof = await mkdtemp(join(tmpdir(), 'bright-foundation-phase2-unity-'));
const studioUrl = process.env.STUDIO_URL ?? 'http://127.0.0.1:5177/';
const unityRoot = 'C:\\Users\\karlr\\repos\\BrightTalesCartoonFoundationUnity';
const unityExe = 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.6.7f1\\Editor\\Unity.exe';
const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const findings = { profile, unityProof, studioUrl, stages: {}, bridgeRequests: [], bridgeReplies: [], errors: [] };
let chrome, unity, socket, serial = 0;
let pending = new Map();
const wait = async (condition, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const result = await condition(); if (result) return result; await delay(150); }
  throw Error('Timed out waiting for required UI or Unity state.');
};
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++serial; pending.set(id, { resolveCall, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const js = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const until = (expression, ms = 30000) => wait(() => js(expression), ms);
const button = (label, scope = 'document') => js(`(()=>{const b=[...(${scope}).querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(!b)throw Error('Missing button '+${JSON.stringify(label)});if(b.disabled)throw Error('Disabled button '+${JSON.stringify(label)});b.click();return true})()`);
const select = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const input = (selector, value) => js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value})()`);
const screenshot = async name => {
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(root, name), Buffer.from(image.data, 'base64'));
};
const savedScene = () => js(`JSON.parse(localStorage.getItem('brightsenappstales.timed-scenes.v1')).scenes[0]`);
const nav = label => js(`(()=>{const b=[...document.querySelectorAll('.studio3-nav button')].find(x=>x.textContent.includes(${JSON.stringify(label)}));if(!b)throw Error('Missing nav '+${JSON.stringify(label)});b.click();return true})()`);

async function openChrome() {
  chrome = spawn(chromeExe, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1600,1100', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const page = await wait(async () => {
    try {
      const port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      return pages.find(item => item.type === 'page');
    } catch { return null; }
  }, 20000);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id); pending.delete(message.id);
      message.error ? callback.reject(Error(message.error.message)) : callback.resolveCall(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') findings.errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') findings.errors.push(message.params.entry.text);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes(':17844/command')) {
      try { findings.bridgeRequests.push(JSON.parse(message.params.request.postData)); } catch { /* Body may be omitted by CDP. */ }
    }
    if (message.method === 'Network.responseReceived' && message.params.response.url.includes(':17844/command')) {
      void send('Network.getResponseBody', { requestId: message.params.requestId }).then(result => {
        try { findings.bridgeReplies.push(JSON.parse(result.body)); } catch { /* A rejected response may be unavailable. */ }
      }).catch(() => {});
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Page.navigate', { url: studioUrl });
  await until(`!!document.querySelector('.studio3-nav')`);
}

async function closeChrome() {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await Promise.race([send('Browser.close'), delay(800)]); } catch { /* Closing the socket is expected. */ }
    socket.close();
  }
  if (chrome?.exitCode === null) {
    await wait(() => chrome.exitCode !== null, 1500).catch(() => {});
    if (chrome.exitCode === null) chrome.kill();
  }
  await wait(() => chrome.exitCode !== null, 10000).catch(() => {});
  try { await unlink(join(profile, 'DevToolsActivePort')); } catch { /* Chrome may already have removed it. */ }
  await delay(500);
}

try {
  await openChrome();
  if (await js(`localStorage.getItem('brightsenappstales.timed-scenes.v1') !== null`)) throw Error('Disposable profile was not empty.');
  findings.stages.launch = 'PASS';
  await nav('Cartoon Editor'); await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create Scene')`);
  await button('Create Scene'); await until(`!!document.querySelector('input[aria-label="Scene name"]')`);
  await input('input[aria-label="Scene name"]', 'Max and Maxine — A Gentle Hello');
  await input('input[aria-label="Scene duration"]', 9);
  await select('select[aria-label="Add Brightling"]', 'max');
  await select('select[aria-label="Add Brightling"]', 'maxine');
  await js(`document.querySelector('.scene-hierarchy > button').click()`);
  await button('Walk To', `document.querySelector('.director-actions')`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Walk To')`);
  await input('input[aria-label="Action start time"]', .7);
  await input('input[aria-label="Selected action duration"]', 2.5);
  await button('Wait', `document.querySelector('.director-actions')`);
  await button('Wave', `document.querySelector('.director-actions')`);
  await button('Disappear', `document.querySelector('.director-actions')`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Disappear')`);
  await input('input[aria-label="Action start time"]', 8.5);
  await js(`document.querySelectorAll('.scene-hierarchy > button')[1].click()`);
  await button('Restart', `document.querySelector('.scene-playback')`);
  await button('Look toward', `document.querySelector('.scene-action-choices')`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Look toward')`);
  await input('input[aria-label="Action start time"]', .9);
  await input('input[aria-label="Selected action duration"]', 2.3);
  await select('select[aria-label="Look toward"]', 'max');
  await button('Wait', `document.querySelector('.director-actions')`);
  await button('Wave', `document.querySelector('.director-actions')`);
  await button('Disappear', `document.querySelector('.director-actions')`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Disappear')`);
  await input('input[aria-label="Action start time"]', 8.5);
  await button('Restart', `document.querySelector('.scene-playback')`);
  await select('select[aria-label="Camera shot"]', 'medium');
  await select('select[aria-label="Camera focus"]', 'group');
  await button('Add camera keyframe at 0.0s', `document.querySelector('.camera-panel')`);
  await until(`!!document.querySelector('input[aria-label="Camera start time"]')`);
  await input('input[aria-label="Camera start time"]', 3.2);
  await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Scene'&&!b.disabled)`);
  await button('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const first = await savedScene();
  findings.firstActions = first?.actions.map(action => ({ characterId: action.characterId, type: action.type, start: action.start, duration: action.duration }));
  if (!first || first.actions.length !== 10 || first.camera?.length !== 1 || first.life?.mode !== 'v2') throw Error('Scene Maker did not persist the authored performance and camera.');
  await js(`document.querySelector('.scene-stage-main').scrollIntoView({block:'start'})`);
  await screenshot('01-scene-saved.png');
  await js(`document.querySelector('.camera-panel').scrollIntoView({block:'center'})`);
  await screenshot('02-camera-authoring.png');
  findings.stages.createAndSave = 'PASS';
  await closeChrome();
  await delay(800);
  await openChrome(); await nav('Cartoon Editor');
  await until(`!!document.querySelector('.scene-library article')`);
  await js(`document.querySelector('.scene-library article button').click()`);
  await until(`!!document.querySelector('.scene-stage canvas')`);
  const reopened = await savedScene();
  if (reopened.id !== first.id || JSON.stringify(reopened) !== JSON.stringify(first)) throw Error('Saved scene did not reopen unchanged.');
  findings.stages.closeReopen = 'PASS';
  await js(`document.querySelector('.scene-stage-main').scrollIntoView({block:'start'})`);
  await screenshot('03-scene-reopened.png');
  // Select Max's saved Walk To block, then edit it through the normal inspector.
  await js(`(()=>{const b=document.querySelector('.timeline-block[aria-label^="Max Walk To"]');if(!b)throw Error('Missing Max walk block');b.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
  await until(`document.querySelector('.scene-inspector h2')?.textContent?.includes('Walk To')`);
  await input('input[aria-label="Selected action duration"]', 2.2);
  await js(`document.querySelector('.scene-inspector details.advanced-position summary').click()`);
  await input('input[aria-label="Destination X"]', 900);
  await button('Save Scene');
  await until(`document.querySelector('.scene-status')?.textContent?.includes('Scene saved')`);
  const edited = await savedScene();
  const walk = edited.actions.find(action => action.characterId === 'max' && action.type === 'walk');
  if (!walk || walk.duration !== 2.2 || walk.point.x !== 900 || walk.motion !== 'gentle' || edited.id !== first.id) throw Error('Edited revision was not saved.');
  await writeFile(join(root, 'unity-edited-scene.json'), JSON.stringify({ version: 1, scenes: [edited] }, null, 2));
  await js(`document.querySelector('.scene-inspector').scrollIntoView({block:'center'})`);
  await screenshot('04-action-edited.png');
  findings.stages.editAndSave = 'PASS';

  await writeFile(join(unityProof, 'expected.json'), JSON.stringify({ sceneId: edited.id, duration: edited.duration, walkStart: walk.start, walkDuration: walk.duration, attentionTime: 1.7, cameraTime: 5.1 }));
  unity = spawn(unityExe, ['-batchmode', '-projectPath', unityRoot, '-runTests', '-testPlatform', 'PlayMode', '-testFilter', 'StudioSceneBrowserWorkflowTest', '-testResults', join(unityProof, 'browser-workflow-results.xml'), '-logFile', join(unityProof, 'unity.log')], {
    env: { ...process.env, BRIGHTTALES_UNITY_BRIDGE_PORT: '17844', CARTOON_FOUNDATION_P1_E2E_DIR: unityProof }, stdio: 'ignore', windowsHide: true,
  });
  await wait(async () => { try { await stat(join(unityProof, 'READY.txt')); return true; } catch { return false; } }, 90000);
  await wait(async () => { try { return (await fetch('http://127.0.0.1:17844/health')).ok; } catch { return false; } }, 15000);
  findings.stages.isolatedUnityReady = 'PASS';
  await nav('Cartoon Preview'); await until(`!!document.querySelector('.unity-connection-status')`);
  await button('Connect preview'); await until(`document.querySelector('.unity-connection-status')?.textContent?.includes('Connected')`);
  findings.stages.connect = 'PASS';
  const panel = `document.querySelector('section[aria-labelledby="studio-unity-heading"]')`;
  for (let run = 1; run <= 2; run++) {
    await js(`${panel}.scrollIntoView({block:'center'})`);
    await select('select[aria-label="Saved scene for Unity"]', edited.id);
    await button('Send scene to preview', panel);
    await until(`${panel}.querySelector('[role="status"]')?.textContent?.includes('ready to play')`);
    await wait(async () => { try { await stat(join(unityProof, `loaded-${run}.txt`)); return true; } catch { return false; } }, 10000);
    await screenshot(`0${run + 4}-preview-loaded.png`);
    await button('Play', panel);
    await until(`${panel}.querySelector('[role="status"]')?.textContent?.includes('has finished')`, 25000);
    await wait(async () => { try { await stat(join(unityProof, `complete-${run}.txt`)); return true; } catch { return false; } }, 10000);
    await screenshot(`0${run + 6}-preview-complete.png`);
    await button('Reset', panel);
    await until(`${panel}.querySelector('[role="status"]')?.textContent?.includes('stage is reset')`);
    await wait(async () => { try { await stat(join(unityProof, `reset-${run}.txt`)); return true; } catch { return false; } }, 10000);
    findings.stages[`unityRun${run}`] = 'PASS';
  }
  findings.stages.resetReplay = 'PASS';
  const loads = findings.bridgeRequests.filter(item => item.command === 'studio.load');
  if (loads.length !== 2 || loads.some(item => item.sceneId !== edited.id || item.config.version !== 2 || !item.config.calmLife || item.config.camera?.[0]?.shot !== 'medium' || item.config.actions.find(action => action.characterId === 'max' && action.type === 'walk')?.x !== 900 || item.config.actions.find(action => action.characterId === 'max' && action.type === 'walk')?.duration !== 2.2 || item.config.actions.find(action => action.characterId === 'maxine' && action.type === 'look-at')?.target !== 'max')) throw Error('Unity bridge did not receive the saved edited performance twice.');
  if (loads[0].revision !== loads[1].revision || !/^[a-f0-9]{64}$/.test(loads[0].revision)) throw Error('Replay content revisions do not match.');
  if (loads[0].revision !== createHash('sha256').update(JSON.stringify(loads[0].config)).digest('hex')) throw Error('Unity acknowledgement did not identify the transmitted content revision.');
  findings.sceneId = edited.id;
  findings.revision = loads[0].revision;
  findings.stages.sceneIdAndRevision = 'PASS';
  await wait(() => unity.exitCode !== null, 30000);
  findings.stages.unityPlayMode = (await readFile(join(unityProof, 'browser-workflow-results.xml'), 'utf8')).includes('result="Passed"') ? 'PASS' : 'FAIL';
  if (findings.stages.unityPlayMode !== 'PASS') throw Error('Unity browser workflow Play mode test failed.');
  if (findings.errors.length) throw Error(`Browser errors before disconnection: ${findings.errors.join(' | ')}`);
  await js(`document.querySelector('.unity-connection > details.preview-diagnostics').open=true`);
  await button('Ping');
  await until(`document.querySelector('.unity-connection-status')?.textContent?.includes('Disconnected')`, 10000);
  findings.stages.connectionLoss = 'PASS';
  if (findings.errors.some(error => !error.includes('net::ERR_CONNECTION_REFUSED'))) throw Error(`Unexpected browser errors: ${findings.errors.join(' | ')}`);
} catch (error) {
  findings.failure = error instanceof Error ? error.stack : String(error);
} finally {
  await writeFile(join(root, 'unity-workflow-results.json'), JSON.stringify(findings, null, 2));
  if (chrome) await closeChrome();
  console.log(JSON.stringify({ stages: findings.stages, failure: findings.failure, profile, unityProof }));
  if (findings.failure) process.exitCode = 1;
}
