# Architettura di sicurezza

Questa pagina descrive ciò che è verificabile nel codice della baseline indicata in [ARCHITECTURE](ARCHITECTURE.md). Non è un audit indipendente, una certificazione o una garanzia contro compromissioni del sistema operativo. Nessuna criticità riportata è stata corretta durante l'incarico documentale.

## Confini di fiducia

Il file su disco è cifrato; dopo lo sblocco il processo Rust contiene il vault in chiaro. Dalla Beta 1.8.0 il frontend principale riceve uno stato senza segreti (vedere «Segreti su richiesta»); la webview contiene in chiaro solo i valori che l'utente mostra o modifica. Il sistema operativo, l'utente della sessione Windows e il codice caricato nelle webview locali fanno parte della base fidata.

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
| KDF | scrypt, `r=8`, `p=1`, output 32 byte. Wrapper master e pacchetti `.jshare`: dalla Beta 1.7.0 `log_n=17` (N=131072, 128 MiB), registrato nell'header come `kdf` e nel pacchetto come `n`; senza il campo vale il precedente `log_n=15` (N=32768, 32 MiB). Wrapper del recupero: sempre `log_n=15`, perché il codice ha 120 bit casuali. Valori letti dai file accettati solo fra 15 e 18 (`log_n_of`), per non far esaurire la memoria |
| Sali dei wrapper | 16 byte casuali, separati per master e recupero |
| AAD | Non passato dall'app a GCM. Dalla Beta 1.6.0 l'header è autenticato a parte con un HMAC-SHA256 (`mac`) con chiave derivata dalla DEK |
| Recupero | 24 simboli casuali formattati in gruppi; normalizzazione maiuscola/alfa-numerica prima della KDF |
| Pacchetto condiviso | Payload cifrato direttamente con chiave scrypt della passphrase e sale dedicato |

La master password non è memorizzata come hash verificabile separato: lo sblocco deriva la chiave e autentica il wrapper della DEK e il payload. Non risultano Argon2, bcrypt, pepper esterno o un server di autenticazione. SHA-1 serve a TOTP e Pwned Passwords, non alla derivazione della master; SHA-256 serve alla verifica della copia del file, non sostituisce GCM.

Dalla Beta 1.7.0 il costo del wrapper master è indicato nell'envelope (`kdf`, coperto dal `mac`). Migrazione: al primo sblocco con la password di un vault senza `kdf`, `unlock` riavvolge la stessa DEK con un nuovo sale a `log_n=17` e salva; se la scrittura non riesce ripristina l'header e riprova allo sblocco successivo. La DEK non cambia, quindi i dati e il codice di recupero restano validi; lo sblocco con il codice di recupero non migra. Dopo la migrazione le versioni precedenti alla 1.7.0 leggono il wrapper con `log_n=15` e rifiutano la password: con il vault su più PC vanno aggiornati tutti. Test: `vault_tests::old_vaults_move_to_the_stronger_scrypt_cost_once`, `scrypt_cost_is_read_only_within_known_values`, `packages_use_the_stronger_cost_and_old_ones_still_open`. Non cambiare questi valori senza una nuova migrazione: il formato legacy v1 (senza `kdf`) dipende da `log_n=15`. Il vettore sintetico è verificato in Rust e nel [test Python](../tests/test_legacy_fixture.py); questo non prova tutti i casi di compatibilità del client storico.

## Sblocco, recupero e rotazione

`Vault::call("unlock")` legge l'envelope, sceglie il wrapper master o recupero, ricava la DEK e decifra i dati. Un fallimento crittografico produce un errore generico di password/recupero e incrementa il contatore dei tentativi errati. Dalla Beta 1.4.0 i primi 5 errori consecutivi sono liberi; poi ogni tentativo, anche con la password giusta, è rifiutato finché non passano 30 secondi, che raddoppiano a ogni errore fino a 15 minuti. Il contatore (`unlock_fails`, `unlock_last_fail`) è nella configurazione del dispositivo, così riavviare l'app non lo azzera; l'attesa residua è limitata al passo corrente, così spostare l'orologio indietro non allunga il blocco. Il rifiuto è immediato: nessuna attesa trattiene il vault. Vale per chi usa l'app su questo PC: chi copia il file del vault o modifica la configurazione aggira il contatore, e lì protegge solo il costo di scrypt.

