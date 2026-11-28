<#
.SYNOPSIS
  Gestisce il bot Discord "Jesse's Archive" con cui le release vengono annunciate.

.DESCRIPTION
  Token del bot e canale degli annunci restano solo su questo PC, cifrati con DPAPI per
  l'utente corrente: %APPDATA%\JesseArchive-Release\discord-bot.dpapi. Publish-Release.ps1
  li decifra in memoria e li passa a scripts\discord-announce.mjs dopo ogni release.
  Il token permette di scrivere come il bot: non va nel repository, nei log o in chat.

.PARAMETER Set
  Chiede il token del bot (portale sviluppatori Discord, Bot, Reset Token).
.PARAMETER Channel
  Con -Set: ID del canale degli annunci (tasto destro sul canale, Copia ID canale).
.PARAMETER Check
  Verifica bot e canale senza pubblicare nulla.
.PARAMETER Remove
  Cancella token e canale salvati.
#>
param([switch]$Set, [string]$Channel = '', [switch]$Check, [switch]$Remove)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$folder = Join-Path $env:APPDATA 'JesseArchive-Release'
$file = Join-Path $folder 'discord-bot.dpapi'
$repo = Split-Path -Parent $PSScriptRoot

function Read-Saved {
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($file), $null, 'CurrentUser')
    try { return [Text.Encoding]::UTF8.GetString($bytes) } finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

if ($Remove) {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    Write-Host 'Bot Discord cancellato da questo PC.' -ForegroundColor Green
    return
}
if ($Set) {
    $secure = Read-Host -Prompt 'Incolla il token del bot (clic destro per incollare, non vedrai nulla)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($token -notmatch '^[\w-]{20,100}\.[\w-]{4,20}\.[\w-]{20,100}$') { throw 'Il token non sembra valido: copialo di nuovo dal portale (Bot, poi Reset Token).' }
    if (-not $Channel) {
        $old = Read-Saved
        if ($old) { $Channel = ($old | ConvertFrom-Json).channel }
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes((@{ token = $token; channel = $Channel } | ConvertTo-Json -Compress))
    New-Item -ItemType Directory -Force $folder | Out-Null
    try {
        [IO.File]::WriteAllBytes($file, [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser'))
    } finally { [Array]::Clear($bytes, 0, $bytes.Length); $token = $null }
    Write-Host "Token salvato e cifrato in $file" -ForegroundColor Green
    if (-not $Channel) { Write-Host 'Canale degli annunci non ancora impostato.' -ForegroundColor Yellow; return }
    $Check = $true
}
if ($Check -or -not ($Set -or $Remove)) {
    $json = Read-Saved
    if (-not $json) { Write-Host 'Bot Discord non configurato.'; return }
    Push-Location $repo
    try { $json | & node scripts/discord-announce.mjs --check } finally { Pop-Location; $json = $null }
    if ($LASTEXITCODE -ne 0) { throw 'Verifica del bot non riuscita.' }
}
