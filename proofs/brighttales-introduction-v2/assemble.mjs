import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve('proofs/brighttales-introduction-v2');
const backup = JSON.parse(await readFile(resolve(root, 'narration-library-backup.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, 'narration-manifest.json'), 'utf8'));
const audio = Object.fromEntries(manifest.lines.map(line => [line.key, line]));
const assignments = [
  ['welcome'],
  ['max_1', 'max_2'],
  ['maxine'],
  ['speak_1', 'speak_2', 'speak_3'],
  ['world_1', 'world_2'],
  ['goodbye_1', 'goodbye_2'],
];
const minimum = [10, 16, 10, 19, 14, 10];
const sceneReport = [];
let globalStart = 0;
for (const [index, scene] of backup.timedScenes.scenes.entries()) {
  const keys = assignments[index];
  if (!keys?.every(key => audio[key])) throw Error(`Missing narration for scene ${index + 1}`);
  let at = 0.85;
  const clips = [];
  for (const key of keys) {
    const asset = audio[key];
    clips.push({ id: randomUUID(), assetId: asset.assetId, start: Number(at.toFixed(3)), trimStart: 0, trimEnd: asset.duration, volume: 0.35, fadeIn: 0.04, fadeOut: 0.1, speakerId: 'narrator' });
    at += asset.duration + 0.8;
  }
  scene.duration = Math.max(minimum[index], Math.ceil(at - 0.8 + 1.4));
  scene.audio = clips;
  if (index === 0) {
    scene.actions.find(action => action.characterId === 'maxine' && action.type === 'wave').start = scene.duration - 4.2;
  }
  if (index === 1 || index === 2) {
    // Keep the approved 5-second solo walk and its destination; cut before the
    // walk-to-idle pose change, as in V1. Narration fills the standing interval.
    scene.actions.find(action => action.type === 'walk').start = scene.duration - 5;
  }
  if (index === 3) {
    const messages = scene.phone.filter(action => action.type === 'communicate');
    messages[0].message = 'I need help.';
    messages[0].symbol = 'help';
    messages[1].message = 'Bright Speak!';
    messages[1].symbol = 'yes';
    messages[2].message = 'Bright Speak helps kids talk.';
    messages[2].symbol = 'help';
  }
  if (index === 4) {
    // Repeat only existing approved waves to keep the longer narrated shot alive.
    scene.actions.push({ id: randomUUID(), characterId: 'maxine', type: 'wave', start: scene.duration - 5.0, duration: 1.62 });
    scene.actions.push({ id: randomUUID(), characterId: 'max', type: 'wave', start: scene.duration - 2.7, duration: 1.62 });
  }
  if (index === 5) {
    scene.actions.find(action => action.characterId === 'max' && action.type === 'wave').start = scene.duration - 4.9;
    scene.actions.find(action => action.characterId === 'maxine' && action.type === 'wave').start = scene.duration - 3.2;
  }
  sceneReport.push({ name: scene.name, globalStart, duration: scene.duration, narrations: keys.map((key, i) => ({ key, text: audio[key].line, localStart: clips[i].start, globalStart: globalStart + clips[i].start, duration: audio[key].duration, end: globalStart + clips[i].start + audio[key].duration })) });
  globalStart += scene.duration;
}
const place = backup.places.customPlaces.find(item => item.name === "Front of Max's house");
if (!place) throw Error('Approved house-front place is missing');
const credits = {
  id: randomUUID(), name: 'BrightTales closing title V2', title: 'BrightTales', duration: 5,
  placeId: place.id, lines: [{ id: randomUUID(), heading: '', name: 'Meet Max & Maxine', role: 'See you soon!' }],
  mode: 'static', scrollSpeed: 2,
};
backup.credits = { version: 1, credits: [credits] };
backup.episodes.episodes[0].name = 'BrightTales — Meet Max & Maxine — Narrated V2';
backup.episodes.episodes[0].creditsId = credits.id;
backup.createdAt = new Date().toISOString();
await writeFile(resolve(root, 'v2-import-backup.json'), JSON.stringify(backup, null, 2) + '\n');
await writeFile(resolve(root, 'timeline.json'), JSON.stringify({ narrator: manifest.voice, speed: manifest.speed, scenes: sceneReport, closingTitle: { start: globalStart, duration: credits.duration }, total: globalStart + credits.duration, music: 'none: no content-approved asset' }, null, 2) + '\n');
console.log(JSON.stringify({ scenes: sceneReport.map(item => [item.name, item.duration]), total: globalStart + credits.duration }));
