import { noiseBuffer, noteTail, scheduleNote, trackTail, type InstrumentId } from './instruments';
import { beatsToSeconds, projectBeats, projectSeconds, trackIsAudible, type EffectProject, type MusicProject, type Note, type Track } from './musicProject';
import { clampSample, WAV_SAMPLE_RATE } from './wav';

/**
 * Deterministic offline rendering.
 *
 * A composition is rendered with OfflineAudioContext at a fixed sample rate, so
 * the same project always produces the same samples. The future video exporter
 * can therefore re-render identical audio instead of re-synthesising live.
 */

export const MIX_SAMPLE_RATE = WAV_SAMPLE_RATE;
/** Master headroom, so a full mix cannot clip the single Web Audio output stage. */
export const MIX_HEADROOM = 0.82;

export type RenderResult = { channels: Float32Array[]; sampleRate: number; duration: number };

const stereoPan = (context: BaseAudioContext, pan: number) => {
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  return panner;
};

/**
 * Soft limiter.
 *
 * Samples below the threshold pass through completely unchanged, so a quiet mix
 * keeps the level the user dialled in. Above it, peaks ease toward full scale
 * instead of hard-clipping, which is what "prevent clipping" means for a mixer.
 */
export const LIMIT_THRESHOLD = 0.7;

export function applySoftLimit(channels: Float32Array[], threshold = LIMIT_THRESHOLD) {
  const headroom = Math.max(0.001, 1 - threshold);
  return channels.map(channel => {
    const copy = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i];
      const magnitude = Math.abs(sample);
      copy[i] = magnitude <= threshold
        ? clampSample(sample)
        : Math.sign(sample) * clampSample(threshold + headroom * Math.tanh((magnitude - threshold) / headroom));
    }
    return copy;
  });
}

/** Peak absolute level across channels, used to warn and to prove audio is audible. */
export const peakOf = (channels: Float32Array[]) => {
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const value = Math.abs(channel[i]);
      if (value > peak) peak = value;
    }
  }
  return peak;
};

export function renderMusic(project: MusicProject, sampleRate = MIX_SAMPLE_RATE): Promise<RenderResult> {
  const bars = project.bars;
  const tempo = project.tempo;
  const tailSeconds = project.tracks.reduce((max, track) => Math.max(max, beatsToSeconds(trackTail(track.instrument, track.notes), tempo)), 0);
  const duration = Math.max(0.5, projectSeconds(project) + Math.min(2, tailSeconds));
  const frames = Math.ceil(duration * sampleRate);
  const context = new OfflineAudioContext(2, frames, sampleRate);

  const master = context.createGain();
  master.gain.value = project.masterVolume * MIX_HEADROOM;
  const limiter = context.createDynamicsCompressor();
  // Gentle settings: catch loud peaks without squashing the mix.
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.12;
  master.connect(limiter).connect(context.destination);

  for (const track of project.tracks) {
    if (!trackIsAudible(project.tracks, track)) continue;
    const gain = context.createGain();
    gain.gain.value = track.volume;
    gain.connect(stereoPan(context, track.pan)).connect(master);
    for (const note of track.notes) {
      scheduleNote(context, gain, track.instrument, {
        pitch: note.pitch,
        start: beatsToSeconds(note.start, tempo),
        duration: beatsToSeconds(note.duration, tempo),
        velocity: note.velocity,
      });
    }
  }
  return context.startRendering().then(buffer => ({ channels: [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()], sampleRate: buffer.sampleRate, duration: buffer.duration }));
}

/** Renders one note of one track, used for click-to-audition while editing. */
export async function renderNotePreview(instrument: InstrumentId, pitch: number, velocity = 0.8, sampleRate = MIX_SAMPLE_RATE): Promise<RenderResult> {
  const frames = Math.ceil(1.4 * sampleRate);
  const context = new OfflineAudioContext(1, frames, sampleRate);
  scheduleNote(context, context.destination, instrument, { pitch, start: 0, duration: 0.5, velocity });
  const buffer = await context.startRendering();
  return { channels: [buffer.getChannelData(0).slice()], sampleRate: buffer.sampleRate, duration: buffer.duration };
}

