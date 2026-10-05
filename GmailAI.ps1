param(
    [Parameter(Mandatory=$true)]
    [ValidateSet(
        "setup",
        "add-delete",
        "remove-delete",
        "add-protected",
        "remove-protected"
    )]
    [string]$Action,

    [string]$Value
)

$ErrorActionPreference = "Stop"

$ConfigDir = Join-Path $env:LOCALAPPDATA "GmailAIManager"
$KeyFile   = Join-Path $ConfigDir "apikey.txt"
$UrlFile   = Join-Path $ConfigDir "webapp.txt"

function Setup-GmailAIManager {
    New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

    $url = Read-Host "Apps Script Web App URL"
    $key = Read-Host "API key" -AsSecureString

    $key | ConvertFrom-SecureString | Set-Content $KeyFile
    $url | Set-Content $UrlFile

    Write-Host "Gmail AI Manager configured."
}

if ($Action -eq "setup") {
    Setup-GmailAIManager
    exit
}

if (-not (Test-Path $KeyFile) -or -not (Test-Path $UrlFile)) {
    throw "Gmail AI Manager is not configured. Run: .\GmailAI.ps1 setup"
}

if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "A sender or domain is required."
}

$secureKey = Get-Content $KeyFile | ConvertTo-SecureString
$credential = New-Object System.Management.Automation.PSCredential("unused", $secureKey)
$apiKey = $credential.GetNetworkCredential().Password

$url = (Get-Content $UrlFile -Raw).Trim()

$changes = @{
    addDelete       = @()
    removeDelete    = @()
    addProtected    = @()
    removeProtected = @()
}

switch ($Action) {
    "add-delete"       { $changes.addDelete       = @($Value) }
    "remove-delete"    { $changes.removeDelete    = @($Value) }
    "add-protected"    { $changes.addProtected    = @($Value) }
    "remove-protected" { $changes.removeProtected = @($Value) }
}

$body = @{
    apiKey  = $apiKey
    action  = "applyRuleChanges"
    changes = $changes
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod `
        -Uri $url `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    $response | ConvertTo-Json -Depth 10

    if (-not $response.success) {
        exit 1
    }
}
finally {
    # Don't retain the plaintext key variable longer than necessary.
    $apiKey = $null
    $body = $null
}