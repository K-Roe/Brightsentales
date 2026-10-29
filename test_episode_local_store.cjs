const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp, readFile, rm, stat } = require('node:fs/promises');
const { createEpisodeLocalStore } = require('./scripts/episode-local-store.cjs');

const episodeId = 'a1234567-1234-4234-8234-123456789abc';
const folderId = 'folder-b1234567-1234-4234-8234-123456789abc';
const backup = { version: 8, createdAt: '2026-10-26T10:00:00.000Z', characters: [], scene: null, places: {}, timedScenes: { version: 1, scenes: [{ id: 'c1234567-1234-4234-8234-123456789abc', name: 'Test', duration: 4, characters: {}, actions: [] }] }, episodes: { version: 1, episodes: [{ id: episodeId, name: 'Test episode', sceneIds: ['c1234567-1234-4234-8234-123456789abc'] }] }, intros: { version: 1, intros: [] }, credits: { version: 1, credits: [] }, projects: { version: 1, music: [], effects: [] }, audioAssets: [] };

function mockRequest(url, method = 'GET', body, origin = 'http://127.0.0.1:4177') {
  const handlers = {};
  return { url, method, headers: { host: '127.0.0.1:4177', ...(origin ? { origin } : {}) }, socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1' }, on(event, callback) { handlers[event] = callback; if (event === 'data' && body !== undefined) callback(Buffer.from(JSON.stringify(body))); if (event === 'end') queueMicrotask(() => callback()); return this; } };
}
function mockBinaryRequest(url, method, bytes, contentType = 'video/webm', origin = 'http://127.0.0.1:4177') {
  const handlers = {};
  return { url, method, headers: { host: '127.0.0.1:4177', origin, 'content-type': contentType }, socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1' }, on(event, callback) { handlers[event] = callback; if (event === 'data') callback(bytes); if (event === 'end') queueMicrotask(() => callback()); return this; } };
}
function mockResponse() {
  return { statusCode: 0, headers: {}, body: '', writeHead(status, headers) { this.statusCode = status; this.headers = headers; }, end(body = '') { this.body = body; }, json() { return JSON.parse(this.body); } };
}

test('creates dedicated local directories and keeps episode copies across service restart', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'BrightTales Episode Library With Spaces '));
  try {
    const store = createEpisodeLocalStore(root); await store.initialize();
    for (const directory of Object.values(store.localDirectories)) assert.equal((await stat(directory)).isDirectory(), true);
    const foldersRequest = mockRequest('/__brighttales_local/episode-folders', 'PUT', { version: 1, folders: [{ id: folderId, name: 'Season 1' }] });
    const foldersResponse = mockResponse(); await store.handle(foldersRequest, foldersResponse); assert.equal(foldersResponse.statusCode, 200);
    const firstUpdatedAt = new Date().toISOString();
    const project = { version: 1, episodeId, folderId, updatedAt: firstUpdatedAt, expectedUpdatedAt: null, backup };
    const putResponse = mockResponse(); await store.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}`, 'PUT', project), putResponse); assert.equal(putResponse.statusCode, 200);
    const restarted = createEpisodeLocalStore(root); await restarted.initialize();
    const getResponse = mockResponse(); await restarted.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}`), getResponse);
    assert.equal(getResponse.statusCode, 200); assert.deepEqual(getResponse.json().backup, backup);
    const backupResponse = mockResponse(); await restarted.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}/backup`), backupResponse);
    assert.equal(backupResponse.statusCode, 200); assert.equal(backupResponse.json().version, 8);
    const listResponse = mockResponse(); await restarted.handle(mockRequest('/__brighttales_local/episode-projects'), listResponse);
    assert.deepEqual(listResponse.json().episodes.map(item => item.id), [episodeId]);
    const update = mockResponse(); await restarted.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}`, 'PUT', { ...project, updatedAt: new Date(Date.parse(firstUpdatedAt) + 1000).toISOString(), expectedUpdatedAt: firstUpdatedAt }), update); assert.equal(update.statusCode, 200);
    const stale = mockResponse(); await restarted.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}`, 'PUT', { ...project, updatedAt: new Date().toISOString(), expectedUpdatedAt: firstUpdatedAt }), stale); assert.equal(stale.statusCode, 409);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rejects cross-origin, malformed IDs, missing folders and invalid backups', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'BrightTales Local Store '));
  try {
    const store = createEpisodeLocalStore(root); await store.initialize();
    const cross = mockResponse(); await store.handle(mockRequest('/__brighttales_local/episode-folders', 'GET', undefined, 'http://evil.example'), cross); assert.equal(cross.statusCode, 403);
    const path = mockResponse(); assert.equal(await store.handle(mockRequest('/__brighttales_local/episode-projects/../../secrets', 'GET'), path), false);
    const invalid = mockResponse(); await store.handle(mockRequest(`/__brighttales_local/episode-projects/${episodeId}`, 'PUT', { version: 1, episodeId, folderId, updatedAt: new Date().toISOString(), backup }), invalid); assert.equal(invalid.statusCode, 400);
    const malformed = mockResponse(); await store.handle(mockRequest('/__brighttales_local/episode-folders', 'PUT', { version: 1, folders: [{ id: folderId, name: '  ' }] }), malformed); assert.equal(malformed.statusCode, 400);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('stores WebM exports locally without replacing an existing export', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'BrightTales Local Exports '));
  try {
    const store = createEpisodeLocalStore(root); await store.initialize();
    const exportId = 'd1234567-1234-4234-8234-123456789abc'; const bytes = Buffer.from('webm-fixture');
    const put = mockResponse(); await store.handle(mockBinaryRequest(`/__brighttales_local/exports/${exportId}.webm`, 'PUT', bytes), put); assert.equal(put.statusCode, 201);
    const repeated = mockResponse(); await store.handle(mockBinaryRequest(`/__brighttales_local/exports/${exportId}.webm`, 'PUT', bytes), repeated); assert.equal(repeated.statusCode, 409);
    const get = mockResponse(); await store.handle(mockRequest(`/__brighttales_local/exports/${exportId}.webm`), get); assert.equal(get.statusCode, 200); assert.deepEqual(get.body, bytes);
    const list = mockResponse(); await store.handle(mockRequest('/__brighttales_local/exports'), list); assert.deepEqual(list.json().exports.map(item => item.name), [`${exportId}.webm`]);
    const rejected = mockResponse(); await store.handle(mockBinaryRequest(`/__brighttales_local/exports/${'e1234567-1234-4234-8234-123456789abc'}.webm`, 'PUT', bytes, 'application/json'), rejected); assert.equal(rejected.statusCode, 415);
  } finally { await rm(root, { recursive: true, force: true }); }
});
