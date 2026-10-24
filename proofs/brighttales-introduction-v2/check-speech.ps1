$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$video = Join-Path $root 'brighttales-meet-max-and-maxine-narrated-v2.webm'
$timeline = Get-Content -LiteralPath (Join-Path $root 'timeline.json') -Raw | ConvertFrom-Json
$clips = Join-Path $root 'speech-check-clips'
New-Item -ItemType Directory -Path $clips -Force | Out-Null
Add-Type -AssemblyName System.Speech
$culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-GB')
$out = @()
foreach ($scene in $timeline.scenes) {
  foreach ($line in $scene.narrations) {
    $path = Join-Path $clips ($line.key + '.wav')
    $start = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0:F3}', [double]$line.globalStart)
    $length = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0:F3}', ([double]$line.duration + 0.4))
    & ffmpeg -y -v error -ss $start -t $length -i $video -vn -ac 1 -ar 16000 $path
    if ($LASTEXITCODE -ne 0) { throw "Could not extract $($line.key)" }
    $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($culture)
    try {
      $recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
      $recognizer.SetInputToWaveFile($path)
      $result = $recognizer.Recognize()
      $recognized = if ($null -eq $result) { @() } else { @($result.Text) }
      $out += [pscustomobject]@{ key = $line.key; expected = $line.text; recognized = ($recognized -join ' '); intelligible = ($recognized.Count -gt 0) }
      Write-Host "$($line.key): $($recognized -join ' ')"
    } finally { $recognizer.Dispose() }
  }
}
$out | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'speech-recognition-check.json') -Encoding UTF8
if ($out.Count -ne 11 -or @($out | Where-Object { -not $_.intelligible }).Count -gt 0) { throw 'One or more narration windows were not intelligible to the local recognizer.' }