`master` richiede la password corrente e riscrive il wrapper master; il recupero può impostare una nuova master. In questi casi la **DEK resta la stessa**: chi ha una vecchia copia dell'header e la vecchia password ricava la DEK e decifra anche i dati attuali. Dalla Beta 1.6.0 il cambio master con la spunta «La vecchia password potrebbe essere stata scoperta» (`rotate: true`) e `recovery_new` chiamano `rotate_key`: unione delle copie con la chiave vecchia, nuova DEK casuale, master riavvolta, **nuovo codice di recupero** (quello vecchio è noto solo in forma cifrata e non si può riavvolgere), scrittura di tutti i dati con la nuova DEK, ripristino della chiave e dell'header in memoria se la scrittura fallisce. Da quel momento vecchie password, vecchi codici e vecchie copie dell'header non aprono più i dati scritti dopo; i backup esistenti (`.bak`, cronologia del provider cloud, copie manuali) restano apribili con le credenziali di allora. Non è una revoca delle copie già fatte. Test: `vault_tests::rotating_the_key_retires_old_passwords_and_codes`.

Un'altra sessione aperta (altro PC) che trova il file principale cambiato e non più decifrabile con la propria DEK si blocca con un messaggio invece di riscriverlo con la chiave vecchia (`pull`, errore `REKEYED`); si riapre con la nuova password. Un file illeggibile per altri motivi (scrittura parziale del client cloud) viene solo saltato. Test: `vault_tests::another_open_session_locks_instead_of_overwriting_a_new_key`. Le versioni precedenti alla 1.6.0 non hanno questa protezione: con il vault su più PC vanno aggiornati tutti prima di cambiare la chiave.

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

`Zeroizing` protegge alcuni oggetti chiave Rust al rilascio. Non copre tutte le copie create da serializzazione, `serde_json::Value`, `Vec`, stringhe intermedie, IPC o React. `App.tsx` conserva lo stato senza segreti, l'editor aperto (`draft`, azzerato alla chiusura e da `wipeSession`), i valori mostrati e i risultati del generatore.

### Segreti su richiesta (dalla Beta 1.8.0)

`state` (e lo stato restituito da ogni modifica) passa per `public_item`: dagli elementi toglie i campi in `HIDDEN` (`password`, `totp`, `number`, `cvv`, `pin`, `seed`, `credential`, `webauthn`) e `notes`, e aggiunge `has`, l'elenco di quelli impostati; dallo storico toglie `value`. La finestra principale chiede un valore alla volta quando l'utente lo mostra (`secret`, anche con `field: "history"` per lo storico), apre l'editor di un elemento (`item_full`, senza `webauthn`: la chiave privata delle passkey non arriva mai a una webview) o lo copia: `copy_vault_secret` in `lib.rs` legge il valore con `secret` e lo copia con `clipboard::copy_with_timeout`, senza passare dalla webview. La ricerca nel testo delle note avviene nel backend (`search_notes`, restituisce solo gli id). `item` non cancella un campo che la finestra non invia (lo stato non li contiene): lo cancella solo un valore vuoto esplicito, o il cambio di categoria. `browser_state`, che restituisce il vault completo per il bridge browser e la ricerca rapida, è rifiutato da `api`. Test: `vault_tests::the_main_window_state_carries_no_secret`, `secrets_are_given_one_at_a_time_and_never_the_passkey_key`, `an_update_without_the_secrets_keeps_them`.

Limiti: una webview compromessa può comunque chiedere i segreti uno per uno con `secret` (stessa base fidata di prima); i valori mostrati o aperti nell'editor restano nella memoria JavaScript finché il garbage collector non la riutilizza; la copia dall'editor e dal generatore usa ancora `copy_secret` con il valore già presente nella finestra. Il mascheramento con `type=password` o pallini riguarda la presentazione.

Non risultano `mlock`/`VirtualLock`, memoria non paginabile, integrazione DPAPI/keyring, protezioni contro dump o cancellazione verificabile della memoria JavaScript. La DEK protetta non rende automaticamente sicuro tutto il processo.

