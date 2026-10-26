Set-StrictMode -Version Latest

function Add-ReviewCheck {
    param([System.Collections.Generic.List[object]]$Checks, [string]$Name, [ValidateSet('PASS','WARN','BLOCK')][string]$Status, [string]$Detail)
    $Checks.Add([pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail })
}

function Get-LocalHttpResponse {
    param([string]$Url, [int]$TimeoutMilliseconds = 1200)
    $response = $null
    try {
        $request = [System.Net.HttpWebRequest]::Create($Url)
        $request.Method = 'GET'
        $request.Timeout = $TimeoutMilliseconds
        $request.ReadWriteTimeout = $TimeoutMilliseconds
        $response = $request.GetResponse()
    } catch [System.Net.WebException] {
        $response = $_.Exception.Response
    } catch { return $null }
    if ($null -eq $response) { return $null }
    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
        return [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Body = $body }
    } finally { $response.Dispose() }
}

function Test-TcpPortListening {
    param([int]$Port, [int]$TimeoutMilliseconds = 400)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) { return $false }
        try { $client.EndConnect($pending); return $true } catch { return $false }
    } catch { return $false } finally { $client.Close() }
}

function Get-PortOwner {
    param([int]$Port)
    try {
        $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
        if ($connection) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
            return [pscustomobject]@{ ProcessId = $connection.OwningProcess; Name = $process.Name; CommandLine = $process.CommandLine }
        }
    } catch { }
    return $null
}

function Get-BrightTalesUnityBridgeStatus {
    param([int]$Port = 17844)
    if (-not (Test-TcpPortListening -Port $Port)) {
        return [pscustomobject]@{ State = 'free'; Port = $Port; Owner = $null; Detail = "Port $Port is free for the Unity Play-mode bridge." }
    }
    $owner = Get-PortOwner -Port $Port
    $response = Get-LocalHttpResponse -Url "http://127.0.0.1:$Port/health"
    if ($response) {
        try { $payload = $response.Body | ConvertFrom-Json } catch { $payload = $null }
        if ($payload -and $payload.source -eq 'unity' -and [int]$payload.version -eq 0 -and $payload.status -in @('ready','unavailable')) {
            $state = if ($payload.status -eq 'ready') { 'ready' } else { 'unity-not-ready' }
            $detail = if ($state -eq 'ready') { "Unity identity verified at 127.0.0.1:$Port and its Play-mode loop is ready." } else { "Unity identity verified at 127.0.0.1:$Port, but its Play-mode loop is not ready yet." }
            return [pscustomobject]@{ State = $state; Port = $Port; Owner = $owner; Detail = $detail }
        }
    }
    $ownerName = if ($owner -and $owner.Name) { "$($owner.Name), PID $($owner.ProcessId)" } else { 'an unidentified local process' }
    return [pscustomobject]@{ State = 'conflict'; Port = $Port; Owner = $owner; Detail = "Port $Port is occupied by $ownerName, but it did not return the BrightTales Unity /health identity. Nothing was stopped." }
}

