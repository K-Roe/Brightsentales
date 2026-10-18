import type { InstrumentId } from './instruments';
import type { EffectPreset } from './musicProject';

/**
 * Presentation tokens for the Music Studio.
 *
 * These are presentation only. Nothing here changes the composition model, the
 * instrument generators, rendering or any saved data.
 */

/** One stable colour per instrument, used for its card, note blocks and mixer strip. */
export const INSTRUMENT_COLOURS: Record<InstrumentId, string> = {
  piano: '#9d8bff',
  guitar: '#f5a65b',
  violin: '#ff87ab',
  flute: '#4ecdc4',
  xylophone: '#ffd166',
  bass: '#5aa9ff',
  drums: '#ff7a6b',
  synth: '#7ee08a',
};

export const INSTRUMENT_BLURBS: Record<InstrumentId, string> = {
  piano: 'Warm and clear. Great for the main tune.',
  guitar: 'Plucky and bright. Good for chords.',
  violin: 'Long and singing. Lovely for slow melodies.',
  flute: 'Light and airy. Sounds like a gentle breeze.',
  xylophone: 'Bright and bouncy. Sounds like a toy.',
  bass: 'Deep and sturdy. Holds the song together.',
  drums: 'Keep the beat. Tap to choose the drum.',
  synth: 'Modern and electric. Good for fun endings.',
};

/** Friendly icons drawn as inline SVG so nothing has to be downloaded. */
export const INSTRUMENT_ICONS: Record<InstrumentId, string> = {
  piano: 'M3 11h18v8H3zM6 11v8M9 11v8M12 11v8M15 11v8M18 11v8M3 11h18',
  guitar: 'M13.5 4.5 19.5 3l.5 2-6 1.5M13 6l5-1.2M11 8.5a4.5 4.5 0 1 1-3 8.2A4.5 4.5 0 0 1 11 8.5zM13 8.5 17 4',
  violin: 'M15.5 3 21 2.5l-.4 2-5 .5M14.6 5.2 18.6 4M13.5 7.8a3.6 3.6 0 1 1-2.6 6.6 3.6 3.6 0 0 1 2.6-6.6zM13.5 7.8 17.5 5',
  flute: 'M2 12h20M6 12v2M9 12v2M12 12v2M15 12v2M18 12v2M2 12v3a2 2 0 0 0 2 2h1',
  xylophone: 'M4 19V9M7.5 19V7M11 19V5M14.5 19V7M18 19V9M2.5 19h19',
  bass: 'M14 4l7-1 .4 2.2-7 1M13.4 6.2 19.4 5M12 9a4.6 4.6 0 1 1-3.2 8.4A4.6 4.6 0 0 1 12 9zM12 9 17 5',
  drums: 'M6 10h12v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM4.5 10a2.5 1.6 0 0 0 15 0M9 8 12 3M15 8 12 3',
  synth: 'M2.5 10h19v9h-19zM2.5 14.5h19M6 10v4.5M9.5 10v4.5M13 10v4.5M16.5 10v4.5M20 10v4.5M6.5 7.5a1 1 0 1 0 0 .1M10.5 7.5a1 1 0 1 0 0 .1',
};

export const EFFECT_COLOURS: Record<EffectPreset, string> = {
  footstep: '#c99a6a',
  pop: '#ff87ab',
  bounce: '#5aa9ff',
  sparkle: '#ffd166',
  whoosh: '#4ecdc4',
  bell: '#9d8bff',
  transition: '#7ee08a',
};

export const EFFECT_BLURBS: Record<EffectPreset, string> = {
  footstep: 'A soft heavy step for walking.',
  pop: 'A quick bright pop, like a balloon.',
  bounce: 'A springy boing that goes up and down.',
  sparkle: 'A bright twinkly magic sound.',
  whoosh: 'A fast swish past your ears.',
  bell: 'A clear, happy chime.',
  transition: 'A fun cartoon change of scene.',
};

