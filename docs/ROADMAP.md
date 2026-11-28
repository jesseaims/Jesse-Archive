# Stato del progetto e aree aperte

**Stato al 28 novembre 2026:** la 2.0.0 è la prima versione stabile (fine della beta). Restano aperti: firma Authenticode del setup (domanda a SignPath Foundation inviata), sincronizzazione tramite cartella cloud dichiarata sperimentale, audit di sicurezza indipendente e revisione delle traduzioni da parte di madrelingua (rimandati per costi), app mobile (in sospeso).

Fotografia statica al 17 novembre 2026, commit di partenza `1f09624`, Beta 1.1.4. Questo documento **non è una roadmap approvata**, non assegna scadenze e non autorizza implementazioni. Le proposte sono distinte dai comportamenti presenti e dai problemi verificabili nel codice. Per il catalogo completo vedere [FEATURES](FEATURES.md).

## Già presente nel codice attivo

- Applicazione desktop Tauri/React con vault JSON cifrato, master password e recupero, sei tipi di schede, cartelle, cestino e cronologia password.
- Generazione password, controllo salute, TOTP, verifica Pwned Passwords, temi, icone, appunti e integrazioni Windows/tray.
- Import/export CSV/JSON, pacchetti cifrati, scelta/copia della posizione del vault, fusione di file locali e di conflitto.
- Rimossa dalla repository la vecchia applicazione Python, con backup esterno; la compatibilità dei vault v1 resta verificata (dalla Beta 1.8.2).
- Permessi per finestra: ogni finestra chiama solo i comandi nativi che usa e le finestre secondarie non accedono ai comandi del vault (dalla Beta 1.8.1).
- Finestra principale senza segreti nello stato: password, PIN, CVV, seed, TOTP, chiavi delle passkey e note arrivano solo su richiesta; copia dalle schede e dallo storico nel backend (dalla Beta 1.8.0).
- Wrapper master a scrypt N=2^17 con migrazione automatica, avviso se il file del vault viene sostituito con una copia più vecchia, nuovo tentativo delle scritture fallite e test di concorrenza fra due PC (dalla Beta 1.7.0).
- Header del vault autenticato (HMAC dalla DEK) e cambio della chiave dati facoltativo nel cambio master, sempre con un nuovo codice di recupero (dalla Beta 1.6.0).
- Rallentamento progressivo dei tentativi di sblocco errati, persistente fra riavvii (dalla Beta 1.4.0).
- Shortcut configurabile, pannello con sblocco, selezione account per dominio e riempimento browser attraverso Native Messaging.
- Proposta di salvataggio degli account inviati sui siti (nuovi, login non salvati, password cambiate) con conferma nella mini finestra (dalla Beta 1.3.0).
- Guida locale e registrazione host per Chrome, Edge, Brave, Opera, Vivaldi e Firefox; estensione pubblicata sul Chrome Web Store e su addons.mozilla.org, pacchetti locali per il caricamento manuale.
- Aggiornamento automatico verificato con firma Ed25519 (dalla Beta 1.1.13); controllo disattivabile e installazione solo su conferma.
- Ricerca rapida globale con scorciatoia di sistema, raggruppamento degli account per servizio e copia sicura delle credenziali (dalla Beta 1.1.19).
- Dashboard personalizzabile con widget, layout multipli e salvataggio automatico (dalla Beta 1.1.17).
- Interfaccia in dieci lingue (dalla Beta 1.1.16), con installer ed estensione tradotti.
- News e commit con data/ora per voce; setup unico Inno nello stile dell'app (dalla Beta 1.2.0, prima MSI dentro un EXE Inno); suite Rust/Node e fixture Python.

“Presente” non certifica la compatibilità universale né implica un collaudo aggiornato. Questa attività ha soltanto analizzato e documentato.

## Funzionalità parziali e limitazioni concrete

