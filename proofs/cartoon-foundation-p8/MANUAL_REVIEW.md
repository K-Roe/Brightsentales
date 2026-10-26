# P8 manual review checklist

This is a human review gate. Automated tests and saved screenshots do not approve the visuals or sound.

## Start the local review

Open a PowerShell window for Studio:

```powershell
Set-Location 'C:\Users\karlr\repos\BrightTalesP8Camera'
$env:VITE_UNITY_BRIDGE_PORT = '17844'
npm start
```

Open a second PowerShell window for Unity Editor:

```powershell
$env:BRIGHTTALES_UNITY_BRIDGE_PORT = '17844'
& 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe' -projectPath 'C:\Users\karlr\repos\BrightTalesP8Unity'
```

In Unity, open `Assets/Scenes/StudioLivingRoomExperimental.unity` in the Editor and press the top-toolbar **Play** button. Keep Play mode running while Studio sends the episode.

Open the saved disposable Studio review profile in a third window. This does not use the normal browser profile:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --user-data-dir='C:\Users\karlr\AppData\Local\Temp\brighttales-p8-camera-SWHGGt' --new-window 'http://127.0.0.1:4177/'
```

## 1. Review Studio camera preview

1. In Studio, choose **Episode Maker** in the left navigation.
2. In the episode list, open **P8 Camera directing workflow**.
3. Scrub the episode timeline or use the episode time control to inspect these points:
   - 0.5s: Wide shot, full room.
   - 1.5s: Medium shot of Max.
   - 3.2s: Close-up of Maxine.
   - 4.7s: Pan shot on Max.
   - 7.2s: Custom follow on Maxine.
4. Press **Preview Episode**, watch it through, then use **Stop** and **Preview Episode** again to check repeatability.

Expected: each shot starts at its saved boundary, targets the named character, and keeps the room and characters framed clearly. Please judge whether the framing and movement look right to you.

## 2. Review Unity Game-view playback

1. In the Studio episode editor, scroll to **Preview full episode in Unity**.
2. Press **Send saved episode**. Wait for **Episode ready**.
3. Keep Unity in Play mode and make the **Game** tab visible. Press **Play / Replay** in Studio.
4. Watch the full 9-second episode in Unity Game view. Confirm the wide, Max medium, Maxine close-up, pan and follow shots, then press **Play / Replay** once more and **Reset**.

Expected: the episode plays all three scene occurrences, the view changes at the five camera boundaries, and replay returns to the opening wide shot. Please judge the actual Game-view appearance; the automated transfer test used `-nographics` and cannot establish this approval.

## 3. Physically listen to episode audio

Play the exported episode through your speakers or headphones:

```powershell
& 'C:\Users\karlr\AppData\Local\Microsoft\WinGet\Links\ffplay.exe' -autoexit -nodisp -vn 'C:\Users\karlr\repos\BrightTalesP8Camera\proofs\cartoon-foundation-p8\reverification-2026-10-26\camera-directed-episode.webm'
```

Expected: the complete 9-second track reaches the selected audio device without dropouts or distortion. This proof episode contains a generated, low-level 220 Hz test tone, not production narration or music. Please judge whether the physical playback path works; the test tone does not represent final audio quality.

## Record the three gates

Reply with an explicit decision for each item:

- Studio visuals: **APPROVE**, **CHANGES**, or **REJECT**.
- Unity Game-view visuals: **APPROVE**, **CHANGES**, or **REJECT**.
- Physical audio playback: **APPROVE**, **CHANGES**, or **REJECT**.

P8 remains unmerged until all three are explicitly approved. No approval is inferred from the automated results.
