<#
.SYNOPSIS
  Compila Jesse's Archive su questo PC e pubblica JesseArchive-Setup.exe nelle
  GitHub Releases come "Beta X.Y.Z" (tag vX.Y.Z).

.DESCRIPTION
  Di norma lo script è avviato dall'automazione locale (attività Windows
  JesseArchive-AutoPublish, progetto del sito) in una copia isolata della
  repository, dopo la CI verde. L'avvio manuale resta possibile.

  1. Blocco di sistema "JesseArchive-Publish-Release": se un'altra pubblicazione è
     in corso (automatica o manuale) termina subito con exit code 75.
  2. Controlli: branch main allineato a origin/main e senza modifiche, versione
     coerente in tutti i file, voce News presente, CI verde sul commit,
     release/tag (anche in bozza) non ancora esistenti, GitHub CLI autenticato.
  3. Build completa con Build-Setup-EXE.ps1 in un processo separato: qualsiasi
     errore (exit code diverso da 0) interrompe la pubblicazione.
  4. Verifica che il setup sia quello appena prodotto (versione nel file, data,
     dimensione) e ne calcola lo SHA-256.
  5. Pubblica la release con le note generate dalle News (lette in UTF-8) e
     controlla l'asset caricato.

  Lo snapshot src/commits.generated.json riscritto dalla build viene ripristinato:
  main resta invariato e il tag punta al commit da cui è stato compilato il setup.

.PARAMETER SkipNpmInstall
  Passato a Build-Setup-EXE.ps1: non reinstalla le dipendenze npm.
.PARAMETER SkipBuild
  Non ricompila: pubblica il setup già presente, solo se è della versione corrente.
.PARAMETER NotesSince
  Versione da cui partire con le note (predefinita: ultima release pubblicata).
.PARAMETER Draft
  Crea la release come bozza, non visibile come "Latest".
.PARAMETER DryRun
  Esegue solo i controlli e mostra le note, senza compilare né pubblicare.
.PARAMETER Yes
  Non chiede conferma prima di pubblicare (uso non interattivo).

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Publish-Release.ps1 -SkipNpmInstall
#>
param(
    [switch]$SkipNpmInstall,
    [switch]$SkipBuild,
    [string]$NotesSince = '',
    [switch]$Draft,
    [switch]$DryRun,
    [switch]$Yes
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step([string]$text) { Write-Host "==> $text" -ForegroundColor Cyan }
# Native commands are judged only by their exit code: in Windows PowerShell 5.1,
# with ErrorActionPreference=Stop, any stderr output would otherwise be fatal.
function Invoke-Quiet([scriptblock]$block) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $block 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
    finally { $ErrorActionPreference = $previous }
}
function Native([string]$label, [scriptblock]$block) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $block 2>&1 | ForEach-Object { "$_" } | Write-Host }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "$label non riuscito (exit code $LASTEXITCODE)" }
}

# --- Una sola pubblicazione alla volta ------------------------------------------
# Named mutex shared by every copy of this script (original checkout, isolated
# clones built by the automation, desktop shortcut). Windows releases it when the
# process ends, so a crash or a reboot never leaves a stale lock behind.
$mutex = New-Object System.Threading.Mutex($false, 'Global\JesseArchive-Publish-Release')
$owned = $false
try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
if (-not $owned) {
    $mutex.Dispose()
    Write-Host "Un'altra pubblicazione di Jesse's Archive è già in corso: nessuna azione." -ForegroundColor Yellow
    exit 75
}