function Get-BrightTalesStudioEndpoint {
    param([int]$Port, [string]$ExpectedWorkspace)
    $url = "http://127.0.0.1:$Port/"
    $page = Get-LocalHttpResponse -Url $url
    if (-not $page -or $page.StatusCode -ne 200 -or $page.Body -notmatch '(?is)<title>[^<]*(BrightSenAppsTales|BrightTales|Cartoon Maker)') { return $null }

    $healthResponse = Get-LocalHttpResponse -Url "http://127.0.0.1:$Port/__brighttales_review/health"
    if (-not $healthResponse -or $healthResponse.StatusCode -ne 200) {
        return [pscustomobject]@{ Url = $url; Port = $Port; Mode = 'unknown'; BridgePort = $null; Workspace = $null; IdentityValid = $false }
    }
    try { $health = $healthResponse.Body | ConvertFrom-Json } catch { $health = $null }
    if (-not $health -or $health.service -ne 'brighttales-studio' -or [int]$health.protocol -ne 1) {
        return [pscustomobject]@{ Url = $url; Port = $Port; Mode = 'unknown'; BridgePort = $null; Workspace = $null; IdentityValid = $false }
    }

    $bridgePort = [int]$health.unityBridgePort
    $mode = [string]$health.mode
    $workspaceMatches = $false
    if ($health.workspace -and $ExpectedWorkspace) {
        $left = [System.IO.Path]::GetFullPath([string]$health.workspace).TrimEnd('\')
        $right = [System.IO.Path]::GetFullPath($ExpectedWorkspace).TrimEnd('\')
        $workspaceMatches = $left.Equals($right,[System.StringComparison]::OrdinalIgnoreCase)
    }

    # Verify the app compiled the bridge URL the readiness endpoint claims to use.
    $devModule = Get-LocalHttpResponse -Url "http://127.0.0.1:$Port/src/unityBridge.ts"
    if ($devModule -and $devModule.StatusCode -eq 200) {
        $mode = 'development'
        if ($devModule.Body -match '===\s*["''](17843|17844)["'']\s*\?\s*["'']http://127\.0\.0\.1:(17843|17844)["'']\s*:\s*["'']http://127\.0\.0\.1:(17843|17844)') {
            $bridgePort = [int]$Matches[2]
        } else { $bridgePort = $null }
    } else {
        $mode = 'production'
        $assetPaths = [regex]::Matches($page.Body, 'src=["''](?<path>/assets/[^"'']+\.js)["'']')
        $compiledPort = $null
        foreach ($asset in $assetPaths) {
            $assetResponse = Get-LocalHttpResponse -Url "http://127.0.0.1:$Port$($asset.Groups['path'].Value)"
            if (-not $assetResponse) { continue }
            if ($assetResponse.Body -match '===\s*["'']17844["'']\s*\?\s*["'']http://127\.0\.0\.1:17844["'']') { $compiledPort = 17844; break }
            if ($assetResponse.Body -match '===\s*["'']17843["'']\s*\?\s*["'']http://127\.0\.0\.1:17844["'']') { $compiledPort = 17844; break }
            if ($assetResponse.Body -match '17843') { $compiledPort = 17843; break }
        }
        $bridgePort = $compiledPort
    }
    return [pscustomobject]@{ Url = $url; Port = $Port; Mode = $mode; BridgePort = $bridgePort; Workspace = [string]$health.workspace; IdentityValid = $workspaceMatches }
}

function Get-StudioCandidatePorts {
    param([int]$PreferredPort)
    $ports = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($port in (@($PreferredPort) + @(4177..4181) + @(5173..5183))) { [void]$ports.Add([int]$port) }
    try {
        $studioProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match '(?i)scripts[\\/]studio\.cjs' }
        $studioIds = @($studioProcesses | ForEach-Object { [int]$_.ProcessId })
        if (@($studioIds).Count -gt 0) {
            Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $studioIds -contains [int]$_.OwningProcess } | ForEach-Object { [void]$ports.Add([int]$_.LocalPort) }
        }
    } catch { }
    return @($ports | Sort-Object)
}

function Find-BrightTalesStudioInstances {
    param([int]$PreferredPort)
    $instances = New-Object System.Collections.Generic.List[object]
    foreach ($port in (Get-StudioCandidatePorts -PreferredPort $PreferredPort)) {
        $endpoint = Get-BrightTalesStudioEndpoint -Port $port -ExpectedWorkspace $script:ReviewExpectedStudioPath
        if ($endpoint) { $instances.Add($endpoint) }
    }
    return @($instances.ToArray())
}

