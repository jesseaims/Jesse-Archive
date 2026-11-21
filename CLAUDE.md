# JesseArchive — guida operativa per Claude Code

Leggere prima [AGENTS.md](AGENTS.md): contiene le regole condivise e si applica integralmente anche a Claude Code. Questo file è la mappa iniziale; i dettagli tecnici sono nei sei documenti in `docs/`. Non usare un vecchio README o una nota di release come prova dell'implementazione corrente.

Baseline analizzata: **Beta 1.1.4**, commit `1f09624`, revisione documentale del **17 novembre 2026**. I numeri di versione qui indicano la baseline dell'analisi, non sostituiscono i manifest del progetto.

## A. Project Overview

**JesseArchive**, denominato anche **Jesse's Archive** nell'interfaccia e nei bundle, è un password manager desktop orientato a Windows. Archivia account, note e altre informazioni sensibili in un file locale cifrato. Il prodotto non richiede un account online proprio e non offre un servizio cloud gestito dal progetto.

Il client attivo usa Rust per la logica, Tauri per l'integrazione desktop e React/TypeScript per l'interfaccia, scritta in italiano e tradotta in nove lingue (`src/i18n.ts`, `src/locales/`). La vecchia applicazione Python è stata rimossa dalla Beta 1.8.2 (resta nella cronologia Git); la compatibilità con i suoi vault v1 è verificata da una fixture sintetica. La filosofia da preservare è: dati locali, compatibilità del vault v1, cambiamenti limitati allo scopo, operazioni sui dati esplicite e test su fixture sintetiche. La dicitura Beta non costituisce una certificazione di sicurezza.

## B. Project Architecture

