# Regole condivise per gli agenti AI

Queste istruzioni valgono per Codex, Claude Code e qualsiasi altro agente che lavora su JesseArchive. Le richieste esplicite dell'utente delimitano sempre l'intervento. Leggere questo file prima di modificare il repository; per orientarsi consultare [CLAUDE.md](CLAUDE.md) e la documentazione tecnica in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Orientamento e confini

- Il prodotto attivo è un'app desktop Windows: Rust + Tauri 2, interfaccia React/TypeScript. Il vault è JSON cifrato, non SQL.
- `src-tauri/src/core.rs` contiene dati, cifratura e dispatcher `Vault::call`; `src-tauri/src/lib.rs` espone IPC, clipboard e ciclo di vita.
- `src/App.tsx` gestisce l'interfaccia principale; `src/QuickFill.tsx` il pannello rapido; `src/BrowserInstaller.tsx` la guida browser. Il routing delle finestre è in `src/main.tsx`.
- L'integrazione browser attraversa i moduli `browser*.rs`, il binario `jesse_browser_host` e `browser-extension/background.js`. Non confondere il socket locale con un server HTTP del vault.
- Dalla Beta 1.8.2 la vecchia applicazione Python (`legacy-python/`) non è più nella repository e resta nella cronologia Git (commit `388f0e4`, ultima versione nel commit precedente alla rimozione). La compatibilità con i vault v1 creati da quella versione resta verificata da `fixtures/legacy_v1_synthetic.json` (test Rust `legacy_python_vectors` e `tests/test_legacy_fixture.py`): non rimuoverla.
- I documenti `AGGIORNAMENTO-*`, `CORREZIONI-*`, `FIX-*` e parte dei README conservano descrizioni di revisioni precedenti. Verificare ogni affermazione nel codice corrente; vedere [docs/ROADMAP.md](docs/ROADMAP.md).

## Prima di una modifica significativa

1. Controllare `git status` e preservare le modifiche dell'utente.
2. Individuare file, funzioni, chiamanti, formati persistiti e test coinvolti; leggere le relative pagine in `docs/`.
3. Valutare effetti su compatibilità, sessione, memoria, import/export, IPC e distribuzione. Preparare un piano breve quando serve.
4. Eseguire soltanto il lavoro autorizzato. Una richiesta di documentazione non autorizza correzioni del codice.

## Come intervenire

