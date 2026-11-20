# Architettura di sicurezza

Questa pagina descrive ciò che è verificabile nel codice della baseline indicata in [ARCHITECTURE](ARCHITECTURE.md). Non è un audit indipendente, una certificazione o una garanzia contro compromissioni del sistema operativo. Nessuna criticità riportata è stata corretta durante l'incarico documentale.

## Confini di fiducia

Il file su disco è cifrato; dopo lo sblocco il processo Rust, la webview e parte della memoria JavaScript contengono dati in chiaro. Il frontend principale riceve un intero stato del vault. Il sistema operativo, l'utente della sessione Windows e il codice caricato nelle webview locali fanno parte della base fidata.

Il browser è esterno all'app. L'estensione riceve le credenziali selezionate soltanto al momento del riempimento; il sito di destinazione può leggerle una volta inserite nei propri campi. La master password non viene inviata dal pannello rapido all'estensione. Un processo ostile già eseguito come lo stesso utente può accedere a memoria, AppData o clipboard: il progetto non implementa una difesa completa contro questo scenario.

## Primitivi e formato

Le implementazioni sono in [core.rs](../src-tauri/src/core.rs), funzioni `kdf`, `seal`, `unseal`, `wrapped`, `recovery`, `key`.

| Elemento | Implementazione verificata |
|---|---|
| Cifratura autenticata | `Aes256Gcm`, crate `aes-gcm` |
| DEK | 32 byte casuali da `OsRng` durante `create` |
| Nonce | 12 byte nuovi da `OsRng` per ogni `seal` |
| Tag | Tag GCM standard della libreria, 16 byte |
| Blob | Base64 di `nonce || ciphertext || tag` |
| KDF | scrypt: `log_n=15`, `r=8`, `p=1`, output 32 byte; N=32768 |
| Sali dei wrapper | 16 byte casuali, separati per master e recupero |
| AAD | Non passato dall'app a GCM; l'header non è autenticato come AAD |
| Recupero | 24 simboli casuali formattati in gruppi; normalizzazione maiuscola/alfa-numerica prima della KDF |
| Pacchetto condiviso | Payload cifrato direttamente con chiave scrypt della passphrase e sale dedicato |

La master password non è memorizzata come hash verificabile separato: lo sblocco deriva la chiave e autentica il wrapper della DEK e il payload. Non risultano Argon2, bcrypt, pepper esterno o un server di autenticazione. SHA-1 serve a TOTP e Pwned Passwords, non alla derivazione della master; SHA-256 serve alla verifica della copia del file, non sostituisce GCM.

I parametri KDF sono fissati nel codice, non negoziati dall'envelope. Non cambiarli senza un piano esplicito di compatibilità/migrazione: il formato legacy v1 dipende da questi valori. Il vettore sintetico è verificato in Rust e nel [test Python](../tests/test_legacy_fixture.py); questo non prova tutti i casi di compatibilità del client storico.

## Sblocco, recupero e rotazione

`Vault::call("unlock")` legge l'envelope, sceglie il wrapper master o recupero, ricava la DEK e decifra i dati. Un fallimento crittografico produce un errore generico di password/recupero e incrementa il contatore dei tentativi errati. Dalla Beta 1.3.1 i primi 5 errori consecutivi sono liberi; poi ogni tentativo, anche con la password giusta, è rifiutato finché non passano 30 secondi, che raddoppiano a ogni errore fino a 15 minuti. Il contatore (`unlock_fails`, `unlock_last_fail`) è nella configurazione del dispositivo, così riavviare l'app non lo azzera; l'attesa residua è limitata al passo corrente, così spostare l'orologio indietro non allunga il blocco. Il rifiuto è immediato: nessuna attesa trattiene il vault. Vale per chi usa l'app su questo PC: chi copia il file del vault o modifica la configurazione aggira il contatore, e lì protegge solo il costo di scrypt.

