param(
    [switch]$SkipNpmInstall
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$project = $PSScriptRoot
$release = Join-Path $project 'src-tauri\target\release'
$payloadFolder = Join-Path $project 'installer\payload'
$outFolder = Join-Path $project 'src-tauri\target\release\bundle\distributable'
$webView2 = Join-Path $payloadFolder 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
# Same official Microsoft link Tauri uses for the offline (standalone) x64 runtime.
$webView2Url = 'https://go.microsoft.com/fwlink/?linkid=2124701'

# Inno Setup is the only installer (Beta 1.2.0+): it installs the program, the browser
# component and, when missing, WebView2; it replaces the old MSI install and uninstalls.
$innoCandidates = @(
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
    'C:\Program Files\Inno Setup 7\ISCC.exe'
) | Where-Object { $_ -and (Test-Path $_) }
$iscc = $innoCandidates | Select-Object -First 1
if (-not $iscc) {
    throw 'Inno Setup 7 non trovato (serve per lo stile dell''installer). Installalo da https://jrsoftware.org/isinfo.php e riprova.'
}

$nodeDir = 'C:\Program Files\nodejs'
# Only when node is not already reachable: on CI runners the configured Node
# version must not be shadowed by a different system-wide install.
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $nodeDir 'node.exe'))) { $env:Path = "$nodeDir;$env:Path" }
if (-not ($env:PATHEXT -split ';' | Where-Object { $_ -ieq '.EXE' })) {
    $env:PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC'
}
$running = Get-Process -Name 'jesse_archive' -ErrorAction SilentlyContinue
if ($running) { throw 'Chiudi completamente JesseArchive (anche dal tray) prima di compilare.' }

Write-Host '==> Test + compilazione applicazione' -ForegroundColor Cyan
$buildStart = Get-Date
& (Join-Path $project 'Build-Distribuzione-Windows.ps1') -Formato app -SkipNpmInstall:$SkipNpmInstall
if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "Compilazione fallita con exit code $LASTEXITCODE" }
foreach ($name in 'jesse_archive.exe', 'jesse_browser_host.exe') {
    $file = Get-Item -LiteralPath (Join-Path $release $name) -ErrorAction SilentlyContinue
    if (-not $file -or $file.LastWriteTime -lt $buildStart.AddMinutes(-2)) {
        throw "File compilato mancante o non aggiornato: $name"
    }
}

Write-Host '==> WebView2 offline per l''installer' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $payloadFolder, $outFolder | Out-Null
if (-not (Test-Path -LiteralPath $webView2)) {
    Write-Host "Scarico il runtime WebView2 offline da Microsoft: $webView2Url"
    $partial = "$webView2.partial"
    Invoke-WebRequest -Uri $webView2Url -OutFile $partial -UseBasicParsing
    Move-Item -LiteralPath $partial -Destination $webView2 -Force
}
$signature = Get-AuthenticodeSignature -LiteralPath $webView2
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    Remove-Item -LiteralPath $webView2 -Force
    throw "Installer WebView2 non firmato da Microsoft ($($signature.Status)): eliminato, riprova la build."
}
if ((Get-Item -LiteralPath $webView2).Length -lt 100MB) {
    throw 'Installer WebView2 troppo piccolo: non sembra la versione offline completa.'
}
# The pre-1.2.0 MSI payload is no longer used.
Remove-Item -LiteralPath (Join-Path $payloadFolder 'JesseArchive.msi') -Force -ErrorAction SilentlyContinue

Write-Host '==> Creo il setup EXE con Inno Setup' -ForegroundColor Cyan
$iss = Join-Path $project 'installer\JesseArchive-Setup.iss'
& $iscc $iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup ha fallito con codice $LASTEXITCODE" }
$exe = Join-Path $outFolder 'JesseArchive-Setup.exe'
if (-not (Test-Path $exe)) { throw "Setup .exe non creato nel percorso atteso: $exe" }
Compress-Archive -Path (Join-Path $project 'browser-extension/chromium/*') -DestinationPath (Join-Path $outFolder 'JesseArchive-Chromium.zip') -Force
Compress-Archive -Path (Join-Path $project 'browser-extension/firefox/*') -DestinationPath (Join-Path $outFolder 'JesseArchive-Firefox-unsigned.zip') -Force
Copy-Item -LiteralPath (Join-Path $project 'BROWSER-INTEGRATION.md') -Destination (Join-Path $outFolder 'BROWSER-INTEGRATION.md') -Force
Write-Host "`nSetup generato: $exe" -ForegroundColor Green
Write-Host 'ATTENZIONE: collaudare installazione, aggiornamento e disinstallazione offline su VM/PC di prova.' -ForegroundColor Yellow
Write-Host 'La firma digitale non è inclusa: Windows SmartScreen può mostrare un avviso.' -ForegroundColor Yellow
