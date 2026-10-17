# Milestone 5A-V: first production outfit integration

Status: implemented for review; **Karl has not yet approved production integration**.

## Implementation

- Max's protected library card has an Outfit selector: Original Hoodie or T-Shirt & Trousers. Changing it saves the choice immediately. Max and Maxine remain protected from character editing or deletion.
- The T-shirt and trousers runtime PNGs in `public/art/max-tshirt/` are byte-identical to the nine recovered 5A-Q frames. No original artwork or animation timing was modified.
- A small sprite URL function selects a complete idle, side-view, four-frame walk and three-frame wave set for Max. The existing canvas renderer, frame order, timing, mirror, positioning and depth sort are unchanged. The library card and Playground selection thumbnail use the chosen idle asset.
- `maxOutfit` is an optional field on the existing version 1 saved scene. Missing or unknown values resolve to Original Hoodie. The selector updates only this field in the last saved scene, leaving saved positions and destinations intact; Save scene still saves current positions. Studio Backup already contains the scene, so no backup version change is needed. Character-library export intentionally excludes scenes and Max's outfit.

## Browser evidence

Run with `npm run dev`, then open Characters in a browser. Automated acceptance used a fresh disposable Chrome profile and never accessed Karl's normal browser data.

- `01-original-hoodie.png`: original protected Max and default selection.
- `02-outfit-selected.png`: selector and full-size T-shirt preview.
- `03-candidate-idle-thumbnail.png`, `thumbnail-closeup.png`: Playground stage and selection thumbnail in the selected outfit.
- `04-walking-right.png`, `05-walking-left.png`: walking in each direction. The right walk crosses behind Maxine.
- `05-wave-raised.png`, `05-after-wave.png`: raised arm and return to idle.
- `06-after-reload.png`, `07-playground-after-reload.png`: the choice and scene persist after navigation/reload.
- `08-restored-hoodie.png`: switching back restores the original preview.
- `walking-and-waving-sampled.mp4`: 21 sampled browser frames. This is a sampled capture, so judge animation timing in the live app.
- `browser-findings.json`: no browser errors or failed asset requests; saved scene contains `maxOutfit: "tshirt-trousers"`; switching back removes the optional field; custom library remains empty.

## Verification

- `npm test`: 9 files, 38 tests passed, including all nine asset hashes, both sprite maps, scene persistence, Studio Backup restore, legacy and unknown outfit fallback.
- `npm run build`: passed TypeScript and Vite.
- All nine production candidate frames match the approved 5A-Q SHA-256 hashes.
- Existing approved Max and Maxine asset files are unchanged.

## Limitations

- The alternative outfit applies only to protected Max. Max-based custom Brightlings retain their existing recoloured hoodie and shorts.
- There is no independent top/bottom selection. The outfit is a complete approved frame set.
- The browser run did not perform a downloaded-file Studio Backup import through the UI. Backup validation and restore were exercised in focused tests. Karl should inspect the live animation and backup workflow before approval.
