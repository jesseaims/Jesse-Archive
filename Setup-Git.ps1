# JesseArchive - Git local setup (does not create commits or push)
[CmdletBinding()]
param([string]$RemoteUrl = '')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git non trovato. Installa Git for Windows: https://git-scm.com/downloads/win'
}
if (-not (Test-Path '.git')) {
    git init -b main
    if ($LASTEXITCODE -ne 0) { throw 'git init fallito' }
} else {
    Write-Host 'Repository Git locale gia presente: non verra reinizializzato.'
}
if ($RemoteUrl -ne '') {
    if ($RemoteUrl -notmatch '^https://github\.com/[^/]+/[^/]+(?:\.git)?$' -and $RemoteUrl -notmatch '^git@github\.com:[^/]+/[^/]+(?:\.git)?$') {
        throw 'URL remoto non valido. Usa https://github.com/UTENTE/REPOSITORY.git oppure git@github.com:UTENTE/REPOSITORY.git'
    }
    $old = git remote get-url origin 2>$null
    if ($LASTEXITCODE -eq 0) {
        if ($old.Trim() -ne $RemoteUrl.Trim()) {
            throw "origin e gia configurato su $old; controlla prima di cambiarlo"
        }
        Write-Host "Origin gia configurato: $old"
    } else {
        git remote add origin $RemoteUrl
        if ($LASTEXITCODE -ne 0) { throw 'Impossibile configurare origin' }
        Write-Host "Origin configurato: $RemoteUrl"
    }
}
Write-Host "`nFile disponibili (nessuno aggiunto all'index):"
git status --short --untracked-files=normal
Write-Host "`nRemoti:"
git remote -v
Write-Host "`nGit pronto. Nessun commit, push o pubblicazione effettuati."
