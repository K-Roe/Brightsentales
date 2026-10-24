param([Parameter(Mandatory=$true)][string]$ProjectPath)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$project = [IO.Path]::GetFullPath($ProjectPath)
$temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
if (-not $project.StartsWith($temp + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The test project must be a disposable copy under the OS temp directory.'
}
$source = Join-Path $PSScriptRoot 'BridgeFixPlayModeTest.cs'
Copy-Item -LiteralPath $source -Destination (Join-Path $project 'Assets/BridgePlayTests/BridgeFixPlayModeTest.cs') -Force
foreach ($name in @('fix-ready.txt', 'fix-complete.txt', 'fix-results.xml')) {
    $path = Join-Path $project $name
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}
$unity = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe'
$arguments = @('-batchmode', '-projectPath', ('"' + $project + '"'), '-runTests', '-testPlatform', 'playmode', '-testResults', ('"' + (Join-Path $project 'fix-results.xml') + '"'), '-logFile', ('"' + (Join-Path $project 'fix-unity-final.log') + '"'))
$process = Start-Process -FilePath $unity -ArgumentList $arguments -WindowStyle Hidden -PassThru
Write-Output "Unity test PID: $($process.Id)"
$ready = Join-Path $project 'fix-ready.txt'
for ($index = 0; $index -lt 480 -and -not (Test-Path -LiteralPath $ready); $index++) {
    if ($process.HasExited) { throw 'Unity exited before the Play mode scene was ready.' }
    Start-Sleep -Milliseconds 250
}
if (-not (Test-Path -LiteralPath $ready)) { throw 'Unity did not enter the MaxBridgeDemo Play mode test.' }

$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.UseProxy = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(5)
$base = 'http://127.0.0.1:17844'
function Invoke-Bridge([string]$label, [string]$method, [string]$path) {
    $httpMethod = if ($method -eq 'Post') { [System.Net.Http.HttpMethod]::Post } else { [System.Net.Http.HttpMethod]::Get }
    $request = [System.Net.Http.HttpRequestMessage]::new($httpMethod, $base + $path)
    if ($method -eq 'Post') {
        $request.Content = [System.Net.Http.StringContent]::new('{"command":"max.blink"}', [Text.Encoding]::UTF8, 'application/json')
    }
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        try {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            return "$label $([int]$response.StatusCode) $body"
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}
$results = @()
try {
    $results += Invoke-Bridge 'connect' 'Get' '/health'
    $results += Invoke-Bridge 'ping' 'Get' '/ping'
    $results += Invoke-Bridge 'blink-1' 'Post' '/command'
    $results += Invoke-Bridge 'busy-repeat' 'Post' '/command'
    Start-Sleep -Milliseconds 350
    $results += Invoke-Bridge 'blink-2' 'Post' '/command'
    Start-Sleep -Milliseconds 350
    $results += Invoke-Bridge 'reconnect' 'Get' '/health'
    $results += Invoke-Bridge 'ping-after' 'Get' '/ping'
} finally { $client.Dispose(); $handler.Dispose() }
$results | Set-Content -LiteralPath (Join-Path $project 'fix-http-results.txt') -Encoding utf8
$results
