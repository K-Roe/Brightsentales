import { useEffect, useRef, useState } from 'react';
import { scheduleNote, type InstrumentId } from './instruments';

/** One live voice at a time, using the same instrument definitions as export. */
export function useNoteAudition() {
  const context = useRef<AudioContext | null>(null);
  const voice = useRef<GainNode | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePitch, setActivePitch] = useState<number | null>(null);

  const stop = () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const old = voice.current;
    voice.current = null;
    if (old && context.current) {
      const now = context.current.currentTime;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.015);
      setTimeout(() => old.disconnect(), 60);
    }
    setActivePitch(null);
  };
  const audition = async (instrument: InstrumentId, pitch: number, velocity = 0.75) => {
    stop();
    const request = generation.current;
    try {
      const audio = context.current ?? new AudioContext();
      context.current = audio;
      if (audio.state !== 'running') await audio.resume();
      if (request !== generation.current) return;
      const output = audio.createGain();
      output.gain.value = 0.22;
      output.connect(audio.destination);
      voice.current = output;
      scheduleNote(audio, output, instrument, { pitch, start: audio.currentTime, duration: 0.36, velocity });
      setActivePitch(pitch);
      timer.current = setTimeout(() => {
        if (voice.current === output) { voice.current = null; output.disconnect(); setActivePitch(null); }
      }, 750);
    } catch {
      setActivePitch(null);
    }
  };
  useEffect(() => () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    voice.current?.disconnect();
    void context.current?.close();
  }, []);
  return { audition, stop, activePitch };
}
