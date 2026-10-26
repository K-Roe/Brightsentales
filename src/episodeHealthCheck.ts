import { AUDIO_MIMES, clipLength, validAudioInfo, type AudioAsset } from './audio';
import { episodePlaybackClips } from './audioPlayback';
import { episodeCameraIssue } from './episodeCamera';
import { episodeTimingIssue, missingSceneIds, productionBlocks, productionDuration, speechFitsEpisode, validateEpisodeLibrary, type Episode } from './episodes';
import type { CreditsLibrary } from './credits';
import type { IntroLibrary } from './introductions';
import { placesIn, type PlaceOrganisation } from './placeFolders';
import { validateBrightling, type Brightling } from './maker';
import { validateAudioReferences, videoFrameCount } from './sceneVideoExport';
import { validateTimedLibrary, type TimedLibrary } from './timedScenes';

export type EpisodeHealthCategory = 'error' | 'warning' | 'passed';
export type EpisodeHealthScope = 'both' | 'preview' | 'export' | 'info';
export type EpisodeHealthFinding = {
  id: string;
  category: EpisodeHealthCategory;
  scope: EpisodeHealthScope;
  title: string;
  message: string;
  location?: string;
  sceneIndex?: number;
  start?: number;
  cameraId?: string;
  audioClipId?: string;
};
export type EpisodeHealthReport = { findings: EpisodeHealthFinding[]; errors: number; warnings: number; passed: number; duration: number };
export type EpisodeHealthInput = {
  episode: Episode;
  scenes: TimedLibrary;
  intros: IntroLibrary;
  credits: CreditsLibrary;
  characters: Brightling[];
  places: PlaceOrganisation;
  audioAssets: AudioAsset[];
};

const UNITY_ACTIONS = new Set(['appear', 'walk', 'wait', 'wave', 'disappear', 'look-at']);
const customId = /^brightling-[a-f0-9-]{36}$/;
const finding = (id: string, category: EpisodeHealthCategory, scope: EpisodeHealthScope, title: string, message: string, extra: Partial<EpisodeHealthFinding> = {}): EpisodeHealthFinding => ({ id, category, scope, title, message, ...extra });

