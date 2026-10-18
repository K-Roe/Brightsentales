export const MUSIC_SCALES = {
  'C major': [0, 2, 4, 5, 7, 9, 11],
  'G major': [7, 9, 11, 0, 2, 4, 6],
  'F major': [5, 7, 9, 10, 0, 2, 4],
  'A minor': [9, 11, 0, 2, 4, 5, 7],
} as const;
export type MusicScale = keyof typeof MUSIC_SCALES;

const PITCH_LABELS = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];
export const beginnerPitchName = (pitch: number) => {
  const rounded = Math.round(pitch);
  const octave = Math.floor(rounded / 12) - 1;
  const label = PITCH_LABELS[((rounded % 12) + 12) % 12];
  return label.includes('/') ? label.split(' / ').map(name => `${name}${octave}`).join(' / ') : `${label}${octave}`;
};
export const pitchInScale = (pitch: number, scale: MusicScale) => MUSIC_SCALES[scale].some(step => step === ((Math.round(pitch) % 12) + 12) % 12);
