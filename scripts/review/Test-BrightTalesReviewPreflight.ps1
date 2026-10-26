[CmdletBinding()]
param(
    [string]$StudioPath,
    [string]$UnityPath = 'C:\Users\karlr\repos\BrightTalesP10MakerUnity',
    [string]$UnityExePath = 'C:\Program Files\Unity\Hub\Editor\6000.6.7f1\Editor\Unity.exe',
    [string]$ExpectedBranch = 'brighttales-active-development',
    [int]$BridgePort = 17844,
    [int]$StudioPort = 5177,
    [string]$NodeModulesPath,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($StudioPath)) { $StudioPath = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
Import-Module (Join-Path $PSScriptRoot 'BrightTalesReview.psm1') -Force
$result = Get-BrightTalesReviewPreflight -StudioPath $StudioPath -UnityPath $UnityPath -UnityExePath $UnityExePath `
    -ExpectedBranch $ExpectedBranch -BridgePort $BridgePort -StudioPort $StudioPort -NodeModulesPath $NodeModulesPath

if ($Json) {
    $result | ConvertTo-Json -Depth 8
} else {
    Write-Host 'BrightTales P8-P11 Review Preflight' -ForegroundColor Cyan
    Write-BrightTalesReviewSummary -Preflight $result
}
if ($result.BlockingCount -gt 0) { exit 1 }
exit 0