| Area | Responsabilità e collegamento |
|---|---|
| `src-tauri/src/main.rs` | Avvia `jesse_archive_lib::run()` |
| `src-tauri/src/lib.rs` | Builder Tauri, `AppState(Mutex<Vault>)`, dispatcher IPC, clipboard, dialoghi file, tray, singola istanza |
| `src-tauri/src/core.rs` | `Vault`, `Vault::call`, cifratura, CRUD, storico, import/export, merge, generatori e utility Windows |
| `src/main.tsx`, `src/App.tsx` | Selezione della UI per finestra; stato e schermate principali React |
| `src/api.ts`, `src/types.ts`, `src/theme.ts`, `src/style.css` | Contratti IPC, tipi, palette e stile condiviso |
| `src-tauri/src/browser.rs`, `browser_channel.rs` | Scorciatoia globale, connessioni locali (file del token riservato all'utente, autenticazione e limiti in `browser_channel.rs`), sessione di compilazione, ricerca e rilascio delle credenziali |
| `src-tauri/src/browser_save.rs`, `browser-extension/save-capture.js` | Proposta di salvataggio degli account inviati sui siti: cattura, decisione nuovo/aggiorna, conferma nella mini finestra |
| `src-tauri/src/browser_protocol.rs`, `src-tauri/src/bin/jesse_browser_host.rs` | Framing JSON e relay tra Native Messaging e socket loopback |
| `src-tauri/src/browser_installer.rs`, `src-tauri/src/browser_navigation.rs` | Rilevamento browser e guida Windows con navigazione controllata via Win32 |
| `src/QuickFill.tsx`, `src/BrowserInstaller.tsx`, `src/BrowserSettings.tsx` | Mini finestra, guida di configurazione e relative impostazioni |
| `src-tauri/src/quick_search.rs`, `src-tauri/src/clipboard.rs`, `src/quick-search/` | Ricerca rapida globale: scorciatoia, finestra `quick-search`, solo metadati alla webview, copia nel backend; motore di ricerca puro in `engine.ts` |
| `browser-extension/background.js` | Contesto della pagina e riempimento dei campi; sorgente delle copie Chromium/Firefox |
| `scripts/`, `installer/`, script PowerShell in root | Generazione metadati e pacchetti; setup unico Inno (dalla Beta 1.2.0, niente MSI) |

Finestre Tauri: `main`, `quick-fill`, `quick-search`, `browser-setup`, ognuna con i soli permessi dei comandi che usa (`capabilities/<finestra>.json`, comandi dichiarati in `build.rs`, `api` limitato per finestra da `api_allowed`; `npm run test:capabilities`). Il frontend sceglie il componente tramite la query string. Il flusso principale è UI → `invoke('api')` → `Vault::call` → JSON cifrato su disco. Quello browser è estensione → helper → socket autenticato → selezione nella mini finestra → credenziale selezionata → campo DOM. Vedere [ARCHITECTURE](docs/ARCHITECTURE.md) per eventi, comandi e confini di fiducia.

## C. Technology Stack

| Tecnologia | Ruolo verificato |
|---|---|
| Rust, edition 2021 | Backend e helper; compilatore osservato `rustc 1.100.0`, non fissato nel repository |
| Tauri 2 | Webview desktop, comandi, eventi, tray; plugin single-instance e global-shortcut |
| React 19, TypeScript 5.7, Vite 6 | Componenti, controlli statici e bundle frontend |
| `serde_json` | Modello dinamico del vault e messaggi; nessun database SQL/ORM |
| `aes-gcm`, `scrypt`, `rand`, `zeroize` | AES-256-GCM, derivazione, casualità OS e cancellazione delle chiavi Rust protette |
| `hmac`, `sha1`, `sha2`, `data-encoding` | TOTP, verifica Pwned Passwords e hash della copia del vault |
| `url`, `psl`, `csv`, `roxmltree`, `reqwest` | URL/PSL offline, import/export (anche XML di KeePass) e richieste HTTP opzionali |
| `ed25519-dalek` | Verifica della firma degli aggiornamenti automatici (`updater.rs`) |
| `p256` | Passkey WebAuthn ES256 (`passkey.rs`) |
| `rfd`, `clipboard-win`, `winreg`, `windows-sys` | Dialoghi e integrazione Windows |
| Node.js/npm, Cargo MSVC, Tauri, Inno Setup 7 | Toolchain e distribuzione Windows con WebView2 offline |
| Node test runner, jsdom, fixture Python | Test dell'estensione, relay nativo e compatibilità crittografica |

Versioni esatte risolte, prerequisiti Node e distinzione fra toolchain osservata e requisiti dichiarati sono in [DEVELOPMENT](docs/DEVELOPMENT.md). Non dedurre il requisito minimo Rust dalla sola edition: l'MSRV complessivo è **Da verificare**.

## D. Core Functionalities

Il catalogo completo, con file, dipendenze e limiti, è [FEATURES](docs/FEATURES.md).

| Funzionalità | Stato effettivo e riferimenti |
|---|---|
| Creazione, sblocco, blocco, recupero, cambio master | Implementate in `core.rs`, usate da `App.tsx` e in parte `QuickFill.tsx`; scadenza per inattività su ogni comando e thread ogni 5 s |
| Sei categorie, cartelle, preferiti, cestino e operazioni multiple | Implementate in `Vault::call`, `src/types.ts`, `App.tsx`; import JSON/`.jshare` validati e atomici, nessuno schema completo dei campi |
| Storico delle password e riassegnazione | Implementati con `link`, `pw_*`, `PasswordPage`; la UI riassegna agli account login |
| Password, PIN, username, passphrase | Implementati con `generate`; passphrase a sillabe e stime di robustezza euristiche |
| TOTP e salute password | Implementati in `core.rs`; TOTP fisso SHA-1/6 cifre/30 secondi |
| Verifica violazioni e favicon | Implementate, opzionali e con rete; `breaches`, `group_logo`, `SecurityPage`, `saveItem` |
| Esportazione/importazione e pacchetti cifrati | Implementati in `core.rs` e Settings; export JSON/CSV in chiaro, `.jshare` cifrato; selezione fine non completamente esposta nella UI |
| Cartelle cloud e fusione | Implementazione locale per timestamp; nessuna API cloud del progetto, collaudo concorrente parziale |
| Aggiornamento automatico | Implementato in `updater.rs`/`Updater.tsx`: controllo disattivabile, conferma utente, manifest firmato Ed25519 verificato prima del setup silenzioso; collaudato end-to-end dall'utente |
| Ricerca rapida globale | Implementata: Ctrl+Shift+Space (personalizzabile), finestra `quick-search`, ricerca per nome/username/email/dominio con errori di battitura, account raggruppati per servizio, copia/mostra password, apri sito o vault, tastiera completa; solo metadati nella finestra, usati di recente salvati nel vault cifrato (solo id), nessuna cronologia delle ricerche; `npm run test:quick-search` |
| Dashboard personalizzabile | Implementata in `src/dashboard/`: registro dei widget, layout multipli, drag & drop nativo, salvataggio automatico in `settings.dashboard`; `health`/`backup_info` passivi; `npm run test:dashboard` |
| Lingua dell'interfaccia | Implementata: pulsante «Lingua», dieci lingue, preferenza `lang` del dispositivo, tray/titoli/messaggi del backend, News, installer ed estensione tradotti; `npm run test:i18n` verifica la completezza |
| Tray, avvio Windows, clipboard e temi | Implementati con limiti di piattaforma e di durata del processo; dimensione, posizione e stato massimizzato della finestra ricordati per dispositivo (`window_state.rs`) |
| Inserimento browser | Parziale: login HTTPS, selezione esplicita, PSL e due passaggi manuali; campi in shadow root aperti e iframe dello stesso dominio registrabile (`frame_allowed`); provato su Brave, altri siti e browser da collaudare |
| Salvataggio account dal browser | Parziale/da collaudare sui siti (Beta 1.3.0): registrazione, login non salvati e password cambiate; solo digitazione reale, conferma nella mini finestra, note a scelta, «Mai per questo sito» in `settings.never_save` |
| Passkey WebAuthn | Parziale/da collaudare sui siti: `passkey-page.js` → bridge → `passkey.rs`; ES256, conferma nella mini finestra, fallback al browser; niente autofill condizionale |
| Guida estensioni | Implementata; caricamento iniziale ancora manuale, Firefox locale temporaneo |
| News e commit offline con orari individuali | Implementati in `NewsPanel.tsx`, changelog e snapshot generato |

Non esiste una roadmap approvata per biometria, provider passkey di sistema o servizi cloud: sono assenze rilevate, non impegni di sviluppo.

## E. Security Architecture

Il contenuto del vault è cifrato con AES-256-GCM e DEK casuale di 32 byte. La master password e il codice di recupero derivano separatamente chiavi scrypt che proteggono due copie della stessa DEK. Dalla Beta 1.6.0 l'header è autenticato con un HMAC derivato dalla DEK (`mac`), adottato da altre copie solo se valido; il cambio master con la spunta «La vecchia password potrebbe essere stata scoperta» e «Nuovo codice di recupero» cambiano la DEK (`rotate_key`) e generano un nuovo codice di recupero. Dalla Beta 1.7.0 il wrapper master usa scrypt N=2^17 (`kdf` nell'header, migrazione al primo sblocco; le versioni precedenti non aprono più il vault migrato) e ogni scrittura porta un contatore `wt` che, confrontato con `seen_writes` della configurazione del dispositivo, fa avvisare allo sblocco se il file è stato sostituito con una copia più vecchia. Parametri e layout esatti sono in [SECURITY](docs/SECURITY.md) e [DATABASE](docs/DATABASE.md).