try {
    $exe = Join-Path $PSScriptRoot 'src-tauri\target\release\bundle\distributable\JesseArchive-Setup.exe'
    $snapshot = 'src/commits.generated.json'

    # --- GitHub CLI ---------------------------------------------------------
    Step 'Controllo GitHub CLI'
    $gh = (Get-Command gh -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
    if (-not $gh) {
        $gh = @("$env:ProgramFiles\GitHub CLI\gh.exe", "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe", "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe") |
            Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    }
    if (-not $gh) { throw 'GitHub CLI (gh) non trovato. Installalo da https://cli.github.com e accedi con: gh auth login' }
    if (-not (Invoke-Quiet { & $gh auth status })) { throw 'GitHub CLI non autenticato. Esegui: gh auth login' }

    # --- Git: si pubblica solo main, allineato e pulito ------------------------
    Step 'Controllo repository Git'
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne 'main') { throw "Le release si pubblicano solo da main (branch attuale: $branch)." }
    Native 'git fetch' { git fetch --quiet origin }
    $sha = (git rev-parse HEAD).Trim()
    $remote = (git rev-parse origin/main).Trim()
    if ($sha -ne $remote) { throw 'main locale non coincide con origin/main: esegui git pull (o pubblica i commit) e riprova.' }
    $dirty = git status --porcelain --untracked-files=no | Where-Object { $_ -and ($_.Substring(3) -ne $snapshot) }
    if ($dirty) { throw "Ci sono modifiche non committate:`n$($dirty -join "`n")" }

    # --- Versione coerente --------------------------------------------------
    Step 'Controllo versione'
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
    $checks = [ordered]@{
        'src-tauri/tauri.conf.json'        = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
        'src-tauri/Cargo.toml'             = ([regex]::Match((Get-Content src-tauri/Cargo.toml -Raw), '(?m)^version\s*=\s*"([^"]+)"')).Groups[1].Value
        'installer/JesseArchive-Setup.iss' = ([regex]::Match((Get-Content installer/JesseArchive-Setup.iss -Raw), '#define AppVersion "([^"]+)"')).Groups[1].Value
    }
    foreach ($file in $checks.Keys) {
        if ($checks[$file] -ne $version) { throw "Versione non allineata: package.json $version, $file $($checks[$file])." }
    }
    if (-not (Select-String -Path src/news-changelog.ts -SimpleMatch "version: 'Beta $version'" -Quiet)) {
        throw "Manca la voce News per la Beta $version in src/news-changelog.ts."
    }

    # --- CI verde sul commit da pubblicare ------------------------------------
    Step 'Controllo CI'
    $ErrorActionPreference = 'Continue'
    $ciJson = & $gh run list --workflow ci.yml --commit $sha --event push --limit 1 --json status,conclusion,url 2>$null
    $ciExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($ciExit -ne 0) { throw 'Impossibile leggere lo stato della CI da GitHub.' }
    $ci = @($ciJson | ConvertFrom-Json) | Select-Object -First 1
    if (-not $ci) { throw "Nessuna CI trovata per il commit $($sha.Substring(0,7)) su main: attendi che parta e riprova." }
    if ($ci.status -ne 'completed') { throw "CI ancora in corso ($($ci.status)): riprova quando è completata. $($ci.url)" }
    if ($ci.conclusion -ne 'success') { throw "CI non superata ($($ci.conclusion)): nessuna pubblicazione. $($ci.url)" }

    $tag = "v$version"
    # gh release view finds drafts too: an interrupted upload is never overwritten.
    if (Invoke-Quiet { & $gh release view $tag }) { throw "La release $tag esiste già (anche in bozza): verificala su GitHub." }
    if (git ls-remote --tags origin "refs/tags/$tag") { throw "Il tag $tag esiste già su GitHub." }

    # --- Note di rilascio -------------------------------------------------------
    if (-not $NotesSince) {
        $ErrorActionPreference = 'Continue'
        $NotesSince = (& $gh release list --exclude-drafts --limit 1 --json tagName --jq '.[0].tagName' 2>$null)
        $ErrorActionPreference = 'Stop'
    }
    $notesFile = Join-Path ([System.IO.Path]::GetTempPath()) "jessearchive-notes-$version.md"
    # Node writes UTF-8: decode it as such, not with the console OEM code page,
    # otherwise accented letters in the notes are corrupted.
    $previousEncoding = [Console]::OutputEncoding
    $ErrorActionPreference = 'Continue'
    try {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $notes = node scripts/release-notes.mjs $version $NotesSince 2>$null
        $notesExit = $LASTEXITCODE
    } finally {
        [Console]::OutputEncoding = $previousEncoding
        $ErrorActionPreference = 'Stop'
    }
    if ($notesExit -ne 0) { throw 'Generazione delle note di rilascio non riuscita.' }
    [System.IO.File]::WriteAllText($notesFile, ($notes -join "`n"), [System.Text.UTF8Encoding]::new($false))
    Write-Host "Versione: Beta $version  |  tag: $tag  |  commit: $($sha.Substring(0,7))  |  note da: $(if ($NotesSince) { $NotesSince } else { 'solo questa versione' })"

    if ($DryRun) {
        Write-Host "`n--- Note di rilascio (anteprima) ---`n$($notes -join "`n")"
        Write-Host "`nDryRun: controlli superati, nessuna build e nessuna pubblicazione." -ForegroundColor Yellow
        exit 0
    }

    # --- Build --------------------------------------------------------------
    if ($SkipBuild) {
        Step 'Build saltata (-SkipBuild): uso il setup già presente'
        $buildStart = [datetime]::MinValue
    } else {
        Step 'Build completa (Build-Setup-EXE.ps1)'
        $buildStart = Get-Date
        $buildArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'Build-Setup-EXE.ps1'))
        if ($SkipNpmInstall) { $buildArgs += '-SkipNpmInstall' }
        & powershell.exe @buildArgs
        $buildExit = $LASTEXITCODE
        # The build rewrites the commit snapshot: restore it so main stays unchanged.
        [void](Invoke-Quiet { git checkout -- $snapshot })
        if ($buildExit -ne 0) { throw "Build non riuscita (exit code $buildExit): nessuna pubblicazione." }
    }

    # --- Verifica dell'artefatto ----------------------------------------------
    Step 'Verifica del setup'
    if (-not (Test-Path $exe)) { throw "Setup non trovato: $exe" }
    $file = Get-Item $exe
    $fileVersion = "$($file.VersionInfo.ProductVersion)".Trim()
    if ($fileVersion -ne $version) { throw "Il setup è della versione '$fileVersion', non ${version}: ricompila senza -SkipBuild." }
    if ($file.LastWriteTime -lt $buildStart) { throw 'Il setup è precedente a questa build: non è l''artefatto appena prodotto.' }
    if ($file.Length -lt 50MB) { throw "Setup troppo piccolo ($($file.Length) byte)." }
    $hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host ("Setup: {0:N1} MB, creato {1}, SHA-256 {2}" -f ($file.Length / 1MB), $file.LastWriteTime, $hash)

    # --- Firma per l'aggiornamento automatico ------------------------------------
    # The installed apps accept only installers whose signed manifest matches the
    # public key embedded in them (src-tauri\update-public-key.txt).
    Step 'Firma per l''aggiornamento automatico'
    $sigFile = "$exe.sig"
    $keyFile = Join-Path $env:APPDATA 'JesseArchive-Release\update-signing-key.dpapi'
    if (-not (Test-Path -LiteralPath $keyFile)) {
        throw "Chiave di firma degli aggiornamenti assente ($keyFile): ripristinala con scripts\Update-SigningKey.ps1 -Restore <backup>."
    }
    Add-Type -AssemblyName System.Security
    $pemBytes = [System.Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile), $null, 'CurrentUser')
    $ErrorActionPreference = 'Continue'
    try {
        [System.Text.Encoding]::ASCII.GetString($pemBytes) | node scripts/update-signature.mjs sign $exe $version $sigFile 2>&1 |
            ForEach-Object { "$_" } | Write-Host
        $signExit = $LASTEXITCODE
    } finally {
        [Array]::Clear($pemBytes, 0, $pemBytes.Length)
        $ErrorActionPreference = 'Stop'
    }
    if ($signExit -ne 0) { throw 'Firma dell''aggiornamento non riuscita.' }
    Native 'Verifica della firma' { node scripts/update-signature.mjs verify $exe $sigFile src-tauri/update-public-key.txt }

    # --- Pubblicazione --------------------------------------------------------
    if (-not $Yes) {
        $answer = Read-Host "Pubblicare JesseArchive-Setup.exe come 'Beta $version' su GitHub? (s/N)"
        if ($answer -notmatch '^(s|si|sì|y|yes)$') { Write-Host 'Pubblicazione annullata.' -ForegroundColor Yellow; exit 1 }
    }
    Step "Pubblicazione della release $tag"
    $releaseArgs = @('release', 'create', $tag, $exe, $sigFile, '--title', "Beta $version", '--notes-file', $notesFile, '--target', $sha)
    if ($Draft) { $releaseArgs += '--draft' } else { $releaseArgs += '--latest' }
    Native 'gh release create' { & $gh @releaseArgs }

    $asset = & $gh release view $tag --json assets,url --jq '{url: .url, assets: [.assets[] | {name: .name, size: .size}]}' | ConvertFrom-Json
    $uploaded = $asset.assets | Where-Object { $_.name -eq 'JesseArchive-Setup.exe' }
    $uploadedSig = $asset.assets | Where-Object { $_.name -eq 'JesseArchive-Setup.exe.sig' }
    if (-not $uploaded -or [int64]$uploaded.size -ne $file.Length) {
        throw "Release creata ma l'asset caricato non corrisponde al file locale: controlla $($asset.url)"
    }
    if (-not $uploadedSig -or [int64]$uploadedSig.size -ne (Get-Item $sigFile).Length) {
        throw "Release creata ma la firma per l'aggiornamento automatico non risulta caricata: controlla $($asset.url)"
    }
    Write-Host "`nPubblicata: $($asset.url)" -ForegroundColor Green
    Write-Host "Asset: JesseArchive-Setup.exe ($($file.Length) byte, SHA-256 $hash) + JesseArchive-Setup.exe.sig" -ForegroundColor Green

    # --- Estensione negli store ---------------------------------------------------
    # After the release, and never blocking it: the extension goes to the Chrome Web
    # Store and addons.mozilla.org only when its code changed since the last submission
    # (scripts\publish-store-extension.mjs). Credentials: scripts\Store-Keys.ps1, kept
    # DPAPI-encrypted and passed on stdin, never written in clear.
    if (-not $Draft) {
        Step 'Estensione negli store'
        $storeKeys = Join-Path $env:APPDATA 'JesseArchive-Release\store-keys.dpapi'
        $storeState = Join-Path $env:APPDATA 'JesseArchive-Release\store-state.json'
        $storeExit = 0
        $ErrorActionPreference = 'Continue'
        try {
            $storeJson = '{}'
            if (Test-Path -LiteralPath $storeKeys) {
                $storeBytes = [System.Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($storeKeys), $null, 'CurrentUser')
                $storeJson = [System.Text.Encoding]::UTF8.GetString($storeBytes)
                [Array]::Clear($storeBytes, 0, $storeBytes.Length)
            }
            $storeJson | node scripts/publish-store-extension.mjs --state $storeState 2>&1 | ForEach-Object { "$_" } | Write-Host
            $storeExit = $LASTEXITCODE
        } catch {
            $storeExit = 1
            Write-Host $_.Exception.Message
        } finally {
            $storeJson = $null
            $ErrorActionPreference = 'Stop'
        }
        if ($storeExit -ne 0) {
            Write-Warning 'Invio agli store non riuscito: la release dell''app è pubblicata comunque. Si riprova alla prossima release (dettagli sopra).'
        }
        # $LASTEXITCODE still holds the store step's node exit code: a caller that checks it
        # after this script (AutoPublish's Invoke-Publisher.ps1) would mark the published
        # release as failed.
        $global:LASTEXITCODE = 0
    }
} finally {
    # Released explicitly too: the desktop shortcut keeps its window (-NoExit) open.
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
