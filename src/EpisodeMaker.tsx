import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Brightling } from './maker';
import { advanceSceneTime, gestureFramesForScene, needsGreetingSideWave, type TimedLibrary } from './timedScenes';
import { HEIGHT, WIDTH } from './scene';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { type MaxOutfit, type MaxineOutfit } from './outfit';
import { drawCreditsPreview, drawIntroPreview, drawScenePreview, previewPack, type PreviewPack } from './scenePreview';
import { episodeFadeAt, episodeTimingIssue, missingSceneIds, productionBlocks, productionDuration, productionPosition, speechFitsEpisode, type Episode, type EpisodeLibrary } from './episodes';
import AudioPanel from './AudioPanel';
import type { AudioAsset } from './audio';
import { episodePlaybackClips, useAudioPlayback } from './audioPlayback';
import { episodeHasUnsavedChanges, episodeSnapshot } from './episodeDraft';
import { beginEpisodeEdit, recordEpisodeEdit, redoEpisodeEdit, undoEpisodeEdit, type EpisodeEditHistory } from './episodeEditHistory';
import { introTitleOpacity, type IntroLibrary } from './introductions';
import { type CreditsLibrary } from './credits';
import { renderTimelineVideo, type VideoExportProgress } from './sceneVideoExport';
import EpisodeUnityPreview from './EpisodeUnityPreview';
import EpisodeSequence from './EpisodeSequencePanel';
import EpisodeInspector from './EpisodeInspector';
import { appendEpisodeScene, moveEpisodeOccurrence } from './episodeSequence';
import { addEpisodeCameraShot, cameraShotName, episodeCameraIssue, episodeCameraTargets, episodeCameraView } from './episodeCamera';
import { assertEpisodeReady, checkEpisodeHealth, type EpisodeHealthFinding, type EpisodeHealthReport } from './episodeHealthCheck';
import { getUnityEditorStatus } from './unityBridge';
import './episode-library.css';
import { addEpisodeTestPreview, decodeEpisodeWorkspace, deleteEpisodeFolder, EMPTY_EPISODE_WORKSPACE, EPISODE_WORKSPACE_KEY, makeEpisodeFolder, moveEpisodeToFolder, recordEpisodeSaved, renameEpisodeFolder, validateEpisodeWorkspace, type EpisodeTestPreview, type EpisodeWorkspace } from './episodeWorkspace';

