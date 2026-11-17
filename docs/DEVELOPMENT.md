# Guida di sviluppo e verifica

Baseline `1f09624`, Beta 1.1.4, analisi del 17 novembre 2026. Leggere prima [AGENTS.md](../AGENTS.md); per Claude anche [CLAUDE.md](../CLAUDE.md). Questo incarico ha modificato soltanto documentazione: nessuna nuova build, installazione, suite o apertura di vault reali è stata eseguita.

## Ambiente e dipendenze

Il percorso di distribuzione completo è Windows x64 con Rust MSVC, Visual Studio Build Tools C++ e Windows SDK, Node/npm, WebView2 e Inno Setup 6 o 7. La build Tauri MSI usa gli strumenti WiX gestiti dalla CLI/cache: al primo utilizzo possono servire download. Non dichiarare offline l'ambiente di compilazione.

Se il repository è stato creato da un altro account Windows (per esempio la sandbox di Codex), Git può rifiutarlo con "dubious ownership". La soluzione adottata è `git config --global --add safe.directory "<percorso del repository>"` per l'utente che sviluppa; non cambiare il proprietario della cartella, perché l'altro agente deve poter continuare a scriverci.

Versioni osservate con comandi di sola lettura: `rustc 1.100.0`, `cargo 1.100.0`, Node `26.13.1`, npm `11.20.0`. Non sono versioni minime certificate: manca un pin `rust-toolchain`/`rust-version`, edizione Rust 2021 non significa MSRV 2021. `jsdom 31.0.1` richiede Node `^22.22.2 || ^24.15.0 || >=26.0.0`: una generica indicazione Node 18 è insufficiente per gli attuali test. Nessun campo `engines` impone il runtime in package.json.

| Tecnologia | Risoluzione nei lockfile | Ruolo |
|---|---|---|
| React / React DOM | 19.3.1 | UI, stato e finestre |
| TypeScript / Vite | 5.7.3 / 6.4.6 | Controllo tipi e bundle frontend |
| API / CLI Tauri JS | 2.12.5 | IPC e tool di sviluppo |
| Tauri / tauri-build Rust | 2.12.6 / 2.7.5 | Runtime desktop e generazione build |
| Plugin global-shortcut / single-instance | 2.4.1 / 2.5.5 | Hotkey e istanza unica |
| aes-gcm / scrypt | 0.10.3 / 0.11.0 | Cifratura e derivazione chiavi |
| rand diretto / zeroize | 0.8.8 / 1.9.1 | Casualità e cancellazione selettiva memoria |
| psl | 2.1.255 | Confini dei domini, incluse suffix private |
| reqwest diretto | 0.12.28 | Favicon e Pwned Passwords |
| windows-sys diretto | 0.61.2 | Clipboard, registro, finestre e integrazione Windows |
| jsdom | 31.0.1 | DOM sintetico nei test estensione |

`serde`/`serde_json`, `base64`, `url`, `sha1`/`sha2`, `hmac`, `csv`, `regex` e librerie di sistema completano il core; lucide-react fornisce icone UI. Il riferimento integrale è [Cargo.toml](../src-tauri/Cargo.toml), [Cargo.lock](../src-tauri/Cargo.lock), [package.json](../package.json), [package-lock.json](../package-lock.json). Le dipendenze transitive possono contenere versioni aggiuntive: non attribuirle automaticamente alle dipendenze dirette.

## Comandi e livello di verifica

Eseguire dalla root. I comandi seguenti sono coerenti con manifest e script ispezionati. Nella sessione precedente sono stati riportati riusciti build completa 1.1.4, suite Rust e Node; non sono stati rieseguiti durante questa analisi. `npm ci`, controlli fmt/clippy e una nuova installazione su macchina pulita non hanno un esito certificato da questa attività.

```powershell
# Installazione riproducibile da lockfile (modifica node_modules)
npm ci

# Solo frontend: Vite, senza bridge desktop
npm run dev

# Applicazione desktop in sviluppo
npm run tauri -- dev

# Controllo tipi senza generare il bundle
npx tsc --noEmit

# Bundle frontend; il prebuild aggiorna commits.generated.json
npm run build

# Compilazione e test Rust
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml

# Test estensione in DOM sintetico
npm run test:browser

# Helper release e test Native Messaging
cargo build --manifest-path src-tauri/Cargo.toml --release --bin jesse_browser_host
node --test tests/browser-host.test.mjs

# Formattazione (rustfmt + Prettier): applica / verifica
npm run format
npm run format:check

# Diagnostica statica: warning da valutare, non assunti puliti
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets
```

Vite da solo non fornisce `invoke` Tauri: un errore IPC in un browser ordinario non dimostra un difetto del core. La build helper produce `jesse_browser_host.exe`, mentre il pacchetto installato usa `jesse-browser-host.exe`; il rename/copy è responsabilità dello script di distribuzione. Controllare il percorso cercato dai test prima di interpretare uno skip. Per sviluppo integrazione browser usare il flusso che prepara risorse e manifest, non presumere che `tauri dev` lo faccia.