`master` richiede la password corrente e riscrive il wrapper master. `recovery_new` verifica la master e rigenera il wrapper del recupero. Il recupero può impostare una nuova master. La **DEK resta la stessa**: è una rotazione delle protezioni della chiave, non della chiave dati. Un backup con wrapper precedente può consentire di recuperare la stessa DEK tramite credenziali precedenti. Non descrivere questa procedura come revoca globale su tutte le copie.

Il minimo di otto caratteri (`long_enough`, `MIN_SECRET_CHARS`) è contato in caratteri Unicode, non in byte, in `create`, `master`, nel recupero con nuova password e in `pack`; il controllo salute usa la stessa funzione. Nel recupero la nuova password viene verificata prima della decifratura: se è troppo corta il vault resta bloccato. Test: `vault_tests::length_policy_counts_characters`. Nessuna policy di complessità master o autenticazione biometrica risulta implementata.

## Blocco e sessione: comportamento reale

`Vault.key` è `Option<Zeroizing<[u8;32]>>`. `lock` toglie la chiave e sostituisce header/payload in memoria con `Null`. La finestra principale, in modalità tray, blocca alla chiusura; il menu tray può bloccare esplicitamente. Le finestre secondarie vengono nascoste secondo i propri handler.

Il controllo dell'inattività è `Vault::expire_if_idle` (`settings.autolock` in minuti, predefinito 5, 0 = mai):

- Viene eseguito all'inizio di **ogni** comando di `Vault::call`, inclusi `ping` e `status`, che in quel caso rispondono `unlocked: false`; i comandi protetti rispondono "Sessione scaduta". I comandi aperti sono `status`, `create`, `unlock`, `ping`, `suggest`, `loc_use`, `show`.
- Un thread di `lib.rs` (`spawn_idle_lock`) lo esegue ogni 5 secondi con `try_lock`, quindi il blocco avviene anche senza chiamate dalla UI (finestra nascosta o bloccata); se il vault è occupato da un comando lungo riprova al giro successivo.
- Attività: i comandi aggiornano `last`, tranne `ping`, `status`, `browser_state` e i comandi di sola lettura `health` e `backup_info`, che la Dashboard richiama da sola quando cambiano i dati. Un widget che si aggiorna non può quindi rinviare il blocco automatico; test `vault_tests::backup_info_and_health_are_read_only_and_passive`. La finestra principale invia `touch` su tastiera, clic e rotella, al massimo una volta ogni 30 secondi, così leggere o scorrere conta come attività mentre il polling no.
- Ogni passaggio da sbloccato a bloccato, rilevato da `api` o dal thread, emette `vault-locked`. `App.tsx` risponde con `wipeSession`, che azzera vault, editor (`draft`), campi di password e recupero, dialoghi, selezioni e segreti mostrati; le pagine figlie che contengono segreti vengono smontate. Lo stesso avviene se `run` riceve "Vault bloccato" o "Sessione scaduta" e se il ping trova il vault bloccato.

Limiti: il blocco può ritardare fino a circa 5 secondi, o di più se un comando lungo tiene il vault; azzerare lo stato React non garantisce la cancellazione della memoria JavaScript (garbage collector, copie nel motore della webview); appunti già copiati seguono il proprio timer. Test: `vault_tests::idle_expiry_locks_on_every_command` e `touch_extends_and_zero_disables_autolock`.

## Memoria e clipboard

`Zeroizing` protegge alcuni oggetti chiave Rust al rilascio. Non copre tutte le copie create da serializzazione, `serde_json::Value`, `Vec`, stringhe intermedie, IPC o React. `App.tsx` conserva stato decifrato, editor e risultati; il blocco non azzera sistematicamente tutti gli stati secondari, per esempio `draft`. Il mascheramento con `type=password` o pallini riguarda la presentazione.

Non risultano `mlock`/`VirtualLock`, memoria non paginabile, integrazione DPAPI/keyring, protezioni contro dump o cancellazione verificabile della memoria JavaScript. La DEK protetta non rende automaticamente sicuro tutto il processo.

