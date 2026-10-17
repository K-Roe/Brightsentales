# Milestone 5B-FINAL — wardrobe integration review

## Delivered

- Max retains his two previously integrated outfits: Original Hoodie and the approved T-Shirt & Trousers.
- Maxine now has Original Hoodie & Skirt and the approved T-Shirt & Leggings. Her nine production files in `public/art/maxine-tshirt/` are byte-identical to `proofs/milestone5b-q/frames/`.
- The protected Maxine card has an Outfit selector and live preview. Playground thumbnails, idle, side, four walk frames, and three wave frames use the selected set. The existing animation timing, character positioning, and depth rendering were not edited.
- Maxine's selection is stored as an optional `maxineOutfit` field in the existing scene JSON, independent of Max's `maxOutfit`. The original outfit remains the legacy and unknown-ID fallback. Existing Studio Backup includes the scene and therefore both selections. Character-only Library Export excludes the scene and outfit selections; the UI explains this.
- No existing sprite was edited. No artwork was generated or recoloured for this integration.

## Visual review

- `completed-outfits-idle.png`: four completed outfit combinations at matching scale.
- `completed-outfits-nine-poses.png`: all nine runtime poses for each original and approved alternative.
- `characters-original-desktop.png`, `characters-alternative-outfits-desktop.png`, `characters-mobile.png`: protected-card selectors and previews.
- `playground-alternative-outfits.png`, `maxine-walking-right.png`, `maxine-walking-left.png`, `maxine-waving.png`, `characters-after-reload.png`: isolated browser screenshots.
- `browser-check.json`: recorded selectors, sprite URLs, saved/reloaded scene values, no captured console errors, and disposable profile removal.

The browser pass used a new temporary Chrome profile with empty localStorage. It did not open Karl's normal profile or save test characters to his library. This is screenshot evidence, not a video recording. Maxine was observed walking right and left, waving, returning to idle, and retaining the selected outfit after reload. The full two-character/two-outfit movement matrix, overlap motion, and interactive Studio Backup download/restore were not visually recorded in this pass. Backup round-trip and sprite mapping are covered by focused tests.

## Verification

- `npm test`: 9 test files, 42 tests passed. Focused tests cover all nine Maxine sprite URLs, exact candidate bytes and hashes, independent Max/Maxine selections, scene and Studio Backup round-trip, legacy scenes, and unknown outfit fallback.
- `npm run build`: TypeScript and Vite production build passed.
- `py -3.12 proofs/milestone5b-q/verify.py`: approved original Maxine hashes, frozen front idle, dimensions, transparency, frame differences and animation constants passed.
- `git diff --check`: passed. Existing original assets are not modified.
- Isolated browser: no captured JavaScript errors; temporary profile removed. See `browser-check.json`.

## Remaining wardrobe work

The requested Casual Jumper & Trousers, Pyjamas, and Smart Outfit have no nine-frame artwork that has passed Karl's visual review. They were **not** added or represented by recolours of the approved hoodie/skirt. The five-outfit collection is therefore incomplete.

Custom Brightlings still use pose-specific recolour masks on the original Max/Maxine sprite templates. The new flattened alternative outfit frames do not have corresponding reviewed masks for body, hair, and clothing across all nine poses. Applying a built-in outfit directly would lose each custom Brightling's colours; crude automatic masking risks visible seams. Custom Brightlings remain on their existing original outfits. Supporting the alternative outfits safely needs separate mask preparation and visual review per template; no large renderer change was made.

Maxine's alternative was previously approved as artwork, but this production integration still needs Karl's visual and functional approval. No further outfit development should begin automatically.
