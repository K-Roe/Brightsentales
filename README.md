# BrightSenAppsTales

A local React/TypeScript 2D cartoon maker. The living room, Max, Maxine, and the V3 walking cycle are Milestone 1 artwork and behaviour approved by Karl.

## Milestone 2 wave

Select Max or Maxine and press **Wave**. The selected character starts from the existing front idle, raises one arm, moves the hand twice, lowers the arm, and returns to the exact original idle image. The wave uses complete transparent character poses; the walking sprites, living room, and scene JSON format are unchanged. Wave is unavailable during walking. Starting a walk, dragging a character, resetting, or reopening a scene cancels an active wave.

- [Wave frame contact sheet](milestone2-wave-contact.png): original idle and every new wave pose for both characters at equal display scale.
- [Browser recording](milestone2-wave-demo.mp4): Max waves, Maxine waves, then Max walks behind Maxine, stops, waves, and returns to idle.

Karl approved the Milestone 2 wave. Its source sheets and `scripts/prepare_wave_sprites.py` remain available for review; its artwork and timing are unchanged in Milestone 3.

## Milestone 3 Oliver proof of concept

`src/brightling.ts` assembles complete transparent SVG poses from a validated character specification, shared face, hair, clothing, leg and arm templates, and a deterministic seed. It generates front idle, side turn, four right-facing walk frames and three wave poses; left-facing walking mirrors the generated side view. Oliver is the only new permanent scene character. A second temporary specification exercises the same generator without adding another character to the interface. No AI or network service runs in the application.

Older version 1 scene JSON containing only Max and Maxine still opens. Oliver starts at his default position in that case. Saving writes all three characters under the existing local storage key.

- [Same-scale character comparison](milestone3-character-comparison.png)
- [Oliver walking contact sheet](milestone3-oliver-walk-contact.png) and [wave contact sheet](milestone3-oliver-wave-contact.png)
- [Second generated variation](milestone3-generator-variation.png)
- [Repeatability evidence](milestone3-repeatability.txt) from two fresh Node processes running `node scripts/brightling-digest.mjs`
- [Full browser recording](milestone3-browser-demo.mp4) of both walking directions, overlap, wave, save, reopen and reload

Oliver's vector shading and facial detail are simpler than the approved painted Max and Maxine sprites. The comparison and motion are a review candidate, not proof that the styles match closely enough. Karl's visual approval of Milestone 3 is pending.

## Run

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Select a character or click them on the stage, drag to place them, and click the floor to set a walking destination. Press **Play scene** to walk or **Wave** to wave while stationary. **Save scene** stores starting positions and destinations in this browser's local storage. **Open saved** reloads them; **Reset positions** returns all characters to the last saved starts.

## Checks

```sh
npm test
npm run build
```

Storage is per browser profile on this device. Clearing site data removes the saved scene.
