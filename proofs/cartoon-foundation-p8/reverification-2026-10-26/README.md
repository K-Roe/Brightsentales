# P8 re-verification artifacts (2026-10-26)

These files were captured by rerunning the existing P8 implementation in the isolated branches. Studio browser automation used a newly created Chrome profile and wrote all files here; Unity XML results used the same temp evidence directory. The normal Chrome profile was not opened.

## Results

- `unity-episode.xml`: `StudioEpisodePlayModeTest`, 5/5 passed.
- `StudioScenePlayerPlayModeTest-correct-port.xml`: 1/1 passed.
- `StudioSceneAudioPlayModeTest-correct-port.xml`: 1/1 passed.
- `unity-browser.xml`: `StudioEpisodeBrowserWorkflowTest`, 1/1 passed.
- `camera-workflow-results.json`: nine stages passed, no browser exceptions, no failed requests. Profile: `C:\Users\karlr\AppData\Local\Temp\brighttales-p8-camera-SWHGGt`.
- `camera-directed-episode.webm`: VP9 1672x941 plus 48 kHz Opus, 3,263,151 bytes; full FFmpeg decode passed. It contains a generated low-level 220 Hz test tone.

Unity fixture commands (run separately; do not add `-quit`). `Start-Process -Wait` keeps each result tied to the completed Unity process:

```powershell
$env:BRIGHTTALES_UNITY_BRIDGE_PORT = '17844'
$unity = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe'
$project = 'C:\Users\karlr\repos\BrightTalesP8Unity'
function Invoke-P8Test($filter, $name) {
  $results = "$env:TEMP\p8-$name.xml"
  $log = "$env:TEMP\p8-$name.log"
  $arguments = "-batchmode -nographics -projectPath `"$project`" -runTests -testPlatform PlayMode -testFilter `"$filter`" -testResults `"$results`" -logFile `"$log`""
  Start-Process -FilePath $unity -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
}
Invoke-P8Test 'StudioEpisodePlayModeTest' 'episode' # expect exit 0, 5/5
Invoke-P8Test 'StudioScenePlayerPlayModeTest' 'player' # expect exit 0, 1/1
Invoke-P8Test 'StudioSceneAudioPlayModeTest' 'audio' # expect exit 0, 1/1
```
The browser-driven test requires the Studio server on port 4177, `CARTOON_FOUNDATION_P8_E2E_DIR` pointing to a disposable directory, and the same bridge-port environment. `StudioEpisodeBrowserWorkflowTest` writes `READY.txt`; the existing `camera-workflow.mjs` script then creates/saves/reopens/replays/exports and transfers the episode. It should run only with a disposable Chrome profile.

The Player test was first attempted without the required port environment and refused its bridge connection. With `BRIGHTTALES_UNITY_BRIDGE_PORT=17844`, it passed. No source changes were needed. All previously modified Unity settings-file hashes were identical before and after verification; `P8CameraReview/` was not touched.