/** Renders a set of notes as a loopable section, used when loop is enabled. */
export async function renderLoopSection(project: MusicProject, fromBeat = 0, toBeat = projectBeats(project), sampleRate = MIX_SAMPLE_RATE): Promise<RenderResult> {
  const span: MusicProject = {
    ...project,
    tracks: project.tracks.map(track => ({
      ...track,
      notes: track.notes.filter(note => note.start + note.duration > fromBeat && note.start < toBeat).map((note): Note => ({ ...note, start: Math.max(0, note.start - fromBeat) })),
    })),
  };
  const sectionBeats = toBeat - fromBeat;
  const seconds = beatsToSeconds(sectionBeats, project.tempo);
  const frames = Math.max(1, Math.ceil(seconds * sampleRate));
  const context = new OfflineAudioContext(2, frames, sampleRate);
  const master = context.createGain();
  master.gain.value = project.masterVolume * MIX_HEADROOM;
  master.connect(context.destination);
  for (const track of span.tracks) {
    if (!trackIsAudible(span.tracks, track)) continue;
    const gain = context.createGain();
    gain.gain.value = track.volume;
    gain.connect(stereoPan(context, track.pan)).connect(master);
    for (const note of track.notes) {
      scheduleNote(context, gain, track.instrument, {
        pitch: note.pitch,
        start: beatsToSeconds(note.start, project.tempo),
        duration: Math.min(beatsToSeconds(note.duration, project.tempo), Math.max(0.02, seconds)),
        velocity: note.velocity,
      });
    }
  }
  const buffer = await context.startRendering();
  return { channels: [buffer.getChannelData(0).slice(), buffer.getChannelData(1).slice()], sampleRate: buffer.sampleRate, duration: buffer.duration };
}

/** Seconds an effect occupies, matching the render below. */
export const effectDuration = (effect: EffectProject) => effect.duration + 0.2;

/**
 * Sound effect synthesis. Each preset is built from oscillators, the shared
 * deterministic noise buffer and an envelope, so effects are offline and repeatable.
 */
export async function renderEffect(effect: EffectProject, sampleRate = MIX_SAMPLE_RATE): Promise<RenderResult> {
  const duration = effectDuration(effect);
  const frames = Math.ceil(duration * sampleRate);
  const context = new OfflineAudioContext(1, frames, sampleRate);
  const out = context.createGain();
  out.gain.value = effect.volume * 0.9;
  out.connect(context.destination);

  const rate = Math.pow(2, effect.pitch / 12);
  const tail = 0.08 + effect.decay * 0.5;
  const stop = Math.max(0.05, duration - 0.05);
  const noise = () => {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer(context);
    return source;
  };

  const tone = (type: OscillatorType, from: number, to: number, gainValue: number) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from * rate, 0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * rate), duration * 0.8);
    gain.gain.setValueAtTime(0.0001, 0);
    gain.gain.linearRampToValueAtTime(gainValue, 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, tail));
    osc.connect(gain).connect(out);
    osc.start(0);
    osc.stop(stop);
  };
  const burst = (filterType: BiquadFilterType, frequency: number, q: number, gainValue: number, length: number) => {
    const source = noise();
    const filter = context.createBiquadFilter();
    filter.type = filterType; filter.frequency.value = frequency; filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, 0);
    gain.gain.linearRampToValueAtTime(gainValue, 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, length));
    source.connect(filter).connect(gain).connect(out);
    source.start(0);
    source.stop(stop);
  };

  switch (effect.preset) {
    case 'footstep': tone('sine', 180, 60, 0.5); if (effect.noise) burst('lowpass', 900, 1, 0.25, 0.16); break;
    case 'pop': tone('sine', 520, 180, 0.6); if (effect.noise) burst('bandpass', 1800, 2, 0.2, 0.08); break;
    case 'bounce': tone('triangle', 320, 620, 0.55); tone('triangle', 320, 140, 0.35); break;
    case 'sparkle':
      for (let i = 0; i < 5; i++) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const at = i * (duration / 6);
        osc.type = 'sine';
        osc.frequency.value = (900 + i * 420) * rate;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.28 - i * 0.04, at + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration / 3);
        osc.connect(gain).connect(out);
        osc.start(at); osc.stop(Math.min(duration, at + duration / 3 + 0.02));
      }
      break;
    case 'whoosh': burst('bandpass', 700, 1.2, 0.5, duration * 0.9); break;
    case 'bell': tone('sine', 880, 880, 0.45); tone('sine', 1320, 1320, 0.2); tone('sine', 1760, 1760, 0.1); break;
    case 'transition':
      tone('square', 440, 880, 0.28);
      tone('square', 880, 440, 0.24);
      if (effect.noise) burst('highpass', 2000, 1, 0.18, duration * 0.5);
      break;
  }

  const buffer = await context.startRendering();
  return { channels: [buffer.getChannelData(0).slice()], sampleRate: buffer.sampleRate, duration: buffer.duration };
}