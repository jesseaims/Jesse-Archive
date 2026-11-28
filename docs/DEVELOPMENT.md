# Guida di sviluppo e verifica

Baseline `1f09624`, Beta 1.1.4, analisi del 17 novembre 2026. Leggere prima [AGENTS.md](../AGENTS.md); per Claude anche [CLAUDE.md](../CLAUDE.md). Questo incarico ha modificato soltanto documentazione: nessuna nuova build, installazione, suite o apertura di vault reali è stata eseguita.

## Ambiente e dipendenze

Il percorso di distribuzione completo è Windows x64 con Rust MSVC, Visual Studio Build Tools C++ e Windows SDK, Node/npm, WebView2 e Inno Setup 7 (temi personalizzati dell'installer). Dalla Beta 1.2.0 il setup non usa più WiX/MSI; al primo utilizzo la build scarica da Microsoft l'installer offline di WebView2 (`installer/payload/`, verificato con Authenticode) e ne tiene una copia per utente in `%LOCALAPPDATA%\JesseArchive-Build\`, riusata dalle build successive e dall'automazione delle release (rinnovata dopo 90 giorni). Non dichiarare offline l'ambiente di compilazione.

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

Nel profilo `dev` (test e `tauri dev`) `scrypt`, `salsa20`, `pbkdf2` e `sha2` sono compilati con `opt-level = 3` (`[profile.dev.package.*]` in `Cargo.toml`): senza ottimizzazioni lo scrypt a N=2^17 del wrapper master (dalla Beta 1.7.0) renderebbe lenti test e sblocco. Le build release sono già ottimizzate.

`serde`/`serde_json` (con `float_roundtrip`, dalla Beta 1.6.0, per rileggere esattamente i decimali dell'header autenticato), `base64`, `url`, `sha1`/`sha2`, `hmac`, `csv`, `roxmltree` (dalla Beta 1.5.0: lettura in sola lettura dell'export XML di KeePass, senza dipendenze proprie), `regex` e librerie di sistema completano il core; lucide-react fornisce icone UI. Il riferimento integrale è [Cargo.toml](../src-tauri/Cargo.toml), [Cargo.lock](../src-tauri/Cargo.lock), [package.json](../package.json), [package-lock.json](../package-lock.json). Le dipendenze transitive possono contenere versioni aggiuntive: non attribuirle automaticamente alle dipendenze dirette.

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

# Diagnostica statica: deve restare senza avvisi (controllata dalla CI)
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Vite da solo non fornisce `invoke` Tauri: un errore IPC in un browser ordinario non dimostra un difetto del core. La build helper produce `jesse_browser_host.exe`, mentre il pacchetto installato usa `jesse-browser-host.exe`; il rename/copy è responsabilità dello script di distribuzione. Controllare il percorso cercato dai test prima di interpretare uno skip. Per sviluppo integrazione browser usare il flusso che prepara risorse e manifest, non presumere che `tauri dev` lo faccia.

Per la sola fixture interoperabile Python, in un ambiente Python separato con `cryptography` disponibile:

```powershell
python tests/test_legacy_fixture.py
```

Il test legge dati sintetici e non richiede la vecchia app Python, rimossa dalla repository nella Beta 1.8.2.

## Test presenti e lacune

| Suite | Copertura effettiva | Limiti |
|---|---|---|
| Test inline `core.rs` | KDF, AES, fusione, TOTP, compatibilità fixture v1; `vault_tests` su un vault sintetico in una cartella temporanea (policy di lunghezza, recupero, generatori: uniformità delle cifre dei PIN con chi quadro, PIN banali, opzioni e bit stimati, password comuni modificate riconosciute deboli; import non validi, round trip export/import, ripristino dopo salvataggio fallito, `ensure_shape`, copie giornaliere (una al giorno, 14 giorni, recupero di un elemento con la password della copia, cancellazione dopo `rotate_key`), `bulk`/`delete` limitato agli elementi nel cestino) | Non coprono interamente CRUD o crash durante scrittura |
| Test inline browser/protocollo/installer/navigation | Matching domini, framing, target fissi e input navigazione; dalla Beta 1.9.2 `browser_channel.rs` su porte locali di prova: token sbagliato o inviato a gocce, limiti di connessioni in attesa e autenticate, frequenza dei messaggi, permessi del file del token letti con le API di Windows | Non certificano sei browser reali |
| `tests/browser-extension.test.mjs` | Casi con mock API e jsdom: focus, compilazione DOM, campi in shadow root aperti, saluto con versione e tipo di installazione, ricaricamento su richiesta | Non sostituisce il motore browser, pagine reali, CAPTCHA o framework esterni |
| `tests/quick-search.test.mjs`, `tests/quick-search-ui.test.mjs` (`npm run test:quick-search`) | Motore: ricerca per nome, username, email, dominio, URL, accenti e maiuscole, parole parziali e multiple, errori di battitura, raggruppamento per servizio, ordine dei risultati, evidenziazione, preferiti e recenti, password mai ricercabili; capability della finestra. UI: la vera `QuickSearch.tsx` in jsdom con comandi ed eventi Tauri simulati: stato iniziale, ricerca, gruppi, tastiera (frecce, Invio, Ctrl+C, Ctrl+Shift+C, Alt/Ctrl+Invio, Esc), chiusura dopo l'azione, azioni rapide, preferiti, password solo su richiesta, blocco con finestra aperta, sblocco | Scorciatoia globale, focus da altre applicazioni, posizione su più monitor e copia reale negli appunti si provano solo nell'app |
| `tests/store-publish.test.mjs` (`npm run test:store`) | Invio agli store (dalla Beta 1.9.6) con API simulate e chiavi sintetiche: ID del Chrome Web Store letto da `browser_protocol.rs`, hash che ignora la sola versione, JWT RS256 del service account e HS256 di AMO, attesa durante una revisione, upload in corso/riuscito/fallito, validazione AMO superata o respinta, add-on non ancora pubblicato | Non chiama gli store reali: il primo invio vero verifica le API |
| `tests/capabilities.test.mjs` (`npm run test:capabilities`) | Permessi per finestra (dalla Beta 1.8.1): legge il codice di ogni finestra (componente, moduli locali importati, moduli comuni di `main.tsx`; gli `import type` non contano), raccoglie i comandi che può chiamare e li confronta con `src-tauri/capabilities/<finestra>.json`; verifica che `build.rs` dichiari esattamente i comandi di `generate_handler!` e che le finestre secondarie usino solo i comandi `api` consentiti | Non avvia l'app: che Tauri rifiuti davvero un comando non consentito si vede nell'app reale |
| `tests/dashboard.test.mjs`, `tests/dashboard-ui.test.mjs` (`npm run test:dashboard`) | Modello: configurazioni mancanti, danneggiate o vecchie, widget sconosciuti o non disponibili, operazioni sul layout, layout indipendenti e ripristino, punteggio, nessun segreto salvato. UI: la vera `Dashboard.tsx`, compilata con esbuild (dipendenza di Vite) e montata in jsdom con un vault sintetico e un backend Tauri simulato. Verifica dati reali, assenza di password e testo delle note, modalità personalizzazione, catalogo, spostamento, ridimensionamento, impostazioni, salvataggio automatico, drag & drop, layout, ripristino con conferma, persistenza dopo un nuovo avvio, aggiornamento quando cambiano i dati, configurazione danneggiata | jsdom non calcola il layout: resa grafica, animazioni e trascinamento col mouse vero vanno provati nell'app |
| `tests/i18n.test.mjs` (`npm run test:i18n`) | Ogni chiave usata nel codice (`t`/`tRich`/`msg`, estratte con [scripts/i18n-keys.mjs](../scripts/i18n-keys.mjs)) e ogni messaggio di `src/locales/runtime-keys.mjs` è tradotto in tutte le lingue con gli stessi segnaposto; nessuna traduzione orfana; ogni voce News tradotta; stesse lingue in frontend e backend | Non verifica la qualità linguistica né i testi Rust non elencati in `runtime-keys.mjs` |
| `tests/passkey-extension.test.mjs` | Sei casi: serializzazione delle opzioni WebAuthn, oggetti `PublicKeyCredential`, fallback, errori, abort, origine presa dal browser e disconnessione | Classi WebAuthn simulate: non sostituisce un collaudo su siti reali |
| `passkey.rs` (test inline) | rpId e PSL, CBOR, `clientDataJSON`, registrazione con login verificato, validazione delle richieste; il test `--ignored` `dump_for_external_verifier` produce dati verificati anche con OpenSSL/Node | Nessun browser reale |
| `tests/browser-host.test.mjs` | Due casi con processo helper, APPDATA isolato e bridge simulato | Può saltare se manca il binario; uno skip non è superamento funzionale |
| `tests/test_legacy_fixture.py` | Vettore crittografico condiviso | Non esegue la UI Python né garantisce tutta la compatibilità bidirezionale |

La precedente esecuzione riportava 11 test libreria Rust e uno di protocollo nel binario helper, oltre ai 6+2 Node. Il protocollo è compilato anche nel binario: non contare il test duplicato come nuova area coperta. Esiste un test GUI Brave ignorato normalmente: apre finestre e usa un profilo dedicato. Prima di eseguirlo leggere `src-tauri/src/browser_navigation.rs`; non avviare indiscriminatamente tutti gli ignored test su una sessione utente. Il precedente controllo manuale della navigazione riguarda Brave soltanto.

Mancano prove complete di concorrenza e durabilità, tutte le categorie CRUD, login reali su ogni browser, installazione/upgrade/disinstallazione in VM e offline su Windows pulito. Non aggiungere test che usino credenziali o vault personali.

## Aggiungere un'azione alla ricerca rapida

Una voce in `QUICK_ACTIONS` (`src/quick-search/actions.ts`) con etichetta tradotta. Se l'azione si esegue nella finestra principale, aggiungi il suo id anche a `ACTIONS` in `src-tauri/src/quick_search.rs` (il backend rifiuta gli id sconosciuti) e il caso corrispondente in `quickOpen` di `App.tsx`. Il motore di ricerca non cambia. Una nuova finestra Tauri richiede il proprio file in `src-tauri/capabilities/` e la sua voce in `WINDOWS` di `tests/capabilities.test.mjs`.

## Aggiungere un widget alla Dashboard

1. Aggiungi il tipo e la specifica in `src/dashboard/model.ts`: categoria, dimensioni, disponibilità, opzioni predefinite e `normalize`.
2. Aggiungi la definizione in `WIDGETS` (`src/dashboard/widgets.tsx`): nome e descrizione con `msg()`, icona, componente, impostazioni ed eventuale `refresh`.
3. Traduci i testi nuovi in tutte le lingue.

Il componente centrale non cambia. Un widget deve usare i dati e i comandi già esistenti, senza mostrare segreti, e non deve chiamare da solo comandi che aggiornano l'attività del vault: quelli nuovi di sola lettura vanno aggiunti all'elenco passivo in `Vault::call`.

La griglia è a posizioni fisse: 4 colonne, riquadri alti 320 px, e ogni widget ha `x`/`y` salvati e resi con le variabili CSS `--x`, `--y`, `--w`. Le regole di spostamento sono in `model.ts` (`placeWidget`, `patchWidget`, `addWidget`) e garantiscono che si muovano solo i widget coinvolti: non usare layout a flusso (`grid-auto-flow`, mosaico), perché ricalcolano la posizione di tutti. `TILE_HEIGHT`, `GRID_GAP` e `NARROW_QUERY` in `Dashboard.tsx` devono restare allineati a `.dash-grid` e alla media query in `style.css`; sotto i 1180 px i widget sono in ordine di lettura.

Il trascinamento usa il drag & drop HTML5: la cella di arrivo è quella del widget sotto il puntatore oppure, nella griglia larga, la cella sotto il puntatore. Durante il trascinamento WebView2 ignora la rotella del mouse: `useDragAutoScroll` fa scorrere l'area dei contenuti quando il puntatore è entro 80 px dal bordo alto o basso, o oltre (per esempio sopra l'intestazione dell'app); la velocità è calcolata da `autoScrollStep` in `model.ts`, testata in `tests/dashboard.test.mjs`. Funziona solo perché la finestra principale ha `"dragDropEnabled": false` in `tauri.conf.json`: con il gestore di rilascio dei file di Tauri attivo (il default), WebView2 su Windows blocca il trascinamento nella pagina e mostra il cursore di divieto. jsdom non riproduce questo comportamento, quindi la regola è verificata da `tests/dashboard.test.mjs`. Se in futuro servisse il rilascio di file nella finestra, il riordino dei widget andrebbe riscritto con eventi pointer.

## Traduzioni

Un nuovo comando Tauri va registrato in `generate_handler!` (`lib.rs`), dichiarato in `COMMANDS` di `src-tauri/build.rs` e consentito solo nei file `src-tauri/capabilities/<finestra>.json` delle finestre che lo usano; un nuovo comando del vault chiamato da una finestra secondaria va aggiunto anche ad `api_allowed` in `lib.rs`. `npm run test:capabilities` fallisce se uno di questi passi manca. `src-tauri/permissions/autogenerated/` è generata da `build.rs` e non è versionata.

Ogni testo visibile nell'interfaccia passa da `t('…')`, `tRich('…', {…})` o `msg('…')` (vedi `src/i18n.ts`), con il testo italiano come chiave e le traduzioni in tutti i file `src/locales/<lingua>.ts`; i messaggi mostrati che arrivano dal backend Rust o dall'estensione vanno elencati in `src/locales/runtime-keys.mjs`, e ogni nuova voce News va tradotta in `src/locales/news/<lingua>.ts`. `npm run test:i18n` (gate della CI) fallisce se manca una traduzione o se i segnaposto `{nome}` non coincidono. `node scripts/i18n-keys.mjs <lingua>` elenca le chiavi ancora mancanti in una lingua. Le lingue sono definite in `src/i18n.ts` (`LANGUAGES`) e in `src-tauri/src/i18n.rs` (`LANGS`, etichette native); aggiungerne una richiede anche il file `src/locales/<lingua>.ts`, le News, il `_locales` dell'estensione e la voce `[Languages]`/`[CustomMessages]` dell'installer.

## Integrazione continua

[.github/workflows/ci.yml](../.github/workflows/ci.yml) gira su `windows-latest` a ogni push e pull request verso `main`: Node 24, Rust stable, `npm ci`, `npx tsc --noEmit`, `npm run format:check`, `npx vite build` (richiesto da `tauri::generate_context!` per `../dist`; non usa `npm run build`, che riscriverebbe lo snapshot dei commit), `cargo test`, `cargo clippy --all-targets -- -D warnings` (dalla Beta 1.4.0: ogni avviso blocca la CI), `npm run test:browser`, `npm run test:i18n`, `npm run test:dashboard`, `npm run test:quick-search`, `npm run test:capabilities`, `npm run test:store`, build release di `jesse_browser_host` e `node --test tests/browser-host.test.mjs`, che così non viene saltato. Il setup Inno e i test GUI ignorati non sono eseguiti. La CI usa Rust stable: una nuova versione di clippy può introdurre avvisi nuovi e far fallire una PR che non li ha causati; in quel caso vanno corretti in una modifica a parte. Ogni modifica deve lasciare la CI verde; una CI verde non sostituisce i collaudi manuali elencati sopra.

[.github/workflows/release-build.yml](../.github/workflows/release-build.yml) (dal 28/11/2026) compila il setup completo sui runner Windows di GitHub, come richiede la firma gratuita di SignPath Foundation ([CODE_SIGNING.md](../CODE_SIGNING.md)): parte a ogni push su `main` che cambia `package.json` (nuova versione), a mano (`workflow_dispatch`) e nelle PR che modificano il workflow o gli script e i file del setup (`Build-Setup-EXE.ps1`, `Build-Distribuzione-Windows.ps1`, `installer/`). `Build-Setup-EXE.ps1` preferisce Inno Setup 7 a un ISCC più vecchio nel PATH: i runner di GitHub hanno Inno Setup 6, che non ha le lingue cinese e coreana dell'installer. Storia Git completa (`fetch-depth: 0`, per l'elenco dei commit nelle News), Inno Setup 7.1.1 scaricato dalla release ufficiale e verificato con lo SHA-256, `Build-Setup-EXE.ps1 -SkipNpmInstall`, controllo della versione del setup, impronta nel riepilogo del job e artefatto `JesseArchive-Setup-<versione>-<commit>` conservato 3 giorni. Per ora **non firma e non pubblica**: le release restano compilate e pubblicate da AutoPublish sul PC; la firma SignPath e il passaggio di AutoPublish al setup del workflow arriveranno dopo l'approvazione della domanda. I runner standard sono gratuiti e senza limite di minuti per i repository pubblici.

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

**Estensione negli store (dalla Beta 1.9.6).** Dopo la release (non con `-Draft`) lo script esegue [scripts/publish-store-extension.mjs](../scripts/publish-store-extension.mjs), passandogli sullo stdin le credenziali decifrate da `%APPDATA%\JesseArchive-Release\store-keys.dpapi` (DPAPI, utente corrente).
- Invia l'estensione solo se il suo codice è cambiato dall'ultimo invio: l'hash dei file ignora `version` e `key` del manifest, quindi una release che cambia solo il numero non invia nulla. L'ultimo invio è in `store-state.json`, nella stessa cartella.
- **Chrome Web Store** (API v2, service account, scope `chromewebstore`): `fetchStatus`; se la versione precedente è `PENDING_REVIEW` non carica e riprova alla release successiva; durante la **prima** revisione, prima di qualsiasi versione approvata, `fetchStatus` non riporta nessuno stato (osservato il 24/11/2026 con la 1.9.5 «In attesa di revisione» nella console): un eventuale upload verrebbe rifiutato dallo store e ritentato alla release successiva, con un avviso; altrimenti `:upload` (attende `SUCCEEDED`) e `:publish`, cioè invio alla revisione. Item ID dal primo `CHROMIUM_STORE_IDS` di `browser_protocol.rs`, publisher ID nelle credenziali.
- **addons.mozilla.org** (API v5, JWT HS256 di un minuto): upload sul canale `listed`, attesa della validazione, nuova versione di `browser@jessearchive.local`. Licenza e scheda restano quelle della versione precedente.
- Un errore degli store non ferma né annulla la release: compare un avviso e si riprova alla release successiva. Senza credenziali l'invio viene saltato. Dopo questo passo lo script azzera `$LASTEXITCODE`: prima della correzione del 28/11/2026 il codice d'uscita di node restava lì, e `Invoke-Publisher.ps1` di AutoPublish segnava come fallita una release pubblicata (osservato con la 1.9.6).
- La **prima versione** di ogni store si pubblica a mano dalla console (le API aggiornano solo elementi esistenti), poi `Store-Keys.ps1 -MarkSubmitted chrome|firefox` la segna come inviata.
- Credenziali con [scripts/Store-Keys.ps1](../scripts/Store-Keys.ps1): `-SetChrome <chiave.json> -PublisherId <id>`, `-SetFirefox` (chiede issuer e secret), `-Status`, `-Check` (chiamate in sola lettura), `-MarkSubmitted`, `-Remove`. Non leggere, stampare o committare le credenziali; il file JSON della chiave va cancellato dopo il salvataggio.
- Prova senza rete: `node scripts/publish-store-extension.mjs --state <file> --dry-run`. Test con API simulate: `npm run test:store`.

Opzioni: `-DryRun` (solo controlli e anteprima delle note), `-SkipBuild` (pubblica il setup già presente se è della versione corrente), `-Draft` (release in bozza), `-NotesSince X.Y.Z`, `-Yes`.

Regole: ogni aggiornamento per gli utenti porta il bump di versione e la voce News nella stessa PR; si pubblica solo dopo il merge, da `main`. Non creare a mano tag `v*` o release. Nessun workflow GitHub compila o pubblica il setup: `ci.yml` esegue solo i controlli. Il setup non è firmato. La prima release pubblicata è Beta 1.1.12 (17 novembre 2026).

Il repository è pubblico (dal 17 novembre 2026): codice, storia, release e asset sono visibili e scaricabili da chiunque. Dal 28 novembre 2026 il codice è distribuito con licenza GNU GPL versione 3 o successiva ([LICENSE](../LICENSE), `GPL-3.0-or-later` in `package.json` e `Cargo.toml`): chiunque può usarlo, studiarlo, modificarlo e ridistribuirlo, ma chi distribuisce una versione modificata deve pubblicarne il codice con la stessa licenza. Nome, logo e dominio restano riservati alle versioni ufficiali ([TRADEMARKS.md](../TRADEMARKS.md)): un fork modificato deve usare un nome e un logo diversi. Le PR da fork eseguono solo `ci.yml` con token in sola lettura.

## Setup Windows completo

Chiudere JesseArchive anche nel tray: gli script verificano il processo e si interrompono se attivo. Non terminare forzatamente un processo con operazioni sui dati in corso. Per rigenerare il setup, quando autorizzato:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1

# Solo se le dipendenze sono già correttamente installate
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1 -SkipNpmInstall
```

Flusso reale:

1. `Build-Setup-EXE.ps1` verifica prerequisiti (Inno Setup 7) e processo; richiama `Build-Distribuzione-Windows.ps1` con formato `app`.
2. Lo script interno installa eventualmente npm, esegue test Rust, build frontend e test browser, genera copie/manifest estensione, compila e verifica helper, poi `tauri build --no-bundle` (solo il programma, frontend incorporato).
3. Lo script esterno verifica che `jesse_archive.exe` e `jesse_browser_host.exe` siano appena compilati, prepara `installer/payload/MicrosoftEdgeWebView2RuntimeInstallerX64.exe` (copiato dalla cache per utente `%LOCALAPPDATA%\JesseArchive-Build\` oppure, se manca o ha più di 90 giorni, scaricato da `go.microsoft.com/fwlink/?linkid=2124701`; firma Authenticode Microsoft e dimensione verificate sia sulla copia sia sulla cache, che viene eliminata se non valida) e compila [JesseArchive-Setup.iss](../installer/JesseArchive-Setup.iss).
4. Il distributable contiene `JesseArchive-Setup.exe`, ZIP Chromium/Firefox e guida.

Dalla Beta 1.2.0 Inno è l'unico installer, con disinstallazione propria (voce in «App installate», `AppId` fisso nello script: non cambiarlo). Installa gli stessi file dell'MSI precedente: `jesse_archive.exe`, `jesse-browser-host.exe` (dal binario `jesse_browser_host.exe`), `browser-extension/{chromium,firefox}` e la guida, più i collegamenti nel menu Start e, facoltativo, sul desktop (AppUserModelID `app.jesse.archive`). In `PrepareToInstall`, prima di copiare i file: attende la chiusura dell'app (in silent fino a 30 s, l'aggiornamento automatico la chiude subito dopo aver avviato il setup), chiude l'helper browser, installa WebView2 se manca e rimuove con `msiexec /x /qn` l'eventuale installazione MSI della 1.1.21 o precedenti, riusandone la cartella. La cartella predefinita è, in ordine: `/INSTALLDIR=` (aggiornamento automatico), installazione Inno precedente, cartella dell'MSI, `Program Files`. La disinstallazione toglie anche il valore `Run` dell'avvio automatico e le registrazioni Native Messaging dell'utente; vault, impostazioni e file in AppData restano. Stile: `WizardStyle=modern dark` con le immagini di `installer/art/`, generate da [scripts/installer-art.ps1](../scripts/installer-art.ps1) con i colori del tema «Notte» (dalla Beta 1.2.1 una misura esatta per ogni scala DPI, logo dall'originale in `installer/art-source/`, angoli con antialiasing, pannello laterale trasparente sopra lo sfondo delle pagine; nome e sottotitolo sotto il logo non sono nell'immagine ma etichette native create da `InitializeWizard`/`AddBrandLabels`, con ClearType come il resto del testo; rieseguirlo dopo aver cambiato logo o palette). La pagina finale offre due spunte post-installazione, eseguite come utente originale e saltate in modalità silent: "Configura le estensioni dei browser" (`--browser-setup`) e, subito sotto, "Avvia Jesse's Archive". Se sono selezionate entrambe, `NextButtonClick(wpFinished)` toglie la seconda: la guida avvia già l'app e il suo pulsante "Ho installato l'estensione" apre la finestra principale, evitando due avvii simultanei che competerebbero sul controllo di istanza singola. L'ordine delle due voci `[Run]` è significativo (indice 0 e 1 di `RunList`). Nota: `ISCC /O-` (solo verifica di sintassi) cancella comunque il setup esistente nella cartella di output. L'elevazione con credenziali di un altro account richiede verifica del contesto HKCU e della guida. La firma del codice del setup non è configurata; l'invio dell'estensione agli store è descritto in «Pubblicazione delle release».

La soglia di 100 MB sull'installer WebView2 è un'euristica, non prova che ogni dipendenza sia disponibile offline. La build Tauri diretta e `Build-Windows.ps1` storico non preparano da soli tutto il pacchetto browser. Il formato NSIS è previsto nello script interno, ma le note storiche riportano un problema NSISCOMCALL; il percorso corrente è il solo Inno (formato `app`); i formati `msi`/`exe` dello script interno restano per diagnosi. Riferimenti operativi preesistenti: [DISTRIBUZIONE-WINDOWS](../DISTRIBUZIONE-WINDOWS.md), [SETUP-EXE-OFFLINE](../SETUP-EXE-OFFLINE.md), da confrontare sempre con gli script attuali.

## Artefatti generati e versioni

- `scripts/generate-commits.mjs`, eseguito dal prebuild npm, riscrive il file versionato `src/commits.generated.json` usando Git. Le date commit sono `%cI`, lo snapshot arriva fino a 250 voci; non è un servizio live.
- `scripts/package-store-extension.mjs` (`npm run package:store`) crea in `store/out/` (ignorata da Git) gli zip per gli store dalle copie generate in `browser-extension/<browser>/`: per Chromium toglie `key` dal manifest (lo store assegna il proprio ID), usa separatori `/` con il `tar.exe` di Windows. Testi e immagini delle schede sono in `store/`, l'informativa in `PRIVACY.md`.
- `scripts/package-browser-extension.mjs` copia il background canonico nelle due directory, prepara manifest e identità Chromium. Preservare la chiave **pubblica** e l'identità esistenti: rigenerarle cambia il collegamento Native Messaging. Non introdurre chiavi private nel repository.
- `src-tauri/resources/` e la configurazione browser merge sono artefatti ignorati. I profili dei test e gli output di compilazione non sono sorgenti.
- La versione compare in package.json/Cargo/Tauri/Inno e nei manifest generati; lockfile e fallback UI vanno valutati se si modifica la versione. Non eseguire un bump per una richiesta soltanto documentale.
- Il codice Rust e `src/` sono formattati (rustfmt predefinito, Prettier 3 con `.prettierrc.json`); la CI esegue `npm run format:check`. Il commit di formattazione iniziale è in `.git-blame-ignore-revs`: usare `git config blame.ignoreRevsFile .git-blame-ignore-revs` per un blame utile. `browser-extension/` non è formattato da Prettier. Clippy non è un gate certificato.

## Metodo di lavoro

Individuare prima comando IPC, UI e persistenza coinvolti; leggere le funzioni chiamate e i test. Separare matcher UI da matcher autorizzativo, sorgenti canonici da copie generate. Preservare il formato v1 e aggiungere fixture compatibili prima di cambiarlo. Non usare `unwrap` come validazione di input esterno e non registrare segreti. Per comportamento e limiti attuali vedere [SECURITY](SECURITY.md) e [DATABASE](DATABASE.md), senza interpretarli come autorizzazione a correggerli fuori scope.

Dopo una modifica eseguire i controlli pertinenti, compilare quando appropriato e controllare `git diff` per artefatti inattesi. Aggiornare solo i documenti influenzati secondo [AGENTS](../AGENTS.md); dichiarare nel resoconto quelli aggiornati e perché, oppure esplicitare che non servono aggiornamenti. Una modifica puramente documentale richiede verifica di link, nomi e coerenza, senza rigenerare build o toccare dati reali. I vecchi README sono contesto storico: affermazioni come “mai compilato” o “nessun remoto” non descrivono necessariamente la baseline attuale.
