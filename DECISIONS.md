# Cartoon foundation decisions

## 2026-10-24 — Recovery and branch isolation

The local Studio `main` (`39e089d`) contains Camera/Life/Scene Maker functionality absent from the frozen Studio V1.1 branch. It is not a descendant of that branch. Start new Studio work on `cartoon-foundation` from `main` and leave `cartoon-engine-v1-1-approved` frozen. Start Unity `cartoon-foundation` from the frozen approved Unity commit. Confirm integration behavior from actual source rather than assuming a remote branch is current.

The Unity repository was created private at `https://github.com/K-Roe/BrightTalesUnityTest`. Both frozen approved branches were pushed without force. Unity LFS objects were verified remotely with the download batch endpoint (137/137). No baseline was merged into main.

## 2026-10-24 — Integration seam

Reuse the existing localhost receiver and versioned command acknowledgements. Treat `TimedScene` and `Episode` as the Studio source of truth. Keep Cartoon Engine V1.1 fixed and isolated; a new versioned payload and experimental controller must read saved values. Reject unsupported actions and missing artwork explicitly. Keep the browser WebM path working while Unity MP4 output is built and verified separately.