function Get-BrightTalesUnityProjectProcess {
    param([string]$UnityProjectPath, [object[]]$ProcessSnapshot)
    if ($null -eq $ProcessSnapshot) {
        try { $ProcessSnapshot = @(Get-CimInstance Win32_Process -Filter "Name='Unity.exe'" -ErrorAction Stop) }
        catch { return [pscustomobject]@{ State = 'unknown'; ProcessId = $null; Detail = 'Unity process identity could not be queried.' } }
    }
    $normalPath = [System.IO.Path]::GetFullPath($UnityProjectPath).TrimEnd('\').Replace('/','\')
    foreach ($process in $ProcessSnapshot) {
        if ($process.Name -ne 'Unity.exe' -or -not $process.CommandLine) { continue }
        $commandLine = $process.CommandLine.Replace('/','\')
        if ($commandLine.IndexOf($normalPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and $commandLine -match '(?i)-projectPath') {
            return [pscustomobject]@{ State = 'running'; ProcessId = [int]$process.ProcessId; Detail = "Unity already has this project open (PID $($process.ProcessId)); it will be reused." }
        }
    }
    return [pscustomobject]@{ State = 'not-running'; ProcessId = $null; Detail = 'No Unity Editor process for this project was found.' }
}

function Get-ReviewGitState {
    param([string]$Path, [string]$ExpectedBranch)
    # Do not pipe native Git output through Select-Object: PowerShell can close
    # the pipe early, leaving git with exit code -1 even when it succeeded.
    $branchOutput = @(& git -C $Path branch --show-current 2>$null)
    $gitExitCode = $LASTEXITCODE
    $branch = if ($branchOutput.Count -gt 0) { [string]$branchOutput[0] } else { '' }
    if ($gitExitCode -ne 0 -or -not $branch) { return [pscustomobject]@{ Status = 'BLOCK'; Detail = 'Git branch could not be read.' } }
    if ($branch.Trim() -ne $ExpectedBranch) { return [pscustomobject]@{ Status = 'BLOCK'; Detail = "Expected branch '$ExpectedBranch', found '$($branch.Trim())'." } }
    $status = (& git -C $Path status --short --branch 2>$null) -join "`n"
    $porcelain = (& git -C $Path status --porcelain 2>$null) -join "`n"
    $detail = "Branch '$ExpectedBranch' is active."
    if ($porcelain) {
        $lines = @($porcelain -split "`n" | Where-Object { $_ })
        $knownUnitySettings = @('Assets/Settings/UniversalRenderPipelineGlobalSettings.asset','ProjectSettings/EditorBuildSettings.asset','ProjectSettings/Packages/com.unity.learn.iet-framework/Settings.json','ProjectSettings/ProjectAuditorSettings.asset','ProjectSettings/ShaderGraphSettings.asset')
        $onlyKnownSettings = $true
        foreach ($line in $lines) {
            $path = $line.Substring(3).Replace('\','/')
            if ($knownUnitySettings -notcontains $path) { $onlyKnownSettings = $false }
        }
        if ($onlyKnownSettings -and @($lines).Count -gt 0) { $detail += ' Known Unity settings edits are present and will be preserved.' }
        else { $detail += " $(@($lines).Count) modified/untracked paths are present; they are warnings only and will not be staged or reset." }
    }
    if ($status -match 'behind\s+\d+') { $detail += ' The branch is behind its upstream; review before using this workspace.' }
    return [pscustomobject]@{ Status = 'PASS'; Detail = $detail }
}

function Get-VoiceServiceReadiness {
    foreach ($port in 8766..8770) {
        $response = Get-LocalHttpResponse -Url "http://127.0.0.1:$port/voice-api/health" -TimeoutMilliseconds 500
        if (-not $response -or $response.StatusCode -ne 200) { continue }
        try { $health = $response.Body | ConvertFrom-Json } catch { continue }
        if ($health.service -eq 'BrightTalesVoiceMaker' -and [int]$health.protocol -eq 2) {
            return [pscustomobject]@{ Ready = ($health.state -eq 'ready'); Port = $port; State = $health.state; Detail = "BrightTales local voice service identity verified on port $port ($($health.state))." }
        }
    }
    return [pscustomobject]@{ Ready = $false; Port = $null; State = 'not-running'; Detail = 'No BrightTales voice service is ready yet. Studio manages its local voice service when launched; installed models may still be loading or unavailable.' }
}

function Get-BrightTalesReviewPreflight {
    [CmdletBinding()]
    param(
        [string]$StudioPath = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
        [string]$UnityPath = 'C:\Users\karlr\repos\BrightTalesUnityFoundationIntegration',
        [string]$UnityExePath = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe',
        [string]$ExpectedStudioBranch = 'main',
        [string]$ExpectedUnityBranch = 'cartoon-foundation',
        [int]$BridgePort = 17844,
        [int]$StudioPort = 5177,
        [string]$NodeModulesPath,
        [object[]]$UnityProcessSnapshot
    )
    $checks = New-Object 'System.Collections.Generic.List[object]'
    $StudioPath = [System.IO.Path]::GetFullPath($StudioPath)
    $UnityPath = [System.IO.Path]::GetFullPath($UnityPath)
    $script:ReviewExpectedStudioPath = $StudioPath
    $modulesPath = if ($NodeModulesPath) { $NodeModulesPath } else { Join-Path $StudioPath 'node_modules' }

    $studioExists = Test-Path -LiteralPath $StudioPath -PathType Container
    Add-ReviewCheck $checks 'Studio workspace' $(if ($studioExists) {'PASS'} else {'BLOCK'}) "Studio path: $StudioPath"
    $unityExists = Test-Path -LiteralPath $UnityPath -PathType Container
    Add-ReviewCheck $checks 'Unity workspace' $(if ($unityExists) {'PASS'} else {'BLOCK'}) "Unity path: $UnityPath"

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    $toolsReady = ($null -ne $node -and $null -ne $npm)
    Add-ReviewCheck $checks 'Node.js and npm' $(if ($toolsReady) {'PASS'} else {'BLOCK'}) $(if ($toolsReady) {"Node: $($node.Source); npm: $($npm.Source)"} else {'Install Node.js LTS with npm, then rerun preflight.'})

    $studioFilesReady = $studioExists -and (Test-Path -LiteralPath (Join-Path $StudioPath 'package.json')) -and
        (Test-Path -LiteralPath (Join-Path $StudioPath 'src/unityBridge.ts')) -and
        (Test-Path -LiteralPath (Join-Path $StudioPath 'scripts/studio.cjs'))
    Add-ReviewCheck $checks 'Studio scripts and bridge config' $(if ($studioFilesReady) {'PASS'} else {'BLOCK'}) 'Requires package.json, scripts/studio.cjs and src/unityBridge.ts.'

    $depsReady = (Test-Path -LiteralPath (Join-Path $modulesPath 'react/package.json')) -and
        (Test-Path -LiteralPath (Join-Path $modulesPath 'vite/package.json')) -and
        (Test-Path -LiteralPath (Join-Path $modulesPath '.bin/vite.cmd'))
    Add-ReviewCheck $checks 'Studio dependencies' $(if ($depsReady) {'PASS'} else {'BLOCK'}) $(if ($depsReady) {'React and Vite dependencies are installed.'} else {"Dependencies are missing under '$modulesPath'. Do not reinstall from this launcher; restore the workspace's approved dependencies separately."})

    $unityScene = Join-Path $UnityPath 'Assets/Scenes/StudioLivingRoomExperimental.unity'
    $unityStructure = $unityExists -and (Test-Path -LiteralPath (Join-Path $UnityPath 'Packages/manifest.json')) -and
        (Test-Path -LiteralPath (Join-Path $UnityPath 'ProjectSettings/ProjectVersion.txt')) -and (Test-Path -LiteralPath $unityScene)
    Add-ReviewCheck $checks 'Unity project and review scene' $(if ($unityStructure) {'PASS'} else {'BLOCK'}) $(if ($unityStructure) {"Unity 6 project and scene exist: Assets/Scenes/StudioLivingRoomExperimental.unity"} else {'Unity manifest, version or requested review scene is missing.'})

    $unityExeExists = Test-Path -LiteralPath $UnityExePath -PathType Leaf
    Add-ReviewCheck $checks 'Unity Editor executable' $(if ($unityExeExists) {'PASS'} else {'BLOCK'}) "Unity executable: $UnityExePath"

    $studioGit = if ($studioExists) { Get-ReviewGitState -Path $StudioPath -ExpectedBranch $ExpectedStudioBranch } else { [pscustomobject]@{ Status='BLOCK'; Detail='Studio workspace is missing.' } }
    Add-ReviewCheck $checks 'Studio branch and working tree' $studioGit.Status $studioGit.Detail
    $unityGit = if ($unityExists) { Get-ReviewGitState -Path $UnityPath -ExpectedBranch $ExpectedUnityBranch } else { [pscustomobject]@{ Status='BLOCK'; Detail='Unity workspace is missing.' } }
    Add-ReviewCheck $checks 'Unity branch and working tree' $unityGit.Status $unityGit.Detail

    $bridgeFile = if ($unityExists) { Join-Path $UnityPath 'Assets/BrightTalesBridgeV0.cs' } else { '' }
    $bridgeConfigured = $bridgeFile -and (Test-Path -LiteralPath $bridgeFile) -and ((Get-Content -LiteralPath $bridgeFile -Raw) -match 'BRIGHTTALES_UNITY_BRIDGE_PORT') -and ((Get-Content -LiteralPath $bridgeFile -Raw) -match "$BridgePort")
    Add-ReviewCheck $checks 'Unity bridge port config' $(if ($bridgeConfigured) {'PASS'} else {'BLOCK'}) "Unity bridge source supports BRIGHTTALES_UNITY_BRIDGE_PORT=$BridgePort."

    $bridge = Get-BrightTalesUnityBridgeStatus -Port $BridgePort
    $bridgeState = switch ($bridge.State) { 'free' { 'PASS' } 'ready' { 'PASS' } 'unity-not-ready' { 'WARN' } default { 'BLOCK' } }
    Add-ReviewCheck $checks 'Unity bridge port identity' $bridgeState $bridge.Detail

    $unityProcess = Get-BrightTalesUnityProjectProcess -UnityProjectPath $UnityPath -ProcessSnapshot $UnityProcessSnapshot
    Add-ReviewCheck $checks 'Unity Editor process' $(if ($unityProcess.State -eq 'running') {'PASS'} elseif ($unityProcess.State -eq 'unknown') {'BLOCK'} else {'PASS'}) $unityProcess.Detail
    if ($bridge.State -in @('ready','unity-not-ready')) {
        $ownerCommand = if ($bridge.Owner) { [string]$bridge.Owner.CommandLine } else { '' }
        $normalUnity = $UnityPath.TrimEnd('\').Replace('/','\')
        if (-not $bridge.Owner -or $bridge.Owner.Name -ne 'Unity.exe' -or -not $ownerCommand -or $ownerCommand.Replace('/','\').IndexOf($normalUnity,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            Add-ReviewCheck $checks 'Bridge project match' 'BLOCK' 'The Unity endpoint is responsive but its owning Editor/project cannot be confirmed as this review workspace. Do not send review content to it; stop Play mode in its own Unity window, then rerun.'
        } else { Add-ReviewCheck $checks 'Bridge project match' 'PASS' "Bridge owner is the requested Unity project (PID $($bridge.Owner.ProcessId))." }
    }

    $studioInstances = if ($studioExists) { @(Find-BrightTalesStudioInstances -PreferredPort $StudioPort) } else { @() }
    $compatibleStudios = @($studioInstances | Where-Object { $_.IdentityValid -and $_.BridgePort -eq $BridgePort })
    $incompatibleStudios = @($studioInstances | Where-Object { -not $_.IdentityValid -or $_.BridgePort -ne $BridgePort })
    $existingStudioUrl = $null
    if (@($incompatibleStudios).Count -gt 0) {
        $urls = (@($incompatibleStudios | ForEach-Object { $_.Url }) -join ', ')
        Add-ReviewCheck $checks 'Studio instance' 'BLOCK' "BrightTales Studio server(s) need a normal close before reuse: $urls. At each server's own console press Ctrl+C; no process was stopped."
    } elseif (@($compatibleStudios).Count -gt 1) {
        Add-ReviewCheck $checks 'Studio instance' 'BLOCK' 'Multiple compatible Studio servers are already running. Close extra Studio windows normally and retry to avoid duplicate local services.'
    } elseif (@($compatibleStudios).Count -eq 1) {
        $existingStudioUrl = $compatibleStudios[0].Url
        Add-ReviewCheck $checks 'Studio instance' 'PASS' "Compatible Studio server detected and will be reused at $existingStudioUrl"
    } else {
        $preferredBusy = Test-TcpPortListening -Port $StudioPort
        Add-ReviewCheck $checks 'Studio launch port' $(if ($preferredBusy) {'BLOCK'} else {'PASS'}) $(if ($preferredBusy) {"Studio port $StudioPort is occupied by an unidentified service. Nothing was stopped; free that port or review the application using it."} else {"Studio port $StudioPort is free for the dedicated review server."})
    }
    $studioProcess = $false
    try { $studioProcess = [bool](Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match '(?i)scripts[\\/]studio\.cjs' } | Select-Object -First 1) } catch { }
    if ($studioProcess -and @($studioInstances).Count -eq 0) {
        Add-ReviewCheck $checks 'Studio process readiness' 'BLOCK' 'A Studio server process exists but its application endpoint is not ready. Wait for startup or inspect its console before retrying; a duplicate was not started.'
    }

    $voice = Get-VoiceServiceReadiness
    Add-ReviewCheck $checks 'Local voice service' $(if ($voice.Ready) {'PASS'} else {'WARN'}) $voice.Detail

    $blocks = @($checks | Where-Object Status -eq 'BLOCK').Count
    $warnings = @($checks | Where-Object Status -eq 'WARN').Count
    return [pscustomobject]@{
        Checks = @($checks.ToArray()); BlockingCount = $blocks; WarningCount = $warnings
        StudioUrl = $existingStudioUrl; StudioPort = $StudioPort; BridgePort = $BridgePort
        StudioPath = $StudioPath; UnityPath = $UnityPath; UnityExePath = $UnityExePath
        UnityProcess = $unityProcess; UnityBridge = $bridge; Voice = $voice
    }
}

function Get-BrightTalesReviewLaunchPlan {
    param([Parameter(Mandatory=$true)]$Preflight)
    if ($Preflight.BlockingCount -gt 0) { return [pscustomobject]@{ CanLaunch=$false; StartStudio=$false; StartUnity=$false; OpenBrowser=$false; Url=$null } }
    return [pscustomobject]@{
        CanLaunch = $true
        StartStudio = [string]::IsNullOrWhiteSpace($Preflight.StudioUrl)
        StartUnity = ($Preflight.UnityProcess.State -ne 'running')
        OpenBrowser = $true
        Url = $Preflight.StudioUrl
    }
}

function Wait-BrightTalesStudioReady {
    param([int]$Port = 5177, [int]$BridgePort = 17844, [int]$TimeoutSeconds = 90, [int]$PollMilliseconds = 1000, [string]$ExpectedWorkspace = $script:ReviewExpectedStudioPath)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $endpoint = Get-BrightTalesStudioEndpoint -Port $Port -ExpectedWorkspace $ExpectedWorkspace
        if ($endpoint -and $endpoint.IdentityValid -and $endpoint.BridgePort -eq $BridgePort) { return $endpoint }
        Start-Sleep -Milliseconds $PollMilliseconds
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Studio did not become ready at http://127.0.0.1:$Port/ with Unity bridge $BridgePort. Check its launcher window/log."
}

function ConvertTo-BrightTalesNativeArgument {
    param([Parameter(Mandatory=$true)][AllowEmptyString()][string]$Value)
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (2 * $slashes + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * (2 * $slashes))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Write-BrightTalesReviewSummary {
    param([Parameter(Mandatory=$true)]$Preflight)
    foreach ($check in $Preflight.Checks) {
        $color = switch ($check.Status) { 'PASS' { 'Green' } 'WARN' { 'Yellow' } default { 'Red' } }
        Write-Host ("[{0}] {1}: {2}" -f $check.Status,$check.Name,$check.Detail) -ForegroundColor $color
    }
    Write-Host ("Summary: {0} passed, {1} warning(s), {2} blocker(s)." -f @($Preflight.Checks | Where-Object Status -eq 'PASS').Count,$Preflight.WarningCount,$Preflight.BlockingCount)
}

Export-ModuleMember -Function Get-BrightTalesReviewPreflight, Get-BrightTalesUnityBridgeStatus, Get-BrightTalesStudioEndpoint, Get-BrightTalesUnityProjectProcess, Get-BrightTalesReviewLaunchPlan, Wait-BrightTalesStudioReady, ConvertTo-BrightTalesNativeArgument, Write-BrightTalesReviewSummary