Il codice usa `Zeroizing` per alcune chiavi; non per tutto il JSON, i buffer, l'IPC o la memoria JavaScript. Dalla Beta 1.8.0 il frontend principale riceve uno stato senza segreti (`public_item`, campo `has`) e li chiede uno alla volta (`secret`, `item_full`, copia nel backend con `copy_vault_secret`); `browser_state` resta solo per il backend. Il campo password mascherato non è una protezione della memoria. Dalla Beta 1.4.0 lo sblocco rallenta dopo 5 tentativi errati (30 s che raddoppiano fino a 15 minuti, contatore nella configurazione del dispositivo).

La scadenza (`expire_if_idle`) si verifica su ogni comando e in un thread ogni 5 secondi; ogni blocco emette `vault-locked` e la UI azzera il proprio stato. Non documentarla come cancellazione garantita della memoria JavaScript. La rotazione master/recovery riscrive i wrapper e conserva la DEK; i backup storici possono mantenere accessi precedenti. Non risultano autenticazione biometrica, keyring OS, firma del payload applicativo, anti-rollback o audit di sicurezza indipendente.

Il bridge browser autentica un canale locale con un token per avvio salvato in AppData; non è una difesa contro codice ostile già in esecuzione come lo stesso utente. L'estensione controlla HTTPS, pagina e campo; il backend ammette solo frame dello stesso dominio registrabile della scheda; la scelta delle credenziali rimane esplicita.