- Preferire modifiche circoscritte; non riscrivere moduli interi, rimuovere funzionalità o modificare aree estranee alla richiesta.
- Formattazione: rustfmt (stile predefinito) e Prettier 3 (`.prettierrc.json`, ambito `src/`). Eseguire `npm run format` prima del commit; `npm run format:check` è un gate della CI. `browser-extension/` è escluso da Prettier perché le copie generate sono versionate. I commit di sola formattazione vanno aggiunti a `.git-blame-ignore-revs`.
- Riutilizzare helper e componenti esistenti. Evitare logica duplicata e dipendenze senza una necessità concreta.
- Conservare nomi di categorie, campi sconosciuti, wrapper crittografici, marker dei pacchetti e compatibilità del formato v1, salvo una modifica esplicitamente richiesta con migrazione e test appropriati.
- Tenere distinti modello Rust/JSON e tipi TypeScript; verificare entrambi i lati quando cambia un contratto IPC.
- Non confondere raggruppamento grafico (`domainOf`, `groupFor`) e autorizzazione delle credenziali (`same_account_site`). Gli iframe di accesso sono ammessi solo sullo stesso dominio registrabile della scheda (`frame_allowed`, decisione dell'utente per la Beta 1.1.20): non allargarli oltre senza una decisione esplicita.
- Ogni testo visibile nell'interfaccia passa da `t('…')`, `tRich('…', {…})` o `msg('…')` (vedi `src/i18n.ts`), con il testo italiano come chiave e le traduzioni in tutti i file `src/locales/<lingua>.ts`; i messaggi mostrati che arrivano dal backend Rust o dall'estensione vanno elencati in `src/locales/runtime-keys.mjs`, e ogni nuova voce News va tradotta in `src/locales/news/<lingua>.ts`. `npm run test:i18n` (gate della CI) fallisce se manca una traduzione o se i segnaposto `{nome}` non coincidono.
- Mantenere palette e componenti grafici condivisi. Non aggiungere dettagli tecnici ai flussi del prodotto se non aiutano l'utente.
- Gli script generano copie dell'estensione e snapshot Git: modificare la sorgente canonica, non solo una copia. Leggere gli effetti collaterali in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
- Gestire errori e casi limite; non nascondere errori di salvataggio o presentare un'operazione fallita come riuscita. Non introdurre nuovi `unwrap` su input esterni.

## Sicurezza e dati reali

- Usare fixture sintetiche e directory di prova isolate. Nessun avvio, import, ripristino, spostamento o modifica di un vault reale senza autorizzazione esplicita.
- Non leggere o riportare password, codici di recupero, token, chiavi private o dati personali. Non inserirli in log, screenshot, documenti o commit.
- Non eseguire operazioni distruttive, reset Git o pulizie ricorsive non richieste.
- La chiave privata che firma gli aggiornamenti (`%APPDATA%\JesseArchive-Release\update-signing-key.dpapi`) non va letta, stampata, copiata né committata; usare solo `scripts/Update-SigningKey.ps1` e `Publish-Release.ps1`. Cambiare `src-tauri/update-public-key.txt` interrompe gli aggiornamenti automatici delle installazioni esistenti.
- Non aggiungere stampe diagnostiche su stdout del Native Messaging host: stdout è il protocollo binario incorniciato e può trasportare credenziali.
- Non dichiarare garantiti azzeramento JavaScript, blocco immediato per inattività, firma del setup o protezione anti-rollback: i limiti reali sono in [docs/SECURITY.md](docs/SECURITY.md).

## Verifica proporzionata

Comandi dalla root, da scegliere secondo l'intervento:

```powershell
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:browser
node --test tests/browser-host.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1 -SkipNpmInstall
```

Il test dell'host richiede il relativo EXE compilato; in sua assenza viene saltato. Il test Brave interattivo è ignorato di default e apre un profilo di prova: non abilitarlo indiscriminatamente. Il setup richiede l'app chiusa, tool Windows e Inno Setup. `npm run build` aggiorna `src/commits.generated.json`; la procedura completa rigenera anche manifest e copie dell'estensione. Non eseguirli in un incarico che vieta tali scritture.

Ogni aggiornamento per gli utenti include nella stessa PR il bump di versione (package.json, Cargo, Tauri, Inno, manifest, `NewsPanel`) e la voce in `src/news-changelog.ts`. Dopo il merge eseguire `git fetch origin` nella repository locale: l'automazione locale (attività `JesseArchive-AutoPublish`) attende CI verde e app chiusa, poi compila e pubblica da questo PC con [Publish-Release.ps1](Publish-Release.ps1) la release "Beta X.Y.Z" con `JesseArchive-Setup.exe`. Non avviare a mano un secondo `Publish-Release.ps1` in parallelo (un blocco di sistema lo fermerebbe con exit code 75). Non creare tag `v*` o release a mano e non pubblicare da branch non uniti.

Un nuovo comando Tauri va registrato in `lib.rs`, dichiarato in `src-tauri/build.rs` e consentito solo nei file `src-tauri/capabilities/<finestra>.json` delle finestre che lo usano (`npm run test:capabilities`); non riunire le finestre in un'unica capability.

La CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) esegue tipi, build frontend, test Rust e Node e clippy senza avvisi (`-D warnings`) su Windows a ogni push/PR verso `main`: ogni modifica deve lasciarla verde.

Una build non sostituisce il collaudo di login, recupero, conflitti cloud, installazione e browser. Registrare esito, controlli saltati e motivi. Per modifiche soltanto documentali bastano controlli di riferimenti, coerenza e perimetro delle modifiche: non ricompilare l'app per abitudine.

## Documentazione sempre aggiornata — obbligo permanente

Ogni agente deve aggiornare, nello stesso intervento, i documenti le cui informazioni cambiano. L'aggiornamento deve essere proporzionato: non riscrivere documenti estranei e non inventare funzionalità o roadmap.

| Cambiamento | Documento da verificare e aggiornare se interessato |
|---|---|
| Funzionalità introdotta, modificata o rimossa | `docs/FEATURES.md` |
| Moduli, responsabilità, IPC o flussi | `docs/ARCHITECTURE.md` |
| Cifratura, autenticazione, segreti o controlli di sicurezza | `docs/SECURITY.md` |
| Formati, CRUD, persistenza, import/export, backup o merge | `docs/DATABASE.md` |
| Dipendenze, tool, comandi, test o distribuzione | `docs/DEVELOPMENT.md` |
| Stato significativo, limite risolto o nuova lacuna | `docs/ROADMAP.md` |
| Stack generale, architettura o istruzioni operative | `CLAUDE.md` e questo `AGENTS.md`, quando necessario |

Dopo ogni implementazione: completare il codice, eseguire i controlli pertinenti, verificare il comportamento, aggiornare i documenti coinvolti e confrontarli con il codice. Nel resoconto finale indicare file modificati, verifiche, problemi residui e documenti aggiornati con il motivo. Se nessun documento necessita modifiche, dichiararlo esplicitamente.

Questa è una regola operativa per gli agenti; non presuppone un generatore, hook o servizio automatico di manutenzione. Se un fatto non è verificabile, scrivere **Da verificare**, distinguendo implementazione, prova effettuata e proposta.
