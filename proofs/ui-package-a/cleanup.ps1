$ErrorActionPreference = 'Stop'
$tempRoot = (Resolve-Path -LiteralPath $env:TEMP).Path.TrimEnd('\')
$profilePath = $env:BRIGHTTALES_TEST_PROFILE
if (-not $profilePath -or -not (Test-Path -LiteralPath $profilePath)) { exit 0 }
$target = (Resolve-Path -LiteralPath $profilePath).Path
if (-not $target.StartsWith($tempRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
    (Split-Path -Leaf $target) -notmatch '^brighttales-ui-[ab]-[A-Za-z0-9]+$') {
  throw "Unexpected disposable profile path: $target"
}
Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($target) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
for ($attempt = 0; $attempt -lt 8; $attempt++) {
  Start-Sleep -Milliseconds 500
  try { Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop; exit 0 }
  catch { if ($attempt -eq 7) { throw } }
}
