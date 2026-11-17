# Stato del progetto e aree aperte

Fotografia statica al 17 novembre 2026, commit di partenza `1f09624`, Beta 1.1.4. Questo documento **non è una roadmap approvata**, non assegna scadenze e non autorizza implementazioni. Le proposte sono distinte dai comportamenti presenti e dai problemi verificabili nel codice. Per il catalogo completo vedere [FEATURES](FEATURES.md).

## Già presente nel codice attivo

- Applicazione desktop Tauri/React con vault JSON cifrato, master password e recupero, sei tipi di schede, cartelle, cestino e cronologia password.
- Generazione password, controllo salute, TOTP, verifica Pwned Passwords, temi, icone, appunti e integrazioni Windows/tray.
- Import/export CSV/JSON, pacchetti cifrati, scelta/copia della posizione del vault, fusione di file locali e di conflitto.
- Shortcut configurabile, pannello con sblocco, selezione account per dominio e riempimento browser attraverso Native Messaging.
- Guida locale e registrazione host per Chrome, Edge, Brave, Opera, Vivaldi e Firefox; pacchetti delle estensioni locali.
- News e commit con data/ora per voce; setup MSI incorporato in EXE Inno; suite Rust/Node e fixture Python.

“Presente” non certifica la compatibilità universale né implica un collaudo aggiornato. Questa attività ha soltanto analizzato e documentato.

## Funzionalità parziali e limitazioni concrete

| Area | Stato osservato | Riferimento |
|---|---|---|
| Blocco inattività | Scadenza su ogni comando e thread di controllo ogni 5 s, UI azzerata su `vault-locked`; manca un collaudo manuale con finestra nascosta e pannello rapido | [SECURITY](SECURITY.md), `core.rs`, `lib.rs` |
| Memoria sensibile | Alcune chiavi Zeroizing, ma copie JSON, frontend e buffer non cancellati integralmente | SECURITY; `core.rs`, `App.tsx` |
| Sincronizzazione | File esterni e timestamp per record intero; nessun trasporto cloud proprio, lock multiprocesso o transazione; UI non segue sempre rev | [DATABASE](DATABASE.md), [ARCHITECTURE](ARCHITECTURE.md) |
| Validazione e migrazioni | Import JSON/`.jshare` validato e atomico, forma del vault garantita allo sblocco; nessuno schema completo dei campi né motore di migrazione | DATABASE; `core.rs` |
| Distribuzione browser | Guida automatizzata e registrazione host, installazione estensione ancora locale/manuale; Firefox temporanea | FEATURES; `browser_installer.rs` |
| Compilazione nei siti | HTTPS e campi supportati; casi ambigui o frame estranei rifiutati; multistep richiede nuova invocazione | FEATURES; background canonico |
| Selezione pacchetto | Backend supporta ID selezionati, percorso UI soprattutto pacchetto completo; flag shared anticipato | DATABASE; `App.tsx` |
| Passkey | Archiviazione di una stringa, senza autenticazione WebAuthn | FEATURES; `types.ts` |
| Backup | Copia intero vault e singolo `.bak`; export non equivale a backup completo; niente catalogo versioni | DATABASE |
| Copertura test | Test mirati, non intera matrice UI/browser/installazione/durabilità | [DEVELOPMENT](DEVELOPMENT.md) |

## Funzionalità non rilevate nel client Rust

Autenticazione biometrica, gestione WebAuthn/passkey come authenticator, aggiornamento automatico, servizio cloud con account e API proprie, installazione silenziosa universale dell'estensione, pacchetti store pubblicati/firmati e riempimento universale di app desktop non risultano implementati. Il foglio di emergenza stampabile e il dispatcher `.jbackup` sono presenti nel client Python storico, non nella UI React esaminata. Questa lista non è una richiesta di portarli o aggiungerli.

## Criticità da valutare e proposte tecniche non approvate

Le criticità sono motivate in [SECURITY](SECURITY.md), con identificativi SEC-01–SEC-09. Non rappresentano una certificazione o un penetration test. Possibili interventi futuri, da autorizzare e progettare separatamente:

| Proposta | Motivazione e cautela |
|---|---|
| Collaudare il modello di inattività/sessione | Implementato (attività utente distinta dal polling, thread di scadenza); resta da provare manualmente scadenza senza interazione, blocco e ripresa del pannello |
| Rafforzare confini IPC e gestione memoria | Valutare comandi accessibili alle finestre, copie plaintext, cleanup di draft/state e buffer; non promettere wipe assoluto |
| Validazione strutturale e migrazioni | Rifiutare dati malformati senza panic o mutazioni parziali; mantenere compatibilità con vault e fixture v1 |
| Durabilità, concorrenza e merge | Test di guasto e rollback, writer concorrenti, timestamp conflittuali e interazione UI/revisione prima di cambiare formato |
| Documentare/rafforzare modello chiave e rotazione | Distinguere cambio master da nuova chiave dati; studiare compatibilità di header autenticati e revoca delle vecchie copie |
| Verificare bridge locale | ACL, limiti di connessioni/frame/thread, processi dello stesso utente, gestione errori e app assente |
| Ampliare collaudo browser/installazione | Sei browser, origini/frame, login multistep, app bloccata, cambio focus, aggiornamento e rimozione estensione |
| Ridurre debito di organizzazione | Formattazione uniforme applicata e verificata dalla CI; `core.rs`/`App.tsx` restano monolitici e il CSS stratificato; eventuale estrazione graduale con test, senza riscrittura indiscriminata |
| Chiarire codice storico e contratti duplicati | Mantenere distinzione Python/Rust, `touch`/`show`, gruppi UI vs matching di sicurezza e sorgente JS vs copie generate |
| Consolidare processo di release | CI presente (tipi, build frontend, test Rust/Node, host nativo) e release automatica del setup su GitHub al merge di una nuova versione; restano da valutare pin toolchain, clippy, firma e prove offline |

Non è stata dimostrata la completa inutilità di moduli o asset: copie ICO e background hanno ruoli di packaging, il client storico è separatamente avviabile. “Apparentemente duplicato” non autorizza la rimozione.

## Da verificare

- Funzionamento reale di apertura pagina estensioni su Chrome, Edge, Opera, Vivaldi e Firefox; la precedente prova manuale riguarda Brave.
- Riempimento end-to-end su siti reali, incluso Epic Games, con la versione installata, scheda/frame/focus appropriati e URL salvati. I test di matching non equivalgono a questa prova.
- Installazione offline su Windows pulito, WebView2 realmente incluso/disponibile, upgrade/disinstallazione, elevazione con un altro account e percorsi personalizzati.
- Compatibilità del prodotto completo su sistemi non Windows e minima versione Rust/browser realmente supportata; manifest e codice condizionale non bastano a certificarla.
- Resistenza a interruzioni di scrittura, più istanze/writer esterni e servizi cloud che generano copie con timestamp inconsistente.
- Risultati correnti di clippy e copertura aggiuntiva: clippy non fa parte della CI.

## Mantenimento dello stato

Aggiornare questa pagina quando un limite cambia, una verifica viene eseguita o una proposta viene esplicitamente approvata/implementata. Collegare il risultato al codice e alla prova pertinente; rimuovere affermazioni superate. Aggiornare contemporaneamente i documenti tecnici interessati secondo [AGENTS.md](../AGENTS.md) e [CLAUDE.md](../CLAUDE.md), senza trasformare ipotesi in funzionalità completate.
