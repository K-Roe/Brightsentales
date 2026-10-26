[CmdletBinding()]
param(
    [switch]$PreflightOnly,
    [switch]$StudioOnly,
    [switch]$UnityOnly,
    [switch]$NoBrowser,
    [string]$StudioPath,
    [string]$UnityPath = $(if ($env:BRIGHTTALES_UNITY_PROJECT_PATH) { $env:BRIGHTTALES_UNITY_PROJECT_PATH } else { 'C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration' }),
    [string]$UnityExePath = $(if ($env:BRIGHTTALES_UNITY_EDITOR_PATH) { $env:BRIGHTTALES_UNITY_EDITOR_PATH } else { 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe' }),
    [string]$ExpectedStudioBranch = 'main',
    [string]$ExpectedUnityBranch = 'cartoon-foundation',
    [int]$BridgePort = 17844,
    [int]$StudioPort = 5177
)

$ErrorActionPreference = 'Stop'
if ($StudioOnly -and $UnityOnly) { throw 'Choose either -StudioOnly or -UnityOnly, not both.' }
if ([string]::IsNullOrWhiteSpace($StudioPath)) { $StudioPath = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
Import-Module (Join-Path $PSScriptRoot 'BrightTalesReview.psm1') -Force
$logRoot = Join-Path $env:LOCALAPPDATA 'BrightTales/ReviewLauncher'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$mutex = New-Object System.Threading.Mutex($false, 'Local\BrightTalesReviewLauncher')
if (-not $mutex.WaitOne(0)) {
    Write-Host 'Another BrightTales review launch is already running its preflight/startup. Wait for it to finish before double-clicking again.' -ForegroundColor Yellow
    $mutex.Dispose()
    exit 1
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$transcript = Join-Path $logRoot "review-$stamp.log"
Start-Transcript -Path $transcript -Force | Out-Null

try {
    Write-Host 'BrightTales P8-P11 Review Launcher' -ForegroundColor Cyan
    Write-Host "Logs: $logRoot"
    $preflight = Get-BrightTalesReviewPreflight -StudioPath $StudioPath -UnityPath $UnityPath -UnityExePath $UnityExePath -ExpectedStudioBranch $ExpectedStudioBranch -ExpectedUnityBranch $ExpectedUnityBranch -BridgePort $BridgePort -StudioPort $StudioPort
    Write-BrightTalesReviewSummary -Preflight $preflight

    if ($preflight.BlockingCount -gt 0) {
        Write-Host 'Startup stopped. Resolve the BLOCK items above and run the launcher again. Nothing was reset, installed, terminated or changed in Unity settings.' -ForegroundColor Red
        exit 1
    }
    if ($PreflightOnly) {
        Write-Host 'Preflight completed. Applications were not launched.' -ForegroundColor Green
        exit 0
    }

    $plan = Get-BrightTalesReviewLaunchPlan -Preflight $preflight
    if ($StudioOnly) { $plan.StartUnity = $false }
    if ($UnityOnly) { $plan.StartStudio = $false; $plan.OpenBrowser = $false }
    $studioUrl = $preflight.StudioUrl
    if ($plan.StartStudio) {
        $runnerPath = Join-Path $logRoot "start-studio-$stamp.ps1"
        $studioLog = Join-Path $logRoot "studio-$stamp.log"
        $quotedStudioPath = $StudioPath.Replace("'","''")
        $quotedStudioLog = $studioLog.Replace("'","''")
        $quotedUnityPath = $UnityPath.Replace("'","''")
        $quotedUnityExePath = $UnityExePath.Replace("'","''")
        $runner = @"
`$ErrorActionPreference = 'Continue'
`$Host.UI.RawUI.WindowTitle = 'BrightTales Studio - Review'
`$env:VITE_UNITY_BRIDGE_PORT = '$BridgePort'
`$env:BRIGHTTALES_STUDIO_PORT = '$StudioPort'
`$env:BRIGHTTALES_UNITY_PROJECT_PATH = '$quotedUnityPath'
`$env:BRIGHTTALES_UNITY_EDITOR_PATH = '$quotedUnityExePath'
`$env:BRIGHTTALES_REVIEW_LOG = '$quotedStudioLog'
Set-Location -LiteralPath '$quotedStudioPath'
Start-Transcript -Path `$env:BRIGHTTALES_REVIEW_LOG -Append | Out-Null
Write-Host 'BrightTales review Studio is starting. Keep this window open; press Ctrl+C here to stop it safely.' -ForegroundColor Cyan
npm.cmd run dev
`$exitCode = `$LASTEXITCODE
Write-Host "Studio process ended with exit code `$exitCode. Log: `$env:BRIGHTTALES_REVIEW_LOG" -ForegroundColor Yellow
Stop-Transcript | Out-Null
"@
        Set-Content -LiteralPath $runnerPath -Value $runner -Encoding UTF8
        $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
        $studioArgs = @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',$runnerPath)
        $argumentLine = ($studioArgs | ForEach-Object { ConvertTo-BrightTalesNativeArgument ([string]$_) }) -join ' '
        try {
            $studioProcess = Start-Process -FilePath $powershell -ArgumentList $argumentLine -WorkingDirectory $StudioPath -WindowStyle Normal -PassThru
            Write-Host "Started Studio console (PID $($studioProcess.Id)); waiting up to 90 seconds for its identity and bridge config..." -ForegroundColor Cyan
            $endpoint = Wait-BrightTalesStudioReady -Port $StudioPort -BridgePort $BridgePort -TimeoutSeconds 90 -ExpectedWorkspace $StudioPath
            $studioUrl = $endpoint.Url
            Write-Host "Studio ready: $studioUrl (workspace and bridge port verified)." -ForegroundColor Green
        } catch {
            Write-Host "Studio startup failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Check the Studio console and logs in $logRoot. The launcher did not start Unity or open the browser." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Reusing verified Studio at $studioUrl" -ForegroundColor Green
    }

    if ($plan.StartUnity) {
        if ($preflight.UnityProcess.State -eq 'unknown') {
            Write-Host 'Unity process identity could not be checked. Nothing was launched to avoid opening a duplicate Editor.' -ForegroundColor Red
            exit 1
        }
        if ($preflight.UnityProcess.State -ne 'running' -and $preflight.UnityBridge.State -in @('ready','unity-not-ready')) {
            Write-Host 'Port 17844 responds as a Unity bridge, but the expected project process was not found. Close or identify the other Unity preview normally before retrying; nothing was launched.' -ForegroundColor Red
            exit 1
        }
        $unityLog = Join-Path $logRoot "unity-$stamp.log"
        $oldUnityPort = $env:BRIGHTTALES_UNITY_BRIDGE_PORT
        try {
            $env:BRIGHTTALES_UNITY_BRIDGE_PORT = [string]$BridgePort
            $unityArgs = @('-projectPath',$UnityPath,'-logFile',$unityLog)
            $unityArgumentLine = ($unityArgs | ForEach-Object { ConvertTo-BrightTalesNativeArgument ([string]$_) }) -join ' '
            $unityProcess = Start-Process -FilePath $UnityExePath -ArgumentList $unityArgumentLine -WorkingDirectory $UnityPath -WindowStyle Normal -PassThru
            $unityAction = 'started'
            $unityProcessId = $unityProcess.Id
            Write-Host "Started Unity Editor (PID $($unityProcess.Id)) with the review bridge port configured. Log: $unityLog" -ForegroundColor Green
        } catch {
            Write-Host "Unity failed to start: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Studio remains available at $studioUrl; inspect Unity's installation and log path before retrying." -ForegroundColor Yellow
            exit 1
        } finally {
            if ($null -eq $oldUnityPort) { Remove-Item Env:BRIGHTTALES_UNITY_BRIDGE_PORT -ErrorAction SilentlyContinue }
            else { $env:BRIGHTTALES_UNITY_BRIDGE_PORT = $oldUnityPort }
        }
    } elseif (-not $StudioOnly) {
        $unityAction = 'reused'
        $unityProcessId = $preflight.UnityProcess.ProcessId
        Write-Host "Reusing Unity project process: $($preflight.UnityProcess.Detail)" -ForegroundColor Green
    } else {
        Write-Host 'Studio-only smoke mode: Unity was not launched.' -ForegroundColor Yellow
    }

    $bridge = Get-BrightTalesUnityBridgeStatus -Port $BridgePort
    if ($bridge.State -eq 'ready') {
        Write-Host "Unity bridge endpoint is responding at 127.0.0.1:$BridgePort. Studio still needs an explicit Connect action." -ForegroundColor Green
    } elseif ($bridge.State -eq 'unity-not-ready') {
        Write-Host "Unity bridge identity is confirmed at 127.0.0.1:$BridgePort, but Play mode is not ready. Open the review scene and press Play." -ForegroundColor Yellow
    } else {
        Write-Host 'Unity bridge is not connected yet. Unity must finish opening the project, then you must open the review scene and press Play.' -ForegroundColor Yellow
    }

    if (-not $NoBrowser -and $studioUrl) {
        try { Start-Process -FilePath $studioUrl | Out-Null; Write-Host "Opened the default browser at $studioUrl" -ForegroundColor Green }
        catch { Write-Host "Could not open the browser automatically. Open $studioUrl manually." -ForegroundColor Yellow }
    }

    if ($UnityOnly) {
        $result = [pscustomobject]@{ status = $unityAction; processId = [int]$unityProcessId }
        Write-Output ('BRIGHTTALES_UNITY_START=' + ($result | ConvertTo-Json -Compress))
        exit 0
    }

    Write-Host ''
    Write-Host 'Unity review scene: Assets/Scenes/StudioLivingRoomExperimental.unity' -ForegroundColor Cyan
    Write-Host 'In Unity, open that scene and press Play. In Studio, open Unity Connection and press Connect; only the Studio acknowledgement confirms a connection.' -ForegroundColor Cyan
    Write-Host "Studio: $studioUrl"
    Write-Host "Bridge port: $BridgePort"
    Write-Host "Launcher log: $transcript"
    Write-Host 'Review checklist: docs/P8_P11_REVIEW_GUIDE.md'
    Write-Host "P8-P11 manual visual and audio acceptance remains Karl's decision." -ForegroundColor Yellow
    exit 0
} finally {
    Stop-Transcript | Out-Null
    try { $mutex.ReleaseMutex() } catch { }
    $mutex.Dispose()
}
