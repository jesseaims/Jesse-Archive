param(
    [switch]$SkipNpmInstall
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 draws a progress bar for every downloaded block: without this
# the ~180 MB WebView2 download took over 8 minutes on GitHub's runners.
$ProgressPreference = 'SilentlyContinue'
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
# Inno Setup 7 first: an older ISCC on the PATH (GitHub runners ship Inno Setup 6)
# lacks languages the installer uses, such as Chinese and Korean.
$innoCandidates = @(
    'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
    'C:\Program Files\Inno Setup 7\ISCC.exe',
    (Get-Command ISCC.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
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
# A verified copy is kept per user, outside the working copy, so every build (also the
# release automation, which builds in a fresh folder each time) reuses it instead of
# downloading about 200 MB again. Refreshed after 90 days; the runtime installed on the
# user's PC updates itself anyway.
$webView2Cache = Join-Path $env:LOCALAPPDATA 'JesseArchive-Build\MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
function Test-WebView2([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    return $signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -match 'O=Microsoft Corporation' -and
        (Get-Item -LiteralPath $path).Length -ge 100MB
}
$cacheValid = Test-WebView2 $webView2Cache
if (-not $cacheValid -and (Test-Path -LiteralPath $webView2Cache)) {
    Remove-Item -LiteralPath $webView2Cache -Force
}
$cacheOld = $cacheValid -and (Get-Item -LiteralPath $webView2Cache).LastWriteTime -lt (Get-Date).AddDays(-90)
if (-not (Test-WebView2 $webView2) -or $cacheOld) {
    if (-not $cacheValid -or $cacheOld) {
        Write-Host "Scarico il runtime WebView2 offline da Microsoft: $webView2Url"
        New-Item -ItemType Directory -Force -Path (Split-Path $webView2Cache) | Out-Null
        $partial = "$webView2Cache.partial"
        try {
            Invoke-WebRequest -Uri $webView2Url -OutFile $partial -UseBasicParsing
            if (-not (Test-WebView2 $partial)) {
                throw 'Installer WebView2 scaricato non valido: firma Microsoft assente o file troppo piccolo.'
            }
            Move-Item -LiteralPath $partial -Destination $webView2Cache -Force
            $cacheValid = $true
        } catch {
            Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
            # An old but valid copy is still usable when the refresh fails.
            if (-not $cacheValid) { throw }
            Write-Host "Aggiornamento della copia WebView2 non riuscito, uso quella esistente: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Uso la copia verificata di WebView2: $webView2Cache"
    }
    Copy-Item -LiteralPath $webView2Cache -Destination $webView2 -Force
} elseif (-not $cacheValid) {
    # First build with the cache: seed it from the payload already in this working copy.
    New-Item -ItemType Directory -Force -Path (Split-Path $webView2Cache) | Out-Null
    Copy-Item -LiteralPath $webView2 -Destination $webView2Cache -Force
}
if (-not (Test-WebView2 $webView2)) {
    Remove-Item -LiteralPath $webView2 -Force -ErrorAction SilentlyContinue
    throw 'Installer WebView2 non valido (firma Microsoft o dimensione): eliminato, riprova la build.'
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