[lib.rs](../src-tauri/src/lib.rs) usa clipboard Windows nativa, su worker, senza PowerShell. `clipboard::set` (usato da `copy_secret` e dalla ricerca rapida) aggiunge i formati `ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory` = 0 e `CanUploadToCloudClipboard` = 0, così Windows non salva la copia nella cronologia degli appunti (Win+V) né la sincronizza nel cloud; i gestori di appunti di terze parti possono ignorarli. `clear_secret_if_unchanged` apre gli appunti, confronta e svuota (`EmptyClipboard`, non un testo vuoto) sotto lo stesso guard se il contenuto coincide ancora. Il timer è però avviato dal frontend e mantiene il valore atteso in una closure. La chiusura del processo, la sospensione, i gestori di cronologia e altre applicazioni impediscono di garantire una pulizia globale. Il percorso copiato dalla guida browser usa la stessa API di copia ma non è una credenziale.

## IPC Tauri e file

[tauri.conf.json](../src-tauri/tauri.conf.json) applica CSP: sorgenti script locali, immagini locali/data, connessione IPC, oggetti disabilitati e stile inline consentito. [capabilities/default.json](../src-tauri/capabilities/default.json) include `main`, `quick-fill`, `browser-setup` con `core:default`.

La CSP è una misura utile; non equivale a isolamento dei comandi per finestra. I comandi applicativi sono tutti registrati nel Builder. `api` applica il gate del core, ma `read_file`, `save_file`, picker, clipboard e vari comandi browser non richiedono lo stesso stato sbloccato né verificano un'etichetta di finestra. `read_file` accetta un percorso e limita a 20.000.000 byte al controllo dei metadati; non ha una allowlist di directory. La valutazione della superficie IPC dipende quindi dalla fiducia nella webview locale.

`choose_icon_data` limita il file a 150000 byte e controlla il magic number dei formati ammessi. Altri percorsi che accettano icone data URI non applicano necessariamente lo stesso controllo. I documenti non devono promettere validazione uniforme su tutti gli ingressi.

## Passkey WebAuthn

[passkey-page.js](../browser-extension/passkey-page.js) gira nel contesto della pagina (MAIN world) e sostituisce `navigator.credentials.create/get`. [passkey-bridge.js](../browser-extension/passkey-bridge.js) inoltra al background, che accetta solo frame principali HTTPS e usa come origine `sender.url` fornito dal browser, mai un valore della pagina.

Controlli in [passkey.rs](../src-tauri/src/passkey.rs):
- **rpId:** deve coincidere con l'host o esserne un dominio genitore registrabile (PSL; mai un suffisso pubblico come `com` o `github.io`).
- **Richiesta:** challenge e `user.id` di lunghezza limitata; si supporta solo ES256, altrimenti la richiesta passa al browser.
- **Conferma:** ogni creazione o uso richiede vault sbloccato e una conferma esplicita nella mini finestra.
- **Collegamento all'account:** `allowCredentials`/`excludeCredentials` vincolano la scelta, e la firma copre `SHA-256(rpId)` e `clientDataJSON` con l'origine reale.

Il flag UV dichiara "utente verificato" perché la master password ha sbloccato il vault e l'utente conferma; non è una verifica biometrica né un nuovo inserimento della password a ogni uso. BE/BS dichiarano una credenziale sincronizzabile, perché il vault può essere copiato nelle cartelle cloud.

La chiave privata P-256 è nel vault cifrato, ma come le password arriva in chiaro alla UI principale con lo stato sbloccato. È nell'export JSON in chiaro e in ogni copia del vault: chi ottiene il vault sbloccato può usare le passkey.

Uno script ostile della pagina può già chiamare WebAuthn per proprio conto: la mini finestra mostra sempre l'rpId verificato. Un'estensione o un processo malevolo dello stesso utente resta fuori dal modello di difesa, come per il riempimento.

## Native Messaging e sito di destinazione