## F. Database & Data Management

Non ci sono tabelle SQL: `Vault.data` è un `serde_json::Value` con collezioni `items`, `passwords`, `folders`, più `groups`, `deleted`, `settings` e `settings_upd`. Il file esterno conserva versione, sali, wrapper, timestamp di header e blob cifrato.

Percorso del vault: override `JESSE_ARCHIVE_VAULT`, poi configurazione dispositivo, poi file legacy accanto all'EXE se presente, altrimenti AppData locale Windows. Le preferenze dispositivo e browser sono fuori dal vault. Non riportare valori reali di questi file nei documenti.

`atomic_write` usa temporaneo, sincronizzazione del file, copia `.bak` e sostituzione con percorso di rollback Windows. `loc_move` copia e verifica SHA-256, conservando l'originale. `pull`/`merge_data` fondono per timestamp e tombstone; non sono un database transazionale. Import JSON, CSV e `.jshare` hanno comportamenti diversi: leggere [DATABASE](docs/DATABASE.md) prima di intervenire.

## G. Development Guidelines

Ogni testo visibile nell'interfaccia passa da `t('…')`, `tRich('…', {…})` o `msg('…')` (vedi `src/i18n.ts`), con il testo italiano come chiave e le traduzioni in tutti i file `src/locales/<lingua>.ts`; i messaggi mostrati che arrivano dal backend Rust o dall'estensione vanno elencati in `src/locales/runtime-keys.mjs`, e ogni nuova voce News va tradotta in `src/locales/news/<lingua>.ts`. `npm run test:i18n` (gate della CI) fallisce se manca una traduzione o se i segnaposto `{nome}` non coincidono.

Applicare le regole di [AGENTS.md](AGENTS.md): interventi piccoli, nessuna modifica estranea, riuso degli helper, compatibilità v1, gestione esplicita degli errori e dipendenze motivate. Il codice è formattato con rustfmt (stile predefinito) e Prettier (`.prettierrc.json`): eseguire `npm run format` prima del commit; la CI rifiuta codice non formattato. La formattazione non autorizza a riorganizzare o riscrivere `core.rs`/`App.tsx`, che restano monolitici.

Per Claude Code, ricercare prima il nome del comando in `src/App.tsx`/`src/api.ts` e nel match di `Vault::call`, oppure nei comandi `browser_*`. Seguire poi persistenza, test e UI chiamanti. Non trasferire automaticamente comportamenti Python nel Rust, né modificare le copie generate dell'estensione al posto della sorgente canonica.

## H. Build, Run & Testing

Dalla root del progetto:

