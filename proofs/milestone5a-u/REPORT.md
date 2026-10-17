# Milestone 5A-U: isolated Playground acceptance evidence

Status: **pending Karl's visual approval**. The recovered 5A-Q artwork was not edited or integrated into production.

## How the isolated preview works

`vite.outfit-preview.config.ts` runs the existing React Playground on `127.0.0.1:5174`. A development-only middleware serves the exact nine recovered PNG files from `proofs/milestone5a-q-recovery/frames/` at Max's normal runtime asset URLs. All other requests use the existing app. The normal `vite.config.ts` remains unchanged and serves the approved hoodie frames. To review locally from the repository root:

```powershell
npm run dev -- --config proofs/milestone5a-u/vite.outfit-preview.config.ts
```

Open `http://127.0.0.1:5174/` and choose Playground. This is an isolated test server, not a production outfit option. It makes every Max-based sprite at those runtime URLs use the candidate art within this server; it is intended only for review.

## Evidence

- `original-vs-outfit-browser.png`: original hoodie and candidate at matching Playground scale, enlarged equally for review.
- `candidate-idle.png`, `candidate-walking-right.png`, `candidate-behind-maxine.png`, `candidate-walking-left.png`: idle, travel and depth overlap.
- `candidate-wave-first.png`, `candidate-wave-second.png`, `candidate-returned-idle.png`: two separate wave actions and return to idle.
- `candidate-after-left-walk.png`: exact left destination and idle.
- `browser-acceptance.mp4`: 35 browser screenshots sampled at approximately 2 frames per second across the interaction. This is a sampled browser capture, not a smooth real-time recording; use the live preview for timing judgments.
- `browser-findings.json`: asset hashes, action sequence, browser errors, failed requests and test-profile storage.

## Verification

- All nine candidate HTTP responses matched the recovered 5A-Q files by SHA-256. All nine normal-server Max responses matched `public/art/` by SHA-256.
- Every candidate PNG matches the corresponding original canvas dimensions and has RGBA transparency.
- The isolated Chrome profile had no saved character library or scene on either test origin. The script did not use Save.
- The browser run exercised right and left click-to-walk, moving Maxine to create a depth overlap, two separate waves, and return to idle. No browser console errors or failed network requests were captured.
- `npm test`: 8 files, 34 tests passed.
- `npm run build`: passed TypeScript and Vite production build.
- `git diff --exit-code -- src public vite.config.ts package.json`: passed. No approved sprite, runtime source, production configuration or saved data was changed.

## Observations and limits

- At normal Playground scale, walking, wave, transparency, positioning and overlap rendered without a new obvious gap or disappearing limb. Max stopped at the chosen destinations and returned to front idle.
- The character selection thumbnail still shows the original hoodie while the isolated stage shows the candidate. This happens because this preview redirects only the nine runtime stage URLs. Reproduce by starting the isolated server, opening Playground and comparing Max's library thumbnail with his stage sprite. It does not alter production.
- The candidate artwork has its own pixel differences from original Max beyond the garment region, visible in `original-vs-outfit-browser.png`. This proof preserves the exact approved candidate; it does not correct or certify those differences.
- Sampled screenshots and automated checks cannot establish final animation quality. Karl must review the live preview or video before any production integration.
