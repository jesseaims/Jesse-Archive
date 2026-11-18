<#
.SYNOPSIS
  Gestisce la chiave Ed25519 che firma gli aggiornamenti automatici di Jesse's Archive.

.DESCRIPTION
  La chiave privata resta solo su questo PC, cifrata con DPAPI di Windows per
  l'utente corrente: %APPDATA%\JesseArchive-Release\update-signing-key.dpapi.
  La chiave pubblica è in src-tauri\update-public-key.txt ed è incorporata nell'app:
  le installazioni esistenti accettano solo aggiornamenti firmati con questa chiave.

  Se la chiave privata va persa (reinstallazione di Windows, altro account) gli
  aggiornamenti automatici si interrompono finché non si installa a mano una
  versione con una chiave nuova: conservare un backup con -Backup.

.PARAMETER Create
  Crea la chiave (rifiuta se esiste già) e scrive la chiave pubblica nel repository.
.PARAMETER Status
  Indica se la chiave esiste e se corrisponde a quella incorporata nell'app.
.PARAMETER Backup
  Esporta la chiave privata cifrata con una passphrase (minimo 12 caratteri).
.PARAMETER Restore
  Ripristina la chiave da un backup, solo se corrisponde alla chiave dell'app.

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Update-SigningKey.ps1 -Backup D:\chiave-aggiornamenti.pem
#>
param(
    [switch]$Create,
    [switch]$Status,
    [string]$Backup = '',
    [string]$Restore = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$repo = Split-Path -Parent $PSScriptRoot
$signer = Join-Path $PSScriptRoot 'update-signature.mjs'
$publicFile = Join-Path $repo 'src-tauri\update-public-key.txt'
$keyDir = Join-Path $env:APPDATA 'JesseArchive-Release'
$keyFile = Join-Path $keyDir 'update-signing-key.dpapi'

function Invoke-Signer([string[]]$arguments, [string]$stdin) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = $stdin | & node $signer @arguments 2>&1 }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "update-signature.mjs $($arguments[0]): $($out -join ' ')" }
    return ($out -join "`n")
}
function Save-PrivateKey([string]$pem) {
    New-Item -ItemType Directory -Force -Path $keyDir | Out-Null
    $protected = [System.Security.Cryptography.ProtectedData]::Protect($utf8.GetBytes($pem), $null, 'CurrentUser')
    [IO.File]::WriteAllBytes($keyFile, $protected)
}
function Get-PrivateKey {
    if (-not (Test-Path -LiteralPath $keyFile)) { throw "Chiave di firma assente: $keyFile" }
    $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile), $null, 'CurrentUser')
    return $utf8.GetString($bytes)
}
function Get-AppPublicKey {
    if (-not (Test-Path -LiteralPath $publicFile)) { return '' }
    return (Get-Content -LiteralPath $publicFile -Raw).Trim()
}
function Read-Passphrase([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if ($Create) {
    if (Test-Path -LiteralPath $keyFile) { throw "Esiste già una chiave di firma ($keyFile): non viene sostituita." }
    $pair = Invoke-Signer @('keygen') '' | ConvertFrom-Json
    Save-PrivateKey $pair.privatePem
    [IO.File]::WriteAllText($publicFile, "$($pair.publicKey)`n", $utf8)
    Write-Host "Chiave creata. Privata (DPAPI): $keyFile" -ForegroundColor Green
    Write-Host "Pubblica: $publicFile -> va committata con l'app."
    Write-Host 'Esegui ora un backup cifrato con -Backup <percorso> e conservalo fuori da questo PC.' -ForegroundColor Yellow
}
elseif ($Status) {
    if (-not (Test-Path -LiteralPath $keyFile)) { Write-Host "Chiave di firma assente su questo PC ($keyFile)." -ForegroundColor Yellow; exit 1 }
    $public = Invoke-Signer @('public') (Get-PrivateKey)
    if ($public -eq (Get-AppPublicKey)) { Write-Host 'Chiave presente e corrispondente a quella incorporata nell''app.' -ForegroundColor Green }
    else { Write-Host 'Chiave presente ma DIVERSA da src-tauri\update-public-key.txt: le release non sarebbero accettate.' -ForegroundColor Red; exit 1 }
}
elseif ($Backup) {
    if (Test-Path -LiteralPath $Backup) { throw "Il file $Backup esiste già: scegli un altro percorso." }
    $first = Read-Passphrase 'Passphrase del backup (minimo 12 caratteri)'
    $second = Read-Passphrase 'Ripeti la passphrase'
    if ($first -ne $second) { throw 'Le passphrase non coincidono.' }
    $payload = @{ pem = (Get-PrivateKey); passphrase = $first } | ConvertTo-Json -Compress
    $encrypted = Invoke-Signer @('encrypt') $payload
    [IO.File]::WriteAllText($Backup, "$encrypted`n", $utf8)
    Write-Host "Backup cifrato salvato in $Backup. Senza la passphrase non è recuperabile." -ForegroundColor Green
}
elseif ($Restore) {
    if (Test-Path -LiteralPath $keyFile) { throw "Esiste già una chiave su questo PC ($keyFile): non viene sostituita." }
    $passphrase = Read-Passphrase 'Passphrase del backup'
    $payload = @{ pem = (Get-Content -LiteralPath $Restore -Raw); passphrase = $passphrase } | ConvertTo-Json -Compress
    $pem = Invoke-Signer @('decrypt') $payload
    if ((Invoke-Signer @('public') $pem) -ne (Get-AppPublicKey)) { throw 'Il backup non corrisponde alla chiave incorporata nell''app: non ripristinato.' }
    Save-PrivateKey $pem
    Write-Host "Chiave ripristinata in $keyFile." -ForegroundColor Green
}
else {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
}
