import { describe, expect, it } from 'vitest';
import { createSpeechAsset } from './voiceAssets';

describe('Voice Maker speech asset persistence contract', () => {
  it('creates a separate edited asset without changing the retained original', () => {
    const originalBlob = new Blob(['original audio'], { type: 'audio/wav' });
    const editedBlob = new Blob(['edited audio'], { type: 'audio/wav' });
    const original = createSpeechAsset(originalBlob, 2.4, 'Take one', 'max');
    const edited = createSpeechAsset(editedBlob, 2.1, 'Take one edited', 'maxine');

    expect(original.id).not.toBe(edited.id);
    expect(original.blob).toBe(originalBlob);
    expect(original.blob.size).toBe(original.size);
    expect(original.speakerId).toBe('max');
    expect(edited.speakerId).toBe('maxine');
    expect(original.name).toBe('Take one');
  });

  it('rejects assets outside the Audio Library bounds', () => {
    expect(() => createSpeechAsset(new Blob(['audio']), 0, 'Empty')).toThrow('under 10 minutes');
    expect(() => createSpeechAsset(new Blob(['audio']), 601, 'Too long')).toThrow('under 10 minutes');
  });
});
