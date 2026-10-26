const { readFile } = require('node:fs/promises');

const sessionPath = '/__brighttales_unity_control/session';

function isLoopback(request) {
  const local = request.socket?.localAddress;
  return local === '127.0.0.1' || local === '::1' || local === '::ffff:127.0.0.1';
}

function handleUnityControlSession(request, response, tokenPath) {
  let pathname;
  try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; }
  catch { return false; }
  if (pathname !== sessionPath) return false;
  const deny = (status, detail) => {
    const body = JSON.stringify({ error: detail });
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) });
    response.end(body);
  };
  if (request.method !== 'GET' || !isLoopback(request)) { deny(403, 'Loopback GET required.'); return true; }
  const origin = request.headers.origin;
  const fetchSite = request.headers['sec-fetch-site'];
  const host = request.headers.host;
  if (!origin || origin !== `http://${host}` || (fetchSite && fetchSite !== 'same-origin')) {
    deny(403, 'Studio same-origin request required.'); return true;
  }
  void readFile(tokenPath, 'utf8').then(contents => {
    const session = JSON.parse(contents.replace(/^\uFEFF/, ''));
    if (!/^[a-f0-9]{64}$/.test(session.token || '')) throw new Error('Unity Editor session token is invalid.');
    const processId = Number(session.processId);
    if (!Number.isSafeInteger(processId) || processId <= 0) throw new Error('Unity Editor session process is invalid.');
    try { process.kill(processId, 0); } catch { throw new Error('Unity Editor session has expired.'); }
    const body = JSON.stringify({ token: session.token, controllerState: session.controllerState, detail: session.detail || '' });
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) });
    response.end(body);
  }).catch(() => deny(503, 'Unity Editor is not available. Start the Unity project with the BrightTales review launcher first.'));
  return true;
}

module.exports = { sessionPath, handleUnityControlSession };
