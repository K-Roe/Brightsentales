import { useEffect, useRef, useState } from 'react';
import { Brightling, LIBRARY_KEY, makeFrame, makePack } from './maker';
import { decodeLibrary, ImportMode, prepareImport, pruneScene, withoutCharacter } from './library';
import Characters from './Characters';
import Places from './Places';
import SceneMaker, { type SceneLeaveGuard } from './SceneMaker';
import EpisodeMaker, { type EpisodeLeaveGuard } from './EpisodeMaker';
import AudioLibrary from './AudioLibrary';
import VoiceMaker from './VoiceMaker';
import { emptyVoiceSettings, readVoiceSettings, validVoiceSettings, VOICE_SETTINGS_KEY, type VoiceSettings } from './voiceSettings';
import { type AudioAsset, type AudioKind } from './audio';
import { audioBackupAssets, decodeAudioBackup, importAudioFile, listAudioAssets, removeAudioAsset, saveAudioAsset } from './audioStore';
import { decodeEpisodeLibrary, EMPTY_EPISODE_LIBRARY, EPISODES_KEY, speechFitsEpisode, type EpisodeLibrary, validateEpisodeLibrary } from './episodes';
import { decodeTimedLibrary, EMPTY_TIMED_LIBRARY, pruneTimedScenes, TIMED_SCENES_KEY, TimedLibrary, validateTimedLibrary } from './timedScenes';
import IntroMaker from './IntroMaker';
import { decodeIntroLibrary, EMPTY_INTRO_LIBRARY, INTROS_KEY, validateIntroLibrary, type IntroLibrary } from './introductions';
import CreditsMaker, { type CreditsLeaveGuard } from './CreditsMaker';
import { CREDITS_KEY, decodeCreditsLibrary, EMPTY_CREDITS_LIBRARY, validateCreditsLibrary, type CreditsLibrary } from './credits';
import MusicStudio from './MusicStudio';
import UnityConnection from './UnityConnection';
import { decodeStudioProjects, EMPTY_PROJECTS, MUSIC_KEY, validateStudioProjects, type StudioProjects } from './musicProject';
import { CharacterId, clampPoint, DEFAULT_SCENE, HEIGHT, moveTowards, parseScene, Point, Scene, STORAGE_KEY, WIDTH } from './scene';
import { directionTo, frameForDistance, Motion, STOP_MS, TURN_MS, WALK_SPEED } from './walking';
import { waveFrameAt } from './wave';
import { generateBrightlingFrames, OLIVER_SPEC, svgDataUrl } from './brightling';
import { createStudioBackup, recoverStudioRestore, restoreStudioBackup, StudioBackup, validateStudioBackup } from './studioBackup';
import { restoreStudioWithAudio } from './restoreCoordinator';
import { decodePlaceOrganisation, DEFAULT_PLACE_ORGANISATION, PLACE_FOLDERS_KEY, PlaceOrganisation, placesIn, validatePlaceOrganisation } from './placeFolders';
import { maxOutfitFrom, maxineOutfitFrom, maxSpriteSource, maxineSpriteSource, type MaxOutfit, type MaxineOutfit } from './outfit';
import { readAppearance, resolveAppearance, saveAppearance, type Appearance } from './appearance';
import { readWorkspace, saveWorkspace, type Workspace } from './workspacePreference';
import { Studio3Projects, Studio3Sidebar, WorkspaceSettings, studioTabLabel, type StudioTab } from './Studio3Shell';

