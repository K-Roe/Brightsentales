export const WAVE_FRAME_MS = 180;

// Two gentle outward/inward hand movements, with a raised and lowered arm.
export const WAVE_SEQUENCE = [0, 1, 2, 3, 2, 3, 2, 1, 0] as const;
export type WaveFrame = (typeof WAVE_SEQUENCE)[number];
export const WAVE_DURATION_MS = WAVE_SEQUENCE.length * WAVE_FRAME_MS;

export function waveFrameAt(elapsedMs: number): WaveFrame | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs >= WAVE_DURATION_MS) return null;
  return WAVE_SEQUENCE[Math.max(0, Math.floor(elapsedMs / WAVE_FRAME_MS))];
}
