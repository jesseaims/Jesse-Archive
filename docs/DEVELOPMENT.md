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
| reqwest diretto | 0.12.28 | Favicon, Pwned Passwords e aggiornamenti |
| ed25519-dalek | 2 | Verifica della firma degli aggiornamenti automatici |
| p256 | 0.13 | Chiavi e firme ES256 delle passkey WebAuthn |
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
| `tests/dashboard.test.mjs`, `tests/dashboard-ui.test.mjs` (`npm run test:dashboard`) | Modello: configurazioni mancanti, danneggiate o vecchie, widget sconosciuti o non disponibili, operazioni sul layout, layout indipendenti e ripristino, punteggio, nessun segreto salvato. UI: la vera `Dashboard.tsx`, compilata con esbuild (dipendenza di Vite) e montata in jsdom con un vault sintetico e un backend Tauri simulato. Verifica dati reali, assenza di password e testo delle note, modalità personalizzazione, catalogo, spostamento, ridimensionamento, impostazioni, salvataggio automatico, drag & drop, layout, ripristino con conferma, persistenza dopo un nuovo avvio, aggiornamento quando cambiano i dati, configurazione danneggiata | jsdom non calcola il layout: resa grafica, animazioni e trascinamento col mouse vero vanno provati nell'app |
| `tests/i18n.test.mjs` (`npm run test:i18n`) | Ogni chiave usata nel codice (`t`/`tRich`/`msg`, estratte con [scripts/i18n-keys.mjs](../scripts/i18n-keys.mjs)) e ogni messaggio di `src/locales/runtime-keys.mjs` è tradotto in tutte le lingue con gli stessi segnaposto; nessuna traduzione orfana; ogni voce News tradotta; stesse lingue in frontend e backend | Non verifica la qualità linguistica né i testi Rust non elencati in `runtime-keys.mjs` |
| `tests/passkey-extension.test.mjs` | Sei casi: serializzazione delle opzioni WebAuthn, oggetti `PublicKeyCredential`, fallback, errori, abort, origine presa dal browser e disconnessione | Classi WebAuthn simulate: non sostituisce un collaudo su siti reali |
| `passkey.rs` (test inline) | rpId e PSL, CBOR, `clientDataJSON`, registrazione con login verificato, validazione delle richieste; il test `--ignored` `dump_for_external_verifier` produce dati verificati anche con OpenSSL/Node | Nessun browser reale |
| `tests/browser-host.test.mjs` | Due casi con processo helper, APPDATA isolato e bridge simulato | Può saltare se manca il binario; uno skip non è superamento funzionale |
| `tests/test_legacy_fixture.py` | Vettore crittografico condiviso | Non esegue la UI Python né garantisce tutta la compatibilità bidirezionale |

La precedente esecuzione riportava 11 test libreria Rust e uno di protocollo nel binario helper, oltre ai 6+2 Node. Il protocollo è compilato anche nel binario: non contare il test duplicato come nuova area coperta. Esiste un test GUI Brave ignorato normalmente: apre finestre e usa un profilo dedicato. Prima di eseguirlo leggere `src-tauri/src/browser_navigation.rs`; non avviare indiscriminatamente tutti gli ignored test su una sessione utente. Il precedente controllo manuale della navigazione riguarda Brave soltanto.

Mancano prove complete di concorrenza e durabilità, collaudo manuale dell'inattività nell'app reale, tutte le categorie CRUD, login reali su ogni browser, installazione/upgrade/disinstallazione in VM e offline su Windows pulito. Non aggiungere test che usino credenziali o vault personali.

## Aggiungere un widget alla Dashboard

1. Aggiungi il tipo e la specifica in `src/dashboard/model.ts`: categoria, dimensioni, disponibilità, opzioni predefinite e `normalize`.
2. Aggiungi la definizione in `WIDGETS` (`src/dashboard/widgets.tsx`): nome e descrizione con `msg()`, icona, componente, impostazioni ed eventuale `refresh`.
3. Traduci i testi nuovi in tutte le lingue.

