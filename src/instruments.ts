/**
 * Browser-native instrument voices for the Music Maker.
 *
 * Every instrument is synthesised from oscillators, filters and noise. There are
 * no bundled samples, no downloads and no cloud calls, so a composition renders
 * identically offline and on any machine. Voices build plain Web Audio nodes so
 * the same definitions serve live preview and offline rendering.
 */

export const INSTRUMENTS = ['piano', 'guitar', 'violin', 'flute', 'xylophone', 'bass', 'drums', 'synth'] as const;
export type InstrumentId = (typeof INSTRUMENTS)[number];

export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  piano: 'Piano', guitar: 'Guitar', violin: 'Violin', flute: 'Flute',
  xylophone: 'Xylophone', bass: 'Bass', drums: 'Drums', synth: 'Synth',
};

export const isInstrument = (value: unknown): value is InstrumentId => typeof value === 'string' && (INSTRUMENTS as readonly string[]).includes(value);

/** MIDI note number to frequency in Hz. A4 (69) is 440 Hz. */
export const noteFrequency = (pitch: number) => 440 * Math.pow(2, (pitch - 69) / 12);
export const frequencyToNote = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Human readable note name such as C4, used in the piano roll. */
export const noteName = (pitch: number) => `${NAMES[((Math.round(pitch) % 12) + 12) % 12]}${Math.floor(Math.round(pitch) / 12) - 1}`;

type VoiceShape = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filter?: { type: BiquadFilterType; frequency: number; q?: number };
  oscillators: { type: OscillatorType; ratio: number; gain: number; detune?: number }[];
  /** Short filtered-noise layer, used for flute breath and drum rattle. */
  noise?: { gain: number; type?: BiquadFilterType; frequency?: number };
};

const SHAPES: Record<InstrumentId, VoiceShape> = {
  piano: { attack: 0.004, decay: 0.5, sustain: 0.25, release: 0.22, filter: { type: 'lowpass', frequency: 5200 }, oscillators: [{ type: 'triangle', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 0.32 }, { type: 'sine', ratio: 3, gain: 0.12 }] },
  guitar: { attack: 0.003, decay: 0.32, sustain: 0.12, release: 0.18, filter: { type: 'lowpass', frequency: 3000 }, oscillators: [{ type: 'sawtooth', ratio: 1, gain: 0.7 }, { type: 'square', ratio: 2, gain: 0.16 }] },
  violin: { attack: 0.11, decay: 0.2, sustain: 0.8, release: 0.26, filter: { type: 'lowpass', frequency: 4200 }, oscillators: [{ type: 'sawtooth', ratio: 1, gain: 0.75 }, { type: 'sawtooth', ratio: 1, gain: 0.3, detune: 9 }, { type: 'sine', ratio: 2, gain: 0.12 }] },
  flute: { attack: 0.06, decay: 0.12, sustain: 0.85, release: 0.2, filter: { type: 'lowpass', frequency: 6000 }, oscillators: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 0.14 }], noise: { gain: 0.05, type: 'bandpass', frequency: 2400 } },
  xylophone: { attack: 0.002, decay: 0.34, sustain: 0.05, release: 0.14, filter: { type: 'highpass', frequency: 260 }, oscillators: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 4, gain: 0.28 }, { type: 'sine', ratio: 6.7, gain: 0.1 }] },
  bass: { attack: 0.006, decay: 0.24, sustain: 0.6, release: 0.2, filter: { type: 'lowpass', frequency: 900 }, oscillators: [{ type: 'triangle', ratio: 1, gain: 1 }, { type: 'square', ratio: 0.5, gain: 0.4 }] },
  // Drums pitch selects the drum: 36 kick, 38 snare, 42 closed hat, 45 open hat, 48 tom.
  drums: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05, oscillators: [{ type: 'sine', ratio: 1, gain: 1 }], noise: { gain: 0.5, type: 'highpass', frequency: 1800 } },
  synth: { attack: 0.02, decay: 0.18, sustain: 0.6, release: 0.22, filter: { type: 'lowpass', frequency: 2600 }, oscillators: [{ type: 'sawtooth', ratio: 1, gain: 0.6 }, { type: 'sawtooth', ratio: 1, gain: 0.5, detune: -12 }, { type: 'square', ratio: 0.5, gain: 0.25 }] },
};