[lib.rs](../src-tauri/src/lib.rs) usa clipboard Windows nativa, su worker, senza PowerShell. `clipboard::set` (usato da `copy_secret` e dalla ricerca rapida) aggiunge i formati `ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory` = 0 e `CanUploadToCloudClipboard` = 0, così Windows non salva la copia nella cronologia degli appunti (Win+V) né la sincronizza nel cloud; i gestori di appunti di terze parti possono ignorarli. `clear_secret_if_unchanged` apre gli appunti, confronta e svuota (`EmptyClipboard`, non un testo vuoto) sotto lo stesso guard se il contenuto coincide ancora. Il timer è però avviato dal frontend e mantiene il valore atteso in una closure. La chiusura del processo, la sospensione, i gestori di cronologia e altre applicazioni impediscono di garantire una pulizia globale. Il percorso copiato dalla guida browser usa la stessa API di copia ma non è una credenziale.

## IPC Tauri e file

[tauri.conf.json](../src-tauri/tauri.conf.json) applica CSP: sorgenti script locali, immagini locali/data, connessione IPC, oggetti disabilitati e stile inline consentito. [capabilities/default.json](../src-tauri/capabilities/default.json) include `main`, `quick-fill`, `browser-setup` con `core:default`.

La CSP è una misura utile; non equivale da sola a isolamento dei comandi per finestra. Dalla Beta 1.8.1 ogni finestra può chiamare solo i comandi nativi che il suo codice usa: `build.rs` dichiara tutti i comandi registrati (`AppManifest::commands`), Tauri crea per ciascuno un permesso `allow-<comando>` e lo controlla a ogni chiamata, e `src-tauri/capabilities/` ha un file per finestra (`main.json`, `quick-fill.json`, `quick-search.json`, `browser-setup.json`). Inoltre `api` accetta dalla mini finestra e dalla ricerca rapida solo `unlock` e dalla guida estensioni nessun comando del vault (`api_allowed` in `lib.rs`). Così una mini finestra o una ricerca rapida compromesse non possono esportare il vault, leggere segreti, modificare elementi o cambiare la password principale. `tests/capabilities.test.mjs` (`npm run test:capabilities`, nella CI) legge il codice di ogni finestra e verifica che i permessi coincidano con i comandi che usa, e che `build.rs` elenchi esattamente i comandi di `lib.rs`; `lib.rs` `tests::each_window_sends_only_its_vault_commands` verifica `api_allowed`. La finestra principale conserva tutti i comandi che usa: è l'interfaccia completa del vault. `read_file`, `save_file`, picker, clipboard e vari comandi browser non richiedono lo stesso stato sbloccato del core. Dalla Beta 1.4.0 `read_file` legge solo il file appena scelto dall'utente nel selettore dell'import (`choose_file` con modalità `import`), una volta sola, fino a 20.000.000 byte: una webview non può chiedere al backend di leggere altri file. La valutazione della superficie IPC dipende quindi dalla fiducia nella webview locale.

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

I moduli [browser.rs](../src-tauri/src/browser.rs), [browser_channel.rs](../src-tauri/src/browser_channel.rs), [browser_protocol.rs](../src-tauri/src/browser_protocol.rs) e [helper](../src-tauri/src/bin/jesse_browser_host.rs) implementano:

