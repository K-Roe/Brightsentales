import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = dirname(fileURLToPath(import.meta.url));
const sampleRate = 22050;
function wav(seconds, sample) {
  const count = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + count * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(i / sampleRate))) * 32767), 44 + i * 2);
  return buffer;
}
const tone = (frequency, time) => Math.sin(2 * Math.PI * frequency * time) + .15 * Math.sin(4 * Math.PI * frequency * time);
const melody = [392, 440, 523.25, 440, 392, 329.63, 349.23, 392, 440, 392, 349.23, 329.63, 293.66, 329.63, 349.23, 392, 440, 523.25, 493.88];
const music = wav(18.5, time => {
  const note = Math.floor(time * 1.5);
  const local = (time * 1.5) % 1;
  const phrase = Math.floor(note / melody.length);
  const frequency = melody[note % melody.length] / (phrase % 2 ? 2 : 1);
  const pluck = Math.sin(Math.PI * Math.min(1, local * 2)) * Math.exp(-2.4 * local);
  const bass = [196, 174.61, 130.81, 174.61][Math.floor(time / 2) % 4];
  const edge = Math.min(1, time / .7, (18.5 - time) / 1.2);
  return edge * (.075 * tone(frequency, time) * pluck + .028 * Math.sin(2 * Math.PI * bass * time));
});
const cue = wav(.65, time => {
  const edge = Math.sin(Math.PI * time / .65) ** 2;
  return .09 * edge * (tone(659.25, time) + .5 * tone(783.99, time));
});
await writeFile(join(output, 'gentle-hello.wav'), music);
await writeFile(join(output, 'soft-chime.wav'), cue);