/** Drum tuning per MIDI pitch. */
const DRUM: Record<number, { freq: number; decay: number; noise: number; tone: number }> = {
  36: { freq: 150, decay: 0.34, noise: 0.06, tone: 1 },
  37: { freq: 130, decay: 0.3, noise: 0.06, tone: 1 },
  38: { freq: 200, decay: 0.2, noise: 0.55, tone: 0.35 },
  39: { freq: 190, decay: 0.22, noise: 0.5, tone: 0.3 },
  42: { freq: 0, decay: 0.05, noise: 0.45, tone: 0 },
  44: { freq: 0, decay: 0.12, noise: 0.4, tone: 0 },
  45: { freq: 0, decay: 0.4, noise: 0.4, tone: 0 },
  46: { freq: 0, decay: 0.18, noise: 0.4, tone: 0 },
  47: { freq: 260, decay: 0.3, noise: 0.3, tone: 0.55 },
  48: { freq: 240, decay: 0.28, noise: 0.14, tone: 0.8 },
  49: { freq: 330, decay: 0.24, noise: 0.1, tone: 0.8 },
  50: { freq: 210, decay: 0.3, noise: 0.18, tone: 0.85 },
  51: { freq: 380, decay: 0.7, noise: 0.3, tone: 0.6 },
};

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
/** One shared noise buffer per render context keeps drum and effect renders fast. */
export function noiseBuffer(context: BaseAudioContext): AudioBuffer {
  const existing = noiseCache.get(context);
  if (existing) return existing;
  const length = Math.floor(context.sampleRate * 1.5);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise so a composition renders identically on every machine.
  let seed = 22222;
  for (let i = 0; i < length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 0xffffffff) * 2 - 1; }
  noiseCache.set(context, buffer);
  return buffer;
}

export type NoteVoice = { pitch: number; start: number; duration: number; velocity: number };

/**
 * Schedules one note into a context starting at `start` seconds.
 * `destination` receives the finished voice; the caller owns its gain.
 */
export function scheduleNote(context: BaseAudioContext, destination: AudioNode, instrument: InstrumentId, note: NoteVoice) {
  const shape = SHAPES[instrument];
  const velocity = Math.max(0.02, Math.min(1, note.velocity));
  const start = Math.max(0, note.start);
  // A note always keeps an audible tail so short taps do not click.
  const hold = Math.max(0.04, note.duration);
  const tail = instrument === 'drums' ? 0 : shape.release;

  if (instrument === 'drums') {
    const drum = DRUM[Math.round(note.pitch)] ?? DRUM[38];
    if (drum.freq > 0) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(drum.freq * 1.8, start);
      // Fast pitch drop is what makes a kick read as a kick.
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, drum.freq * 0.6), start + drum.decay * 0.9);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(drum.tone * velocity, start + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + drum.decay);
      osc.connect(gain).connect(destination);
      osc.start(start); osc.stop(start + drum.decay + 0.02);
    }
    if (drum.noise > 0) {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer(context);
      const filter = context.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = 1400;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(drum.noise * velocity, start + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + drum.decay);
      source.connect(filter).connect(gain).connect(destination);
      source.start(start); source.stop(start + drum.decay + 0.02);
    }
    return;
  }

  const frequency = noteFrequency(note.pitch);
  const end = start + hold;
  const releaseStart = end;
  const stop = releaseStart + tail + 0.05;

  let head: AudioNode = destination;
  if (shape.filter) {
    const filter = context.createBiquadFilter();
    filter.type = shape.filter.type;
    filter.frequency.value = shape.filter.frequency;
    if (shape.filter.q) filter.Q.value = shape.filter.q;
    filter.connect(destination);
    head = filter;
  }

  const envelope = context.createGain();
  envelope.connect(head);
  const peak = 0.26 * velocity;
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.linearRampToValueAtTime(peak, start + shape.attack);
  envelope.gain.linearRampToValueAtTime(Math.max(0.0001, peak * shape.sustain), start + shape.attack + shape.decay);
  envelope.gain.setValueAtTime(Math.max(0.0001, peak * shape.sustain), Math.max(start + shape.attack + shape.decay, releaseStart - 0.001));
  envelope.gain.exponentialRampToValueAtTime(0.0001, Math.max(releaseStart + 0.01, start + 0.02));

  for (const osc of shape.oscillators) {
    const node = context.createOscillator();
    node.type = osc.type;
    node.frequency.value = frequency * osc.ratio;
    if (osc.detune) node.detune.value = osc.detune;
    const gain = context.createGain();
    gain.gain.value = osc.gain;
    node.connect(gain).connect(envelope);
    node.start(start);
    node.stop(stop);
  }

  if (shape.noise) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context);
    source.loop = true;
    let noiseHead: AudioNode = envelope;
    if (shape.noise.type) {
      const filter = context.createBiquadFilter();
      filter.type = shape.noise.type;
      filter.frequency.value = shape.noise.frequency ?? 1000;
      filter.connect(envelope);
      noiseHead = filter;
    }
    const gain = context.createGain();
    gain.gain.value = shape.noise.gain;
    source.connect(gain).connect(noiseHead);
    source.start(start);
    source.stop(stop);
  }
}

/** How long a scheduled note occupies the timeline, including its release tail. */
export function noteTail(instrument: InstrumentId, duration: number) {
  if (instrument === 'drums') return Math.max(0.05, duration + 0.02);
  return Math.max(0.04, duration) + SHAPES[instrument].release + 0.05;
}

/** The last moment any note on a track can still be heard. */
export const trackTail = (instrument: InstrumentId, notes: NoteVoice[]) => notes.reduce((max, note) => Math.max(max, note.start + noteTail(instrument, note.duration)), 0);