const SPRITE_HEIGHT = 355;
const SPRITE_WIDTH = 213;
const WAVE_WIDTH = 245;
const legacyFrames = generateBrightlingFrames(OLIVER_SPEC);
const legacySprites = { idle: svgDataUrl(legacyFrames.idle), side: legacyFrames.side.map(svgDataUrl), wave: legacyFrames.wave.map(svgDataUrl) };
const emptyMotion = (): Motion => ({ direction: 1, distance: 0, turnUntil: 0, stopUntil: 0, moving: false });
const readScene = (): Scene => { try { return parseScene(localStorage.getItem(STORAGE_KEY)) ?? structuredClone(DEFAULT_SCENE); } catch { return structuredClone(DEFAULT_SCENE); } };
const readLibrary = () => { try { return decodeLibrary(localStorage.getItem(LIBRARY_KEY)); } catch { return { ok: false as const, error: 'Browser storage is unavailable.' }; } };
const placesInReady = (organisation: PlaceOrganisation) => placesIn(organisation).filter(place => place.artworkAvailable && place.background).map(place => place.id);
const spriteSource = (id: string, pose: 'idle' | 'side' | 'wave', frame = 0, maxOutfit: MaxOutfit = 'original', maxineOutfit: MaxineOutfit = 'original'): string => {
  if (id === 'max') return maxSpriteSource(maxOutfit, pose, frame);
  if (id === 'maxine') return maxineSpriteSource(maxineOutfit, pose, frame);
  if (id === 'oliver') return pose === 'idle' ? legacySprites.idle : legacySprites[pose][frame];
  if (pose === 'idle') return `/art/${id}-0.png`;
  if (pose === 'side') return frame === 0 ? `/art/${id}-side-0.png` : `/art/${id}-side-v3-${frame}.png`;
  return `/art/${id}-wave-${frame + 1}.png`;
};
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}
type Sprite = HTMLImageElement | HTMLCanvasElement;
type Pack = { idle: Sprite; side: Sprite[]; wave: Sprite[] };

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(readWorkspace);
  const [workspaceIssue, setWorkspaceIssue] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance());
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const resolvedTheme = resolveAppearance(appearance, systemDark);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = resolvedTheme; }, [resolvedTheme]);
  const chooseAppearance = (next: Appearance) => { setAppearance(next); saveAppearance(next); document.documentElement.dataset.theme = resolveAppearance(next, systemDark); };
  const [recovery] = useState(() => recoverStudioRestore(localStorage, LIBRARY_KEY, STORAGE_KEY));
  const episodeLeaveGuard = useRef<EpisodeLeaveGuard | null>(null);
  const creditsLeaveGuard = useRef<CreditsLeaveGuard | null>(null);
  const sceneLeaveGuard = useRef<SceneLeaveGuard | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const savedRef = useRef<Scene>(readScene());
  const positionsRef = useRef<Record<string, Point>>(Object.fromEntries(Object.entries(savedRef.current.characters).map(([id, value]) => [id, { ...value.start }])));
  const destinationsRef = useRef<Record<string, Point | null>>(Object.fromEntries(Object.entries(savedRef.current.characters).map(([id, value]) => [id, value.destination])));
  const motionsRef = useRef<Record<string, Motion>>(Object.fromEntries(Object.keys(savedRef.current.characters).map(id => [id, emptyMotion()])));
  const selectedRef = useRef<CharacterId>('max');
  const playingRef = useRef(false);
  const waveRef = useRef<{ id: CharacterId; startedAt: number } | null>(null);
  const dragRef = useRef<{ id: CharacterId; origin: Point; offset: Point; moved: boolean } | null>(null);
  const [sceneIds, setSceneIds] = useState(() => Object.keys(savedRef.current.characters));
  const [initialLibrary] = useState(readLibrary);
  const [initialPlaces] = useState(() => { try { return decodePlaceOrganisation(localStorage.getItem(PLACE_FOLDERS_KEY)); } catch { return { ok: false as const, error: 'Browser Places storage is unavailable.' }; } });
  const [places, setPlaces] = useState<PlaceOrganisation>(initialPlaces.ok ? initialPlaces.organisation : structuredClone(DEFAULT_PLACE_ORGANISATION));
  const [placesIssue, setPlacesIssue] = useState<string | null>(initialPlaces.ok ? null : initialPlaces.error);
  const [library, setLibrary] = useState<Brightling[]>(initialLibrary.ok ? initialLibrary.characters : []);
  const [libraryIssue, setLibraryIssue] = useState<string | null>(initialLibrary.ok ? null : initialLibrary.error);
  const [initialTimed] = useState(() => { try { return decodeTimedLibrary(localStorage.getItem(TIMED_SCENES_KEY), placesInReady(initialPlaces.ok ? initialPlaces.organisation : DEFAULT_PLACE_ORGANISATION)); } catch { return { ok: false as const, error: 'Browser timed scene storage is unavailable.' }; } });
  const [timedScenes, setTimedScenes] = useState<TimedLibrary>(initialTimed.ok ? initialTimed.library : structuredClone(EMPTY_TIMED_LIBRARY));
  const [timedIssue, setTimedIssue] = useState<string | null>(initialTimed.ok ? null : initialTimed.error);
  const [initialEpisodes] = useState(() => { try { return decodeEpisodeLibrary(localStorage.getItem(EPISODES_KEY)); } catch { return { ok: false as const, error: 'Browser episode storage is unavailable.' }; } });
  const [episodes, setEpisodes] = useState<EpisodeLibrary>(initialEpisodes.ok ? initialEpisodes.library : structuredClone(EMPTY_EPISODE_LIBRARY));
  const [episodeIssue, setEpisodeIssue] = useState<string | null>(initialEpisodes.ok ? null : initialEpisodes.error);
  const [initialIntros] = useState(() => { try { return decodeIntroLibrary(localStorage.getItem(INTROS_KEY), placesInReady(initialPlaces.ok ? initialPlaces.organisation : DEFAULT_PLACE_ORGANISATION)); } catch { return { ok: false as const, error: 'Browser intro storage is unavailable.' }; } });
  const [intros, setIntros] = useState<IntroLibrary>(initialIntros.ok ? initialIntros.library : structuredClone(EMPTY_INTRO_LIBRARY));
  const [introIssue, setIntroIssue] = useState<string | null>(initialIntros.ok ? null : initialIntros.error);
  const [initialCredits] = useState(() => { try { return decodeCreditsLibrary(localStorage.getItem(CREDITS_KEY), placesInReady(initialPlaces.ok ? initialPlaces.organisation : DEFAULT_PLACE_ORGANISATION)); } catch { return { ok: false as const, error: 'Browser credits storage is unavailable.' }; } });
  const [credits, setCredits] = useState<CreditsLibrary>(initialCredits.ok ? initialCredits.library : structuredClone(EMPTY_CREDITS_LIBRARY));
  const [creditsIssue, setCreditsIssue] = useState<string | null>(initialCredits.ok ? null : initialCredits.error);
  const [initialProjects] = useState(() => { try { return decodeStudioProjects(localStorage.getItem(MUSIC_KEY)); } catch { return { ok: false as const, error: 'Browser music project storage is unavailable.' }; } });
  const [projects, setProjects] = useState<StudioProjects>(initialProjects.ok ? initialProjects.projects : structuredClone(EMPTY_PROJECTS));
  const [projectsIssue, setProjectsIssue] = useState<string | null>(initialProjects.ok ? null : initialProjects.error);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => { try { return readVoiceSettings(); } catch { return emptyVoiceSettings(); } });
  const [voiceSettingsIssue, setVoiceSettingsIssue] = useState<string | null>(() => { try { readVoiceSettings(); return null; } catch { return 'Saved voice settings are invalid. Existing data was kept.'; } });
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [audioIssue, setAudioIssue] = useState<string | null>(null);
  const [sceneIssue, setSceneIssue] = useState<string | null>(() => { try { const raw = localStorage.getItem(STORAGE_KEY); return raw !== null && !parseScene(raw) ? 'Saved scene JSON is invalid. It has not been overwritten.' : null; } catch { return 'Browser scene storage is unavailable.'; } });
  const [activeTab, setActiveTab] = useState<StudioTab>(() => workspace === 'studio3' ? 'projects' : 'characters');
  const [unityStatus, setUnityStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [sceneDirty, setSceneDirty] = useState(false);
  const [requestedSceneId, setRequestedSceneId] = useState<string | null>(null);
  const [requestedPreviewSceneId, setRequestedPreviewSceneId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CharacterId>('max');
  const [maxOutfit, setMaxOutfit] = useState<MaxOutfit>(() => maxOutfitFrom(savedRef.current.maxOutfit));
  const [maxineOutfit, setMaxineOutfit] = useState<MaxineOutfit>(() => maxineOutfitFrom(savedRef.current.maxineOutfit));
  const [playing, setPlaying] = useState(false);
  const [waving, setWaving] = useState(false);
  const [notice, setNotice] = useState('Drag a character, then click the floor to choose where they walk.');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState<string[]>([]);
  useEffect(() => { let live = true; listAudioAssets().then(items => { if (live) setAudioAssets(items); }).catch(() => { if (live) setAudioIssue('Audio Library storage is unavailable. Existing audio was not changed.'); }); return () => { live = false; }; }, []);
  const ids = sceneIds.filter(id => !unavailable.includes(id) && (!id.startsWith('brightling-') || library.some(item => item.id === id)));
  const custom = (id: string) => library.find(item => item.id === id);
  const name = (id: string) => id === 'max' ? 'Max' : id === 'maxine' ? 'Maxine' : id === 'oliver' ? OLIVER_SPEC.name : custom(id)?.name ?? 'Brightling';
  const colour = (id: string) => id === 'max' ? '#13bfc0' : id === 'maxine' ? '#ee61ab' : id === 'oliver' ? OLIVER_SPEC.bodyColour : custom(id)?.body ?? '#777777';

  useEffect(() => {
    let active = true;
    Promise.allSettled(library.map(async item => [item.id, (await makeFrame(item, '0')).toDataURL('image/png')] as const))
      .then(results => { if (!active) return; setThumbnails(Object.fromEntries(results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))); if (results.some(result => result.status === 'rejected')) setNotice('A saved Brightling could not load its artwork. Other characters are still available.'); });
    return () => { active = false; };
  }, [library]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    let active = true, animation = 0, last = 0;
    Promise.all([loadImage('/art/living-room.png'), ...ids.map(async id => {
      const item = library.find(character => character.id === id);
      if (item) return makePack(item).catch(error => { if (active) setUnavailable(previous => previous.includes(id) ? previous : [...previous, id]); throw error; });
      return { idle: await loadImage(spriteSource(id, 'idle', 0, maxOutfit, maxineOutfit)), side: await Promise.all(Array.from({ length: 5 }, (_, frame) => loadImage(spriteSource(id, 'side', frame, maxOutfit, maxineOutfit)))), wave: await Promise.all(Array.from({ length: 3 }, (_, frame) => loadImage(spriteSource(id, 'wave', frame, maxOutfit, maxineOutfit)))) };
    })]).then(([room, ...packs]) => {
      if (!active) return;
      const sprites = Object.fromEntries(ids.map((id, index) => [id, packs[index]])) as Record<string, Pack>;
      const render = (time: number) => {
        const elapsed = Math.min((time - last) / 1000 || 0, 0.05); last = time;
        if (playingRef.current) {
          let activeMotion = false;
          for (const id of ids) {
            const motion = motionsRef.current[id];
            if (!motion.moving && time >= motion.stopUntil) continue;
            activeMotion = true;
            if (!motion.moving || time < motion.turnUntil) continue;
            const target = destinationsRef.current[id]; if (!target) continue;
            const before = positionsRef.current[id];
            const after = moveTowards(before, target, WALK_SPEED * elapsed);
            positionsRef.current[id] = after;
            motion.distance += Math.hypot(after.x - before.x, after.y - before.y);
            if (after.x === target.x && after.y === target.y) { motion.moving = false; motion.stopUntil = time + STOP_MS; }
          }
          if (!activeMotion) { playingRef.current = false; setPlaying(false); setNotice('Walk complete. Reset returns to the saved starting positions.'); }
        }
        const wave = waveRef.current;
        const waveFrame = wave ? waveFrameAt(time - wave.startedAt) : null;
        if (wave && waveFrame === null) { waveRef.current = null; setWaving(false); setNotice(`${name(wave.id)} finished waving.`); }
        context.clearRect(0, 0, WIDTH, HEIGHT); context.drawImage(room, 0, 0, WIDTH, HEIGHT);
        for (const id of ids) {
          const destination = destinationsRef.current[id]; if (!destination) continue;
          context.save(); context.strokeStyle = colour(id); context.fillStyle = '#fffdf4'; context.lineWidth = 6; context.setLineDash([11, 9]);
          context.beginPath(); context.arc(destination.x, destination.y, 21, 0, Math.PI * 2); context.fill(); context.stroke(); context.setLineDash([]);
          context.beginPath(); context.arc(destination.x, destination.y, 6, 0, Math.PI * 2); context.fillStyle = colour(id); context.fill(); context.restore();
        }
        for (const id of [...ids].sort((a, b) => positionsRef.current[a].y - positionsRef.current[b].y)) {
          const p = positionsRef.current[id], motion = motionsRef.current[id];
          const showingSide = playingRef.current && (motion.moving || time < motion.stopUntil);
          const frame = showingSide && motion.moving && time >= motion.turnUntil ? frameForDistance(motion.distance) : 0;
          context.save(); context.fillStyle = 'rgba(68, 42, 75, .22)'; context.beginPath(); context.ellipse(p.x, p.y - 3, 87, 17, 0, 0, Math.PI * 2); context.fill();
          if (id === selectedRef.current) { context.strokeStyle = colour(id); context.lineWidth = 5; context.beginPath(); context.ellipse(p.x, p.y - 3, 91, 22, 0, 0, Math.PI * 2); context.stroke(); }
          const bob = showingSide && motion.moving && frame % 2 === 0 ? 3 : 0;
          if (showingSide) {
            context.translate(p.x, p.y); context.scale(motion.direction, 1);
            const width = id === 'oliver' ? 239 : frame === 0 ? SPRITE_WIDTH : 239;
            context.drawImage(sprites[id].side[frame], -width / 2, -SPRITE_HEIGHT - bob, width, SPRITE_HEIGHT);
          } else if (wave?.id === id && waveFrame !== null && waveFrame > 0) {
            context.drawImage(sprites[id].wave[waveFrame - 1], p.x - WAVE_WIDTH / 2, p.y - SPRITE_HEIGHT, WAVE_WIDTH, SPRITE_HEIGHT);
          } else context.drawImage(sprites[id].idle, p.x - SPRITE_WIDTH / 2, p.y - SPRITE_HEIGHT, SPRITE_WIDTH, SPRITE_HEIGHT);
          context.restore();
        }
        animation = requestAnimationFrame(render);
      };
      animation = requestAnimationFrame(render);
    }).catch(() => { if (active) setNotice('Artwork could not load. Check the local assets and refresh.'); });
    return () => { active = false; cancelAnimationFrame(animation); };
  }, [sceneIds, library, unavailable, maxOutfit, maxineOutfit]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const box = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - box.left) * WIDTH / box.width, y: (event.clientY - box.top) * HEIGHT / box.height }; };
  const select = (id: CharacterId) => { selectedRef.current = id; setSelected(id); setNotice(`${name(id)} selected. Drag to position, then click the floor for a destination.`); };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (playingRef.current) return;
    waveRef.current = null; setWaving(false);
    const point = pointFromEvent(event);
    const hit = [...ids].sort((a, b) => positionsRef.current[b].y - positionsRef.current[a].y).find(id => { const p = positionsRef.current[id]; return Math.abs(point.x - p.x) < SPRITE_WIDTH * .43 && point.y >= p.y - SPRITE_HEIGHT * .88 && point.y <= p.y; });
    if (hit) { select(hit); dragRef.current = { id: hit, origin: point, offset: { x: positionsRef.current[hit].x - point.x, y: positionsRef.current[hit].y - point.y }, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
    else if (point.y >= 570) { destinationsRef.current[selectedRef.current] = clampPoint(point); setNotice(`${name(selectedRef.current)}'s walking destination is set. Press Play.`); }
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = dragRef.current; if (!drag) return; const point = pointFromEvent(event); if (Math.hypot(point.x - drag.origin.x, point.y - drag.origin.y) > 5) drag.moved = true; if (drag.moved) positionsRef.current[drag.id] = clampPoint({ x: point.x + drag.offset.x, y: point.y + drag.offset.y }); };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => { const drag = dragRef.current; if (drag?.moved) setNotice(`${name(drag.id)} positioned. Click the floor to choose a destination.`); dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const play = () => {
    if (!ids.some(id => { const target = destinationsRef.current[id]; return target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1; })) { setNotice('Choose a Brightling destination first.'); return; }
    waveRef.current = null; setWaving(false); const now = performance.now();
    for (const id of ids) { const target = destinationsRef.current[id], motion = motionsRef.current[id]; motion.moving = !!target && Math.hypot(target.x - positionsRef.current[id].x, target.y - positionsRef.current[id].y) > 1; motion.distance = 0; motion.stopUntil = 0; if (motion.moving && target) { motion.direction = directionTo(positionsRef.current[id], target, motion.direction); motion.turnUntil = now + TURN_MS; } }
    playingRef.current = true; setPlaying(true); setNotice('Walking to the selected destinations…');
  };
  const wave = () => { if (playingRef.current || waveRef.current) return; waveRef.current = { id: selectedRef.current, startedAt: performance.now() }; setWaving(true); setNotice(`${name(selectedRef.current)} is waving hello!`); };
  const reset = () => { playingRef.current = false; setPlaying(false); waveRef.current = null; setWaving(false); for (const id of sceneIds) { motionsRef.current[id].moving = false; motionsRef.current[id].stopUntil = 0; positionsRef.current[id] = { ...savedRef.current.characters[id].start }; } setNotice('Restored the saved starting positions.'); };
  const save = () => { if (!recovery.ok || sceneIssue) { setNotice(recovery.error ?? sceneIssue ?? 'Studio storage is unavailable.'); return; } const scene: Scene = { version: 1, characters: Object.fromEntries(sceneIds.map(id => [id, { start: { ...positionsRef.current[id] }, destination: destinationsRef.current[id] && { ...destinationsRef.current[id] } }])), ...(maxOutfit === 'original' ? {} : { maxOutfit }), ...(maxineOutfit === 'original' ? {} : { maxineOutfit }) }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scene)); savedRef.current = scene; setNotice('Scene saved on this device. Reset now returns to these positions.'); } catch { setNotice('Could not save the scene in this browser. Check site storage settings.'); } };
  const saveMaxOutfit = (outfit: MaxOutfit): boolean => {
    if (!recovery.ok || sceneIssue) return false;
    const scene: Scene = { ...savedRef.current, ...(outfit === 'original' ? {} : { maxOutfit: outfit }) };
    if (outfit === 'original') delete scene.maxOutfit;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
      savedRef.current = scene; setMaxOutfit(outfit);
      return true;
    } catch { return false; }
  };
  const saveMaxineOutfit = (outfit: MaxineOutfit): boolean => {
    if (!recovery.ok || sceneIssue) return false;
    const scene: Scene = { ...savedRef.current, ...(outfit === 'original' ? {} : { maxineOutfit: outfit }) };
    if (outfit === 'original') delete scene.maxineOutfit;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
      savedRef.current = scene; setMaxineOutfit(outfit);
      return true;
    } catch { return false; }
  };
  const open = () => {
    let scene: Scene | null = null; try { scene = parseScene(localStorage.getItem(STORAGE_KEY)); } catch { /* storage unavailable */ }
    if (!scene) { setNotice(sceneIssue ?? 'No saved scene found on this device yet.'); return; }
    playingRef.current = false; setPlaying(false); waveRef.current = null; setWaving(false); savedRef.current = scene; setMaxOutfit(maxOutfitFrom(scene.maxOutfit)); setMaxineOutfit(maxineOutfitFrom(scene.maxineOutfit));
    const entries = Object.entries(scene.characters);
    for (const [id, character] of entries) { motionsRef.current[id] = emptyMotion(); positionsRef.current[id] = { ...character.start }; destinationsRef.current[id] = character.destination; }
    setSceneIds(entries.map(([id]) => id));
    if (!entries.some(([id]) => id === selectedRef.current && !unavailable.includes(id) && (!id.startsWith('brightling-') || library.some(item => item.id === id)))) { selectedRef.current = 'max'; setSelected('max'); }
    setNotice(entries.every(([id]) => !id.startsWith('brightling-') || library.some(item => item.id === id)) ? 'Saved scene reopened.' : 'Saved scene reopened; missing Brightling data was kept but cannot be displayed.');
  };
  const commitLibrary = (next: Brightling[], nextScene?: Scene): boolean => {
    try {
      const oldLibrary = localStorage.getItem(LIBRARY_KEY), oldScene = localStorage.getItem(STORAGE_KEY), oldTimed = localStorage.getItem(TIMED_SCENES_KEY);
      const nextTimed = nextScene ? pruneTimedScenes(timedScenes, next.map(item => item.id)) : timedScenes;
      try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
        if (nextScene && oldScene !== null) localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScene));
        if (nextScene && oldTimed !== null) localStorage.setItem(TIMED_SCENES_KEY, JSON.stringify(nextTimed));
      } catch {
        if (oldLibrary === null) localStorage.removeItem(LIBRARY_KEY); else localStorage.setItem(LIBRARY_KEY, oldLibrary);
        if (oldScene === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, oldScene);
        if (oldTimed === null) localStorage.removeItem(TIMED_SCENES_KEY); else localStorage.setItem(TIMED_SCENES_KEY, oldTimed);
        return false;
      }
      setLibrary(next); setLibraryIssue(null);
      if (nextScene) setTimedScenes(nextTimed);
      return true;
    } catch { return false; }
  };
  const persistedScene = (): Scene | null => { try { return parseScene(localStorage.getItem(STORAGE_KEY)); } catch { return null; } };
  const saveBrightling = async (item: Brightling): Promise<boolean> => {
    if (!recovery.ok || libraryIssue) return false;
    try {
      await makePack(item);
      const index = library.findIndex(character => character.id === item.id);
      const next = [...library];
      if (index === -1) next.push(item); else next[index] = item;
      const saved = commitLibrary(next);
      if (saved) setUnavailable(previous => previous.filter(id => id !== item.id));
      return saved;
    } catch { return false; }
  };
  const deleteBrightling = (id: string): boolean => {
    if (!recovery.ok || libraryIssue || sceneIssue || timedIssue || !library.some(item => item.id === id)) return false;
    const next = library.filter(item => item.id !== id);
    const nextScene = withoutCharacter(persistedScene() ?? savedRef.current, id);
    if (!commitLibrary(next, nextScene)) return false;
    savedRef.current = withoutCharacter(savedRef.current, id);
    setSceneIds(previous => previous.filter(characterId => characterId !== id));
    if (selectedRef.current === id) { selectedRef.current = 'max'; setSelected('max'); }
    return true;
  };
  const importBrightlings = (incoming: Brightling[], mode: ImportMode): boolean => {
    if (!recovery.ok || sceneIssue || timedIssue || (libraryIssue && mode !== 'replace')) return false;
    const result = prepareImport(library, incoming, mode);
    if (!result.ok) { setNotice(result.error); return false; }
    const nextScene = mode === 'replace' ? pruneScene(persistedScene() ?? savedRef.current, result.characters) : savedRef.current;
    if (!commitLibrary(result.characters, nextScene)) return false;
    if (mode === 'replace') {
      savedRef.current = pruneScene(savedRef.current, result.characters);
      setSceneIds(previous => previous.filter(id => !id.startsWith('brightling-') || result.characters.some(item => item.id === id)));
      if (selectedRef.current.startsWith('brightling-') && !result.characters.some(item => item.id === selectedRef.current)) { selectedRef.current = 'max'; setSelected('max'); }
    }
    setUnavailable([]);
    return true;
  };
  const addBrightling = (item: Brightling) => {
    if (sceneIds.includes(item.id)) { select(item.id); setActiveTab('playground'); return; }
    const count = ids.length - 2;
    const start = clampPoint({ x: 720 + count * 110, y: 780 + (count % 2) * 45 });
    positionsRef.current[item.id] = start; destinationsRef.current[item.id] = null; motionsRef.current[item.id] = emptyMotion();
    savedRef.current.characters[item.id] = { start: { ...start }, destination: null };
    setSceneIds([...sceneIds, item.id]); select(item.id); setActiveTab('playground'); setNotice(`${item.name} added. Drag to place, then save the scene.`);
  };
  const exportStudio = async (): Promise<StudioBackup | null> => {
    if (!recovery.ok || libraryIssue || sceneIssue || placesIssue || timedIssue || episodeIssue || introIssue || creditsIssue || projectsIssue || audioIssue || voiceSettingsIssue) return null;
    try {
      const storedLibrary = readLibrary();
      const storedPlaces = decodePlaceOrganisation(localStorage.getItem(PLACE_FOLDERS_KEY));
      const sceneRaw = localStorage.getItem(STORAGE_KEY);
      if (!storedLibrary.ok || !storedPlaces.ok) return null;
      const storedTimed = decodeTimedLibrary(localStorage.getItem(TIMED_SCENES_KEY), placesInReady(storedPlaces.organisation));
      const storedEpisodes = decodeEpisodeLibrary(localStorage.getItem(EPISODES_KEY));
      const storedIntros = decodeIntroLibrary(localStorage.getItem(INTROS_KEY), placesInReady(storedPlaces.organisation));
      const storedCredits = decodeCreditsLibrary(localStorage.getItem(CREDITS_KEY), placesInReady(storedPlaces.organisation));
      const storedProjects = decodeStudioProjects(localStorage.getItem(MUSIC_KEY));
      if (!storedTimed.ok || !storedEpisodes.ok || !storedIntros.ok || !storedCredits.ok || !storedProjects.ok) return null;
      const currentAudio = await listAudioAssets();
      const candidate = createStudioBackup(storedLibrary.characters, sceneRaw === null ? null : JSON.parse(sceneRaw), new Date(), storedPlaces.organisation, storedTimed.library, storedEpisodes.library, await audioBackupAssets(currentAudio), storedIntros.library, storedCredits.library, storedProjects.projects, readVoiceSettings());
      const checked = validateStudioBackup(candidate);
      return checked.ok ? checked.backup : null;
    } catch { return null; }
  };
  const importStudio = async (backup: StudioBackup): Promise<boolean> => {
    if (!recovery.ok) return false;
    try {
      const restoredAudio = backup.audioAssets === null ? null : await decodeAudioBackup(backup.audioAssets);
      await Promise.all(backup.characters.map(item => makePack(item)));
      const result = restoredAudio === null
        ? restoreStudioBackup(localStorage, LIBRARY_KEY, STORAGE_KEY, backup)
        : await restoreStudioWithAudio(localStorage, backup, restoredAudio);
      if (!result.ok) {
        setNotice(result.error ?? 'Studio restore failed.'); return false;
      }
      const scene = backup.scene ?? structuredClone(DEFAULT_SCENE);
      savedRef.current = scene; setMaxOutfit(maxOutfitFrom(scene.maxOutfit)); setMaxineOutfit(maxineOutfitFrom(scene.maxineOutfit));
      positionsRef.current = Object.fromEntries(Object.entries(scene.characters).map(([id, value]) => [id, { ...value.start }]));
      destinationsRef.current = Object.fromEntries(Object.entries(scene.characters).map(([id, value]) => [id, value.destination]));
      motionsRef.current = Object.fromEntries(Object.keys(scene.characters).map(id => [id, emptyMotion()]));
      selectedRef.current = 'max'; setSelected('max'); playingRef.current = false; setPlaying(false); waveRef.current = null; setWaving(false);
      setSceneIds(Object.keys(scene.characters)); setLibrary(backup.characters); setLibraryIssue(null); setSceneIssue(null); setUnavailable([]);
      setPlaces(backup.places); setPlacesIssue(null);
      const restoredTimed = decodeTimedLibrary(localStorage.getItem(TIMED_SCENES_KEY), placesInReady(backup.places));
      if (restoredTimed.ok) { setTimedScenes(restoredTimed.library); setTimedIssue(null); }
      const restoredEpisodes = decodeEpisodeLibrary(localStorage.getItem(EPISODES_KEY));
      if (restoredEpisodes.ok) { setEpisodes(restoredEpisodes.library); setEpisodeIssue(null); }
      const restoredIntros = decodeIntroLibrary(localStorage.getItem(INTROS_KEY), placesInReady(backup.places));
      if (restoredIntros.ok) { setIntros(restoredIntros.library); setIntroIssue(null); }
      const restoredCredits = decodeCreditsLibrary(localStorage.getItem(CREDITS_KEY), placesInReady(backup.places));
      if (restoredCredits.ok) { setCredits(restoredCredits.library); setCreditsIssue(null); }
      const restoredProjects = decodeStudioProjects(localStorage.getItem(MUSIC_KEY));
      if (restoredProjects.ok) { setProjects(restoredProjects.projects); setProjectsIssue(null); }
      try { setVoiceSettings(readVoiceSettings()); setVoiceSettingsIssue(null); } catch { /* Restore validator and journal preserve existing settings. */ }
      if (restoredAudio !== null) { setAudioAssets(restoredAudio); setAudioIssue(null); }
      setNotice('Studio Backup restored. Characters, scenes, episodes and Places library are ready.');
      return true;
    } catch {
      setNotice('Studio restore failed. Existing data was kept.'); return false;
    }
  };
  const savePlaces = (next: PlaceOrganisation): boolean => {
    if (!recovery.ok || placesIssue || !validatePlaceOrganisation(next).ok) return false;
    if (timedScenes.scenes.some(scene => !placesInReady(next).includes(scene.placeId))) return false;
    try { localStorage.setItem(PLACE_FOLDERS_KEY, JSON.stringify(next)); setPlaces(next); return true; }
    catch { return false; }
  };
  const saveTimedScenes = (next: TimedLibrary): boolean => {
    if (!recovery.ok || timedIssue) return false;
    const checked = validateTimedLibrary(next, placesInReady(places));
    if (!checked.ok) return false;
    if (next.scenes.some(scene => Object.keys(scene.characters).some(id => id.startsWith('brightling-') && !library.some(item => item.id === id)))) return false;
    try { localStorage.setItem(TIMED_SCENES_KEY, JSON.stringify(checked.library)); setTimedScenes(checked.library); return true; }
    catch { return false; }
  };
  const saveEpisodes = (next: EpisodeLibrary): boolean => {
    if (!recovery.ok || episodeIssue) return false;
    const checked = validateEpisodeLibrary(next);
    if (!checked.ok || checked.library.episodes.some(item => !speechFitsEpisode(item, timedScenes, intros, credits))) return false;
    try { localStorage.setItem(EPISODES_KEY, JSON.stringify(checked.library)); setEpisodes(checked.library); return true; }
    catch { return false; }
  };
  const saveIntros = (next: IntroLibrary): boolean => {
    if (!recovery.ok || introIssue) return false;
    const checked = validateIntroLibrary(next, placesInReady(places));
    if (!checked.ok) return false;
    if (checked.library.intros.some(item => Object.keys(item.characters).some(id => id.startsWith('brightling-') && !library.some(character => character.id === id)))) return false;
    try { localStorage.setItem(INTROS_KEY, JSON.stringify(checked.library)); setIntros(checked.library); return true; }
    catch { return false; }
  };
  const saveCredits = (next: CreditsLibrary): boolean => {
    if (!recovery.ok || creditsIssue) return false;
    const checked = validateCreditsLibrary(next, placesInReady(places));
    if (!checked.ok) return false;
    try { localStorage.setItem(CREDITS_KEY, JSON.stringify(checked.library)); setCredits(checked.library); return true; }
    catch { return false; }
  };
  const saveProjects = (next: StudioProjects): boolean => {
    if (!recovery.ok || projectsIssue) return false;
    const checked = validateStudioProjects(next);
    if (!checked.ok) return false;
    try { localStorage.setItem(MUSIC_KEY, JSON.stringify(checked.projects)); setProjects(checked.projects); return true; }
    catch { return false; }
  };
  // A rendered song or effect becomes an ordinary Audio Library asset.
  const addRenderedAsset = async (asset: AudioAsset) => {
    try {
      await saveAudioAsset(asset);
      setAudioAssets(previous => [...previous, asset]);
    } catch {
      setNotice('The render was created but could not be stored in the Audio Library. Browser storage may be full.');
    }
  };
  const saveVoiceAsset = async (asset: AudioAsset) => {
    if (audioIssue) throw new Error(audioIssue);
    await saveAudioAsset(asset);
    setAudioAssets(previous => [...previous, asset]);
  };
  const saveVoiceSettings = (next: VoiceSettings): boolean => {
    if (voiceSettingsIssue || !validVoiceSettings(next)) return false;
    try { localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(next)); setVoiceSettings(next); return true; }
    catch { return false; }
  };
  const addAudio = async (file: File, kind: AudioKind) => {
    if (audioIssue) throw new Error(audioIssue);
    const asset = await importAudioFile(file, kind);
    await saveAudioAsset(asset);
    setAudioAssets(previous => [...previous, asset]);
  };
  const deleteAudio = async (id: string) => {
    if (timedIssue || episodeIssue || introIssue || creditsIssue) throw new Error('Scene, intro, credits or episode storage needs repair before deleting audio.');
    const asset = audioAssets.find(item => item.id === id);
    if (!asset) return;
    const affectedScenes = timedScenes.scenes.filter(item => item.audio?.some(clip => clip.assetId === id)).map(item => item.name);
    const affectedSceneIds = new Set(timedScenes.scenes.filter(item => item.audio?.some(clip => clip.assetId === id)).map(item => item.id));
    const affectedIntros = intros.intros.filter(item => item.audio?.some(clip => clip.assetId === id)).map(item => item.name);
    const affectedCredits = credits.credits.filter(item => item.audio?.some(clip => clip.assetId === id)).map(item => item.name);
    const affectedEpisodes = episodes.episodes.filter(item => item.audio?.some(clip => clip.assetId === id) || item.sceneIds.some(sceneId => affectedSceneIds.has(sceneId))).map(item => item.name);
    const usage = [...affectedScenes.map(name => `Scene: ${name}`), ...affectedIntros.map(name => `Intro: ${name}`), ...affectedCredits.map(name => `Credits: ${name}`), ...affectedEpisodes.map(name => `Episode: ${name}`)];
    if (!window.confirm(`Delete “${asset.name}”?${usage.length ? ` This also removes its clips from:\n${usage.join('\n')}` : ''}`)) return;
    const nextTimed = { ...timedScenes, scenes: timedScenes.scenes.map(item => ({ ...item, audio: item.audio?.filter(clip => clip.assetId !== id) })) };
    const nextIntros = { ...intros, intros: intros.intros.map(item => ({ ...item, audio: item.audio?.filter(clip => clip.assetId !== id) })) };
    const nextCredits = { ...credits, credits: credits.credits.map(item => ({ ...item, audio: item.audio?.filter(clip => clip.assetId !== id) })) };
    const nextEpisodes = { ...episodes, episodes: episodes.episodes.map(item => ({ ...item, audio: item.audio?.filter(clip => clip.assetId !== id) })) };
    const beforeTimed = localStorage.getItem(TIMED_SCENES_KEY), beforeIntros = localStorage.getItem(INTROS_KEY), beforeCredits = localStorage.getItem(CREDITS_KEY), beforeEpisodes = localStorage.getItem(EPISODES_KEY);
    try {
      localStorage.setItem(TIMED_SCENES_KEY, JSON.stringify(nextTimed));
      localStorage.setItem(INTROS_KEY, JSON.stringify(nextIntros));
      localStorage.setItem(CREDITS_KEY, JSON.stringify(nextCredits));
      localStorage.setItem(EPISODES_KEY, JSON.stringify(nextEpisodes));
      await removeAudioAsset(id);
      setTimedScenes(nextTimed); setIntros(nextIntros); setCredits(nextCredits); setEpisodes(nextEpisodes); setAudioAssets(previous => previous.filter(item => item.id !== id));
    } catch {
      if (beforeTimed === null) localStorage.removeItem(TIMED_SCENES_KEY); else localStorage.setItem(TIMED_SCENES_KEY, beforeTimed);
      if (beforeIntros === null) localStorage.removeItem(INTROS_KEY); else localStorage.setItem(INTROS_KEY, beforeIntros);
      if (beforeCredits === null) localStorage.removeItem(CREDITS_KEY); else localStorage.setItem(CREDITS_KEY, beforeCredits);
      if (beforeEpisodes === null) localStorage.removeItem(EPISODES_KEY); else localStorage.setItem(EPISODES_KEY, beforeEpisodes);
      throw new Error('Audio could not be deleted. Saved scenes, intros, credits and episodes were kept.');
    }
  };

  const navigate = (tab: StudioTab, sceneId?: string) => {
    if (tab === activeTab && !sceneId) return;
    const proceed = () => { setRequestedSceneId(sceneId ?? null); setActiveTab(tab); };
    if (activeTab === 'scenes' && sceneLeaveGuard.current) sceneLeaveGuard.current(proceed);
    else if (activeTab === 'episodes' && episodeLeaveGuard.current) episodeLeaveGuard.current(proceed);
    else if (activeTab === 'credits' && creditsLeaveGuard.current) creditsLeaveGuard.current(proceed, 'switch Studio section');
    else proceed();
  };
  const chooseWorkspace = (next: Workspace) => {
    if (next === workspace) return;
    setWorkspace(next);
    setWorkspaceIssue(saveWorkspace(next) ? null : 'The workspace changed for this session, but this browser could not save your preference.');
    if (next === 'classic' && activeTab === 'projects') setActiveTab('characters');
  };

  return <div className={`app-shell ${workspace === 'studio3' ? 'studio3-shell' : 'classic-shell'}`}>
    {workspace === 'studio3' ? <Studio3Sidebar activeTab={activeTab} onNavigate={navigate} /> : <aside className="studio-sidebar">
      <div className="brand"><span className="brand-star">✦</span><div><strong>BrightSenAppsTales</strong><small>2D CARTOON STUDIO</small></div></div>
      <p className="sidebar-caption">STUDIO</p>
      <nav className="studio-nav" aria-label="Studio sections">{(['characters', 'places', 'scenes', 'intros', 'episodes', 'credits', 'music', 'voice', 'audio', 'playground', 'unity'] as const).map(tab => <button key={tab} onClick={() => navigate(tab)} className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined}><span className="section-icon" aria-hidden="true">{({ characters: '✦', places: '▧', scenes: '▤', intros: '★', episodes: '▣', credits: '❖', music: '♪', voice: '\u266c', audio: '♫', playground: '▶', unity: '◇' } as const)[tab]}</span><span>{tab === 'music' ? 'Music Studio' : tab === 'voice' ? 'Voice Maker' : tab === 'unity' ? 'Cartoon Preview' : tab[0].toUpperCase() + tab.slice(1)}</span></button>)}</nav>
      <label className="appearance-control">Appearance<select aria-label="Appearance" value={appearance} onChange={event => chooseAppearance(event.target.value as Appearance)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
      <button type="button" className="classic-settings-link" onClick={() => navigate('settings')}>Settings · Workspace</button>
      <span className="local-badge"><span /> Saved in this browser</span>
    </aside>}
    <main className={`main ${activeTab === 'music' ? 'main-music' : ''}`}>
      {workspace === 'studio3' && <header className="studio3-topbar"><div><span className="studio3-topbar-overline">UNITY STUDIO 3.0 <span aria-hidden="true">/</span> {studioTabLabel(activeTab).toUpperCase()}</span><strong>{studioTabLabel(activeTab)}</strong></div><div className="studio3-topbar-actions"><span className={`studio3-unity-state ${unityStatus}`}><span aria-hidden="true" />Unity {unityStatus === 'connected' ? 'connected' : 'not connected'}</span><span className={`studio3-save-status ${sceneDirty ? 'needs-save' : ''}`}><span aria-hidden="true" /> {sceneDirty ? 'Changes to save' : 'Local workspace'}</span><button type="button" onClick={() => chooseWorkspace('classic')}>Classic Studio</button></div></header>}
      {workspaceIssue && activeTab !== 'settings' && <p role="alert" className="storage-alert">{workspaceIssue}</p>}
      {activeTab === 'projects' && <Studio3Projects scenes={timedScenes} episodes={episodes} places={places} onScene={id => navigate('scenes', id)} onNavigate={navigate} />}
      {activeTab === 'settings' && <WorkspaceSettings workspace={workspace} appearance={appearance} onWorkspace={chooseWorkspace} onAppearance={chooseAppearance} storageIssue={workspaceIssue} />}
      {activeTab === 'characters' && <Characters library={library} thumbnails={thumbnails} inScene={sceneIds} maxOutfit={maxOutfit} onMaxOutfitChange={saveMaxOutfit} maxineOutfit={maxineOutfit} onMaxineOutfitChange={saveMaxineOutfit} storageIssue={libraryIssue ?? (recovery.ok ? null : recovery.error ?? 'Studio recovery failed.')} sceneIssue={sceneIssue} onSave={saveBrightling} onDelete={deleteBrightling} onImport={importBrightlings} onAdd={addBrightling} onExportStudio={exportStudio} onImportStudio={importStudio} />}
      {activeTab === 'places' && <Places organisation={places} storageIssue={placesIssue ?? (recovery.ok ? null : recovery.error ?? 'Studio recovery failed.')} onSave={savePlaces} />}
      {activeTab === 'scenes' && <SceneMaker library={timedScenes} characters={library} places={places} maxOutfit={maxOutfit} maxineOutfit={maxineOutfit} issue={timedIssue} onSave={saveTimedScenes} onRenderPreview={id => { setRequestedPreviewSceneId(id); navigate('unity'); }} requestedSceneId={requestedSceneId} audioAssets={audioAssets} professional={workspace === 'studio3'} leaveGuardRef={sceneLeaveGuard} onDirtyChange={setSceneDirty} />}
      {activeTab === 'intros' && <IntroMaker library={intros} characters={library} places={places} maxOutfit={maxOutfit} maxineOutfit={maxineOutfit} issue={introIssue} onSave={saveIntros} audioAssets={audioAssets} />}
      {activeTab === 'credits' && <CreditsMaker library={credits} places={places} issue={creditsIssue} onSave={saveCredits} audioAssets={audioAssets} leaveGuardRef={creditsLeaveGuard} />}
      {activeTab === 'episodes' && <EpisodeMaker library={episodes} scenes={timedScenes} intros={intros} credits={credits} characters={library} places={places} maxOutfit={maxOutfit} maxineOutfit={maxineOutfit} issue={episodeIssue} onSave={saveEpisodes} onEditScene={id => navigate('scenes', id)} leaveGuardRef={episodeLeaveGuard} audioAssets={audioAssets} />}
      {activeTab === 'music' && <MusicStudio projects={projects} issue={projectsIssue} audioAssets={audioAssets} onSaveProjects={saveProjects} onAddAsset={addRenderedAsset} theme={resolvedTheme} onThemeChange={chooseAppearance} />}
      {activeTab === 'voice' && <VoiceMaker assets={audioAssets} characters={library} settings={voiceSettings} issue={voiceSettingsIssue} onSettingsChange={saveVoiceSettings} onSaveAsset={saveVoiceAsset} onDeleteAsset={deleteAudio} />}
      {activeTab === 'audio' && <AudioLibrary assets={audioAssets} issue={audioIssue} onImport={addAudio} onDelete={deleteAudio} />}
      {activeTab === 'unity' && <UnityConnection scenes={timedScenes} requestedSceneId={requestedPreviewSceneId} onStatusChange={setUnityStatus} />}
      <div className="playground-page" hidden={activeTab !== 'playground'}>
      <div className="intro"><div><p className="eyebrow">THE LITTLE LIVING ROOM</p><h1>Make a moment <em>move.</em></h1><p>Place your Brightlings, choose where they walk, and press play.</p></div><div className="step-pill">PLAYGROUND</div></div>
      {sceneIssue && <p className="storage-alert" role="alert">{sceneIssue}</p>}
      <div className="workspace"><section className="stage-panel" aria-label="Cartoon stage"><div className="stage-top"><span><span className="live-dot" /> LIVING ROOM</span><span>Click a character, then the floor</span></div><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Living room scene with draggable Brightlings" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} /><div className="stage-bottom"><span>✦ &nbsp; Your scene</span><span>Drag to place · Click to set destination</span></div></section>
        <aside className="sidebar"><div className="side-heading"><span className="side-number">01</span><div><h2>Characters</h2><p>Pick who you want to move</p></div></div><div className="character-list">{ids.map(id => <button key={id} className={`character-card ${selected === id ? 'active' : ''}`} style={{ '--character-colour': colour(id) } as React.CSSProperties} onClick={() => select(id)} aria-pressed={selected === id}><img src={custom(id) ? thumbnails[id] : spriteSource(id, 'idle', 0, maxOutfit, maxineOutfit)} alt="" /><span><strong>{name(id)}</strong><small>{selected === id ? 'Selected · ready to move' : 'Click to select'}</small></span><span className="radio-mark" /></button>)}</div><button className="wave-button" onClick={wave} disabled={playing || waving} aria-label={`Wave ${name(selected)}`}>✋ &nbsp; Wave {name(selected)}</button>
          {library.length > 0 && <div className="library"><h3>Saved Brightlings</h3>{library.map(item => <button key={item.id} onClick={() => addBrightling(item)} disabled={!thumbnails[item.id] || unavailable.includes(item.id)}><img src={thumbnails[item.id]} alt="" /><span>{item.name}<small>{unavailable.includes(item.id) || !thumbnails[item.id] ? 'Artwork unavailable' : sceneIds.includes(item.id) ? 'In scene · select' : 'Add to scene'}</small></span><b>{sceneIds.includes(item.id) ? '✓' : '+'}</b></button>)}</div>}
          <div className="divider" /><div className="side-heading"><span className="side-number">02</span><div><h2>Make it move</h2><p>Watch your scene come to life</p></div></div><div className="actions"><button className="play-button" onClick={play} disabled={playing}><span>▶</span> {playing ? 'Playing…' : 'Play scene'}</button><button className="reset-button" onClick={reset}>↺ &nbsp; Reset positions</button></div><div className="divider" /><div className="side-heading"><span className="side-number">03</span><div><h2>Keep your scene</h2><p>Come back to it any time</p></div></div><div className="save-actions"><button onClick={save}>↓ &nbsp; Save scene</button><button onClick={open}>↗ &nbsp; Open saved</button></div><p className="storage-note">Stored locally in this browser as scene JSON.</p></aside></div><div className="tip"><span>✦</span><p role="status">{notice}</p></div>
      </div>
    </main>
  </div>;
}
