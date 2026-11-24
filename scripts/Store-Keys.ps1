<#
.SYNOPSIS
  Gestisce le credenziali con cui le release inviano l'estensione agli store.

.DESCRIPTION
  Le credenziali restano solo su questo PC, cifrate con DPAPI di Windows per l'utente
  corrente: %APPDATA%\JesseArchive-Release\store-keys.dpapi. Publish-Release.ps1 le
  decifra in memoria e le passa a scripts\publish-store-extension.mjs, che dopo ogni
  release invia l'estensione al Chrome Web Store e ad addons.mozilla.org solo se il
  suo codice è cambiato. Non vanno mai nel repository, nei log o in chat.

.PARAMETER SetChrome
  File JSON della chiave del service account Google (Chrome Web Store API). Dopo il
  salvataggio il file originale si può (e conviene) cancellare.
.PARAMETER PublisherId
  ID publisher del Chrome Web Store (Dashboard > Impostazioni), con -SetChrome.
.PARAMETER SetFirefox
  Chiede issuer ("Emittente JWT") e secret ("Segreto JWT") di addons.mozilla.org.
.PARAMETER Status
  Indica quali credenziali sono salvate, senza mostrare i segreti.
.PARAMETER Check
  Verifica le credenziali con chiamate in sola lettura e mostra lo stato negli store.
.PARAMETER MarkSubmitted
  chrome o firefox: dopo un invio fatto a mano, segna il codice attuale come già
  inviato, così la release successiva non rimanda lo stesso codice.
.PARAMETER Remove
  chrome, firefox o all: cancella le credenziali indicate.

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Store-Keys.ps1 -SetChrome "$env:USERPROFILE\Downloads\chiave.json" -PublisherId 2be302aa-...
.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Store-Keys.ps1 -SetFirefox
#>
param(
    [string]$SetChrome = '',
    [string]$PublisherId = '',
    [switch]$SetFirefox,
    [switch]$Status,
    [switch]$Check,
    [ValidateSet('', 'chrome', 'firefox')][string]$MarkSubmitted = '',
    [ValidateSet('', 'chrome', 'firefox', 'all')][string]$Remove = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$repo = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $env:APPDATA 'JesseArchive-Release'
$keyFile = Join-Path $folder 'store-keys.dpapi'
$stateFile = Join-Path $folder 'store-state.json'
$publisher = Join-Path $PSScriptRoot 'publish-store-extension.mjs'

function Read-Keys {
    if (-not (Test-Path -LiteralPath $keyFile)) { return [pscustomobject]@{} }
    $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile), $null, 'CurrentUser')
    try { return ($utf8.GetString($bytes) | ConvertFrom-Json) } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}
function Write-Keys($keys) {
    New-Item -ItemType Directory -Force $folder | Out-Null
    $bytes = $utf8.GetBytes(($keys | ConvertTo-Json -Depth 6 -Compress))
    try {
        $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
        [IO.File]::WriteAllBytes($keyFile, $protected)
    } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}
function Read-Secret([string]$prompt) {
    $secure = Read-Host -Prompt $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Set-Key($keys, [string]$name, $value) {
    if ($keys.PSObject.Properties[$name]) { $keys.$name = $value } else { $keys | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}

if ($SetChrome) {
    if (-not $PublisherId) { throw 'Indica anche -PublisherId (Dashboard del Chrome Web Store > Impostazioni).' }
    if ($PublisherId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { throw "ID publisher non valido: $PublisherId" }
    $account = Get-Content -LiteralPath $SetChrome -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($account.type -ne 'service_account' -or -not $account.client_email -or -not $account.private_key) {
        throw 'Il file non è la chiave JSON di un service account (mancano type, client_email o private_key).'
    }
    $keys = Read-Keys
    Set-Key $keys 'chrome' ([pscustomobject]@{ serviceAccount = $account; publisherId = $PublisherId })
    Write-Keys $keys
    Write-Host "Credenziali del Chrome Web Store salvate per $($account.client_email)." -ForegroundColor Green
    Write-Host "Ora cancella il file originale: $SetChrome" -ForegroundColor Yellow
}
if ($SetFirefox) {
    $issuer = (Read-Host -Prompt 'Emittente JWT (JWT issuer) di addons.mozilla.org').Trim()
    $secret = Read-Secret 'Segreto JWT (JWT secret) di addons.mozilla.org'
    if ($issuer -notmatch '^user:\d+:\d+$' -or $secret.Length -lt 32) { throw 'Issuer o secret non validi: copiali dalla pagina delle credenziali API di addons.mozilla.org.' }
    $keys = Read-Keys
    Set-Key $keys 'firefox' ([pscustomobject]@{ issuer = $issuer; secret = $secret })
    $secret = $null
    Write-Keys $keys
    Write-Host "Credenziali di addons.mozilla.org salvate per $issuer." -ForegroundColor Green
}
if ($Remove) {
    $keys = Read-Keys
    foreach ($name in @(if ($Remove -eq 'all') { 'chrome', 'firefox' } else { $Remove })) { $keys.PSObject.Properties.Remove($name) }
    Write-Keys $keys
    Write-Host "Credenziali rimosse: $Remove." -ForegroundColor Green
}
if ($MarkSubmitted) {
    & node $publisher --state $stateFile --mark $MarkSubmitted
    if ($LASTEXITCODE -ne 0) { throw 'Registrazione non riuscita.' }
}
if ($Status -or -not ($SetChrome -or $SetFirefox -or $Remove -or $MarkSubmitted -or $Check)) {
    $keys = Read-Keys
    if ($keys.chrome) { Write-Host "Chrome Web Store: service account $($keys.chrome.serviceAccount.client_email), publisher $($keys.chrome.publisherId)." }
    else { Write-Host 'Chrome Web Store: credenziali non salvate.' }
    if ($keys.firefox) { Write-Host "addons.mozilla.org: issuer $($keys.firefox.issuer), secret presente." }
    else { Write-Host 'addons.mozilla.org: credenziali non salvate.' }
    if (Test-Path -LiteralPath $stateFile) { Write-Host "Ultimi invii: $((Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json | ConvertTo-Json -Compress))" }
}
if ($Check) {
    $json = Read-Keys | ConvertTo-Json -Depth 6 -Compress
    Push-Location $repo
    try { $json | & node $publisher --state $stateFile --check } finally { Pop-Location; $json = $null }
    if ($LASTEXITCODE -ne 0) { throw 'Verifica delle credenziali non riuscita.' }
}