I moduli [browser.rs](../src-tauri/src/browser.rs), [browser_protocol.rs](../src-tauri/src/browser_protocol.rs) e [helper](../src-tauri/src/bin/jesse_browser_host.rs) implementano:

- Listener solo `127.0.0.1`, porta effimera, token casuale di 32 byte per avvio.
- Descrittore e manifest sotto la directory browser di AppData; il token è memorizzato in chiaro, con permessi ereditati dal filesystem. Nessuna ACL dedicata viene impostata dal codice.
- Autenticazione del primo frame, limite di 262144 byte per frame, timeout iniziale di 3 secondi e scrittura di 2 secondi. Dopo l'autenticazione non viene mantenuto lo stesso timeout di lettura.
- Argomenti del native host controllati contro gli identificatori ammessi. Questo controllo non prova da solo che il chiamante sia un browser autentico: gli argomenti sono riproducibili da un processo locale.
- Nessuna cifratura TLS del canale loopback. Il token protegge il servizio da un chiamante che non lo conosce, non da codice arbitrario dello stesso utente capace di leggerlo.

Il protocollo espone dal relay i messaggi `hello`, `open`, `context`, `filled`, `passkey`, `passkey-cancel` e `save`, non `Vault::call`. La sessione attiva è unica per l'app, non un contenitore indipendente per ogni browser. Connessioni e thread non hanno un limite globale esplicito.

La ricerca account richiede HTTPS nella pagina, stessa porta e dominio registrabile calcolato con PSL. Include i suffissi privati, evitando di unificare tenant diversi di servizi come `github.io`. Gli URL salvati senza schema sono normalizzati per la ricerca. Questo criterio non prova che ogni sottodominio della stessa organizzazione sia un servizio di login affidabile; la selezione resta manuale.

L'estensione verifica HTTPS del frame focalizzato, URL prima dell'iniezione, richiesta recente e riferimento DOM ancora valido. Dalla Beta 1.1.20 un iframe di un'altra origine è ammesso solo se il backend (`frame_allowed`) lo trova sullo stesso dominio registrabile PSL e sulla stessa porta della scheda, per esempio un riquadro `connect.example.com` dentro `www.example.com`: è la stessa fiducia già data agli account salvati per un sottodominio. I suffissi privati restano separati (`alice.github.io` dentro `bob.github.io` è rifiutato), così come iframe HTTP, con credenziali nell'URL o di altri siti. Rischio residuo: un sottodominio dello stesso dominio che ospita contenuti di terzi può ricevere la sessione se l'utente seleziona un suo campo e sceglie esplicitamente un account. I campi dentro shadow root aperti vengono trovati; quelli chiusi no.

[background.js](../browser-extension/background.js) non espone il canale nativo alle pagine: accetta solo messaggi dei propri content script (passkey e salvataggio, controllando `sender.id`) e costruisce da sé i messaggi per l'app. Richiede `nativeMessaging`, `tabs`, `scripting` e accesso a tutte le pagine HTTPS: è una superficie ampia da mantenere sotto revisione. Nessuna credenziale è salvata nello storage dell'estensione; durante il riempimento passa però in memoria nell'estensione e nei campi del sito. Moduli personalizzati, mutazioni sincrone del DOM e policy browser richiedono collaudi reali oltre a jsdom.

## Salvataggio degli account dal browser

Dalla Beta 1.3.0 il flusso va anche dalla pagina all'app: [save-capture.js](../browser-extension/save-capture.js) invia al background quanto l'utente ha inserito in un modulo con password, e [browser_save.rs](../src-tauri/src/browser_save.rs) chiede se salvarlo. Controlli:

- **Solo digitazione reale:** serve una password che abbia ricevuto eventi `input`/`paste`/`keydown` fidati (`isTrusted`). Valori impostati da script della pagina, e dall'inserimento di Jesse's Archive (già salvati), non avviano nulla; una pagina ostile non può far comparire richieste a raffica. Lo stesso invio viene inviato una volta sola entro 4 secondi e, dopo «Non ora», il sito tace per 2 minuti.
- **Origine dal browser:** il background usa `sender.url` e l'URL della scheda, accetta solo pagine HTTPS e la propria estensione; il backend riapplica `frame_allowed` e calcola il sito con la PSL. I valori dei campi vengono dalla pagina e sono trattati come testo non fidato (lunghezze limitate, caratteri di controllo rimossi, mostrati come testo).
- **Consenso:** con l'opzione disattivata l'app lo comunica all'estensione (`config`) e la cattura non lascia il browser. Nessuna scrittura nel vault senza conferma nella mini finestra; «Mai per questo sito» è salvato nel vault cifrato (`settings.never_save`), non in chiaro sul disco.
- **Dati esclusi:** numeri di carta e CVV (`cc-*`), codici OTP, captcha, ricerche e campi nascosti non vengono mai proposti per le note.
- **Memoria:** la password catturata resta solo nel processo Rust (`Zeroizing`, una richiesta alla volta, al massimo 3 minuti) e non arriva alla webview della mini finestra; username e altri campi sì, perché l'utente li sceglie. Nell'estensione passa in memoria dal content script al background e al canale nativo, come il riempimento in senso opposto; resta in memoria solo l'identificativo del primo passo di un login in due passaggi (fino a 5 minuti).

Rischi residui: un login con password sbagliata propone di aggiornare quella salvata (la richiesta lo dice esplicitamente e serve una conferma); i moduli personalizzati possono sfuggire alla classificazione; uno script della stessa pagina vede comunque ciò che l'utente digita, indipendentemente da questa funzione.

## Servizi di rete opzionali

`breaches` calcola SHA-1 localmente e invia solo un prefisso di cinque cifre esadecimali a Pwned Passwords, con padding richiesto e cache per prefisso nella singola operazione. Le richieste girano su un thread dedicato, fuori dal worker asincrono del comando, e ogni prefisso è ritentato due volte. Il suffisso viene confrontato localmente. Non è una verifica della sicurezza complessiva di un account.

`group_logo` richiede una favicon a DuckDuckGo e rivela il dominio richiesto e i normali metadati di rete. La preferenza loghi è attiva di default quando assente: il salvataggio di un account web può attivare la richiesta, senza un dialogo separato per ogni sito. Non descrivere tutte le operazioni dell'app come prive di rete. Le copie cloud sono gestite dal software del provider, non da una API di upload del progetto.

### Aggiornamento automatico

`updater.rs` legge `releases/latest` del repository pubblico tramite l'API GitHub, senza token. La richiesta rivela a GitHub l'indirizzo IP e la versione cercata, all'avvio e una volta al giorno. Il controllo è disattivabile per dispositivo (`update_auto` nella configurazione locale).

Un'installazione avviene solo dopo la conferma esplicita dell'utente e solo se:
- l'asset `JesseArchive-Setup.exe.sig` è un manifest testuale (versione, nome del file, dimensione, SHA-256) firmato Ed25519 con la chiave pubblica incorporata nel binario (`src-tauri/update-public-key.txt`);
- la versione firmata coincide con il tag ed è più recente di quella installata;
- dimensione e SHA-256 del setup scaricato coincidono con il manifest.

Si accettano solo link diretti `https://github.com/jesseaims/Jesse-Archive/releases/download/<tag>/…`. Il backend ripete il controllo da zero prima di installare, quindi un valore manipolato nella UI non basta.

Un account GitHub compromesso, da solo, non può quindi far installare un setup non firmato. Chi possiede la chiave privata invece sì: la chiave resta su un solo PC, cifrata con DPAPI per l'utente (`%APPDATA%\JesseArchive-Release\update-signing-key.dpapi`) e gestita da `scripts/Update-SigningKey.ps1`, con backup cifrato da passphrase.

Limiti:
- non c'è protezione anti-rollback oltre al confronto di versione;
- non c'è rotazione della chiave: una chiave persa richiede un'installazione manuale con una chiave nuova;
- il file scaricato in `%TEMP%` non è protetto da processi malevoli dello stesso utente fra la verifica e l'avvio;
- il setup non ha Authenticode, quindi l'avviso di Windows dipende dalla reputazione SmartScreen.