export type EpisodeLeaveGuard = (proceed: () => void) => void;
type LocalEpisodeCopy = { id: string; name: string; folderId: string; sceneCount: number; runtime: number; updatedAt: string };
type Props = { library: EpisodeLibrary; scenes: TimedLibrary; intros: IntroLibrary; credits: CreditsLibrary; characters: Brightling[]; places: PlaceOrganisation; maxOutfit: MaxOutfit; maxineOutfit: MaxineOutfit; issue: string | null; onSave: (next: EpisodeLibrary) => boolean; onSaveLocal?: (episode: Episode, folderId: string, updatedAt: string, expectedUpdatedAt: string | null) => Promise<boolean>; onDeleteLocal?: (episodeId: string) => Promise<boolean>; onRecoverLocal?: (episodeId: string) => Promise<boolean>; onEditScene: (id: string) => void; leaveGuardRef: RefObject<EpisodeLeaveGuard | null>; audioAssets?: AudioAsset[] };
const clock = (time: number) => `${time.toFixed(1)}s`;
const drawEpisodeFade = (context: CanvasRenderingContext2D, opacity: number) => { if (opacity <= 0) return; context.save(); context.globalAlpha = opacity; context.fillStyle = '#000'; context.fillRect(0, 0, WIDTH, HEIGHT); context.restore(); };
const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Artwork could not load: ${url.slice(0, 80)}`)); image.src = url; });

export default function EpisodeMaker({ library, scenes: sourceScenes, intros, credits, characters, places, maxOutfit, maxineOutfit, issue, onSave, onSaveLocal, onDeleteLocal, onRecoverLocal, onEditScene, leaveGuardRef, audioAssets = [] }: Props) {
  const [visualPreview, setVisualPreview] = useState<EpisodeTestPreview | null>(null);
  const scenes: TimedLibrary = visualPreview ? { version: 1, scenes: visualPreview.scenes } : sourceScenes;
  const [history, setHistory] = useState<EpisodeEditHistory | null>(null);
  const episode = history?.present ?? null;
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState<{ proceed: () => void; destination: string } | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const [selectedBoundary, setSelectedBoundary] = useState<number | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedAudioClip, setSelectedAudioClip] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose an episode or create one.');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<VideoExportProgress>({ stage: 'validating' });
  const [healthReport, setHealthReport] = useState<EpisodeHealthReport | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [episodeWorkspace, setEpisodeWorkspace] = useState<EpisodeWorkspace>(() => { try { const result = decodeEpisodeWorkspace(localStorage.getItem(EPISODE_WORKSPACE_KEY)); return result.ok ? result.workspace : structuredClone(EMPTY_EPISODE_WORKSPACE); } catch { return structuredClone(EMPTY_EPISODE_WORKSPACE); } });
  const [workspaceIssue, setWorkspaceIssue] = useState<string | null>(() => { try { const result = decodeEpisodeWorkspace(localStorage.getItem(EPISODE_WORKSPACE_KEY)); return result.ok ? null : result.error; } catch { return 'Episode folder storage is unavailable.'; } });
  const [folderFilter, setFolderFilter] = useState('all');
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [folderDraft, setFolderDraft] = useState('');
  const [localCopyStatus, setLocalCopyStatus] = useState('');
  const [pendingPreviewPlay, setPendingPreviewPlay] = useState<string | null>(null);
  const [localEpisodeCopies, setLocalEpisodeCopies] = useState<LocalEpisodeCopy[]>([]);
  const localCopyVersions = useRef<Record<string, string>>({});
  const folderSync = useRef<Promise<boolean>>(Promise.resolve(true));
  const [room, setRoom] = useState<HTMLImageElement | null>(null);
  const [packs, setPacks] = useState<Record<string, PreviewPack>>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const cancelLeave = useRef<HTMLButtonElement>(null);
  const last = useRef(0);
  const exportAbort = useRef<AbortController | null>(null);
  const total = episode ? productionDuration(episode, scenes, intros, credits) : 0;
  const currentHealth = useMemo(() => episode ? checkEpisodeHealth({ episode, scenes, intros, credits, characters, places, audioAssets }) : null, [episode, scenes, intros, credits, characters, places, audioAssets]);
  const dirty = episodeHasUnsavedChanges(episode, savedSnapshot);
  const missing = episode ? missingSceneIds(episode, scenes) : [];
  const missingIntro = !!episode?.introId && !intros.intros.some(item => item.id === episode.introId);
  const missingCredits = !!episode?.creditsId && !credits.credits.some(item => item.id === episode.creditsId);
  const timingIssue = episode ? episodeTimingIssue(episode, scenes) : null;
  const cameraIssue = episode ? episodeCameraIssue(episode, scenes, total) : null;
  const position = episode && missing.length === 0 ? productionPosition(episode, scenes, intros, credits, time) : null;
  const scene = position?.scene;
  const cameraView = episode ? episodeCameraView(episode, scenes, time, intros, credits) : undefined;
  const selectedCameraShot = episode?.camera?.find(shot => shot.id === selectedCamera);
  const audioClips = episode ? episodePlaybackClips(episode, scenes, intros, credits) : [];
  const audio = useAudioPlayback(audioClips, audioAssets, time, playing, setMessage);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [projectResponse, folderResponse, previewResponse, statusResponse] = await Promise.all([
          fetch('/__brighttales_local/episode-projects'), fetch('/__brighttales_local/episode-folders'), fetch('/__brighttales_local/test-previews'), fetch('/__brighttales_local/status'),
        ]);
        if (![projectResponse, folderResponse, previewResponse].every(response => response.ok)) throw new Error('Local file index unavailable');
        const [projectIndex, folderIndex, previewIndex] = await Promise.all([projectResponse.json(), folderResponse.json(), previewResponse.json()]);
        if (!active || projectIndex.version !== 1 || !Array.isArray(projectIndex.episodes) || folderIndex.version !== 1 || !Array.isArray(folderIndex.folders) || previewIndex.version !== 1 || !Array.isArray(previewIndex.items)) return;
        setLocalEpisodeCopies(projectIndex.episodes);
        localCopyVersions.current = Object.fromEntries(projectIndex.episodes.map((copy: LocalEpisodeCopy) => [copy.id, copy.updatedAt]));
        if (!workspaceIssue) setEpisodeWorkspace(previous => {
          const folders = [...previous.folders], idMap = new Map<string, string>();
          for (const folder of folderIndex.folders) {
            const existing = folders.find(item => item.id === folder.id) ?? folders.find(item => item.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase());
            if (existing) idMap.set(folder.id, existing.id);
            else { folders.push(folder); idMap.set(folder.id, folder.id); }
          }
          const assignments = { ...previous.assignments }, lastEdited = { ...previous.lastEdited };
          for (const copy of projectIndex.episodes) if (library.episodes.some(item => item.id === copy.id)) {
            const folderId = copy.folderId === 'unfiled' ? undefined : idMap.get(copy.folderId);
            if (folderId) assignments[copy.id] ??= folderId;
            lastEdited[copy.id] ??= copy.updatedAt;
          }
          const previews = [...previous.testPreviews];
          for (const item of previewIndex.items) if (!previews.some(existing => existing.id === item.id)) previews.push({ ...item, folderId: item.folderId === null ? null : idMap.get(item.folderId) ?? null });
          const checked = validateEpisodeWorkspace({ version: 1, folders, assignments, lastEdited, testPreviews: previews });
          if (!checked.ok) { setLocalCopyStatus('Some saved folder or preview metadata could not be read. Browser projects remain unchanged.'); return previous; }
          try { localStorage.setItem(EPISODE_WORKSPACE_KEY, JSON.stringify(checked.workspace)); return checked.workspace; }
          catch { setLocalCopyStatus('Local folder metadata could not be written to this browser.'); return previous; }
        });
        if (statusResponse.ok) { const status = await statusResponse.json(); if (active && status.service === 'BrightTalesEpisodeLibrary') setLocalCopyStatus(`Private local project storage is ready: ${status.directories.episodes}`); }
      } catch { if (active) setLocalCopyStatus('Browser episodes are available; local PC project copies require the managed Studio launcher.'); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => { setHealthReport(null); }, [currentHealth]);
  const placeName = (id: string) => placesIn(places).find(place => place.id === id)?.name ?? 'Place unavailable';
  const readyPlace = scene && placesIn(places).find(place => place.id === scene.placeId && place.artworkAvailable && place.background);
  const canPreview = !!episode && !missing.length && !missingIntro && !missingCredits && !timingIssue && !cameraIssue && total > 0 && !!room && !!readyPlace && !Object.keys(scene?.characters ?? {}).some(id => !packs[id]);
  const playFrom = (at: number) => { if (!canPreview) return; const start = Math.max(0, Math.min(at, total)); audio.startAt(start); setTime(start); setPlaying(true); };
  const togglePlayback = () => { if (!canPreview) return; if (playing) setPlaying(false); else playFrom(time >= total ? 0 : time); };
  const requestLeave = (proceed: () => void, destination: string) => {
    if (dirty) setPendingLeave({ proceed, destination });
    else proceed();
  };
  const persistWorkspace = (next: EpisodeWorkspace): boolean => {
    if (workspaceIssue) return false;
    const checked = validateEpisodeWorkspace(next);
    if (!checked.ok) { setLocalCopyStatus(checked.error); return false; }
    try {
      localStorage.setItem(EPISODE_WORKSPACE_KEY, JSON.stringify(checked.workspace));
      setEpisodeWorkspace(checked.workspace);
      folderSync.current = fetch('/__brighttales_local/episode-folders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, folders: checked.workspace.folders }) })
        .then(response => response.ok).catch(() => false);
      void folderSync.current.then(saved => { if (!saved) setLocalCopyStatus('Folders are saved in this browser; the local disk folder index could not be updated.'); });
      return true;
    } catch { setLocalCopyStatus('Episode folders could not be saved. Existing episode data was kept.'); return false; }
  };
  const persistEpisodeCopy = (item: Episode, folderId = episodeWorkspace.assignments[item.id] ?? 'unfiled', updatedAt = episodeWorkspace.lastEdited[item.id] ?? new Date().toISOString()) => {
    if (!onSaveLocal) { setLocalCopyStatus('Episode is saved in this browser. Local disk copies are unavailable in this launch mode.'); return; }
    setLocalCopyStatus('Saving a local project copy…');
    const expectedUpdatedAt = localCopyVersions.current[item.id] ?? null;
    void folderSync.current.then(foldersSaved => foldersSaved && onSaveLocal(item, folderId, updatedAt, expectedUpdatedAt)).then(saved => { setLocalCopyStatus(saved ? 'Local project copy saved on this PC.' : 'Episode is saved in this browser, but its local disk copy could not be updated. A newer copy may exist; refresh the Studio before retrying.'); if (saved) { localCopyVersions.current[item.id] = updatedAt; void refreshLocalCopies(); } })
      .catch(() => setLocalCopyStatus('Episode is saved in this browser, but its local disk copy could not be updated. Keep this browser profile and use Studio Backup for another copy.'));
  };

  const refreshLocalCopies = async () => {
    try { const response = await fetch('/__brighttales_local/episode-projects'); if (!response.ok) return; const value = await response.json(); if (value.version === 1 && Array.isArray(value.episodes)) setLocalEpisodeCopies(value.episodes); } catch { /* Browser storage still contains the editable episode. */ }
  };
  const createFolder = () => {
    const next = makeEpisodeFolder(episodeWorkspace, folderDraft);
    if (!next) { setLocalCopyStatus('Choose a unique folder name up to 60 characters.'); return; }
    if (persistWorkspace(next)) { setFolderDraft(''); setFolderFilter(next.folders.at(-1)!.id); setLocalCopyStatus('Folder created.'); }
  };
  const renameFolder = () => {
    const folder = episodeWorkspace.folders.find(item => item.id === folderFilter);
    if (!folder) return;
    const name = window.prompt('Rename folder', folder.name);
    if (name === null) return;
    const next = renameEpisodeFolder(episodeWorkspace, folder.id, name);
    if (!next) { setLocalCopyStatus('Choose a unique folder name up to 60 characters.'); return; }
    persistWorkspace(next);
  };
  const removeFolder = () => {
    const folder = episodeWorkspace.folders.find(item => item.id === folderFilter);
    if (!folder || !window.confirm(`Delete folder “${folder.name}”? Its episodes and previews will move to Unfiled.`)) return;
    const next = deleteEpisodeFolder(episodeWorkspace, folder.id);
    if (next && persistWorkspace(next)) {
      setFolderFilter('all');
      for (const item of library.episodes.filter(saved => episodeWorkspace.assignments[saved.id] === folder.id)) persistEpisodeCopy(item, 'unfiled', next.lastEdited[item.id] ?? new Date().toISOString());
      void folderSync.current.then(() => fetch('/__brighttales_local/test-previews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, items: next.testPreviews }) })).catch(() => {});
    }
  };
  const createEpisode = () => {
    const fresh = { id: crypto.randomUUID(), name: 'My Episode', sceneIds: [] };
    if (folderFilter !== 'all' && folderFilter !== 'unfiled') {
      const next = moveEpisodeToFolder(episodeWorkspace, fresh.id, folderFilter);
      if (!next || !persistWorkspace(next)) return;
    }
    open(fresh);
  };
  const duplicateEpisode = (item: Episode) => {
    const duplicate = { ...structuredClone(item), id: crypto.randomUUID(), name: `${item.name} copy` };
    const folderId = episodeWorkspace.assignments[item.id];
    if (folderId) {
      const next = moveEpisodeToFolder(episodeWorkspace, duplicate.id, folderId);
      if (!next || !persistWorkspace(next)) return;
    }
    open(duplicate); setMessage('Duplicate opened. Save Episode to keep the copy.');
  };
  const moveEpisode = (item: Episode, folderId: string) => {
    const next = moveEpisodeToFolder(episodeWorkspace, item.id, folderId === 'unfiled' ? null : folderId);
    if (!next || !persistWorkspace(next)) return;
    void folderSync.current.then(() => fetch('/__brighttales_local/test-previews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, items: next.testPreviews }) })).catch(() => {});
    if (library.episodes.some(saved => saved.id === item.id)) persistEpisodeCopy(item, folderId, next.lastEdited[item.id] ?? new Date().toISOString());
  };
  const open = (item: Episode, preview: EpisodeTestPreview | null = null) => requestLeave(() => {
    setHealthReport(null);
    setVisualPreview(preview);
    setHistory(beginEpisodeEdit(item));
    setSelectedSceneIndex(null);
    setSelectedBoundary(null);
    setSelectedCamera(null);
    setSavedSnapshot(preview || library.episodes.some(saved => saved.id === item.id) ? episodeSnapshot(item) : null);
    setTime(0); setPlaying(false); setMessage('Add scenes from the library, then press Play.');
  }, 'open another episode');
  const change = (next: Episode) => { if (visualPreview) return; setHealthReport(null); setPlaying(false); setHistory(current => current ? recordEpisodeEdit(current, next) : current); setTime(value => Math.min(value, productionDuration(next, scenes, intros, credits))); };
  const undo = () => { if (!history?.past.length) return; const next = undoEpisodeEdit(history); setPlaying(false); setHistory(next); setTime(value => Math.min(value, productionDuration(next.present, scenes, intros, credits))); };
  const redo = () => { if (!history?.future.length) return; const next = redoEpisodeEdit(history); setPlaying(false); setHistory(next); setTime(value => Math.min(value, productionDuration(next.present, scenes, intros, credits))); };
  const save = (): boolean => {
    if (visualPreview) { setMessage('Visual test previews are read-only snapshots. Return to Episodes and open the editable episode to make changes.'); return false; }
    if (!episode || issue) { setMessage(issue ?? 'Episode could not be saved.'); return false; }
    if (timingIssue) { setMessage(timingIssue); return false; }
    if (cameraIssue) { setMessage(cameraIssue); return false; }
    if (!speechFitsEpisode(episode, scenes, intros, credits)) { setMessage('A voice clip runs past the episode end. Move or trim it before saving.'); return false; }
    const next = { version: 1 as const, episodes: library.episodes.some(item => item.id === episode.id) ? library.episodes.map(item => item.id === episode.id ? episode : item) : [...library.episodes, episode] };
    const saved = onSave(next);
    if (saved) {
      const updatedAt = new Date().toISOString();
      const organized = recordEpisodeSaved(episodeWorkspace, episode, new Date(updatedAt));
      persistWorkspace(organized);
      setSavedSnapshot(episodeSnapshot(episode));
      persistEpisodeCopy(episode, organized.assignments[episode.id] ?? 'unfiled', updatedAt);
    }
    setMessage(saved ? 'Episode saved in this browser.' : 'Episode could not be saved. Existing episodes were kept.');
    return saved;
  };
  const exportVideo = async () => {
    if (!episode || dirty || missing.length || missingIntro || missingCredits || timingIssue || cameraIssue || exporting || exportAbort.current) return;
    const controller = new AbortController(); exportAbort.current = controller;
    setPlaying(false); setExporting(true); setExportProgress({ stage: 'validating' });
    try {
      const report = checkEpisodeHealth({ episode, scenes, intros, credits, characters, places, audioAssets });
      assertEpisodeReady(report, 'export');
      const blocks = productionBlocks(episode, scenes, intros, credits);
      if (!blocks.length) throw new Error('Add an intro, scene or credits before exporting.');
      setExportProgress({ stage: 'preparing' }); setMessage('Preparing every scene, background, Brightling and audio cue.');
      const placesById = new Map(placesIn(places).map(place => [place.id, place]));
      const rooms = new Map<string, HTMLImageElement>();
      for (const block of blocks) {
        const place = placesById.get(block.scene.placeId);
        if (!place?.artworkAvailable || !place.background) throw new Error(`Artwork is missing for ${place?.name ?? block.scene.placeId}.`);
        if (!rooms.has(block.scene.placeId)) rooms.set(block.scene.placeId, await loadImage(place.background));
      }
      const cast = [...new Set(blocks.flatMap(block => Object.keys(block.scene.characters)))];
      const loaded = await Promise.all(cast.map(async id => [id, await previewPack(id, characters, maxOutfit, maxineOutfit, [...new Set(blocks.flatMap(block => gestureFramesForScene(block.scene, id)))], blocks.some(block => needsGreetingSideWave(block.scene, id)), blocks.some(block => block.scene.life?.mode === 'v2' || block.scene.livingWorld?.enabled) ? 'v2' : blocks.some(block => !!block.scene.life?.enabled))] as const));
      const packsById = Object.fromEntries(loaded.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null));
      if (cast.some(id => !packsById[id])) throw new Error('A Brightling sprite is missing.');
      if (blocks.some(block => Object.keys(block.scene.characters).some(id => needsGreetingSideWave(block.scene, id) && !packsById[id]?.sideWave))) throw new Error('Greeting V2 side-wave artwork requires Max and Maxine in their original outfits.');
      const draw = (context: CanvasRenderingContext2D, at: number) => {
        const block = blocks.find((item, index) => at < item.start + item.duration || index === blocks.length - 1)!;
        const local = at - block.start;
        const room = rooms.get(block.scene.placeId)!;
        const camera = episodeCameraView(episode, scenes, at, intros, credits);
        if (block.intro) drawIntroPreview(context, block.scene, block.intro.seriesTitle, block.intro.episodeTitle, block.intro.titleStyle, introTitleOpacity(block.intro, local), local, room, packsById, camera);
        else if (block.credits) drawCreditsPreview(context, block.scene, block.credits.title, block.credits.lines, block.credits.mode, block.credits.scrollSpeed, local, room, camera);
        else drawScenePreview(context, block.scene, Math.min(local, block.scene.duration), room, packsById, camera);
        drawEpisodeFade(context, episodeFadeAt(episode, scenes, at, intros, credits));
      };
      setMessage('Preparing scenes, artwork and audio for the complete episode.');
      const blob = await renderTimelineVideo(total, draw, episodePlaybackClips(episode, scenes, intros, credits), audioAssets, progress => {
        if (progress.stage === 'validating') return;
        setExportProgress(progress);
        setMessage(progress.stage === 'preparing' ? 'Preparing scenes, artwork and audio.' :
          progress.stage === 'rendering' ? 'Rendering complete episode frames.' :
          progress.stage === 'encoding' ? 'Encoding video and audio.' :
          progress.stage === 'finalising' ? 'Checking and finalising the WebM file.' : 'WebM is complete and validated.');
      }, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
      let localExportMessage = 'The private local PC export copy could not be written.';
      try {
        const exportId = crypto.randomUUID();
        const stored = await fetch(`/__brighttales_local/exports/${encodeURIComponent(exportId)}.webm`, { method: 'PUT', headers: { 'Content-Type': blob.type || 'video/webm' }, body: blob, signal: AbortSignal.timeout(60_000) });
        if (stored.ok) localExportMessage = `Private PC copy: .brighttales-local/exports/${exportId}.webm.`;
        else localExportMessage = `The browser download will continue, but local PC storage reported ${(await stored.json().catch(() => null))?.error ?? `HTTP ${stored.status}`}.`;
      } catch { localExportMessage = 'The browser download will continue; the managed Studio local file service did not save an extra PC copy.'; }
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a'); link.href = url; link.download = `${episode.name.replace(/[^a-z0-9_-]/gi, '_') || 'episode'}.webm`; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch {
        URL.revokeObjectURL(url);
        throw new Error('The browser could not start the WebM download. Check download permissions and try again.');
      }
      setMessage(`Complete ${blob.type.split(';')[0]} file prepared (${(blob.size / 1_000_000).toFixed(1)} MB). The browser download was started; check Downloads to confirm the file was saved. ${localExportMessage}`);
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError' ? 'Episode export cancelled. Temporary recording resources were released.' : error instanceof Error ? error.message : 'Episode export failed.');
    } finally { if (exportAbort.current === controller) exportAbort.current = null; setExporting(false); }
  };
  const runHealthCheck = async () => {
    if (!episode || checkingHealth) return;
    setCheckingHealth(true);
    try {
      const report = checkEpisodeHealth({ episode, scenes, intros, credits, characters, places, audioAssets });
      const findings = [...report.findings];
      if (dirty) findings.push({ id: 'episode-unsaved', category: 'warning', scope: 'info', title: 'Unsaved changes', message: 'This check covers the current edits. Save the episode before Unity preview or WebM export.' });
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      try {
        const unity = await getUnityEditorStatus(controller.signal);
        if (unity.state === 'Error') findings.push({ id: 'unity-status', category: 'error', scope: 'preview', title: 'Unity Editor', message: unity.detail || 'Unity Editor control reported an error.' });
        else if (unity.state === 'Editor Ready' || unity.state === 'Playing') findings.push({ id: 'unity-status', category: 'passed', scope: 'info', title: 'Unity Editor', message: unity.state === 'Playing' ? 'Unity Editor is already in Play Mode.' : 'Unity Editor is open. Preview can request Play Mode when needed.' });
        else findings.push({ id: 'unity-status', category: 'warning', scope: 'info', title: 'Unity Editor', message: `Unity Editor currently reports ${unity.state}. Preview will wait for it to become ready.` });
      } catch {
        findings.push({ id: 'unity-status', category: 'warning', scope: 'info', title: 'Unity Editor', message: 'Unity readiness could not be checked. Open the BrightTales Unity project with Start-BrightTales-Review.cmd before previewing.' });
      } finally { window.clearTimeout(timeout); }
      setHealthReport({ ...report, findings, errors: findings.filter(item => item.category === 'error').length, warnings: findings.filter(item => item.category === 'warning').length, passed: findings.filter(item => item.category === 'passed').length });
    } finally { setCheckingHealth(false); }
  };
  const jumpToFinding = (item: EpisodeHealthFinding) => {
    if (!episode) return;
    setPlaying(false);
    if (item.cameraId) { setSelectedCamera(item.cameraId); setSelectedSceneIndex(null); setSelectedBoundary(null); }
    else if (item.sceneIndex !== undefined) { setSelectedSceneIndex(item.sceneIndex); setSelectedCamera(null); setSelectedBoundary(null); }
    if (item.audioClipId && item.sceneIndex === undefined) setSelectedAudioClip(item.audioClipId);
    const block = item.sceneIndex === undefined ? undefined : productionBlocks(episode, scenes, intros, credits).find(candidate => candidate.occurrenceIndex === item.sceneIndex);
    const targetTime = item.start ?? block?.start;
    if (targetTime !== undefined) setTime(Math.max(0, Math.min(total, targetTime)));
    if (item.audioClipId && item.sceneIndex === undefined) window.setTimeout(() => document.getElementById('episode-audio-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    else if (item.sceneIndex !== undefined || item.cameraId) window.setTimeout(() => document.querySelector('.episode-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  useEffect(() => {
    leaveGuardRef.current = proceed => requestLeave(proceed, 'switch Studio section');
    return () => { leaveGuardRef.current = null; };
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (pendingLeave && !leaveDialog.current?.open) { leaveDialog.current?.showModal(); cancelLeave.current?.focus(); }
    else if (!pendingLeave && leaveDialog.current?.open) leaveDialog.current.close();
  }, [pendingLeave]);

  useEffect(() => {
    if (!readyPlace?.background) { setRoom(null); return; }
    let live = true;
    const image = new Image();
    image.onload = () => { if (live) setRoom(image); };
    image.onerror = () => { if (live) { setRoom(null); setMessage('Scene background could not load.'); } };
    setRoom(null); image.src = readyPlace.background;
    return () => { live = false; };
  }, [readyPlace?.background]);

  useEffect(() => {
    if (!scene) { setPacks({}); return; }
    let live = true;
    setPacks({});
    Promise.all(Object.keys(scene.characters).map(async id => [id, await previewPack(id, characters, maxOutfit, maxineOutfit, gestureFramesForScene(scene, id), needsGreetingSideWave(scene, id), scene.life?.mode === 'v2' || scene.livingWorld?.enabled ? 'v2' : !!scene.life?.enabled)] as const))
      .then(entries => { if (live) setPacks(Object.fromEntries(entries.filter((entry): entry is readonly [string, PreviewPack] => entry[1] !== null))); })
      .catch(() => { if (live) setMessage('A Brightling sprite could not load.'); });
    return () => { live = false; };
  }, [scene?.id, scene?.actions, scene?.life?.enabled, scene?.life?.mode, scene?.livingWorld?.enabled, characters, maxOutfit, maxineOutfit]);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (scene && room && position) {
      if (position.intro) drawIntroPreview(context, scene, position.intro.seriesTitle, position.intro.episodeTitle, position.intro.titleStyle, introTitleOpacity(position.intro, position.localTime), position.localTime, room, packs, cameraView);
      else if (position.credits) drawCreditsPreview(context, scene, position.credits.title, position.credits.lines, position.credits.mode, position.credits.scrollSpeed, position.localTime, room, cameraView);
      else drawScenePreview(context, scene, Math.min(position.localTime, scene.duration), room, packs, cameraView);
      drawEpisodeFade(context, episodeFadeAt(episode!, scenes, time, intros, credits));
    }
  }, [scene, room, packs, position?.localTime, time, episode, scenes, intros, credits]);

  useEffect(() => {
    if (!playing || !episode || missing.length || total <= 0) return;
    let frame = 0;
    last.current = 0;
    const tick = (now: number) => {
      const elapsed = last.current ? (now - last.current) / 1000 : 0;
      last.current = now;
      if (elapsed > 0) setTime(value => { const next = advanceSceneTime(value, elapsed, total); if (next >= total) setPlaying(false); return next; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, episode?.id, total, missing.length]);

  const createCamera = () => {
    if (!episode) return;
    const target = episodeCameraTargets(episode, scenes, characters)[0]?.id ?? 'point';
    const result = addEpisodeCameraShot(episode, total, time, target);
    if ('error' in result) { setMessage(result.error); return; }
    change(result.episode);
    setSelectedCamera(result.shot.id);
    setSelectedSceneIndex(null);
    setSelectedBoundary(null);
    setMessage('Camera shot added. Choose a shot, target and movement in the Inspector.');
  };

  useEffect(() => {
    if (selectedCamera && !episode?.camera?.some(shot => shot.id === selectedCamera)) setSelectedCamera(null);
  }, [episode?.camera, selectedCamera]);

  useEffect(() => {
    if (!pendingPreviewPlay || visualPreview?.id !== pendingPreviewPlay || !canPreview) return;
    playFrom(0);
    setPendingPreviewPlay(null);
  }, [pendingPreviewPlay, visualPreview?.id, canPreview]);

  const createTestPreview = (item: Episode) => {
    const purpose = window.prompt('What should this visual preview help you review?', 'Review the current scene order, animation and camera timing.');
    if (purpose === null) return;
    const sceneSnapshots = item.sceneIds.map(id => sourceScenes.scenes.find(sceneItem => sceneItem.id === id)).filter((sceneItem): sceneItem is TimedLibrary['scenes'][number] => !!sceneItem);
    const next = addEpisodeTestPreview(episodeWorkspace, item, sceneSnapshots, `${item.name} · Preview ${new Date().toLocaleDateString()}`, purpose);
    if (!next || !persistWorkspace(next)) { setLocalCopyStatus('A playable preview could not be created. Check that the episode has valid saved scenes.'); return; }
    setLocalCopyStatus('Playable visual test preview saved in this Studio profile.');
    void fetch('/__brighttales_local/test-previews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, items: next.testPreviews }) })
      .then(response => { if (!response.ok) setLocalCopyStatus('Preview is saved in this browser; the local disk preview index could not be updated.'); })
      .catch(() => setLocalCopyStatus('Preview is saved in this browser; the Studio local file service is unavailable.'));
  };

  const removeTestPreview = (id: string) => {
    const next = { ...episodeWorkspace, testPreviews: episodeWorkspace.testPreviews.filter(item => item.id !== id) };
    if (!persistWorkspace(next)) return;
    void fetch('/__brighttales_local/test-previews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, items: next.testPreviews }) }).catch(() => {});
  };

  const downloadLocalBackup = async (item: Episode) => {
    try {
      const response = await fetch(`/__brighttales_local/episode-projects/${encodeURIComponent(item.id)}/backup`);
      if (!response.ok) throw new Error('No local PC copy is available yet. Save the episode first.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${item.name.replace(/[^a-z0-9_-]/gi, '_')}-studio-backup-v8.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setLocalCopyStatus(error instanceof Error ? error.message : 'Local backup download failed.'); }
  };

  const renameSavedEpisode = (item: Episode) => {
    const name = window.prompt('Rename episode', item.name);
    if (name === null) return;
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > 80) { setLocalCopyStatus('Episode names must contain 1–80 characters.'); return; }
    const renamed = { ...item, name: clean };
    const next = { version: 1 as const, episodes: library.episodes.map(saved => saved.id === item.id ? renamed : saved) };
    if (onSave(next)) {
      const updatedAt = new Date().toISOString();
      const organized = recordEpisodeSaved(episodeWorkspace, renamed, new Date(updatedAt));
      persistWorkspace(organized); persistEpisodeCopy(renamed, organized.assignments[item.id] ?? 'unfiled', updatedAt);
    }
  };

  const deleteSavedEpisode = (item: Episode) => {
    if (!window.confirm(`Delete episode “${item.name}”? Its saved scenes and audio assets will stay in the library.`)) return;
    void (async () => {
      if (onDeleteLocal && !(await onDeleteLocal(item.id))) { setLocalCopyStatus('The local episode copy could not be removed, so the episode was kept.'); return; }
      const next = { version: 1 as const, episodes: library.episodes.filter(saved => saved.id !== item.id) };
      if (!onSave(next)) { setLocalCopyStatus('Episode could not be deleted. Existing data was kept.'); return; }
      setLocalEpisodeCopies(previous => previous.filter(copy => copy.id !== item.id));
      const { [item.id]: _assignment, ...assignments } = episodeWorkspace.assignments;
      const { [item.id]: _lastEdited, ...lastEdited } = episodeWorkspace.lastEdited;
      const workspace = { ...episodeWorkspace, assignments, lastEdited };
      persistWorkspace(workspace);
      void fetch('/__brighttales_local/test-previews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, items: workspace.testPreviews }) }).catch(() => {});
      setLocalCopyStatus('Episode deleted. Its scenes and audio assets were kept.');
    })();
  };

  const visibleEpisodes = library.episodes.filter(item => {
    const folderMatches = folderFilter === 'all' || (folderFilter === 'unfiled' ? !episodeWorkspace.assignments[item.id] : episodeWorkspace.assignments[item.id] === folderFilter);
    return folderMatches && item.name.toLocaleLowerCase().includes(episodeSearch.toLocaleLowerCase());
  });
  const visiblePreviews = episodeWorkspace.testPreviews.filter(item => (folderFilter === 'all' || (folderFilter === 'unfiled' ? item.folderId === null : item.folderId === folderFilter)) && `${item.title} ${item.purpose}`.toLocaleLowerCase().includes(episodeSearch.toLocaleLowerCase()));

  useEffect(() => {
    if (!episode) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      const control = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (control && key === 's') { event.preventDefault(); save(); return; }
      if (control && !editing && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (control && !editing && key === 'y') { event.preventDefault(); redo(); return; }
      if (editing || control || event.altKey || target?.closest('button, a, summary')) return;
      if (event.key === ' ') { event.preventDefault(); togglePlayback(); }
      else if (event.key === 'Home') { event.preventDefault(); setPlaying(false); setTime(0); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return <section className="episode-maker scene-maker">
    <dialog ref={leaveDialog} className="episode-leave-dialog" aria-labelledby="episode-leave-title" aria-describedby="episode-leave-description" onCancel={event => { event.preventDefault(); setPendingLeave(null); }}>
      <h2 id="episode-leave-title">Unsaved episode changes</h2>
      <p id="episode-leave-description">Save changes to {episode?.name || 'this episode'} before you {pendingLeave?.destination}?</p>
      {(issue || message.startsWith('Episode could not be saved')) && <p role="alert" className="episode-save-error">{issue ?? message}</p>}
      <div className="episode-leave-actions"><button ref={cancelLeave} onClick={() => setPendingLeave(null)}>Cancel</button><button onClick={() => { const next = pendingLeave?.proceed; setPendingLeave(null); next?.(); }}>Discard Changes</button><button className="scene-primary" onClick={() => { if (save()) { const next = pendingLeave?.proceed; setPendingLeave(null); next?.(); } }}>Save and Continue</button></div>
    </dialog>
    {!episode ? <><div className="scene-heading"><div><p className="eyebrow">EPISODE LIBRARY</p><h1>My Episodes</h1><p>Organise your cartoons, keep editing, and play saved visual test previews here.</p></div><button className="scene-primary" disabled={!!issue || !!workspaceIssue} onClick={createEpisode}>Create Episode</button></div>
      {issue && <p role="alert" className="storage-alert">{issue}</p>}
      {workspaceIssue && <p role="alert" className="storage-alert">{workspaceIssue} Folders are read-only until this is repaired; saved episodes remain unchanged.</p>}
      <div className="episode-library-toolbar"><form className="folder-form" onSubmit={event => { event.preventDefault(); createFolder(); }}><label>New folder<input aria-label="New episode folder name" maxLength={60} value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="Folder name" /></label><button type="submit" disabled={!!workspaceIssue || !folderDraft.trim()}>Create Folder</button></form><label className="episode-search">Search episodes and previews<input type="search" value={episodeSearch} onChange={event => setEpisodeSearch(event.target.value)} placeholder="Search by name" /></label></div>
      <nav className="episode-folder-nav" aria-label="Episode folders"><button className={folderFilter === 'all' ? 'selected' : ''} onClick={() => setFolderFilter('all')}>All episodes</button><button className={folderFilter === 'unfiled' ? 'selected' : ''} onClick={() => setFolderFilter('unfiled')}>Unfiled</button>{episodeWorkspace.folders.map(folder => <button key={folder.id} className={folderFilter === folder.id ? 'selected' : ''} onClick={() => setFolderFilter(folder.id)}>{folder.name}</button>)}{episodeWorkspace.folders.some(folder => folder.id === folderFilter) && <><button onClick={renameFolder} disabled={!!workspaceIssue}>Rename folder</button><button onClick={removeFolder} disabled={!!workspaceIssue}>Delete folder</button></>}</nav>
      {localCopyStatus && <p role="status" className="episode-local-status">{localCopyStatus}</p>}
      <section aria-labelledby="my-episode-list"><div className="episode-library-title"><h2 id="my-episode-list">Episodes</h2><span>{visibleEpisodes.length} shown · local browser library</span></div><div className="episode-library-grid">{visibleEpisodes.map(item => {
        const first = item.sceneIds.map(id => sourceScenes.scenes.find(sceneItem => sceneItem.id === id)).find(Boolean);
        const place = first ? placesIn(places).find(entry => entry.id === first.placeId) : null;
        const editedAt = episodeWorkspace.lastEdited[item.id];
        const missingSceneCount = missingSceneIds(item, sourceScenes).length;
        return <article className="episode-library-card" key={item.id}>{place?.background && <img className="episode-library-thumb" src={place.background} alt={`${place.name} scene preview`} loading="lazy" />}<div className="episode-library-card-body"><h3>{item.name}</h3><p>{clock(productionDuration(item, sourceScenes, intros, credits))} · {item.sceneIds.length} scenes · {editedAt ? `Edited ${new Date(editedAt).toLocaleDateString()}` : 'Date not recorded'}</p>{missingSceneCount > 0 && <p role="alert" className="episode-warning">{missingSceneCount} saved scene reference{missingSceneCount === 1 ? '' : 's'} unavailable.</p>}<div className="episode-library-card-actions"><button className="scene-primary" onClick={() => open(item)}>Open &amp; Edit</button><button onClick={() => renameSavedEpisode(item)}>Rename</button><button onClick={() => duplicateEpisode(item)}>Duplicate</button><select aria-label={`Move ${item.name} to folder`} value={episodeWorkspace.assignments[item.id] ?? 'unfiled'} onChange={event => moveEpisode(item, event.target.value)}><option value="unfiled">Unfiled</option>{episodeWorkspace.folders.map(folder => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select><button onClick={() => createTestPreview(item)}>Save Visual Test Preview</button><button onClick={() => void downloadLocalBackup(item)}>Download Local Backup</button><button className="episode-danger" onClick={() => deleteSavedEpisode(item)}>Delete</button></div></div></article>;
      })}</div>{visibleEpisodes.length === 0 && <p className="scene-empty">No episodes in this folder match your search.</p>}</section>
      {localEpisodeCopies.some(copy => !library.episodes.some(item => item.id === copy.id) && (folderFilter === 'all' || folderFilter === 'unfiled' && copy.folderId === 'unfiled' || folderFilter === copy.folderId) && `${copy.name}`.toLocaleLowerCase().includes(episodeSearch.toLocaleLowerCase())) && <section className="episode-test-library" aria-labelledby="episode-local-copies-title"><div className="episode-library-title"><div><h2 id="episode-local-copies-title">Saved on this PC</h2><p>Private local project copies. Add one to this browser without replacing any current projects.</p></div></div><div className="episode-library-grid">{localEpisodeCopies.filter(copy => !library.episodes.some(item => item.id === copy.id) && (folderFilter === 'all' || folderFilter === 'unfiled' && copy.folderId === 'unfiled' || folderFilter === copy.folderId) && copy.name.toLocaleLowerCase().includes(episodeSearch.toLocaleLowerCase())).map(copy => <article className="episode-library-card" key={copy.id}><div className="episode-library-card-body"><h3>{copy.name}</h3><p>{clock(copy.runtime)} · {copy.sceneCount} scenes · Local copy updated {new Date(copy.updatedAt).toLocaleDateString()}</p><div className="episode-library-card-actions"><button className="scene-primary" disabled={!onRecoverLocal} onClick={() => { setLocalCopyStatus('Checking saved scenes, characters, artwork and audio…'); void onRecoverLocal?.(copy.id).then(ok => { if (!ok) return; const folder = episodeWorkspace.folders.find(item => item.id === copy.folderId); if (folder) persistWorkspace({ ...episodeWorkspace, assignments: { ...episodeWorkspace.assignments, [copy.id]: folder.id }, lastEdited: { ...episodeWorkspace.lastEdited, [copy.id]: copy.updatedAt } }); else persistWorkspace({ ...episodeWorkspace, lastEdited: { ...episodeWorkspace.lastEdited, [copy.id]: copy.updatedAt } }); setLocalCopyStatus('Local episode added. Other current projects were left intact.'); }); }}>Add local copy to My Episodes</button><a className="episode-local-download" href={`/__brighttales_local/episode-projects/${encodeURIComponent(copy.id)}/backup`} download={`${copy.name.replace(/[^a-z0-9_-]/gi, '_')}-studio-backup-v8.json`}>Download native backup</a></div></div></article>)}</div></section>}
      <section className="episode-test-library" aria-labelledby="episode-test-library-title"><div className="episode-library-title"><div><h2 id="episode-test-library-title">Test Previews</h2><p>Playable snapshots made with the existing episode preview renderer. These are visual reviews, not automated unit tests or approvals.</p></div><span>{visiblePreviews.length} previews</span></div><div className="episode-library-grid">{visiblePreviews.map(preview => { const source = library.episodes.find(item => item.id === preview.episodeId); return <article className="episode-library-card test-preview-card" key={preview.id}><div className="episode-test-preview-mark" aria-hidden="true">▶</div><div className="episode-library-card-body"><h3>{preview.title}</h3><p>Created {new Date(preview.createdAt).toLocaleString()}</p><p>{preview.purpose}</p><p>Saved episode and scene timing snapshot · {preview.scenes.length} scene records. Brightling artwork, locations and audio stay linked to this Studio profile.</p><div className="episode-library-card-actions"><button className="scene-primary" onClick={() => { setPendingPreviewPlay(preview.id); open(preview.snapshot, preview); }}>Play Preview</button><button onClick={() => open(preview.snapshot, preview)}>Open Snapshot</button>{source && <button onClick={() => open(source)}>Edit Source Episode</button>}<button onClick={() => removeTestPreview(preview.id)}>Remove Preview</button></div>{!source && <p role="alert">The source episode is no longer in the current library; this saved timing snapshot can still be opened.</p>}</div></article>; })}</div>{visiblePreviews.length === 0 && <p className="scene-empty">Save a visual test preview from an episode card to keep a playable snapshot here.</p>}</section>
      {library.episodes.length === 0 && <p className="scene-empty">No episodes yet. Create one to add your saved scenes.</p>}
    </> : <><div className="scene-heading"><div><p className="eyebrow">{visualPreview ? 'VISUAL TEST PREVIEW · READ ONLY' : 'EPISODE EDITOR'}</p><h1>{visualPreview?.title ?? episode.name}</h1>{visualPreview && <p>{visualPreview.purpose} · Created {new Date(visualPreview.createdAt).toLocaleString()}</p>}<p>{episode.sceneIds.length} scenes · Total duration <strong>{clock(total)}</strong></p>{!visualPreview && <span className={`episode-save-indicator ${dirty ? 'unsaved' : 'saved'}`} role="status">{dirty ? 'Unsaved changes' : 'Saved'}</span>}</div><div className="scene-actions"><button onClick={() => requestLeave(() => { setHistory(null); setPlaying(false); setVisualPreview(null); setPendingPreviewPlay(null); }, 'return to Episodes')}>Back to Episodes</button>{!visualPreview && <><button aria-label="Undo episode edit" title="Undo (Ctrl+Z)" disabled={!history?.past.length} onClick={undo}>Undo</button><button aria-label="Redo episode edit" title="Redo (Ctrl+Y)" disabled={!history?.future.length} onClick={redo}>Redo</button><button className="scene-primary" onClick={save} disabled={!!issue}>Save Episode</button><button onClick={() => void runHealthCheck()} disabled={checkingHealth || !episode}>{checkingHealth ? 'Checking…' : 'Check Episode'}</button></>}<button disabled={!!missing.length || missingIntro || missingCredits || !!timingIssue || !!cameraIssue || total <= 0 || !room || Object.keys(scene?.characters ?? {}).some(id => !packs[id])} onClick={() => playFrom(0)}>{visualPreview ? 'Play Preview' : 'Preview Episode'}</button>{!visualPreview && <><button title={dirty ? "Save episode before exporting" : "Download the complete episode as WebM"} disabled={dirty || exporting || total <= 0 || !!missing.length || missingIntro || missingCredits || !!timingIssue || !!cameraIssue} onClick={() => void exportVideo()}>{exporting ? `Exporting ${exportProgress.stage}` : "Export WebM"}</button>{exporting && <button onClick={() => exportAbort.current?.abort()}>Cancel export</button>}</>}</div></div>
      {healthReport && <section className="episode-health" aria-labelledby="episode-health-title" aria-live="polite"><div className="episode-health-heading"><div><h2 id="episode-health-title">Episode Health Check</h2><p>{healthReport.errors === 0 ? 'No blocking problems were found.' : 'Fix the errors below before using the affected production step.'}</p></div><strong className={healthReport.errors ? 'has-errors' : 'all-clear'}>{healthReport.errors} errors · {healthReport.warnings} warnings</strong></div>{(['error', 'warning', 'passed'] as const).map(category => { const items = healthReport.findings.filter(item => item.category === category); if (!items.length) return null; const title = category === 'error' ? `Errors (${items.length})` : category === 'warning' ? `Warnings (${items.length})` : `Passed checks (${items.length})`; return <div className={`episode-health-group ${category}`} key={category}><h3>{title}</h3><ul>{items.map(item => <li key={item.id}><div><strong>{item.title}{item.location ? ` · ${item.location}` : ''}</strong><p>{item.message}</p></div>{(item.sceneIndex !== undefined || item.cameraId || item.audioClipId) && <button type="button" onClick={() => jumpToFinding(item)}>Go to {item.cameraId ? 'shot' : item.sceneIndex !== undefined ? `scene ${item.sceneIndex + 1}` : 'cue'}</button>}</li>)}</ul></div>})}</section>}
      {exporting && <div className="episode-export-progress" role="status" aria-live="polite"><p>{exportProgress.stage === 'validating' ? 'Validating episode' : exportProgress.stage === 'preparing' ? 'Preparing scenes and audio' : exportProgress.stage === 'rendering' ? 'Rendering frames' : exportProgress.stage === 'encoding' ? 'Encoding video and audio' : 'Finalising WebM'}{exportProgress.completedFrames !== undefined && exportProgress.totalFrames ? ` · ${exportProgress.completedFrames.toLocaleString()} / ${exportProgress.totalFrames.toLocaleString()} frames` : ''}</p>{exportProgress.stage === 'rendering' && exportProgress.completedFrames !== undefined && exportProgress.totalFrames ? <progress max={exportProgress.totalFrames} value={exportProgress.completedFrames} aria-label="Episode export frame progress" /> : <progress aria-label="Episode export stage progress" />}</div>}
      <label className="episode-name">Episode name<input aria-label="Episode name" maxLength={80} value={episode.name} readOnly={!!visualPreview} onChange={event => change({ ...episode, name: event.target.value })} /></label>
      {!visualPreview && <div className="voice-fields"><label>Opening intro<select aria-label="Episode intro" value={episode.introId ?? ''} onChange={event => change({ ...episode, introId: event.target.value || undefined })}><option value="">No intro</option>{intros.intros.map(item => <option key={item.id} value={item.id}>{item.name} · {clock(item.duration)}</option>)}</select></label><label>Ending credits<select aria-label="Episode credits" value={episode.creditsId ?? ''} onChange={event => change({ ...episode, creditsId: event.target.value || undefined })}><option value="">No credits</option>{credits.credits.map(item => <option key={item.id} value={item.id}>{item.name} · {clock(item.duration)}</option>)}</select></label></div>}
      {missing.length > 0 && <p role="alert" className="episode-warning">This episode refers to {missing.length} missing scene{missing.length === 1 ? '' : 's'}. Playback is paused until you remove the missing block or restore the scene from a backup.</p>}
      {(missingIntro || missingCredits) && <p role="alert" className="episode-warning">The selected intro or credits are missing. Choose another saved item before playback or export.</p>}
      {timingIssue && <p role="alert" className="episode-warning">{timingIssue}</p>}
      {cameraIssue && <p role="alert" className="episode-camera-warning">{cameraIssue}</p>}
      {scene?.actions.some(action => action.artwork === 'provisional-v1' && (action.characterId === 'max' && maxOutfit !== 'original' || action.characterId === 'maxine' && maxineOutfit !== 'original')) && <p role="status" className="episode-warning">Provisional gestures need Max and Maxine's original outfits. The current outfit shows its standing pose instead.</p>}
      {scene?.actions.some(action => action.artwork === 'greeting-side-v2' && (action.characterId === 'max' && maxOutfit !== 'original' || action.characterId === 'maxine' && maxineOutfit !== 'original')) && <p role="alert" className="episode-warning">Greeting V2 side waves require Max and Maxine's original outfits. Restore those outfits before export.</p>}
      <div className="episode-workspace"><div className="episode-main"><section className="scene-stage episode-preview"><div className="scene-stage-caption"><strong>{scene ? scene.name : 'EPISODE PREVIEW'}</strong><span>{scene ? `${placeName(scene.placeId)} · ${position!.kind === 'scene' ? `Scene ${position!.index + 1 - (episode.introId ? 1 : 0)} of ${episode.sceneIds.length}` : position!.kind === 'intro' ? 'Intro' : 'Credits'} · ${clock(position!.localTime)} / ${clock(position!.duration)}${selectedCameraShot ? ` · Camera: ${cameraShotName(selectedCameraShot.shot)}` : ''}` : 'Add a saved scene to start'}</span></div><canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Episode cartoon preview" />
        <div className="scene-playback episode-transport"><button aria-label="Restart episode" onClick={() => { setPlaying(false); setTime(0); }}>Restart</button><button className="scene-primary" disabled={!!missing.length || missingIntro || missingCredits || !!timingIssue || total <= 0 || !readyPlace || !room || Object.keys(scene?.characters ?? {}).some(id => !packs[id])} onClick={togglePlayback}>{playing ? 'Pause' : 'Play'}</button><button aria-label="Replay episode" disabled={!canPreview} onClick={() => playFrom(0)}>Replay</button><button disabled={!playing && time === 0} onClick={() => { setPlaying(false); setTime(0); }}>Stop</button><input aria-label="Episode time" type="range" min="0" max={total || 1} step="0.1" value={time} disabled={total <= 0 || !!missing.length || missingIntro || missingCredits || !!timingIssue} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} /><strong>{clock(time)} / {clock(total)}</strong></div></section>
        {!visualPreview ? <EpisodeSequence episode={episode} scenes={scenes} intros={intros} credits={credits} time={time} total={total} playing={playing} audioClips={audioClips} audioAssets={audioAssets} selected={selectedSceneIndex} selectedBoundary={selectedBoundary} selectedCamera={selectedCamera} placeName={placeName} onSelect={(index, start) => { setSelectedSceneIndex(index >= 0 ? index : null); setSelectedBoundary(null); setSelectedCamera(null); setPlaying(false); setTime(start); }} onBoundarySelect={(index, start) => { setSelectedBoundary(index); setSelectedSceneIndex(null); setSelectedCamera(null); setPlaying(false); setTime(start); }} onSelectCamera={(id, start) => { setSelectedCamera(id); setSelectedSceneIndex(null); setSelectedBoundary(null); setPlaying(false); setTime(start); }} onCreateCamera={createCamera} onSeek={value => { setPlaying(false); setTime(value); }} onReorder={(from, to) => { change(moveEpisodeOccurrence(episode, from, to)); setSelectedSceneIndex(to); setSelectedBoundary(null); }} /> : <section className="episode-sequence episode-snapshot-timeline"><h2>Preview timeline</h2><input aria-label="Visual preview timeline" type="range" min="0" max={total || 1} step="0.1" value={time} onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }} /><p>Timeline scrub and playback use this saved visual snapshot. Shared audio, intro and credits remain linked from the current library.</p></section>}
        {!visualPreview && <><div id="episode-audio-editor"><AudioPanel label="Episode" clips={episode.audio ?? []} assets={audioAssets} speakers={[{ id: 'max', name: 'Max' }, { id: 'maxine', name: 'Maxine' }, ...characters.map(item => ({ id: item.id, name: item.name }))]} duration={total} time={time} selectedClipId={selectedAudioClip} onSelectClip={setSelectedAudioClip} onChange={clips => change({ ...episode, audio: clips })} onSeek={value => { setPlaying(false); setTime(value); }} /></div>
        <EpisodeUnityPreview episode={episode} scenes={scenes} characters={characters} audioAssets={audioAssets} saved={!dirty && library.episodes.some(item => item.id === episode.id)} health={currentHealth!} /></>}</div>
      {!visualPreview && <aside className="episode-production-sidebar"><EpisodeInspector episode={episode} scenes={scenes} intros={intros} credits={credits} characters={characters} selectedScene={selectedSceneIndex} selectedBoundary={selectedBoundary} selectedCamera={selectedCamera} onChange={change} onSelectScene={setSelectedSceneIndex} onSelectCamera={setSelectedCamera} onEditSource={id => requestLeave(() => onEditScene(id), 'open Scene Maker')} onPreviewTransition={(start, duration) => playFrom(Math.max(0, start - duration / 2 - .3))} /><section className="episode-scene-library"><h2>Saved scenes</h2><p>Add a scene to the end of your episode.</p>{scenes.scenes.map(item => <article key={item.id}>{placesIn(places).find(place => place.id === item.placeId)?.background && <img src={placesIn(places).find(place => place.id === item.placeId)?.background ?? undefined} alt="" loading="lazy" />}<strong>{item.name}</strong><span>{placeName(item.placeId)} · {clock(item.duration)}</span><div><button onClick={() => { change(appendEpisodeScene(episode, item.id)); setSelectedSceneIndex(episode.sceneIds.length); }}>Add Scene</button><button onClick={() => requestLeave(() => onEditScene(item.id), 'open Scene Maker')}>Edit Scene</button></div></article>)}{scenes.scenes.length === 0 && <p>Create a scene in Cartoon Editor first.</p>}</section></aside>}</div>
      <p className="episode-export-note">Export WebM renders every scene through the exact episode end and keeps the soundtrack. Save changes before exporting. The browser confirms a validated WebM was prepared; check Downloads to confirm it saved.</p>
      {localCopyStatus && <p role="status" className="episode-local-status">{localCopyStatus}</p>}<p role="status" className="scene-status">{message}</p>
    </>}
  </section>;
}