Per la sola fixture interoperabile Python, in un ambiente Python separato con `cryptography` disponibile:

```powershell
python tests/test_legacy_fixture.py
```

Il test legge dati sintetici; non importare il modulo dell'app storica per provarlo. Le dipendenze del client Python sono in `legacy-python/requirements*.txt`, ma non servono al runtime Rust.

## Test presenti e lacune

| Suite | Copertura effettiva | Limiti |
|---|---|---|
| Test inline `core.rs` | KDF, AES, fusione, TOTP, compatibilità fixture v1; `vault_tests` su un vault sintetico in una cartella temporanea (policy di lunghezza, recupero, import non validi, round trip export/import, ripristino dopo salvataggio fallito, `ensure_shape`, `bulk`/`delete` limitato agli elementi nel cestino) | Non coprono interamente CRUD o crash durante scrittura |
| Test inline browser/protocollo/installer/navigation | Matching domini, framing, target fissi e input navigazione | Non certificano sei browser reali |
| `tests/browser-extension.test.mjs` | Sei casi con mock API e jsdom, focus e compilazione DOM | Non sostituisce il motore browser, pagine reali, CAPTCHA o framework esterni |
| `tests/browser-host.test.mjs` | Due casi con processo helper, APPDATA isolato e bridge simulato | Può saltare se manca il binario; uno skip non è superamento funzionale |
| `tests/test_legacy_fixture.py` | Vettore crittografico condiviso | Non esegue la UI Python né garantisce tutta la compatibilità bidirezionale |

La precedente esecuzione riportava 11 test libreria Rust e uno di protocollo nel binario helper, oltre ai 6+2 Node. Il protocollo è compilato anche nel binario: non contare il test duplicato come nuova area coperta. Esiste un test GUI Brave ignorato normalmente: apre finestre e usa un profilo dedicato. Prima di eseguirlo leggere `src-tauri/src/browser_navigation.rs`; non avviare indiscriminatamente tutti gli ignored test su una sessione utente. Il precedente controllo manuale della navigazione riguarda Brave soltanto.

Mancano prove complete di concorrenza e durabilità, collaudo manuale dell'inattività nell'app reale, tutte le categorie CRUD, login reali su ogni browser, installazione/upgrade/disinstallazione in VM e offline su Windows pulito. Non aggiungere test che usino credenziali o vault personali.

## Integrazione continua

[.github/workflows/ci.yml](../.github/workflows/ci.yml) gira su `windows-latest` a ogni push e pull request verso `main`: Node 24, Rust stable, `npm ci`, `npx tsc --noEmit`, `npm run format:check`, `npx vite build` (richiesto da `tauri::generate_context!` per `../dist`; non usa `npm run build`, che riscriverebbe lo snapshot dei commit), `cargo test`, `npm run test:browser`, build release di `jesse_browser_host` e `node --test tests/browser-host.test.mjs`, che così non viene saltato. Clippy, il setup MSI/Inno e i test GUI ignorati non sono eseguiti. Ogni modifica deve lasciare la CI verde; una CI verde non sostituisce i collaudi manuali elencati sopra.

## Rilasci automatici

[.github/workflows/release.yml](../.github/workflows/release.yml) gira a ogni push su `main`. Se la versione di `package.json` non ha ancora una release (tag `vX.Y.Z`), su `windows-latest` installa Inno Setup (Chocolatey), esegue `npm ci` e `Build-Setup-EXE.ps1 -SkipNpmInstall` (stessi test e stesso MSI + Inno della build locale) e pubblica una release normale "Latest" intitolata **Beta X.Y.Z**, con l'unico asset `JesseArchive-Setup.exe` (nome invariato). Le note sono generate da [scripts/release-notes.mjs](../scripts/release-notes.mjs) con le voci News di tutte le versioni successive all'ultima release pubblicata. Un merge che non cambia versione termina subito senza pubblicare.

Regole: ogni aggiornamento destinato agli utenti porta il bump di versione e la voce News nella stessa PR; non creare a mano tag `v*` o release (il workflow salterebbe la versione). Il setup pubblicato è compilato da GitHub, non è il file provato in locale, e non è firmato. Il repository è pubblico (dal 17 novembre 2026): codice, storia, release e asset sono visibili e scaricabili da chiunque; i runner standard di GitHub Actions sono gratuiti per i repository pubblici. Non è presente un file di licenza, quindi il codice è consultabile ma non concesso in riuso. Le PR da fork eseguono solo `ci.yml` con token in sola lettura; `release.yml` parte unicamente da push su `main`.

## Setup Windows completo

Chiudere JesseArchive anche nel tray: gli script verificano il processo e si interrompono se attivo. Non terminare forzatamente un processo con operazioni sui dati in corso. Per rigenerare il setup, quando autorizzato:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1

