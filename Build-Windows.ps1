$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host 'Jesse Archive - Windows build + test' -ForegroundColor Cyan
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Cargo non trovato. Installa Rust MSVC: https://rustup.rs/' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm non trovato. Installa Node.js LTS.' }
Write-Host '[1/4] Installazione dipendenze frontend'
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install fallito' }
Write-Host '[2/4] Test unitari Rust (compresi vettori legacy Python)'
cargo test --manifest-path src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw 'cargo test fallito. Non procedere con vault reali.' }
Write-Host '[3/4] TypeScript e Vite'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build TypeScript fallita' }
Write-Host '[4/4] Installer Windows MSI'
npm run tauri -- build --bundles msi
if ($LASTEXITCODE -ne 0) { throw 'Build Tauri fallita' }
Write-Host 'Build conclusa. Controlla: src-tauri/target/release/bundle' -ForegroundColor Green
Write-Host 'ATTENZIONE: esegui regressione funzionale su vault sintetici prima di utilizzare dati reali.' -ForegroundColor Yellow
