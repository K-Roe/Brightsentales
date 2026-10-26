import { Brightling, FRAMES, makeFrame, validateBrightling } from './maker';
import { UNITY_BRIDGE_URL, UnityBridgeTimeoutError } from './unityBridge';

export type BrightlingAsset = { frame: typeof FRAMES[number]; mime: 'image/png'; sha256: string; data: string };
export type BrightlingDefinition = {
  schema: 'brighttales.brightling'; version: 1; character: Brightling;
  templateVersion: 1; bodyPart: { kind: 'whole-body'; layer: 0; pivot: { x: .5; y: 0 }; scale: 1 };
  animations: ['idle', 'blink', 'walk', 'wave']; assets: BrightlingAsset[];
};
const MAX_BYTES = 8_000_000;
const encoder = new TextEncoder();
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer)), b => b.toString(16).padStart(2, '0')).join('');

export function canonicalDefinition(definition: BrightlingDefinition): string {
  const ordered = { command: 'brightling.import', schema: definition.schema, version: definition.version, character: {
    id: definition.character.id, name: definition.character.name, template: definition.character.template,
    body: definition.character.body.toLowerCase(), hair: definition.character.hair.toLowerCase(), clothing: definition.character.clothing.toLowerCase(),
  }, templateVersion: definition.templateVersion, bodyPart: definition.bodyPart, animations: definition.animations,
  assets: [...definition.assets].sort((a, b) => FRAMES.indexOf(a.frame) - FRAMES.indexOf(b.frame)).map(a => ({ frame: a.frame, mime: a.mime, sha256: a.sha256, data: a.data })) };
  return JSON.stringify(ordered).replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export async function buildBrightlingDefinition(character: Brightling): Promise<BrightlingDefinition> {
  if (!validateBrightling(character) || !/^brightling-[a-f0-9-]{36}$/.test(character.id)) throw new Error('This Brightling has an invalid identity or appearance.');
  const assets: BrightlingAsset[] = [];
  for (const frame of FRAMES) {
    const canvas = await makeFrame(character, frame);
    const encoded = canvas.toDataURL('image/png');
    const data = encoded.slice('data:image/png;base64,'.length);
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    if (bytes.length < 8 || bytes.length > 1_000_000 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error(`Invalid generated PNG for ${frame}.`);
    assets.push({ frame, mime: 'image/png', sha256: await digest(bytes), data });
  }
  const result: BrightlingDefinition = { schema: 'brighttales.brightling', version: 1, character: { ...character, name: character.name.trim().replace(/\s+/g, ' ') }, templateVersion: 1, bodyPart: { kind: 'whole-body', layer: 0, pivot: { x: .5, y: 0 }, scale: 1 }, animations: ['idle', 'blink', 'walk', 'wave'], assets };
  if (encoder.encode(canonicalDefinition(result)).length > MAX_BYTES) throw new Error('Character artwork exceeds the 8 MB transfer limit.');
  return result;
}

export type BrightlingImportReply = { source: 'unity'; version: 1; command: 'brightling.import'; status: 'imported' | 'updated'; characterId: string; name: string; revision: string; animations: string[] };
export async function sendBrightlingToUnity(character: Brightling, signal: AbortSignal, request: typeof fetch = fetch): Promise<BrightlingImportReply> {
  const definition = await buildBrightlingDefinition(character);
  const body = canonicalDefinition(definition);
  const timeout = new AbortController(); const forward = () => timeout.abort();
  signal.addEventListener('abort', forward, { once: true }); if (signal.aborted) timeout.abort();
  const timer = setTimeout(() => timeout.abort(), 30_000);
  let response: Response;
  try { response = await request(`${UNITY_BRIDGE_URL}/command`, { method: 'POST', cache: 'no-store', signal: timeout.signal, headers: { 'Content-Type': 'application/json' }, body }); }
  catch (error) { if (timeout.signal.aborted && !signal.aborted) throw new UnityBridgeTimeoutError('Unity did not finish importing within 30 seconds. Check that Play mode is running.'); throw error; }
  finally { clearTimeout(timer); signal.removeEventListener('abort', forward); }
  const reply = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!reply || reply.source !== 'unity' || reply.version !== 1 || reply.command !== 'brightling.import') throw new Error('Unity sent an invalid Brightling import acknowledgement.');
  if (!response.ok) throw new Error(typeof reply.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`);
  if (response.status !== 202 || !['imported', 'updated'].includes(String(reply.status)) || reply.characterId !== character.id || reply.name !== character.name.trim().replace(/\s+/g, ' ') || typeof reply.revision !== 'string' || !Array.isArray(reply.animations)) throw new Error('Unity did not confirm construction of this Brightling.');
  return reply as BrightlingImportReply;
}

export type BrightlingAction = 'idle' | 'blink' | 'walk' | 'wave';
export async function playBrightlingActionInUnity(characterId: string, action: BrightlingAction, signal: AbortSignal, request: typeof fetch = fetch): Promise<void> {
  if (!/^brightling-[a-f0-9-]{36}$/.test(characterId) || !['idle', 'blink', 'walk', 'wave'].includes(action)) throw new Error('Choose a valid imported Brightling and action.');
  const response = await request(`${UNITY_BRIDGE_URL}/command`, { method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'brightling.action', characterId, action }) });
  const reply = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!reply || reply.source !== 'unity' || reply.version !== 1 || reply.command !== 'brightling.action') throw new Error('Unity sent an invalid animation acknowledgement.');
  if (!response.ok) throw new Error(typeof reply.reason === 'string' ? reply.reason : `Unity returned HTTP ${response.status}.`);
  if (response.status !== 202 || reply.status !== 'accepted' || reply.characterId !== characterId || reply.action !== action) throw new Error('Unity did not acknowledge this animation.');
}