### Ricerca rapida globale

- **Nessuna sessione propria:** ogni comando passa da `Vault::call`, quindi valgono gli stessi controlli di sblocco e scadenza; lo sblocco dalla finestra usa il comando `unlock` della finestra principale. Con il vault bloccato `quick_search_data` restituisce solo `unlocked: false` e le impostazioni.
- **Solo metadati nella finestra:** titolo, username o email, URL, piattaforma crypto, categoria, cartella, preferito, nome e logo del gruppo (`metadata` in `quick_search.rs`). Mai password, TOTP, numeri di carta, CVV, PIN, seed, credenziali passkey o testo delle note; test `quick_search::tests::metadata_never_contains_secrets_or_notes`. L'indice di ricerca esiste solo nella memoria della finestra e viene scartato quando si nasconde o il vault si blocca.
- **Password:** copiate nel backend (`quick_search_copy`) senza passare dalla webview; gli appunti si svuotano dopo il ritardo del vault (`settings.clip`) solo se contengono ancora quel valore (`clipboard::clear_if_unchanged`), e la copia in attesa è in `Zeroizing`. «Mostra password» è l'unico caso in cui una password arriva alla finestra: su richiesta esplicita, nascosta dopo 15 s, al cambio di selezione, alla chiusura e al blocco. Come per la finestra principale, la memoria JavaScript non è cancellata in modo verificabile e i JSON letti nel backend non sono azzerati.
- **Blocco:** su `vault-locked` la finestra scarta risultati e password mostrata e passa allo stato bloccato; gli usati di recente restano salvati nel vault cifrato e la finestra li riceve di nuovo solo dopo lo sblocco. Copiare, mostrare o aprire conta come attività (`touch`); cercare no, perché `browser_state` è passivo.
- **Usati di recente e ricerche:** le ricerche non vengono mai salvate né inviate al backend per essere ricordate (nessuna cronologia). Gli usati di recente sono al massimo 12 id di elementi in `settings.recent` (condivisi con il widget della Dashboard), dentro il payload cifrato del vault, mai password o altri campi; il backend accetta solo un elenco di stringhe brevi. Viaggiano con le impostazioni nella fusione delle copie (`settings_upd`), quindi chi apre il vault su un altro dispositivo vede gli stessi elementi recenti. Si cancellano con «Cancella gli usati di recente»; disattivando l'opzione la ricerca rapida smette di mostrarli e di aggiungerne.
- **Siti:** si aprono solo indirizzi http/https validi (`site_url`), quindi non `file:`, `javascript:` o protocolli di altre applicazioni.
- **Scorciatoia:** registrata con `RegisterHotKey` tramite il plugin, senza hook di tastiera né polling; rifiutate le combinazioni senza Ctrl/Alt/Win e quelle di sistema (Ctrl+C/V…, Alt+Tab, Alt+F4, Ctrl+Alt+Canc, Win+L).
- **Rete e log:** nessuna richiesta di rete, telemetria o log delle ricerche; nessuna notifica con credenziali.

### Dashboard

- **Cosa mostrano i widget:** solo dati già presenti nello stato sbloccato della UI (titoli, categorie, date, conteggi) e i risultati di `health`/`backup_info`. Nessun widget mostra password, valori TOTP o testo delle note.
- **Generatore:** il widget usa il comando `generate` del backend; il valore resta nello stato del componente e viene copiato con il normale `copy_secret`, quindi gli appunti si puliscono come al solito.
- **Configurazione:** il layout si salva cifrato nel vault, senza segreti (`tests/dashboard.test.mjs` lo verifica).
- **Dati solo di sessione:** i risultati della verifica violazioni restano in memoria e si azzerano al blocco. «Usati di recente» (dalla Beta 1.1.19) è invece salvato nel vault cifrato come elenco di id, senza altri dati.
- **Rete:** nessuna telemetria e nessuna richiesta di rete aggiunta. Il widget Privacy legge soltanto le impostazioni locali.

