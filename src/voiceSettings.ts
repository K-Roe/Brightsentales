export const VOICE_SETTINGS_KEY = 'brightsenappstales.voice-settings.v1';
export type VoiceEffect = {
  trimStart: number; trimEnd: number; cuts: [number, number][];
  pitch: number; speed: number; tone: number; volume: number;
  noiseReduction: number;
  normalize: boolean; fadeIn: number; fadeOut: number;
  echo: boolean; reverb: boolean; robot: boolean;
};
export type VoicePreset = { id: string; name: string; effect: Omit<VoiceEffect, 'trimStart' | 'trimEnd' | 'cuts'> };
export type VoiceSettings = { version: 1; presets: VoicePreset[]; defaults: Record<string, { voice: string | null; presetId: string | null; speed?: number }> };
export const emptyVoiceSettings = (): VoiceSettings => ({ version: 1, presets: [], defaults: {} });
export const naturalEffect = (duration: number): VoiceEffect => ({ trimStart: 0, trimEnd: Math.floor(duration * 100) / 100, cuts: [], pitch: 0, speed: 1, tone: 0, volume: 1, noiseReduction: 0, normalize: false, fadeIn: .03, fadeOut: .08, echo: false, reverb: false, robot: false });
export const BUILTIN_VOICE_PRESETS: VoicePreset[] = [
  { id: 'natural', name: 'Natural', effect: { ...naturalEffect(1) } },
  { id: 'high-cartoon', name: 'High-Pitched Cartoon', effect: { ...naturalEffect(1), pitch: 5, tone: .3 } },
  { id: 'deep-cartoon', name: 'Deep Cartoon', effect: { ...naturalEffect(1), pitch: -4, tone: -.25 } },
  { id: 'robot', name: 'Robot', effect: { ...naturalEffect(1), robot: true, tone: -.1 } },
  { id: 'monster', name: 'Monster', effect: { ...naturalEffect(1), pitch: -7, speed: .85, reverb: true } },
  { id: 'tiny-creature', name: 'Tiny Creature', effect: { ...naturalEffect(1), pitch: 8, speed: 1.18, tone: .45 } },
  { id: 'echo', name: 'Echo', effect: { ...naturalEffect(1), echo: true, reverb: true } },
].map(item => ({ ...item, effect: (({ trimStart: _start, trimEnd: _end, cuts: _cuts, ...effect }) => effect)(item.effect as VoiceEffect) }));

const numberIn = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export const validVoiceEffect = (value: unknown): value is VoiceEffect => {
  if (!value || typeof value !== 'object') return false;
  const e = value as VoiceEffect;
  return numberIn(e.trimStart, 0, 600) && numberIn(e.trimEnd, e.trimStart + .01, 600) && Array.isArray(e.cuts) && e.cuts.length <= 20 && e.cuts.every(cut => Array.isArray(cut) && cut.length === 2 && numberIn(cut[0], 0, 600) && numberIn(cut[1], cut[0] + .01, 600))
    && numberIn(e.pitch, -12, 12) && numberIn(e.speed, .5, 2) && numberIn(e.tone, -1, 1) && numberIn(e.volume, 0, 2) && (e.noiseReduction === undefined || numberIn(e.noiseReduction, 0, 1))
    && numberIn(e.fadeIn, 0, 10) && numberIn(e.fadeOut, 0, 10)
    && ['normalize', 'echo', 'reverb', 'robot'].every(key => typeof e[key as keyof VoiceEffect] === 'boolean');
};
export const validVoiceSettings = (value: unknown): value is VoiceSettings => {
  if (!value || typeof value !== 'object') return false;
  const state = value as VoiceSettings;
  if (state.version !== 1 || !Array.isArray(state.presets) || state.presets.length > 50 || !state.defaults || typeof state.defaults !== 'object' || Array.isArray(state.defaults)) return false;
  const ids = new Set<string>();
  for (const preset of state.presets) {
    if (!preset || typeof preset.id !== 'string' || !/^[a-f0-9-]{36}$/.test(preset.id) || ids.has(preset.id) || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 60 || !preset.effect || typeof preset.effect !== 'object' || 'trimStart' in preset.effect || 'trimEnd' in preset.effect || 'cuts' in preset.effect || !validVoiceEffect({ ...preset.effect, trimStart: 0, trimEnd: 1, cuts: [] })) return false;
    ids.add(preset.id);
  }
  return Object.entries(state.defaults).length <= 200 && Object.entries(state.defaults).every(([id, item]) => /^(narrator|max|maxine|brightling-[a-f0-9-]{36})$/.test(id) && item && (item.voice === null || typeof item.voice === 'string' && item.voice.length <= 100) && (item.presetId === null || typeof item.presetId === 'string' && item.presetId.length <= 100) && (item.speed === undefined || numberIn(item.speed, .6, 1.8)));
};
export const readVoiceSettings = (): VoiceSettings => {
  const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
  if (raw === null) return emptyVoiceSettings();
  const value: unknown = JSON.parse(raw);
  if (!validVoiceSettings(value)) throw new Error('Saved voice settings are invalid. Existing data was kept.');
  return value;
};