/** Combines the existing episode, scene, camera, and export validators into one reviewable report. */
export function checkEpisodeHealth(input: EpisodeHealthInput): EpisodeHealthReport {
  const { episode, scenes, intros, credits, characters, places, audioAssets } = input;
  const findings: EpisodeHealthFinding[] = [];
  const validEpisode = validateEpisodeLibrary({ version: 1, episodes: [episode] });
  if (!validEpisode.ok) {
    findings.push(finding('episode-schema', 'error', 'both', 'Episode details', validEpisode.error));
    return summarize(findings, 0);
  }
  if (!episode.sceneIds.length) findings.push(finding('scenes-empty', 'error', 'both', 'Scenes', 'Add at least one saved scene before previewing or exporting.'));
  else findings.push(finding('scenes-present', 'passed', 'info', 'Scenes', `${episode.sceneIds.length} scene${episode.sceneIds.length === 1 ? '' : 's'} are listed.`));

  const missing = missingSceneIds(episode, scenes);
  if (missing.length) {
    missing.forEach(id => {
      const sceneIndex = episode.sceneIds.indexOf(id);
      findings.push(finding(`scene-missing-${sceneIndex}`, 'error', 'both', 'Saved scene', `Scene ${sceneIndex + 1} is missing from the saved scene library. Restore it or remove this scene from the episode.`, { location: `Scene ${sceneIndex + 1}`, sceneIndex }));
    });
  }

  const blocks = productionBlocks(episode, scenes, intros, credits);
  const duration = productionDuration(episode, scenes, intros, credits);
  if (episode.introId && !intros.intros.some(item => item.id === episode.introId)) findings.push(finding('intro-missing', 'error', 'both', 'Opening intro', 'The selected opening intro is missing from the saved library. Choose another intro or remove it.'));
  if (episode.creditsId && !credits.credits.some(item => item.id === episode.creditsId)) findings.push(finding('credits-missing', 'error', 'both', 'Ending credits', 'The selected ending credits are missing from the saved library. Choose another set or remove it.'));

  if (episode.sceneIds.length && !missing.length) {
    const timing = episodeTimingIssue(episode, scenes);
    if (timing) findings.push(finding('scene-timing', 'error', 'both', 'Scene timing', timing));
    else findings.push(finding('scene-timing', 'passed', 'info', 'Scene timing', 'Scene durations and transition boundaries fit the episode timeline.'));
  }

  const availablePlaces = placesIn(places);
  const placeIds = availablePlaces.map(place => place.id);
  const placeById = new Map(availablePlaces.map(place => [place.id, place]));
  const savedCharacters = new Map(characters.map(character => [character.id, character]));
  const customCharacters = new Set<string>();
  let missingPlaceFinding = false;
  blocks.forEach((block, blockIndex) => {
    const sceneIndex = block.occurrenceIndex;
    const location = block.kind === 'scene' ? `Scene ${(sceneIndex ?? blockIndex) + 1}` : block.kind === 'intro' ? 'Opening intro' : 'Ending credits';
    const sourceScene = scenes.scenes.find(scene => scene.id === block.scene.id);
    if (sourceScene) {
      const result = validateTimedLibrary({ version: 1, scenes: [sourceScene] }, placeIds);
      if (!result.ok) findings.push(finding(`scene-content-${sceneIndex ?? blockIndex}`, 'error', 'both', 'Scene content', `${location}: ${result.error}`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
      else findings.push(finding(`scene-content-${sceneIndex ?? blockIndex}`, 'passed', 'info', 'Scene content', `${location} actions, character positions, and scene timing are valid.`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
    }
    const place = placeById.get(block.scene.placeId);
    if (!place?.artworkAvailable || !place.background) {
      findings.push(finding(`place-art-${sceneIndex ?? blockIndex}`, 'error', 'export', 'Location artwork', `${location} uses a location with no available background artwork. Choose a saved location with artwork.`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
      missingPlaceFinding = true;
    }
    for (const id of Object.keys(block.scene.characters ?? {})) {
      if (id === 'max' || id === 'maxine') continue;
      if (!customId.test(id)) {
        findings.push(finding(`character-id-${sceneIndex ?? blockIndex}-${id}`, 'error', 'both', 'Character reference', `${location} contains an unsupported character identity. Re-add the character from the saved Brightling library.`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
        continue;
      }
      customCharacters.add(id);
      const character = savedCharacters.get(id);
      if (!character) {
        findings.push(finding(`character-missing-${sceneIndex ?? blockIndex}-${id}`, 'error', 'both', 'Saved Brightling', `${characterLabel(id, characters)} is referenced in ${location} but is missing from the saved cast. Restore it from Brightling Maker.`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
      } else if (!validateBrightling(character as unknown)) {
        findings.push(finding(`character-invalid-${sceneIndex ?? blockIndex}-${id}`, 'error', 'both', 'Brightling appearance', `${characterLabel(id, characters)} in ${location} has invalid saved appearance settings. Open it in Brightling Maker and save a valid version.`, { location, ...(sceneIndex === undefined ? {} : { sceneIndex }) }));
      }
    }
  });
  if (blocks.length && !missingPlaceFinding) findings.push(finding('location-art', 'passed', 'info', 'Location artwork', 'Every scene, intro, and credits item has a saved background artwork reference.'));
  if (customCharacters.size > 4) findings.push(finding('unity-cast-limit', 'error', 'preview', 'Unity cast size', 'Unity episode preview supports up to four custom Brightlings. Reduce the custom cast or use Studio preview.', { location: 'Episode cast' }));

  if (episode.camera?.length) {
    const cameraIssue = episodeCameraIssue(episode, scenes, duration);
    if (cameraIssue) {
      const badShot = episode.camera.find(shot => shot.target !== 'point' && !episode.sceneIds.some(id => scenes.scenes.find(scene => scene.id === id)?.characters?.[shot.target]));
      findings.push(finding('camera-track', 'error', 'both', 'Camera shots', cameraIssue, { location: badShot ? `Camera shot at ${badShot.start.toFixed(1)}s` : 'Camera track', ...(badShot ? { cameraId: badShot.id, start: badShot.start } : {}) }));
    } else findings.push(finding('camera-track', 'passed', 'info', 'Camera shots', 'Camera targets, shot timing, and movement fit the episode timeline.'));
  } else findings.push(finding('camera-track', 'passed', 'info', 'Camera shots', 'No episode camera track is set; saved scene cameras remain in use.'));

  const clips = episodePlaybackClips(episode, scenes, intros, credits);
  try {
    const sourceClips = [...(episode.audio ?? []), ...blocks.flatMap(block => block.scene.audio ?? [])];
    validateAudioReferences(sourceClips, audioAssets, duration);
    validateAudioReferences(clips, audioAssets, duration);
    const audioById = new Map(audioAssets.map(asset => [asset.id, asset]));
    for (const clip of clips) {
      const asset = audioById.get(clip.assetId)!;
      if (!validAudioInfo(asset) || !AUDIO_MIMES.includes(asset.blob?.type) || asset.blob.type !== asset.mime || asset.blob.size !== asset.size) {
        findings.push(finding(`audio-invalid-${clip.key}`, 'error', 'both', 'Audio file', `${asset.name || 'An audio cue'} is missing or has an invalid file. Restore it in Audio Library.`, { location: clip.source === 'scene' ? 'Scene audio' : 'Episode audio', start: clip.start, audioClipId: clip.id }));
      } else if (clip.speakerId && (asset.kind !== 'speech' || asset.speakerId && asset.speakerId !== clip.speakerId)) {
        findings.push(finding(`audio-use-${clip.key}`, 'error', 'both', 'Audio cue type', `${asset.name || 'This cue'} is assigned as a voice for ${clip.speakerId}, but its saved audio type or speaker does not match. Choose the matching voice file or remove the speaker assignment.`, { location: clip.source === 'scene' ? 'Scene audio' : 'Episode audio', start: clip.start, audioClipId: clip.id }));
      }
    }
    const firstInvalid = findings.find(item => item.id.startsWith('audio-invalid-') || item.id.startsWith('audio-use-'));
    if (!firstInvalid) findings.push(finding('audio-assets', 'passed', 'info', 'Audio files', `${clips.length} audio cue${clips.length === 1 ? '' : 's'} reference compatible saved files.`));
  } catch (error) {
    findings.push(finding('audio-assets', 'error', 'both', 'Audio files and timing', error instanceof Error ? error.message : 'Audio files or cue timing are invalid.', audioFindingLocation(episode, scenes, duration)));
  }

  for (const block of blocks.filter(item => item.kind === 'scene')) {
    const sourceScene = scenes.scenes.find(scene => scene.id === block.scene.id);
    if (!sourceScene) continue;
    for (const clip of sourceScene.audio ?? []) {
      const cueEnd = clip.start + clipLength(clip);
      if (cueEnd > Math.min(block.duration, sourceScene.duration) + 1e-7) findings.push(finding(`scene-audio-boundary-${block.occurrenceIndex}-${clip.id}`, 'warning', 'info', 'Scene audio boundary', `An audio cue in Scene ${(block.occurrenceIndex ?? 0) + 1} extends past the scene boundary and will be shortened at that cut. Move it to episode audio if it should continue across scenes.`, { location: `Scene ${(block.occurrenceIndex ?? 0) + 1}`, sceneIndex: block.occurrenceIndex, start: block.start + clip.start, audioClipId: clip.id }));
    }
  }
  for (const clip of episode.audio ?? []) {
    if (clip.start < duration && clip.start + clipLength(clip) > duration + 1e-7) findings.push(finding(`episode-audio-end-${clip.id}`, clip.speakerId ? 'error' : 'warning', clip.speakerId ? 'both' : 'info', 'Audio at episode ending', clip.speakerId ? 'A voice cue runs past the episode ending. Move it earlier or shorten it before saving.' : 'This episode audio cue extends beyond the ending and will be shortened when played or exported.', { location: 'Episode audio', start: clip.start, audioClipId: clip.id }));
  }
  if (!findings.some(item => item.id === 'audio-assets' || item.id.startsWith('audio-invalid-') || item.id.startsWith('audio-use-') || item.id.startsWith('episode-audio-end-'))) findings.push(finding('audio-timeline', 'passed', 'info', 'Audio timing', 'Audio cues use the episode clock; scene cues are shortened at scene cuts and episode cues are checked against the ending.'));

  try {
    const frameCount = videoFrameCount(duration);
    findings.push(finding('export-duration', 'passed', 'info', 'Export length and ending', `The ${duration.toFixed(1)}-second episode fits the export limit; ${frameCount.toLocaleString()} frame samples include the final timeline boundary.`));
  } catch (error) {
    findings.push(finding('export-duration', 'error', 'export', 'Export length and ending', error instanceof Error ? error.message : 'Episode duration cannot be exported.'));
    if (duration > 3600) findings.push(finding('unity-episode-duration', 'error', 'preview', 'Unity episode length', 'Unity episode preview supports episodes up to 60 minutes. Shorten the episode before sending it to Unity.'));
  }

  if (episode.introId || episode.creditsId) findings.push(finding('unity-intro-credits', 'error', 'preview', 'Unity preview content', 'Unity episode preview does not support intros or credits yet. Remove them for Unity preview; Studio preview and WebM export remain available.'));
  for (const block of blocks.filter(item => item.kind === 'scene')) {
    const sourceScene = scenes.scenes.find(scene => scene.id === block.scene.id);
    if (!sourceScene) continue;
    const loc = `Scene ${(block.occurrenceIndex ?? 0) + 1}`;
    if (sourceScene.placeId !== 'living-room') findings.push(finding(`unity-place-${block.occurrenceIndex}`, 'error', 'preview', 'Unity location support', `${loc} uses a location not currently supported by Unity episode playback.`, { location: loc, sceneIndex: block.occurrenceIndex }));
    if (sourceScene.duration > 120) findings.push(finding(`unity-scene-duration-${block.occurrenceIndex}`, 'error', 'preview', 'Unity scene length', `${loc} is longer than Unity's 120-second saved-scene limit.`, { location: loc, sceneIndex: block.occurrenceIndex }));
    if (sourceScene.phone?.length || sourceScene.phoneIn || sourceScene.objects?.length || sourceScene.livingWorld || sourceScene.life && sourceScene.life.mode !== 'v2') findings.push(finding(`unity-scene-feature-${block.occurrenceIndex}`, 'error', 'preview', 'Unity scene features', `${loc} uses Bright Speak, scene objects, or life effects that Unity episode playback does not support.`, { location: loc, sceneIndex: block.occurrenceIndex }));
    if (sourceScene.characters && (Object.keys(sourceScene.characters).length > 2 || Object.keys(sourceScene.characters).some(id => id !== 'max' && id !== 'maxine' && !customId.test(id)))) findings.push(finding(`unity-scene-cast-${block.occurrenceIndex}`, 'error', 'preview', 'Unity scene cast', `${loc} must contain no more than two supported Brightlings.`, { location: loc, sceneIndex: block.occurrenceIndex }));
    const unsupported = sourceScene.actions?.find(action => !UNITY_ACTIONS.has(action.type) || action.artwork);
    if (unsupported) findings.push(finding(`unity-scene-action-${block.occurrenceIndex}-${unsupported.id}`, 'error', 'preview', 'Unity action support', `${loc} uses ${unsupported.type}${unsupported.artwork ? ` with ${unsupported.artwork} artwork` : ''}, which Unity episode playback does not support yet.`, { location: loc, sceneIndex: block.occurrenceIndex, start: unsupported.start }));
  }
  if (episode.sceneIds.length && !missing.length && duration > 0 && duration <= 3600 && !episode.introId && !episode.creditsId && !findings.some(item => item.category === 'error' && item.scope === 'preview')) findings.push(finding('unity-content', 'passed', 'info', 'Unity-compatible episode content', 'Episode content is within the currently supported Unity episode features.'));

  return summarize(findings, duration);
}

function characterLabel(id: string, characters: Brightling[]): string {
  const character = characters.find(item => item.id === id);
  return character?.name?.trim() || 'This Brightling';
}

function audioFindingLocation(episode: Episode, scenes: TimedLibrary, duration: number): Partial<EpisodeHealthFinding> {
  const clip = episodePlaybackClips(episode, scenes).find(item => item.start < duration && item.start + clipLength(item) > duration);
  return clip ? { location: clip.source === 'scene' ? 'Scene audio' : 'Episode audio', start: clip.start, audioClipId: clip.id } : {};
}

function summarize(findings: EpisodeHealthFinding[], duration: number): EpisodeHealthReport {
  return { findings, errors: findings.filter(item => item.category === 'error').length, warnings: findings.filter(item => item.category === 'warning').length, passed: findings.filter(item => item.category === 'passed').length, duration };
}

export function assertEpisodeReady(report: EpisodeHealthReport, operation: 'preview' | 'export'): void {
  const failure = report.findings.find(item => item.category === 'error' && (item.scope === 'both' || item.scope === operation));
  if (failure) throw new Error(`${failure.location ? `${failure.location}: ` : ''}${failure.message}`);
}