Il componente centrale non cambia. Un widget deve usare i dati e i comandi già esistenti, senza mostrare segreti, e non deve chiamare da solo comandi che aggiornano l'attività del vault: quelli nuovi di sola lettura vanno aggiunti all'elenco passivo in `Vault::call`.

La griglia è a mosaico: righe da 8 px (`grid-auto-rows`, `row-gap: 0`) e ogni scheda misura la propria altezza con `ResizeObserver` (`useRowSpan` in `Dashboard.tsx`) e occupa `ceil((altezza + 16) / 8)` righe; `grid-auto-flow: dense` riempie i buchi. Le costanti `GRID_ROW`/`GRID_GAP` devono restare allineate a `.dash-grid` in `style.css`.

Il trascinamento usa il drag & drop HTML5: rilascio su un widget = scambio (`swapWidgets`), rilascio sullo spazio libero = in fondo all'elenco, e il mosaico lo mette nel primo spazio in cui entra. Funziona solo perché la finestra principale ha `"dragDropEnabled": false` in `tauri.conf.json`: con il gestore di rilascio dei file di Tauri attivo (il default), WebView2 su Windows blocca il trascinamento nella pagina e mostra il cursore di divieto. jsdom non riproduce questo comportamento, quindi la regola è verificata da `tests/dashboard.test.mjs`. Se in futuro servisse il rilascio di file nella finestra, il riordino dei widget andrebbe riscritto con eventi pointer.

## Traduzioni

Ogni testo visibile nell'interfaccia passa da `t('…')`, `tRich('…', {…})` o `msg('…')` (vedi `src/i18n.ts`), con il testo italiano come chiave e le traduzioni in tutti i file `src/locales/<lingua>.ts`; i messaggi mostrati che arrivano dal backend Rust o dall'estensione vanno elencati in `src/locales/runtime-keys.mjs`, e ogni nuova voce News va tradotta in `src/locales/news/<lingua>.ts`. `npm run test:i18n` (gate della CI) fallisce se manca una traduzione o se i segnaposto `{nome}` non coincidono. `node scripts/i18n-keys.mjs <lingua>` elenca le chiavi ancora mancanti in una lingua. Le lingue sono definite in `src/i18n.ts` (`LANGUAGES`) e in `src-tauri/src/i18n.rs` (`LANGS`, etichette native); aggiungerne una richiede anche il file `src/locales/<lingua>.ts`, le News, il `_locales` dell'estensione e la voce `[Languages]`/`[CustomMessages]` dell'installer.

## Integrazione continua

[.github/workflows/ci.yml](../.github/workflows/ci.yml) gira su `windows-latest` a ogni push e pull request verso `main`: Node 24, Rust stable, `npm ci`, `npx tsc --noEmit`, `npm run format:check`, `npx vite build` (richiesto da `tauri::generate_context!` per `../dist`; non usa `npm run build`, che riscriverebbe lo snapshot dei commit), `cargo test`, `npm run test:browser`, `npm run test:i18n`, `npm run test:dashboard`, build release di `jesse_browser_host` e `node --test tests/browser-host.test.mjs`, che così non viene saltato. Clippy, il setup MSI/Inno e i test GUI ignorati non sono eseguiti. Ogni modifica deve lasciare la CI verde; una CI verde non sostituisce i collaudi manuali elencati sopra.

## Pubblicazione delle release

Le release si compilano **su questo PC** con [Publish-Release.ps1](../Publish-Release.ps1). Di norma lo avvia l'automazione locale del progetto del sito (attività Windows `JesseArchive-AutoPublish`, documentata in `DISTRIBUZIONE.md` del sito): reagisce agli aggiornamenti di `origin/main` nella copia locale, attende la CI verde e l'app chiusa, poi esegue lo script in un clone isolato e pubblica.