```powershell
npm ci
npm run tauri dev
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:browser
node --test tests/browser-host.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1 -SkipNpmInstall
```

La procedura completa è `Build-Setup-EXE.ps1` (programma compilato senza pacchetto Tauri, poi Inno); `Build-Windows.ps1` e il comando Tauri diretto non includono da soli il confezionamento del componente browser. `npm ci` installa e può eseguire script di dipendenze; non è un controllo in sola lettura. Non eseguire `npm run build` durante un incarico strettamente documentale: il prebuild aggiorna uno snapshot versionato.

La CI GitHub Actions (`.github/workflows/ci.yml`, Windows) esegue questi controlli, escluso il setup, a ogni push/PR verso `main` e deve restare verde. Le release non sono compilate da GitHub: dopo il merge di una nuova versione eseguire `git fetch origin`; l'automazione locale `JesseArchive-AutoPublish` le compila e pubblica da questo PC con `Publish-Release.ps1` (vedere [DEVELOPMENT](docs/DEVELOPMENT.md#pubblicazione-delle-release) e AGENTS.md).

Il test dell'host può essere saltato quando manca il binario; non trasformare uno skip in un successo funzionale. Il test Brave con `--ignored` apre realmente una finestra e un profilo dedicato. Per prerequisiti, comandi diagnostici, effetti collaterali e prove ancora necessarie vedere [DEVELOPMENT](docs/DEVELOPMENT.md).

## I. AI Agent Working Rules

Prima: identificare i file, analizzare il codice pertinente e i suoi contratti, comprendere le dipendenze, valutare gli effetti collaterali, preparare un piano sintetico se necessario. Dopo: eseguire test pertinenti, compilare quando opportuno, verificare regressioni e documentazione, riepilogare file cambiati e problemi residui. Non eseguire operazioni distruttive o modificare dati reali senza autorizzazione.

**Documentazione sempre aggiornata, obbligo per Claude Code, Codex e tutti gli agenti:** ogni modifica che altera informazioni documentate deve aggiornare nello stesso intervento solo le pagine interessate. Funzionalità → `FEATURES`; architettura → `ARCHITECTURE`; sicurezza → `SECURITY`; dati/persistenza → `DATABASE`; dipendenze/comandi → `DEVELOPMENT`; stato significativo → `ROADMAP`; stack o istruzioni generali → anche `CLAUDE.md`/`AGENTS.md` quando necessario. I percorsi completi e la matrice canonica sono in [AGENTS.md](AGENTS.md#documentazione-sempre-aggiornata--obbligo-permanente).

Nel resoconto finale dichiarare quali documenti sono cambiati e perché; se nessuno richiede aggiornamento, dichiararlo esplicitamente. Le regole non richiedono di riscrivere ogni documento per ogni ritocco grafico. Una funzionalità proposta non va descritta come implementata; usare **Da verificare** per informazioni non dimostrate. La manutenzione è responsabilità dell'agente: nessun hook di aggiornamento documentale è stato aggiunto.

## J. Current Project Status

Il repository contiene una Beta Windows con core, UI e integrazione browser operativi nel codice. La sessione di sviluppo precedente a questa analisi ha prodotto il setup 1.1.4 e superato le suite automatiche; questa attività documentale non li ha rieseguiti e non è un nuovo collaudo del prodotto.

Limiti principali: azzeramento dei segreti incompleto; validazione limitata agli import e alla forma del vault, senza schema completo; assenza di transazioni e test estesi di concorrenza; processo di distribuzione browser manuale/parziale; compatibilità su tutti i browser e installazione offline su macchina pulita **Da verificare**. L'apertura della pagina estensioni è stata provata su Brave nella sessione precedente, non certificata sugli altri browser.

Vedere [ROADMAP](docs/ROADMAP.md) per stato, criticità e proposte separate dagli impegni effettivi. Nessuna proposta contenuta nella documentazione autorizza da sola una modifica al codice.
