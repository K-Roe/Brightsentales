import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateBrightlingFrames, OLIVER_SPEC, SAMPLE_VARIATION_SPEC } from '../src/brightling.ts';

const digest = value => createHash('sha256').update(value).digest('hex');
const specs = process.argv[2] ? [JSON.parse(readFileSync(process.argv[2], 'utf8'))] : [OLIVER_SPEC, SAMPLE_VARIATION_SPEC];
for (const spec of specs) {
  const frames = generateBrightlingFrames(spec);
  const ordered = [frames.idle, ...frames.side, ...frames.wave];
  console.log(JSON.stringify({ id: spec.id, specSha256: digest(JSON.stringify(spec)), framesSha256: ordered.map(digest), combinedSha256: digest(JSON.stringify(ordered)) }));
}
