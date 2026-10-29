const { mkdir, readFile, readdir, rename, unlink, writeFile, stat } = require('node:fs/promises');
const path = require('node:path');

const EPISODE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 160 * 1024 * 1024;
const emptyFolders = { version: 1, folders: [] };

function createEpisodeLocalStore(root) {
  const base = path.resolve(root, '.brighttales-local');
  const projects = path.join(base, 'episode-projects');
  const previews = path.join(base, 'test-previews');
  const folderFile = path.join(projects, 'folders.json');
  const previewFile = path.join(previews, 'index.json');
  const localDirectories = {
    episodes: projects,
    exports: path.join(base, 'exports'),
    testPreviews: previews,
    recordings: path.join(base, 'recordings'),
    temp: path.join(base, 'temp'),
    mediaCache: path.join(base, 'media-cache'),
  };

  async function initialize() {
    await Promise.all(Object.values(localDirectories).map(directory => mkdir(directory, { recursive: true })));
    await writeDefault(folderFile, emptyFolders);
    await writeDefault(previewFile, { version: 1, items: [] });
    await seedExistingEpisodeOne();
  }

  async function seedExistingEpisodeOne() {
    const source = path.join(root, 'proofs', 'episode-1-hello-max', 'Hello-Im-Max-120s-studio-backup-v8.json');
    try {
      const backup = JSON.parse(await readFile(source, 'utf8'));
      if (backup.version !== 8 || !Array.isArray(backup.episodes?.episodes) || !Array.isArray(backup.timedScenes?.scenes)) return;
      const episode = backup.episodes.episodes.find(item => item.name === "Hello, I'm Max!" && EPISODE_ID.test(item.id));
      if (!episode || episode.sceneIds.length !== 7 || episode.sceneIds.some(id => !backup.timedScenes.scenes.some(scene => scene.id === id))) return;
      const file = path.join(projects, `${episode.id}.json`);
      try { await readFile(file); return; } catch (error) { if (error.code !== 'ENOENT') return; }
      await atomicWrite(file, JSON.stringify({ version: 1, episodeId: episode.id, folderId: 'unfiled', updatedAt: new Date().toISOString(), backup }));
    } catch { /* Episode 1 is optional on fresh clones; never alter source or existing copies. */ }
  }

  async function writeDefault(file, value) {
    try { await readFile(file); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await atomicWrite(file, JSON.stringify(value));
    }
  }

  async function atomicWrite(file, data) {
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, file);
  }

  async function readJson(file, fallback) {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }

  function send(response, status, value, headers = {}) {
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    response.writeHead(status, { 'Content-Type': typeof value === 'string' ? 'application/json; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body), ...headers });
    response.end(body);
  }

  function loopback(request) {
    const remote = request.socket.remoteAddress;
    const local = request.socket.localAddress;
    const isLoopback = value => value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
    if (!isLoopback(remote) || !isLoopback(local)) return false;
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        const host = request.headers.host;
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.host !== host) return false;
      } catch { return false; }
    }
    return true;
  }

  function readBody(request) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      request.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error('Episode project is too large.'), { status: 413 })); request.destroy(); return; }
        chunks.push(chunk);
      });
      request.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })); }
      });
      request.on('error', reject);
    });
  }

  function readBinary(request) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      request.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Export file is too large.'), { status: 413 })); request.destroy(); return; } chunks.push(chunk); });
      request.on('end', () => resolve(Buffer.concat(chunks)));
      request.on('error', reject);
    });
  }

  function validFolders(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.folders) || value.folders.length > 200) return false;
    const ids = new Set(), names = new Set();
    return value.folders.every(folder => {
      if (!folder || typeof folder.id !== 'string' || !/^folder-[0-9a-f-]{36}$/i.test(folder.id) || typeof folder.name !== 'string') return false;
      const name = folder.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      if (!name || name.length > 60 || ids.has(folder.id) || names.has(name)) return false;
      ids.add(folder.id); names.add(name); return true;
    });
  }

  function validProject(id, value) {
    return EPISODE_ID.test(id) && value && value.version === 1 && value.episodeId === id && typeof value.folderId === 'string' && (value.folderId === 'unfiled' || /^folder-[0-9a-f-]{36}$/i.test(value.folderId)) && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt)) && (value.expectedUpdatedAt === null || typeof value.expectedUpdatedAt === 'string' && !Number.isNaN(Date.parse(value.expectedUpdatedAt))) && value.backup && value.backup.version === 8 && Array.isArray(value.backup.timedScenes?.scenes) && Array.isArray(value.backup.episodes?.episodes) && value.backup.episodes.episodes.some(episode => episode.id === id);
  }

  async function handle(request, response) {
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); } catch { return false; }
    if (!url.pathname.startsWith('/__brighttales_local/')) return false;
    if (!loopback(request)) { send(response, 403, { error: 'Local Episode Library requests are limited to this Studio origin.' }); return true; }
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'PUT' && request.method !== 'POST' && request.method !== 'DELETE') { send(response, 405, { error: 'Method not allowed.' }); return true; }
    try {
      const endpoint = url.pathname.slice('/__brighttales_local'.length);
      if (endpoint === '/status' && request.method === 'GET') { send(response, 200, { service: 'BrightTalesEpisodeLibrary', protocol: 1, directories: localDirectories }); return true; }
      if (endpoint === '/episode-folders') {
        if (request.method === 'GET') { send(response, 200, await readJson(folderFile, emptyFolders)); return true; }
        if (request.method !== 'PUT') { send(response, 405, { error: 'Use PUT to save folders.' }); return true; }
        const folders = await readBody(request);
        if (!validFolders(folders)) { send(response, 400, { error: 'Folder data is invalid.' }); return true; }
        await atomicWrite(folderFile, JSON.stringify(folders)); send(response, 200, { saved: true }); return true;
      }
      if (endpoint === '/episode-projects' && request.method === 'GET') {
        const files = (await readdir(projects)).filter(file => EPISODE_ID.test(file.replace(/\.json$/, '')) && file.endsWith('.json'));
        const items = await Promise.all(files.map(async file => {
          try {
            const project = JSON.parse(await readFile(path.join(projects, file), 'utf8'));
            const episode = project.backup.episodes.episodes.find(item => item.id === project.episodeId);
            const scenesById = new Map(project.backup.timedScenes.scenes.map(scene => [scene.id, scene]));
            const runtime = episode ? episode.sceneIds.reduce((sum, sceneId, index) => sum + (episode.sceneSettings?.[index]?.duration ?? scenesById.get(sceneId)?.duration ?? 0), 0) + (episode.introId ? project.backup.intros?.intros?.find(item => item.id === episode.introId)?.duration ?? 0 : 0) + (episode.creditsId ? project.backup.credits?.credits?.find(item => item.id === episode.creditsId)?.duration ?? 0 : 0) : 0;
            return { id: project.episodeId, folderId: project.folderId, name: episode?.name ?? 'Unavailable episode', sceneCount: episode?.sceneIds.length ?? 0, runtime, updatedAt: project.updatedAt };
          } catch { return null; }
        }));
        send(response, 200, { version: 1, episodes: items.filter(Boolean) }); return true;
      }
      if (endpoint === '/exports' && request.method === 'GET') {
        const files = (await readdir(localDirectories.exports)).filter(file => EPISODE_ID.test(file.replace(/\.webm$/i, '')) && file.endsWith('.webm'));
        const items = await Promise.all(files.map(async file => { const info = await stat(path.join(localDirectories.exports, file)); return { id: file.slice(0, -5), name: file, size: info.size, updatedAt: info.mtime.toISOString() }; }));
        send(response, 200, { version: 1, exports: items }); return true;
      }
      const exportMatch = endpoint.match(/^\/exports\/([0-9a-f-]{36})\.webm$/i);
      if (exportMatch) {
        if (!EPISODE_ID.test(exportMatch[1])) { send(response, 400, { error: 'Export ID is invalid.' }); return true; }
        const file = path.join(localDirectories.exports, `${exportMatch[1]}.webm`);
        if (request.method === 'GET') {
          let bytes; try { bytes = await readFile(file); } catch (error) { if (error.code === 'ENOENT') { send(response, 404, { error: 'Export was not found.' }); return true; } throw error; }
          response.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': bytes.length, 'Content-Disposition': `attachment; filename="${exportMatch[1]}.webm"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(bytes); return true;
        }
        if (request.method !== 'PUT' || !/^video\/webm(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) { send(response, 415, { error: 'Only supported WebM episode exports can be stored here.' }); return true; }
        const bytes = await readBinary(request);
        if (!bytes.length) { send(response, 400, { error: 'The WebM export is empty.' }); return true; }
        try { await stat(file); send(response, 409, { error: 'An export already exists with this ID. Choose a new export ID.' }); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
        await atomicWrite(file, bytes); send(response, 201, { saved: true, id: exportMatch[1], size: bytes.length }); return true;
      }
      const match = endpoint.match(/^\/episode-projects\/([0-9a-f-]{36})(\/backup)?$/i);
      if (match) {
        const id = match[1], file = path.join(projects, `${id}.json`);
        if (!EPISODE_ID.test(id)) { send(response, 400, { error: 'Episode ID is invalid.' }); return true; }
        if (request.method === 'DELETE' && !match[2]) {
          try { await unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
          send(response, 200, { deleted: true, episodeId: id }); return true;
        }
        if (request.method === 'GET') {
          const project = await readJson(file, null);
          if (!project) { send(response, 404, { error: 'No local saved copy exists for this episode.' }); return true; }
          if (match[2]) send(response, 200, project.backup, { 'Content-Disposition': `attachment; filename="${id}-studio-backup-v8.json"` });
          else send(response, 200, project);
          return true;
        }
        if (match[2] || request.method !== 'PUT') { send(response, 405, { error: 'Use PUT to save an episode project.' }); return true; }
        const project = await readBody(request);
        if (!validProject(id, project)) { send(response, 400, { error: 'The local project does not contain a valid native Studio Backup v8 episode.' }); return true; }
        const folders = await readJson(folderFile, emptyFolders);
        if (project.folderId !== 'unfiled' && !folders.folders.some(folder => folder.id === project.folderId)) { send(response, 400, { error: 'The selected episode folder does not exist.' }); return true; }
        let existing = null; try { existing = await readJson(file, null); } catch { send(response, 409, { error: 'The existing local episode copy is unreadable and was not overwritten.' }); return true; }
        if (existing && project.expectedUpdatedAt !== existing.updatedAt || !existing && project.expectedUpdatedAt !== null) { send(response, 409, { error: 'A newer or missing local copy was detected. Reload the Episode Library before saving again.' }); return true; }
        await atomicWrite(file, JSON.stringify(project)); send(response, 200, { saved: true, episodeId: id, updatedAt: project.updatedAt }); return true;
      }
      if (endpoint === '/test-previews') {
        if (request.method === 'GET') { send(response, 200, await readJson(previewFile, { version: 1, items: [] })); return true; }
        if (request.method !== 'PUT') { send(response, 405, { error: 'Use PUT to save visual previews.' }); return true; }
        const value = await readBody(request);
        if (!value || value.version !== 1 || !Array.isArray(value.items) || value.items.length > 500 || value.items.some(item => !item || typeof item.id !== 'string' || !EPISODE_ID.test(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 80 || typeof item.purpose !== 'string' || item.purpose.length > 240 || typeof item.episodeId !== 'string' || !EPISODE_ID.test(item.episodeId) || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || item.folderId !== null && !/^folder-[0-9a-f-]{36}$/i.test(item.folderId) || !item.snapshot || item.snapshot.id !== item.episodeId || !Array.isArray(item.snapshot.sceneIds) || !Array.isArray(item.scenes) || item.scenes.some(scene => !scene || !EPISODE_ID.test(scene.id)) || item.snapshot.sceneIds.some(id => !item.scenes.some(scene => scene.id === id)))) { send(response, 400, { error: 'Visual preview index is invalid.' }); return true; }
        const folderIndex = await readJson(folderFile, emptyFolders);
        if (value.items.some(item => item.folderId !== null && !folderIndex.folders.some(folder => folder.id === item.folderId))) { send(response, 400, { error: 'A visual preview refers to a missing folder.' }); return true; }
        await atomicWrite(previewFile, JSON.stringify(value)); send(response, 200, { saved: true }); return true;
      }
      send(response, 404, { error: 'Local Episode Library endpoint not found.' }); return true;
    } catch (error) {
      send(response, error.status ?? 500, { error: error.status ? error.message : 'The local Episode Library could not read or save this data.' }); return true;
    }
  }

  return { base, localDirectories, initialize, handle };
}

module.exports = { createEpisodeLocalStore, MAX_BODY };
