import { describe, expect, it } from 'vitest';
import { BUILTIN_VOICE_PRESETS, emptyVoiceSettings, naturalEffect, validVoiceEffect, validVoiceSettings } from './voiceSettings';

describe('Voice Maker settings', () => {
  it('keeps built-in presets distinct and original timing out of saved presets', () => {
    expect(BUILTIN_VOICE_PRESETS).toHaveLength(7);
    expect(new Set(BUILTIN_VOICE_PRESETS.map(item => JSON.stringify(item.effect))).size).toBe(7);
    expect(BUILTIN_VOICE_PRESETS.every(item => !('trimEnd' in item.effect) && !('cuts' in item.effect))).toBe(true);
    expect(naturalEffect(3.204333).trimEnd).toBe(3.2);
  });

  it('validates restored custom presets and rejects corrupt effects', () => {
    const state = emptyVoiceSettings();
    const effect = BUILTIN_VOICE_PRESETS[1].effect;
    state.presets.push({ id: '11111111-1111-4111-8111-111111111111', name: 'Bright', effect });
    state.defaults.max = { voice: 'piper:en_GB-alan-medium', presetId: state.presets[0].id };
    expect(validVoiceSettings(state)).toBe(true);
    state.defaults.narrator = { voice: 'kokoro:bf_alice', presetId: null, speed: .9 };
    expect(validVoiceSettings(state)).toBe(true);
    expect(validVoiceSettings({ ...state, defaults: { ...state.defaults, narrator: { ...state.defaults.narrator, speed: 2 } } })).toBe(false);
    expect(validVoiceSettings({ ...state, presets: [{ ...state.presets[0], effect: { ...effect, pitch: 99 } }] })).toBe(false);
    expect(validVoiceSettings({ ...state, presets: [{ ...state.presets[0], effect: { ...effect, cuts: [[0, 1]] } }] })).toBe(false);
    expect(validVoiceEffect({ ...naturalEffect(2), cuts: [[1, .5]] })).toBe(false);
    expect(naturalEffect(2).noiseReduction).toBe(0);
    expect(validVoiceEffect({ ...naturalEffect(2), noiseReduction: .65 })).toBe(true);
    expect(validVoiceEffect({ ...naturalEffect(2), noiseReduction: 1.1 })).toBe(false);
    const legacyPreset = { ...state, presets: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Older preset', effect: Object.fromEntries(Object.entries(effect).filter(([key]) => key !== 'noiseReduction')) as typeof effect }] };
    expect(validVoiceSettings(legacyPreset)).toBe(true);
  });
});