| Area | Stato osservato | Riferimento |
|---|---|---|
| Blocco inattività | Scadenza su ogni comando e thread di controllo ogni 5 s, UI azzerata su `vault-locked`; collaudato a mano nell'app reale (senza interazione, finestra nel tray, pannello rapido, ricerca rapida) | [SECURITY](SECURITY.md), `core.rs`, `lib.rs` |
| Memoria sensibile | Alcune chiavi Zeroizing, ma copie JSON, frontend e buffer non cancellati integralmente | SECURITY; `core.rs`, `App.tsx` |
| Sincronizzazione | File esterni e timestamp per record intero; nessun trasporto cloud proprio, lock multiprocesso o transazione; UI non segue sempre rev | [DATABASE](DATABASE.md), [ARCHITECTURE](ARCHITECTURE.md) |
| Validazione e migrazioni | Import JSON/`.jshare` validato e atomico, forma del vault garantita allo sblocco; import JSON, CSV, `.jshare` e rifiuto di un file corrotto provati a mano con file sintetici; nessuno schema completo dei campi né motore di migrazione | DATABASE; `core.rs` |
| Distribuzione browser | Guida automatizzata e registrazione host; dalla Beta 1.9.7 installazione dagli store (Chrome Web Store e addons.mozilla.org, pubblicata dal 27/11/2026; ogni versione passa dalla revisione), caricamento manuale come alternativa | FEATURES; `browser_installer.rs` |
| Compilazione nei siti | HTTPS e campi supportati, anche in shadow root aperti e in iframe dello stesso dominio registrabile (Beta 1.1.20); casi ambigui o frame di altri siti rifiutati; multistep richiede nuova invocazione. Provata su Brave: login in due passaggi su Epic Games e rifiuto al cambio pagina | FEATURES; background canonico |
| Selezione pacchetto | Backend supporta ID selezionati, percorso UI soprattutto pacchetto completo; flag shared anticipato | DATABASE; `App.tsx` |
| Salvataggio account | Dalla Beta 1.3.0: cattura solo con digitazione reale, conferma esplicita, note a scelta; test jsdom e Rust, collaudo su siti reali **Da verificare** | FEATURES, SECURITY; `browser_save.rs`, `save-capture.js` |
| Passkey | WebAuthn tramite estensione dalla Beta 1.1.14: solo ES256, frame principale, niente autofill condizionale né PRF; UV dichiarato per vault sbloccato e conferma | FEATURES, SECURITY; `passkey.rs`, `passkey-page.js` |
| Backup | Copia intero vault, singolo `.bak` e, dalla Beta 1.9.8, copie giornaliere locali (14 giorni) con recupero dei singoli elementi; export non equivale a backup completo; copie solo sul PC che le crea, nessun ripristino dell'intero vault | DATABASE |
| Copertura test | Test mirati, non intera matrice UI/browser/installazione/durabilità | [DEVELOPMENT](DEVELOPMENT.md) |

## Funzionalità non rilevate nel client Rust

Autenticazione biometrica, provider passkey di sistema Windows (uso fuori dai browser), servizio cloud con account e API proprie, installazione silenziosa universale dell'estensione, firma digitale del setup Windows e riempimento universale di app desktop non risultano implementati. Il foglio di emergenza stampabile e il dispatcher `.jbackup` sono presenti nel client Python storico, non nella UI React esaminata. Questa lista non è una richiesta di portarli o aggiungerli.

## Criticità da valutare e proposte tecniche non approvate

Le criticità sono motivate in [SECURITY](SECURITY.md), con identificativi SEC-01–SEC-09. Non rappresentano una certificazione o un penetration test. Possibili interventi futuri, da autorizzare e progettare separatamente:

| Proposta | Motivazione e cautela |
|---|---|
| Rafforzare confini IPC e gestione memoria | Dalla Beta 1.8.0 la finestra principale riceve i segreti solo su richiesta e `browser_state` non è accessibile alle webview; dalla Beta 1.8.1 permessi dei comandi per finestra. Resta: copia dall'editor con il valore nella webview; non promettere wipe assoluto |
| Validazione strutturale e migrazioni | Rifiutare dati malformati senza panic o mutazioni parziali; mantenere compatibilità con vault e fixture v1 |
| Durabilità, concorrenza e merge | Dalla Beta 1.7.0 test di scrittori concorrenti, conflitti fra due PC e scrittura fallita (con nuovo tentativo alla sincronizzazione). Restano: collaudo reale con client cloud (OneDrive, Dropbox), interazione UI/revisione |
| Documentare/rafforzare modello chiave e rotazione | Dalla Beta 1.6.0 header autenticato e cambio della chiave dati facoltativo (vedi SECURITY). Dalla Beta 1.7.0 scrypt `log_n=17` con migrazione e avviso anti-rollback per dispositivo. Resta: riferimento anti-rollback in una configurazione non protetta |
| Verificare bridge locale | ACL, limiti di connessioni/frame/thread, processi dello stesso utente, gestione errori e app assente |
| Ampliare collaudo browser/installazione | Sei browser, origini/frame, login multistep, app bloccata, cambio focus, aggiornamento e rimozione estensione |
| Ridurre debito di organizzazione | Formattazione uniforme applicata e verificata dalla CI; `core.rs`/`App.tsx` restano monolitici; dalla Beta 1.8.3 il CSS non ha più dichiarazioni mai applicate né regole di classi inutilizzate, ma resta organizzato per stratificazione storica; eventuale estrazione graduale con test, senza riscrittura indiscriminata |
| Chiarire codice storico e contratti duplicati | Dalla Beta 1.8.2 il client Python non è più nella repository (resta la fixture di compatibilità v1). Restano: `touch`/`show`, gruppi UI vs matching di sicurezza e sorgente JS vs copie generate |
| Consolidare processo di release | CI presente (tipi, build frontend, test Rust/Node, clippy senza avvisi, host nativo) e pubblicazione delle release dal PC di sviluppo con `Publish-Release.ps1` (prima release: Beta 1.1.12); restano da valutare pin toolchain, clippy, firma e prove offline |