- Listener solo `127.0.0.1`, porta effimera, token casuale di 32 byte per avvio.
- Descrittore e manifest sotto la directory browser di AppData. Dalla Beta 1.9.2 `connection.json` (porta e token, in chiaro) è scritto da `write_private`: file temporaneo creato con DACL protetta `D:P(A;;FA;;;<SID utente>)(A;;FA;;;SY)` (solo l'utente e SYSTEM, nulla ereditato dalla cartella), poi spostato sopra il vecchio; viene cancellato all'uscita dell'app (`RunEvent::Exit`). Prima ereditava i permessi della cartella, che su un PC osservato includevano un gruppo locale aggiuntivo (`CodexSandboxUsers`) in lettura.
- Autenticazione del primo frame, confronto del token a tempo costante, limite di 262144 byte per frame e scrittura di 2 secondi. Dalla Beta 1.9.2 (`browser_channel::serve`) il primo frame va inviato per intero entro 3 secondi complessivi (prima il limite valeva per ogni lettura, quindi un invio a gocce teneva aperta la connessione), al massimo 8 connessioni attendono l'autenticazione e 16 sono autenticate insieme (le altre vengono chiuse), e oltre 200 messaggi in 10 secondi chiudono il client.
- Argomenti del native host controllati contro gli identificatori ammessi. Questo controllo non prova da solo che il chiamante sia un browser autentico: gli argomenti sono riproducibili da un processo locale.
- Nessuna cifratura TLS del canale loopback. Il token protegge il servizio da un chiamante che non lo conosce, non da codice arbitrario dello stesso utente capace di leggerlo.

Il protocollo espone dal relay i messaggi `hello`, `open`, `context`, `filled`, `passkey`, `passkey-cancel` e `save`, non `Vault::call`. La sessione attiva è unica per l'app, non un contenitore indipendente per ogni browser. Connessioni e thread sono limitati come sopra.

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
- il file scaricato in `%TEMP%` è, dalla Beta 1.4.0, riaperto negando scrittura, rinomina e cancellazione agli altri processi, ricontrollato (dimensione e SHA-256) tramite quello stesso handle e tenuto bloccato fino alla chiusura dell'app (`lock_verified`): un programma dello stesso utente non può sostituirlo fra la verifica e l'avvio con privilegi. Resta il caso in cui il setup in esecuzione rilegga il proprio file dopo la chiusura dell'app;
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

GCM autentica i blob cifrati; dalla Beta 1.6.0 l'header (`v`, sali, wrapper, `hv`) è autenticato dal `mac` con una chiave derivata dalla DEK. `adopt` prende l'header di un'altra copia della cartella solo se ha `hv` più alto **e** `mac` valido: prima un file con un vecchio header e un `hv` gonfiato veniva adottato, riportando in vita una vecchia master o rendendo il vault illeggibile (wrapper di un'altra DEK). Un header senza `mac` (scritto da una versione precedente) non viene adottato, quindi un cambio master fatto da una versione vecchia su un altro PC non si propaga; lo sblocco non richiede il `mac` del file principale, perché la password ha appena aperto il wrapper. Test: `vault_tests::forged_or_unsigned_headers_are_not_adopted`, che fallisce senza il controllo. Dalla Beta 1.7.0 c'è un controllo anti-rollback: ogni scrittura mette nell'header un contatore `wt` (coperto dal `mac`), sempre maggiore di quello già visto anche se l'orologio di un altro PC è avanti; la configurazione del dispositivo conserva per ogni file del vault il valore più alto visto (`seen_writes`). Allo sblocco un file con `wt` minore (o senza `mac` valido, quindi senza un `wt` credibile) è una copia più vecchia rimessa al posto di quella attuale: il vault si apre comunque, non viene riscritto automaticamente e la UI mostra un avviso (`rollback: true`) finché non si salva qualcosa. Protegge da chi può scrivere nella cartella del vault o nel cloud, non da chi può modificare anche la configurazione di questo PC; un PC che non ha mai aperto il vault non ha un riferimento, e lo sblocco dalla mini finestra non mostra l'avviso (lo mostra il successivo sblocco nella finestra principale). Test: `vault_tests::a_vault_file_swapped_with_an_older_copy_is_reported`, `a_file_without_a_valid_mac_cannot_fake_a_newer_write`, `another_pc_with_its_clock_ahead_is_not_a_rollback`. SHA-256 in `loc_move` confronta una copia, non autentica il proprietario del file.

La `.bak` contiene un envelope cifrato precedente. “Eliminazione definitiva” toglie record dalla collezione, e dalla Beta 1.9.0 anche le password storiche dell'elemento (con tombstone); vecchie copie persistono in backup/provider. Non è cancellazione sicura del disco.

Il codice non configura Authenticode per il setup; gli aggiornamenti automatici usano una firma Ed25519 propria (vedere sopra), che non sostituisce la firma del codice di Windows. La chiave pubblica Chromium stabilizza un ID di sviluppo e non firma una release desktop. La firma Mozilla dell'estensione Firefox non è presente nella distribuzione locale.

## Registro delle criticità osservate

Le priorità seguenti sono valutazioni documentali per orientare una futura revisione, non interventi approvati né risultati di uno sfruttamento.