# Solo se le dipendenze sono già correttamente installate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1 -SkipNpmInstall
```

Flusso reale:

1. `Build-Setup-EXE.ps1` verifica prerequisiti e processo; richiama `Build-Distribuzione-Windows.ps1` con formato MSI.
2. Lo script interno installa eventualmente npm, esegue test Rust, build frontend e test browser, genera copie/manifest estensione, compila e verifica helper.
3. Copia helper in `src-tauri/resources/`, prepara configurazione merge Tauri con helper, estensioni e guida; costruisce MSI.
4. Lo script esterno verifica data/dimensione del MSI, ricava `INSTALLDIR` tramite database MSI, copia il payload e compila [JesseArchive-Setup.iss](../installer/JesseArchive-Setup.iss).
5. Il distributable contiene `JesseArchive-Setup.exe`, ZIP Chromium/Firefox e guida. I percorsi precisi sono definiti dagli script: non prelevare un vecchio MSI soltanto perché è l'unico presente.

Inno è un bootstrapper amministrativo non disinstallabile autonomamente; installa il MSI, che gestisce la disinstallazione. Gestisce codice 3010 e percorso personalizzato. La pagina finale offre due spunte post-installazione, eseguite come utente originale e saltate in modalità silent: "Configura le estensioni dei browser" (`--browser-setup`) e, subito sotto, "Avvia Jesse's Archive". Se sono selezionate entrambe, `NextButtonClick(wpFinished)` toglie la seconda: la guida avvia già l'app e il suo pulsante "Ho installato l'estensione" apre la finestra principale, evitando due avvii simultanei che competerebbero sul controllo di istanza singola. L'ordine delle due voci `[Run]` è significativo (indice 0 e 1 di `RunList`). Nota: `ISCC /O-` (solo verifica di sintassi) cancella comunque il setup esistente nella cartella di output. L'elevazione con credenziali di un altro account richiede verifica del contesto HKCU e della guida. Nessuna configurazione di firma del setup o pubblicazione store è dimostrata.

La soglia di dimensione MSI è un'euristica, non prova che ogni dipendenza WebView2 sia disponibile offline. La build Tauri diretta e `Build-Windows.ps1` storico non preparano da soli tutto il pacchetto browser. Il formato NSIS è previsto nello script interno, ma le note storiche riportano un problema NSISCOMCALL; il percorso corrente preferito è MSI + Inno. Riferimenti operativi preesistenti: [DISTRIBUZIONE-WINDOWS](../DISTRIBUZIONE-WINDOWS.md), [SETUP-EXE-OFFLINE](../SETUP-EXE-OFFLINE.md), da confrontare sempre con gli script attuali.

## Artefatti generati e versioni

- `scripts/generate-commits.mjs`, eseguito dal prebuild npm, riscrive il file versionato `src/commits.generated.json` usando Git. Le date commit sono `%cI`, lo snapshot arriva fino a 250 voci; non è un servizio live.
- `scripts/package-browser-extension.mjs` copia il background canonico nelle due directory, prepara manifest e identità Chromium. Preservare la chiave **pubblica** e l'identità esistenti: rigenerarle cambia il collegamento Native Messaging. Non introdurre chiavi private nel repository.
- `src-tauri/resources/` e la configurazione browser merge sono artefatti ignorati. I profili dei test e gli output di compilazione non sono sorgenti.
- La versione compare in package.json/Cargo/Tauri/Inno e nei manifest generati; lockfile e fallback UI vanno valutati se si modifica la versione. Non eseguire un bump per una richiesta soltanto documentale.
- Il codice Rust e `src/` sono formattati (rustfmt predefinito, Prettier 3 con `.prettierrc.json`); la CI esegue `npm run format:check`. Il commit di formattazione iniziale è in `.git-blame-ignore-revs`: usare `git config blame.ignoreRevsFile .git-blame-ignore-revs` per un blame utile. `browser-extension/` e `legacy-python/` non sono formattati da Prettier. Clippy non è un gate certificato.

## Metodo di lavoro

Individuare prima comando IPC, UI e persistenza coinvolti; leggere le funzioni chiamate e i test. Separare matcher UI da matcher autorizzativo, client Rust da Python storico, sorgenti canonici da copie generate. Preservare il formato v1 e aggiungere fixture compatibili prima di cambiarlo. Non usare `unwrap` come validazione di input esterno e non registrare segreti. Per comportamento e limiti attuali vedere [SECURITY](SECURITY.md) e [DATABASE](DATABASE.md), senza interpretarli come autorizzazione a correggerli fuori scope.

Dopo una modifica eseguire i controlli pertinenti, compilare quando appropriato e controllare `git diff` per artefatti inattesi. Aggiornare solo i documenti influenzati secondo [AGENTS](../AGENTS.md); dichiarare nel resoconto quelli aggiornati e perché, oppure esplicitare che non servono aggiornamenti. Una modifica puramente documentale richiede verifica di link, nomi e coerenza, senza rigenerare build o toccare dati reali. I vecchi README sono contesto storico: affermazioni come “mai compilato” o “nessun remoto” non descrivono necessariamente la baseline attuale.
