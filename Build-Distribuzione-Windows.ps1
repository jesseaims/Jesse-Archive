param(
    [ValidateSet('exe','msi','both')]
    [string]$Formato = 'exe',
    [switch]$SkipNpmInstall
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Solo la sessione corrente: correzione difensiva del PATH/PATHEXT.
$nodeDir = 'C:\Program Files\nodejs'
if ((Test-Path (Join-Path $nodeDir 'node.exe')) -and -not (($env:Path -split ';') -contains $nodeDir)) {
    $env:Path = "$nodeDir;$env:Path"
}
if (-not ($env:PATHEXT -split ';' | Where-Object { $_ -ieq '.EXE' })) {
    $env:PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC'
}
foreach ($command in @('node','npm','cargo')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Dipendenza non trovata sul PC di compilazione: $command"
    }
}
$running = Get-Process -Name 'jesse_archive' -ErrorAction SilentlyContinue
if ($running) {
    throw "JesseArchive risulta in esecuzione. Chiudilo completamente (anche dal tray), poi riprova."
}
function Run-Step([string]$label, [scriptblock]$command) {
    Write-Host "`n==> $label" -ForegroundColor Cyan
    & $command
    if ($LASTEXITCODE -ne 0) { throw "Fallito: $label (exit code $LASTEXITCODE)" }
}
if (-not $SkipNpmInstall) {
    Run-Step 'Dipendenze npm' { npm install }
}
Run-Step 'Test Rust e fixture legacy' { cargo test --manifest-path 'src-tauri/Cargo.toml' }
Run-Step 'Verifica TypeScript e build frontend' { npm run build }
if ($Formato -eq 'exe' -or $Formato -eq 'both') {
    Run-Step 'Creazione setup EXE NSIS con WebView2 OFFLINE' { npm run tauri -- build --bundles nsis }
}
if ($Formato -eq 'msi' -or $Formato -eq 'both') {
    Run-Step 'Creazione MSI con WebView2 OFFLINE' { npm run tauri -- build --bundles msi }
}
Write-Host "`nPacchetti creati in src-tauri\target\release\bundle\" -ForegroundColor Green
Get-ChildItem 'src-tauri/target/release/bundle' -Recurse -File -Include '*.exe','*.msi' |
  Where-Object { $_.FullName -notmatch '\\nsis\\x64\\' } |
  Select-Object FullName,Length | Format-Table -AutoSize
Write-Host 'Esegui il test di installazione offline su un secondo PC/VM prima di distribuire.' -ForegroundColor Yellow
