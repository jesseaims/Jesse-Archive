param(
    [switch]$SkipNpmInstall
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$project = $PSScriptRoot
$msiFolder = Join-Path $project 'src-tauri\target\release\bundle\msi'
$payloadFolder = Join-Path $project 'installer\payload'
$outFolder = Join-Path $project 'src-tauri\target\release\bundle\distributable'

# Tauri/MSI gestisce l'installazione e la disinstallazione.
# Inno Setup impacchetta SOLO l'MSI, senza cambiare il programma o il vault.
$innoCandidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
    'C:\Program Files\Inno Setup 7\ISCC.exe',
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
) | Where-Object { $_ -and (Test-Path $_) }
$iscc = $innoCandidates | Select-Object -First 1
if (-not $iscc) {
    throw 'Inno Setup non trovato. Installa Inno Setup da https://jrsoftware.org/isinfo.php e riprova.'
}

Write-Host '==> Test + build MSI OFFLINE tramite Tauri' -ForegroundColor Cyan
$oldPath = $env:Path
$nodeDir = 'C:\Program Files\nodejs'
if (Test-Path (Join-Path $nodeDir 'node.exe')) { $env:Path = "$nodeDir;$env:Path" }
if (-not ($env:PATHEXT -split ';' | Where-Object { $_ -ieq '.EXE' })) {
    $env:PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC'
}
$running = Get-Process -Name 'jesse_archive' -ErrorAction SilentlyContinue
if ($running) { throw 'Chiudi completamente JesseArchive (anche dal tray) prima di compilare.' }

$buildStart = Get-Date
& (Join-Path $project 'Build-Distribuzione-Windows.ps1') -Formato msi -SkipNpmInstall:$SkipNpmInstall
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "Build MSI fallita con exit code $LASTEXITCODE" }

$msi = Get-ChildItem -LiteralPath $msiFolder -Filter '*.msi' -File |
    Where-Object { $_.LastWriteTime -ge $buildStart.AddMinutes(-2) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msi) { throw "Nessun MSI recente prodotto in: $msiFolder" }
if ($msi.Length -lt 50000000) {
    throw "MSI troppo piccolo ($($msi.Length) byte). Verifica che WebView2 offline sia stato incluso."
}

# Check the MSI really exposes the INSTALLDIR directory. Otherwise the
# folder picker in the Inno EXE would be misleading and silently ignored.
Write-Host "==> Verifico che MSI supporti la cartella personalizzata (INSTALLDIR)" -ForegroundColor Cyan
$msiInstaller = $null; $msiDatabase = $null; $msiView = $null; $msiRow = $null
try {
    $msiInstaller = New-Object -ComObject WindowsInstaller.Installer
    $msiDatabase = $msiInstaller.OpenDatabase($msi.FullName, 0)
    $msiView = $msiDatabase.OpenView("SELECT ``Directory`` FROM ``Directory`` WHERE ``Directory`` = 'INSTALLDIR'")
    $msiView.Execute()
    $msiRow = $msiView.Fetch()
    if ($null -eq $msiRow) {
        throw 'MSI senza directory INSTALLDIR. La scelta della cartella non sarebbe applicata: build interrotta.'
    }
}
finally {
    if ($msiView) { try { $msiView.Close() } catch {} }
    foreach ($obj in @($msiRow, $msiView, $msiDatabase, $msiInstaller)) {
        if ($null -ne $obj) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) }
    }
}

New-Item -ItemType Directory -Force -Path $payloadFolder,$outFolder | Out-Null
$targetMsi = Join-Path $payloadFolder 'JesseArchive.msi'
Copy-Item -LiteralPath $msi.FullName -Destination $targetMsi -Force
Write-Host "==> Creo setup EXE autonomo da MSI offline: $($msi.Name)" -ForegroundColor Cyan
$iss = Join-Path $project 'installer\JesseArchive-Setup.iss'
& $iscc $iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup ha fallito con codice $LASTEXITCODE" }
$exe = Join-Path $outFolder 'JesseArchive-Setup-1.0.2-x64.exe'
if (-not (Test-Path $exe)) { throw "Setup .exe non creato nel percorso atteso: $exe" }
Write-Host "`nSetup generato: $exe" -ForegroundColor Green
Write-Host 'ATTENZIONE: collaudare installazione, aggiornamento e disinstallazione offline su VM/PC di prova.' -ForegroundColor Yellow
Write-Host 'La firma digitale non è inclusa: Windows SmartScreen può mostrare un avviso.' -ForegroundColor Yellow