**Dopo ogni merge su `main` eseguire `git fetch origin`** nella repository locale. `gh pr merge` lanciato dal branch della PR esegue già un pull, ma un merge dal sito GitHub, da un altro branch o con `--auto` non aggiorna `origin/main` sul PC: senza fetch l'automazione non riceve l'evento (non esiste polling). Non lanciare `Publish-Release.ps1` a mano in parallelo all'automazione. L'avvio manuale, con JesseArchive chiuso, resta possibile come ripiego:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Publish-Release.ps1 -SkipNpmInstall
```

Lo script:

1. Prende il blocco di sistema `Global\JesseArchive-Publish-Release`: se un'altra pubblicazione (automatica o manuale) è in corso termina subito con exit code **75**, senza controlli né build. Windows rilascia il blocco alla fine del processo, quindi non restano lock orfani.
2. Verifica GitHub CLI autenticato (cerca anche in `Program Files\GitHub CLI`, non serve nel PATH), branch `main` uguale a `origin/main` e senza modifiche, versione allineata in `package.json`, `tauri.conf.json`, `Cargo.toml` e `JesseArchive-Setup.iss`, voce News `Beta X.Y.Z` presente, CI `ci.yml` completata con successo sul commit, release (anche in bozza) e tag `vX.Y.Z` non esistenti.
3. Esegue `Build-Setup-EXE.ps1` in un processo separato: un exit code diverso da 0 interrompe tutto senza pubblicare.
4. Ripristina `src/commits.generated.json` riscritto dalla build, quindi `main` resta invariato.
5. Controlla che il setup sia della versione corrente, successivo all'avvio della build e di dimensione plausibile, e ne calcola lo SHA-256.
6. Chiede conferma (salvo `-Yes`), crea la release "Beta X.Y.Z" segnata Latest con tag `vX.Y.Z` sul commit compilato, gli asset `JesseArchive-Setup.exe` e `JesseArchive-Setup.exe.sig` e le note di [scripts/release-notes.mjs](../scripts/release-notes.mjs) (voci News successive all'ultima release o a `-NotesSince`), lette in UTF-8 anche con la console di Windows PowerShell in una code page OEM. Infine verifica che l'asset caricato abbia la stessa dimensione del file locale.

**Firma per l'aggiornamento automatico.** Dopo la verifica del setup, lo script firma `JesseArchive-Setup.exe.sig` con [scripts/update-signature.mjs](../scripts/update-signature.mjs) usando la chiave privata DPAPI di questo PC. Poi verifica la firma con la chiave pubblica incorporata nell'app ([src-tauri/update-public-key.txt](../src-tauri/update-public-key.txt)) e carica entrambi i file nella release.
- Senza chiave la pubblicazione si ferma.
- Gestione della chiave con [scripts/Update-SigningKey.ps1](../scripts/Update-SigningKey.ps1): `-Status`, `-Backup <file>` (cifrato con passphrase), `-Restore <file>`.
- La chiave è stata creata il 18 novembre 2026.
- Se la chiave va persa, le installazioni esistenti non accettano più aggiornamenti automatici finché non si installa a mano una versione con una nuova chiave pubblica.
- Non leggere, stampare o committare la chiave privata.

Opzioni: `-DryRun` (solo controlli e anteprima delle note), `-SkipBuild` (pubblica il setup già presente se è della versione corrente), `-Draft` (release in bozza), `-NotesSince X.Y.Z`, `-Yes`.

Regole: ogni aggiornamento per gli utenti porta il bump di versione e la voce News nella stessa PR; si pubblica solo dopo il merge, da `main`. Non creare a mano tag `v*` o release. Nessun workflow GitHub compila o pubblica il setup: `ci.yml` esegue solo i controlli. Il setup non è firmato. La prima release pubblicata è Beta 1.1.12 (17 novembre 2026).

Il repository è pubblico (dal 17 novembre 2026): codice, storia, release e asset sono visibili e scaricabili da chiunque. Non è presente un file di licenza, quindi il codice è consultabile ma non concesso in riuso. Le PR da fork eseguono solo `ci.yml` con token in sola lettura.

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