## Persistenza, backup e anti-tampering

GCM autentica i blob cifrati, non l'intero header esterno. `v` e `hv` non sono firme; `hv` guida l'adozione di un header durante la fusione. Non c'è una protezione dimostrata contro rollback di un file interamente valido, sostituzione con backup o manipolazione dei metadati non inclusi nell'AAD. SHA-256 in `loc_move` confronta una copia, non autentica il proprietario del file.

La `.bak` contiene un envelope cifrato precedente. “Eliminazione definitiva” toglie record dalla collezione, ma password storiche possono essere conservate come orfane e vecchie copie persistono in backup/provider. Non è cancellazione sicura del disco.

Il codice non configura Authenticode per il setup; gli aggiornamenti automatici usano una firma Ed25519 propria (vedere sopra), che non sostituisce la firma del codice di Windows. La chiave pubblica Chromium stabilizza un ID di sviluppo e non firma una release desktop. La firma Mozilla dell'estensione Firefox non è presente nella distribuzione locale.

## Registro delle criticità osservate

Le priorità seguenti sono valutazioni documentali per orientare una futura revisione, non interventi approvati né risultati di uno sfruttamento.

| ID | Evidenza e impatto | Verifica/proposta |
|---|---|---|
| SEC-01 | Attenuata: scadenza su ogni comando, thread di blocco ogni 5 s, `vault-locked` emesso su ogni transizione, `wipeSession` nella UI; collaudo manuale nell'app reale superato (Beta 1.1.19: senza interazione, finestra nel tray, pannello rapido e ricerca rapida) | Media: la memoria JavaScript non è cancellata in modo verificabile (vedere SEC-03) |
| SEC-02 | Attenuata (Beta 1.3.1): rallentamento progressivo dei tentativi di sblocco errati, persistente fra riavvii, testato in `core.rs` | Bassa: il contatore è nella configurazione del dispositivo, non protetta; contro una copia del file vale solo scrypt |
| SEC-03 | `Value`, buffer, IPC, `draft`, timer clipboard: azzeramento parziale | Alta: mappa delle copie e policy esplicita di rimozione dei dati sensibili |
| SEC-04 | Header fuori AAD, stessa DEK dopo rotazione, backup storici | Alta: definire modello di revoca/rollback e compatibilità prima di qualsiasi cambiamento |
| SEC-05 | Attenuata: `validate_import` rifiuta payload malformati, `ensure_shape` garantisce la forma usata da `arr`/`obj`, `import`/`unpack` ripristinano la memoria se falliscono, e un mutex del vault avvelenato da un panic viene recuperato da `AppState::vault` bloccando il vault (dati su disco intatti). Restano `unwrap` interni e nessuno schema completo dei campi | Media: estendere i controlli alle altre route (`item`, `bulk`) e ai mutex di `browser.rs` |
| SEC-06 | Comandi nativi condivisi dalle tre finestre, I/O file generico | Rivedere autorizzazione per comando e confini delle webview |
| SEC-07 | Token locale in chiaro e worker non limitati; fiducia nello stesso utente | Documentare ACL effettive e limiti; testare abuso/riconnessioni su profili sintetici |
| SEC-08 | Permessi estensione ampi e confronto PSL tra sottodomini, usato dalla Beta 1.1.20 anche per gli iframe di accesso | Revisionare superficie e casi di delega, preservando scelta esplicita e il rifiuto degli iframe di altri domini registrabili |
| SEC-09 | Generatori/`bits`: stime euristiche; PIN usa modulo, passphrase a sillabe | Verificare distribuzioni, vincoli e accuratezza delle stime; nessuna certificazione di entropia |

Non esistono test esaustivi dei punti sopra. L'elenco non è una prova dell'assenza di altri problemi. Stato e suggerimenti sono riepilogati in [ROADMAP](ROADMAP.md).