Non è stata dimostrata la completa inutilità di moduli o asset: copie ICO e background hanno ruoli di packaging, il client storico è separatamente avviabile. “Apparentemente duplicato” non autorizza la rimozione.

## Da verificare

- Funzionamento reale di apertura pagina estensioni su Chrome, Edge, Opera, Vivaldi e Firefox; la precedente prova manuale riguarda Brave.
- Riempimento end-to-end su altri siti e browser: su Brave funzionano Epic Games (due passaggi) e il rifiuto al cambio pagina; Reddit (componenti web) e Ubisoft (riquadro su sottodominio) sono corretti nella Beta 1.1.20 e vanno riprovati con la versione installata.
- Installazione offline su Windows pulito, WebView2 realmente incluso/disponibile, upgrade/disinstallazione, elevazione con un altro account e percorsi personalizzati. Un'installazione su un secondo PC (portatile) è riuscita; la prova senza rete non è documentata. Installer unico della Beta 1.2.0 collaudato su questo PC: aggiornamento dall'MSI 1.1.21 (una sola voce in «App installate», cartella mantenuta), collegamenti, estensione, disinstallazione con vault conservato, reinstallazione e aggiornamento silenzioso con riapertura dell'app; su un PC pulito **Da verificare**.
- Compatibilità del prodotto completo su sistemi non Windows e minima versione Rust/browser realmente supportata; manifest e codice condizionale non bastano a certificarla.
- Resistenza a interruzioni di scrittura, più istanze/writer esterni e servizi cloud che generano copie con timestamp inconsistente.
- Copertura aggiuntiva dei test; clippy fa parte della CI dalla Beta 1.4.0, senza avvisi.

- Passkey WebAuthn su siti reali (per esempio webauthn.io, GitHub, Google) in Chromium e Firefox ≥ 128: registrazione, accesso, fallback, abort, siti che richiedono attestazione o algoritmi diversi da ES256.
- Dashboard nell'app reale: trascinamento col mouse e finestra piccola collaudati; provata con un vault sintetico di 238 elementi. Possibili estensioni: widget Documenti quando esisterà la categoria, più istanze dello stesso widget.
- Ricerca rapida globale: collaudata nell'app reale (tray, focus immediato, zoom alto e basso, copia e pulizia degli appunti, apertura dei siti); restano più monitor. Le applicazioni che leggono direttamente la tastiera (TeamSpeak) perdono la combinazione senza avviso. Possibili estensioni: combinazioni interne personalizzabili, integrazione nella Dashboard e in una command palette.
- Revisione delle traduzioni da parte di madrelingua; la resa grafica nelle dieci lingue è stata controllata a vista sugli screenshot del sito senza problemi evidenti; lingue da destra a sinistra non supportate.
- Cartella sincronizzata con due dispositivi o due copie modificate, guida estensioni su Chrome, Edge, Opera, Vivaldi e Firefox, passkey su siti reali: non ancora provati a mano.

## Mantenimento dello stato

Aggiornare questa pagina quando un limite cambia, una verifica viene eseguita o una proposta viene esplicitamente approvata/implementata. Collegare il risultato al codice e alla prova pertinente; rimuovere affermazioni superate. Aggiornare contemporaneamente i documenti tecnici interessati secondo [AGENTS.md](../AGENTS.md) e [CLAUDE.md](../CLAUDE.md), senza trasformare ipotesi in funzionalità completate.
