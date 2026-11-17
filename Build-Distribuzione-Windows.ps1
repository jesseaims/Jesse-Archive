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
Run-Step 'Test compilazione campi browser' { npm run test:browser }
Run-Step 'Preparazione estensioni browser' { node scripts/package-browser-extension.mjs }
Run-Step 'Build componente Native Messaging' { cargo build --release --manifest-path 'src-tauri/Cargo.toml' --bin jesse_browser_host }
Run-Step 'Test canale Native Messaging' { node --test tests/browser-host.test.mjs }
New-Item -ItemType Directory -Force -Path 'src-tauri/resources' | Out-Null
Copy-Item -LiteralPath 'src-tauri/target/release/jesse_browser_host.exe' -Destination 'src-tauri/resources/jesse-browser-host.exe' -Force
$browserBundle = '{"bundle":{"resources":{"resources/jesse-browser-host.exe":"jesse-browser-host.exe","../browser-extension/chromium/":"browser-extension/chromium/","../browser-extension/firefox/":"browser-extension/firefox/","../BROWSER-INTEGRATION.md":"browser-extension/BROWSER-INTEGRATION.md"}}}'
$browserBundlePath = Join-Path $PSScriptRoot 'src-tauri/resources/browser-bundle.json'
[System.IO.File]::WriteAllText($browserBundlePath, $browserBundle, (New-Object System.Text.UTF8Encoding($false)))
if ($Formato -eq 'exe' -or $Formato -eq 'both') {
    Run-Step 'Creazione setup EXE NSIS con WebView2 OFFLINE' { npm run tauri -- build --bundles nsis --config $browserBundlePath }
}
if ($Formato -eq 'msi' -or $Formato -eq 'both') {
    Run-Step 'Creazione MSI con WebView2 OFFLINE' { npm run tauri -- build --bundles msi --config $browserBundlePath }
}
Write-Host "`nPacchetti creati in src-tauri\target\release\bundle\" -ForegroundColor Green
Get-ChildItem 'src-tauri/target/release/bundle' -Recurse -File -Include '*.exe','*.msi' |
  Where-Object { $_.FullName -notmatch '\\nsis\\x64\\' } |
  Select-Object FullName,Length | Format-Table -AutoSize
Write-Host 'Esegui il test di installazione offline su un secondo PC/VM prima di distribuire.' -ForegroundColor Yellow