| ID | Evidenza e impatto | Verifica/proposta |
|---|---|---|
| SEC-01 | Attenuata: scadenza su ogni comando, thread di blocco ogni 5 s, `vault-locked` emesso su ogni transizione, `wipeSession` nella UI; collaudo manuale nell'app reale superato (Beta 1.1.19: senza interazione, finestra nel tray, pannello rapido e ricerca rapida) | Media: la memoria JavaScript non è cancellata in modo verificabile (vedere SEC-03) |
| SEC-02 | Attenuata (Beta 1.4.0): rallentamento progressivo dei tentativi di sblocco errati, persistente fra riavvii, testato in `core.rs` | Bassa: il contatore è nella configurazione del dispositivo, non protetta; contro una copia del file vale solo scrypt |
| SEC-03 | Attenuata. Dalla Beta 1.7.0 in Rust sono azzerati (`Zeroizing`) i buffer in chiaro di sblocco, lettura, scrittura e pacchetti, la DEK appena estratta e la password/codice usati per lo sblocco; dalla Beta 1.8.0 la UI principale non riceve più i segreti né il testo delle note nello stato, ma solo su richiesta (mostra, editor) e le copie da schede e storico avvengono nel backend. Restano non azzerati il `serde_json::Value` del vault e i valori aperti nella memoria JavaScript | Media: i segreti richiesti esplicitamente restano nella webview fino al garbage collector |
| SEC-04 | Attenuata (Beta 1.6.0–1.7.0): header autenticato con HMAC dalla DEK e adottato solo se valido; cambio della DEK facoltativo nel cambio master e sempre con un nuovo codice di recupero; wrapper master a scrypt `log_n=17` con migrazione; avviso anti-rollback per dispositivo. Restano i backup storici apribili con le credenziali di allora | Bassa: il riferimento anti-rollback è nella configurazione non protetta del dispositivo |
| SEC-05 | Attenuata: `validate_import` rifiuta payload malformati (il JSON di Bitwarden e l'XML di KeePass passano da lettori dedicati in `importers.rs`; l'XML è letto con `roxmltree` senza DTD, quindi senza espansione di entità), `ensure_shape` garantisce la forma usata da `arr`/`obj`, `import`/`unpack` ripristinano la memoria se falliscono, e un mutex del vault avvelenato da un panic viene recuperato da `AppState::vault` bloccando il vault (dati su disco intatti). Restano `unwrap` interni e nessuno schema completo dei campi | Media: estendere i controlli alle altre route (`item`, `bulk`) e ai mutex di `browser.rs` |
| SEC-06 | Attenuata (Beta 1.8.1): permessi Tauri per finestra (`capabilities/<finestra>.json`, comandi dichiarati in `build.rs`) e `api` limitato per finestra; `read_file` limitato al file scelto per l'import dalla Beta 1.4.0 | Bassa: la finestra principale ha tutti i suoi comandi; nessuna difesa contro codice ostile eseguito come lo stesso utente |
| SEC-07 | Attenuata (Beta 1.9.2): file del token leggibile solo dall'utente e da SYSTEM e cancellato all'uscita, autenticazione con scadenza complessiva e confronto a tempo costante, limiti di connessioni in attesa (8) e autenticate (16), limite di frequenza dei messaggi; test in `browser_channel.rs` su porte locali di prova | Fiducia nello stesso utente: un programma che gira come l'utente può leggere il token o avviare l'helper; nessuna verifica del processo che si collega, nessun TLS sul loopback. Resta la scelta esplicita delle credenziali nella mini finestra |
| SEC-08 | Permessi estensione ampi e confronto PSL tra sottodomini, usato dalla Beta 1.1.20 anche per gli iframe di accesso | Revisionare superficie e casi di delega, preservando scelta esplicita e il rifiuto degli iframe di altri domini registrabili |
| SEC-09 | Attenuata (Beta 1.9.1): estrazioni uniformi con `gen_range` (test chi quadro sulle cifre dei PIN), PIN banali scartati, opzioni validate, bit stimati prudenti per le password generate; `bits` riconosce password comuni con piccole modifiche, ripetizioni e sequenze di tastiera. Passphrase a sillabe (3 × log₂ 70 bit per parola) | Bassa: `bits` resta un'euristica con un elenco breve, senza dizionari né modelli tipo zxcvbn; nessuna certificazione di entropia |

Non esistono test esaustivi dei punti sopra. L'elenco non è una prova dell'assenza di altri problemi. Stato e suggerimenti sono riepilogati in [ROADMAP](ROADMAP.md).
