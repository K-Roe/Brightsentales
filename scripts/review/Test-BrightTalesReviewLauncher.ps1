[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'BrightTalesReview.psm1') -Force
$script:passed = 0

function Assert-Review {
    param([bool]$Condition, [string]$Name)
    if (-not $Condition) { throw "FAIL: $Name" }
    $script:passed++
    Write-Host "PASS: $Name" -ForegroundColor Green
}

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("BrightTales Review Launcher Tests " + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$listener = $null
$serverJob = $null
try {
    $workspaceWithSpaces = Join-Path $temp 'Studio Workspace With Spaces'
    New-Item -ItemType Directory -Path $workspaceWithSpaces | Out-Null

    $quoted = ConvertTo-BrightTalesNativeArgument (Join-Path $workspaceWithSpaces 'run studio.ps1')
    Assert-Review ($quoted.StartsWith('"') -and $quoted.EndsWith('"') -and $quoted.Contains('Workspace With Spaces')) 'Windows command-line quoting preserves paths containing spaces'

    $unityPathWithSpaces = Join-Path $temp 'Unity Workspace With Spaces'
    $matchingProcess = [pscustomobject]@{ Name='Unity.exe'; ProcessId=43210; CommandLine="Unity.exe -projectPath `"$unityPathWithSpaces`"" }
    $processCheck = Get-BrightTalesUnityProjectProcess -UnityProjectPath $unityPathWithSpaces -ProcessSnapshot @($matchingProcess)
    Assert-Review ($processCheck.State -eq 'running' -and $processCheck.ProcessId -eq 43210) 'Existing Unity process is matched to the exact project path'
    $otherProcess = [pscustomobject]@{ Name='Unity.exe'; ProcessId=43211; CommandLine='Unity.exe -projectPath C:\OtherProject' }
    $processCheck = Get-BrightTalesUnityProjectProcess -UnityProjectPath $unityPathWithSpaces -ProcessSnapshot @($otherProcess)
    Assert-Review ($processCheck.State -eq 'not-running') 'A different Unity project is not mistaken for this workspace'

    $portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
    $portProbe.Start()
    $runningStudioPath = ([System.Net.IPEndPoint]$portProbe.LocalEndpoint).Port
    $portProbe.Stop()
    $stopFile = Join-Path $temp 'stop-mock-server'
    $serverJob = Start-Job -ArgumentList $runningStudioPath,$workspaceWithSpaces,$stopFile -ScriptBlock {
        param($Port,$Workspace,$StopFile)
        $listener = [System.Net.HttpListener]::new()
        $listener.Prefixes.Add("http://127.0.0.1:$Port/")
        $listener.Start()
        while ($listener.IsListening) {
            try {
                $pending = $listener.GetContextAsync()
                while (-not $pending.Wait(100)) {
                    if (Test-Path -LiteralPath $StopFile) { $listener.Stop(); throw 'Mock server stop requested.' }
                }
                $context = $pending.GetAwaiter().GetResult()
            } catch { break }
            $path = $context.Request.Url.AbsolutePath
            if ($path -eq '/') {
                $status = 200; $body = '<html><title>BrightSenAppsTales - Cartoon Maker</title></html>'; $type = 'text/html'
            } elseif ($path -eq '/__brighttales_review/health') {
                $status = 200; $body = (@{ service='brighttales-studio'; protocol=1; workspace=$Workspace; mode='development'; unityBridgePort=17844 } | ConvertTo-Json -Compress); $type = 'application/json'
            } elseif ($path -eq '/src/unityBridge.ts') {
                $status = 200; $body = 'const UNITY_BRIDGE_URL = "17844" === ''17844'' ? ''http://127.0.0.1:17844'' : ''http://127.0.0.1:17843'';'; $type = 'text/javascript'
            } else {
                $status = 404; $body = ''; $type = 'text/plain'
            }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            $context.Response.StatusCode = $status
            $context.Response.ContentType = $type
            $context.Response.ContentLength64 = $bytes.Length
            if ($bytes.Length) { $context.Response.OutputStream.Write($bytes,0,$bytes.Length) }
            $context.Response.Close()
        }
        $listener.Close()
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    do {
        Start-Sleep -Milliseconds 100
        $tcp = New-Object System.Net.Sockets.TcpClient
        try { $tcp.Connect('127.0.0.1',$runningStudioPath); $ready = $tcp.Connected } catch { $ready = $false } finally { $tcp.Close() }
    } while (-not $ready -and [DateTime]::UtcNow -lt $deadline)
    Assert-Review $ready 'Mock Studio identity endpoint starts on a path containing spaces'
    $endpoint = Get-BrightTalesStudioEndpoint -Port $runningStudioPath -ExpectedWorkspace $workspaceWithSpaces
    Assert-Review ($endpoint -and $endpoint.IdentityValid -and $endpoint.BridgePort -eq 17844) 'Preflight validates Studio service identity, workspace and compiled bridge configuration'
    $readyEndpoint = Wait-BrightTalesStudioReady -Port $runningStudioPath -BridgePort 17844 -TimeoutSeconds 2 -PollMilliseconds 100 -ExpectedWorkspace $workspaceWithSpaces
    Assert-Review ($readyEndpoint.Url -eq "http://127.0.0.1:$runningStudioPath/") 'Successful Studio startup is confirmed at the URL reported by its listener'
    $wrongWorkspace = Get-BrightTalesStudioEndpoint -Port $runningStudioPath -ExpectedWorkspace (Join-Path $temp 'another workspace')
    Assert-Review ($wrongWorkspace -and -not $wrongWorkspace.IdentityValid) 'A BrightTales server from another workspace is not reused'

    $newPlan = Get-BrightTalesReviewLaunchPlan -Preflight ([pscustomobject]@{ BlockingCount=0; StudioUrl=$null; UnityProcess=[pscustomobject]@{State='not-running'} })
    Assert-Review ($newPlan.CanLaunch -and $newPlan.StartStudio -and $newPlan.StartUnity -and $newPlan.OpenBrowser) 'Fresh launch plan starts Studio and Unity once and opens the ready URL'
    $reusePlan = Get-BrightTalesReviewLaunchPlan -Preflight ([pscustomobject]@{ BlockingCount=0; StudioUrl='http://127.0.0.1:54173/'; UnityProcess=[pscustomobject]@{State='running'} })
    Assert-Review ($reusePlan.CanLaunch -and -not $reusePlan.StartStudio -and -not $reusePlan.StartUnity -and $reusePlan.Url -eq 'http://127.0.0.1:54173/') 'Repeated launch reuses the verified Studio and Unity processes without duplication'
    $blockedPlan = Get-BrightTalesReviewLaunchPlan -Preflight ([pscustomobject]@{ BlockingCount=1; StudioUrl=$null; UnityProcess=[pscustomobject]@{State='not-running'} })
    Assert-Review (-not $blockedPlan.CanLaunch -and -not $blockedPlan.StartStudio -and -not $blockedPlan.StartUnity) 'A blocking preflight prevents all application launches'

    $timeoutFailed = $false
    try { Wait-BrightTalesStudioReady -Port 54174 -BridgePort 17844 -TimeoutSeconds 1 -PollMilliseconds 100 -ExpectedWorkspace $workspaceWithSpaces } catch { $timeoutFailed = $true }
    Assert-Review $timeoutFailed 'Studio startup/readiness timeout returns an actionable failure'

    $tcpListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
    $tcpListener.Start()
    $occupiedPort = ([System.Net.IPEndPoint]$tcpListener.LocalEndpoint).Port
    $portStatus = Get-BrightTalesUnityBridgeStatus -Port $occupiedPort
    Assert-Review ($portStatus.State -eq 'conflict') 'An occupied port without Unity health identity is a conflict, not a successful bridge'
    $tcpListener.Stop(); $tcpListener = $null

    $studioRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $unityRoot = 'C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration'
    $realUnity = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe'
    $missingStudio = Get-BrightTalesReviewPreflight -StudioPath (Join-Path $temp 'Missing Studio Workspace') -UnityPath $unityRoot -UnityExePath $realUnity -ExpectedStudioBranch 'main' -ExpectedUnityBranch 'cartoon-foundation'
    Assert-Review (($missingStudio.Checks | Where-Object Name -eq 'Studio workspace').Status -eq 'BLOCK') 'Missing Studio workspace is reported as a blocking failure'
    $missingUnity = Get-BrightTalesReviewPreflight -StudioPath $studioRoot -UnityPath $unityRoot -UnityExePath (Join-Path $temp 'Missing Unity.exe') -ExpectedStudioBranch 'main' -ExpectedUnityBranch 'cartoon-foundation'
    Assert-Review (($missingUnity.Checks | Where-Object Name -eq 'Unity Editor executable').Status -eq 'BLOCK') 'Missing Unity executable is reported as a blocking failure'
    Assert-Review ((($missingUnity.Checks | Where-Object Name -eq 'Studio branch and working tree').Status) -eq 'PASS') 'Integrated Studio main branch is accepted by preflight'
    Assert-Review ((($missingUnity.Checks | Where-Object Name -eq 'Unity branch and working tree').Status) -eq 'PASS') 'Integrated Unity cartoon-foundation branch is accepted by preflight'
    $missingDeps = Get-BrightTalesReviewPreflight -StudioPath $studioRoot -UnityPath $unityRoot -UnityExePath $realUnity -ExpectedStudioBranch 'main' -ExpectedUnityBranch 'cartoon-foundation' -NodeModulesPath (Join-Path $temp 'Missing node modules')
    Assert-Review (($missingDeps.Checks | Where-Object Name -eq 'Studio dependencies').Status -eq 'BLOCK') 'Missing Studio dependencies are reported without installing anything'

    Write-Host "Review launcher checks passed: $script:passed" -ForegroundColor Green
} finally {
    if ($tcpListener) { $tcpListener.Stop() }
    if ($serverJob) {
        Set-Content -LiteralPath $stopFile -Value 'stop' -ErrorAction SilentlyContinue
        Wait-Job $serverJob -Timeout 3 | Out-Null
        if ($serverJob.State -ne 'Completed') { Stop-Job $serverJob -ErrorAction SilentlyContinue; Wait-Job $serverJob -Timeout 3 | Out-Null }
        Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