export const EFFECT_ICONS: Record<EffectPreset, string> = {
  footstep: 'M8 4.5c1.8 0 2.6 1.6 2.6 3.2S9.6 11 8 11s-2.6-1.6-2.6-3.3S6.2 4.5 8 4.5zM5 20h11a2 2 0 0 0 2-2.4l-.7-3.4a2 2 0 0 0-2-1.6H9.7a2 2 0 0 0-2 1.6L7 17.6A2 2 0 0 0 9 20z',
  pop: 'M12 3a1.6 1.6 0 1 1 0 3.2A1.6 1.6 0 0 1 12 3zM12 7.5c3 0 5 2.4 5 5.6 0 3.6-2.2 7.4-5 7.4s-5-3.8-5-7.4c0-3.2 2-5.6 5-5.6zM12 9.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  bounce: 'M4 19c2.5 0 3.5-4 6-4s3.5 4 6 4M6.5 15c0-4 2.4-8 5.5-8s5.5 4 5.5 8M12 7V4',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  whoosh: 'M3 12h4c4 0 5-6 9-6 2.4 0 3.6 1.6 5 3M3 15.5h4c4 0 5 3.5 9 3.5 2.4 0 3.6-1.2 5-2.4',
  bell: 'M12 3a6 6 0 0 1 6 6c0 5 2 6 2 6H4s2-1 2-6a6 6 0 0 1 6-6zM10 18.5a2.2 2.2 0 0 0 4 0M12 3V1.5',
  transition: 'M4 5h7l2 4-2 4H4zM20 5h-7l-2 4 2 4h7M13 3.5 10 20.5',
};

export const ZOOM_LEVELS = [
  { id: 'compact', label: 'Compact', beat: 30, row: 14 },
  { id: 'normal', label: 'Normal', beat: 46, row: 18 },
  { id: 'big', label: 'Big', beat: 68, row: 23 },
] as const;
export type ZoomId = (typeof ZOOM_LEVELS)[number]['id'];
export const zoomById = (id: ZoomId) => ZOOM_LEVELS.find(level => level.id === id) ?? ZOOM_LEVELS[1];

/** Real drum names, so a drum track never shows a misleading piano pitch. */
export const DRUM_NAMES: Record<number, string> = {
  36: 'Bass Drum', 37: 'Bass Drum', 38: 'Snare', 39: 'Snare',
  42: 'Closed Hat', 44: 'Closed Hat', 45: 'Open Hat', 46: 'Open Hat',
  47: 'High Tom', 48: 'Mid Tom', 49: 'High Tom', 50: 'Low Tom', 51: 'Cymbal',
};

/** Note label shown on keys and note chips. */
export const noteLabel = (pitch: number, isDrum: boolean) => (isDrum ? DRUM_NAMES[Math.round(pitch)] ?? 'Snare' : pitchName(pitch));

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const pitchName = (pitch: number) => `${NAMES[((Math.round(pitch) % 12) + 12) % 12]}${Math.floor(Math.round(pitch) / 12) - 1}`;

export type MusicTheme = 'dark' | 'light';

/** Renders an inline SVG icon at the requested size. */
export const iconPaths = (path: string) => path.split('M').filter(Boolean).map(segment => `M${segment}`);

export const STARTER_BLURBS: Record<string, string> = {
  'Twinkle melody': 'A simple tune everyone knows.',
  'Up and down': 'Steps up, then steps back down.',
  'Happy bouncy': 'A bright, cheerful little tune.',
  'Calm and slow': 'A gentle tune with space to breathe.',
};

export const DRUM_PATTERN_BLURBS: Record<string, string> = {
  'Steady beat': 'A heartbeat that keeps going.',
  'Marching': 'Boom, boom, boom, boom.',
  'Kick and clap': 'Kick and clap together, like a clap along.',
};

/** Renders an inline SVG icon at the requested size. */
export function Icon({ path, colour, size = 22 }: { path: string; colour: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={colour} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {iconPaths(path).map((d, index) => <path key={index} d={d} />)}
  </svg>;
}

export const BEGINNER_STEPS = [
  'Name your song',
  'Choose an instrument',
  'Add notes or pick a starter tune',
  'Press Play',
  'Add more instruments',
  'Adjust the mix',
  'Save your song',
  'Add it to the Audio Library',
];
