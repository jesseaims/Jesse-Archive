# Dati, formato del vault e persistenza

Riferimenti canonici: [core.rs](../src-tauri/src/core.rs), [types.ts](../src/types.ts), [api.ts](../src/api.ts). Baseline e metodo in [ARCHITECTURE](ARCHITECTURE.md); dettagli dei primitivi e relativi limiti in [SECURITY](SECURITY.md).

## Nessun database relazionale

Il vault è un singolo file JSON esterno, con payload JSON cifrato. Non ci sono SQL, tabelle fisiche, ORM, connessioni database o migrazioni SQL. `Vault.data` usa `serde_json::Value`; TypeScript descrive una parte dello schema per la UI, senza validazione runtime equivalente.

I nomi `jessamine` e `jessamine-export` rimangono marker di compatibilità nei formati di scambio: non rinominarli per allinearli al branding.

## Percorsi e configurazioni

Ordine di risoluzione in `Vault::new`:

1. Variabile `JESSE_ARCHIVE_VAULT`, se definita.
2. Percorso `vault` nella configurazione dispositivo.
3. `dati/jesse_archive.vault` accanto all'eseguibile, se esiste.
4. Su Windows, `%LOCALAPPDATA%/JesseArchive/jesse_archive.vault`.

La configurazione dispositivo è `%APPDATA%/JesseArchive/config.json`, con percorso del vault e preferenze `close_action`, `zoom` (fattore 0.5–2.0, letto anche a vault bloccato tramite `device_pref`) `update_auto` (controllo automatico degli aggiornamenti, predefinito attivo) e `lang` (lingua dell'interfaccia: `it`, `en`, `es`, `fr`, `de`, `pt`, `ru`, `zh`, `ja`, `ko`; scritta al primo avvio con la lingua rilevata) `quick_search` (dalla Beta 1.1.19: `{enabled, shortcut, close_after, favorites, recent, categories}`, solo preferenze della ricerca rapida globale; gli usati di recente sono nel vault, `settings.recent`) e `window` (dalla Beta 1.1.18: stato della finestra principale, `{x, y, width, height, maximized, fullscreen}` in pixel fisici; dimensione e posizione sono quelle della finestra non massimizzata), `passkeys` e `save_logins` (interruttori delle passkey e della proposta di salvataggio degli account dal browser, predefiniti attivi), `unlock_fails` e `unlock_last_fail` (dalla Beta 1.4.0: tentativi di sblocco errati consecutivi e ora dell'ultimo, per il rallentamento; azzerati dal primo sblocco riuscito). `window` contiene solo numeri e due flag; valori mancanti, danneggiati o su uno schermo non più collegato vengono ignorati e la finestra si apre con la dimensione predefinita, al centro. L'avvio automatico è ricavato dal registro Windows, non da un campo cifrato del vault. Il fallback non Windows passa dalle funzioni `dirs_config`/`dirs_data`, ma la portabilità completa non è collaudata.

| Persistenza distinta | Contenuto e gestione |
|---|---|
| Vault principale | Envelope e dati cifrati; `save`, `atomic_write` |
| File `.bak` | Una precedente copia cifrata, accanto al vault; non uno storico illimitato |
| Configurazione dispositivo | JSON non cifrato: percorso e preferenze locali; `persist_config`, `set_pref` |
| `browser/preferences.json` sotto AppData | Scorciatoia locale, non sincronizzata nel vault |
| `browser/connection.json` sotto AppData | Porta e token per avvio; effimero nel significato, file riscritto all'avvio |
| `browser/chromium.json`, `browser/firefox.json` | Manifest Native Messaging con percorso dell'helper |
| Registro HKCU | Avvio automatico e riferimenti ai manifest per i browser |

Le configurazioni locali non fanno parte degli export del vault. Non leggerne o copiarne i valori reali nella documentazione o nei test.

## Envelope v1

| Campo | Significato |
|---|---|
| `v` | Marcatore di versione scritto come v1; non c'è un dispatcher generale di migrazione/version rejection |
| `salt` | Sale Base64 del wrapper master, 16 byte nella creazione corrente |
| `wrap` | DEK cifrata tramite chiave derivata dalla master |
| `rsalt` | Sale separato Base64 del wrapper di recupero |
| `rwrap` | Stessa DEK protetta dal codice di recupero normalizzato |
| `hv` | Timestamp dell'header, usato anche da `adopt` per il confronto |
| `mac` | Dalla Beta 1.6.0: HMAC-SHA256 Base64 di `v`, `salt`, `wrap`, `rsalt`, `rwrap`, `hv` (JSON con chiavi ordinate) con una chiave derivata dalla DEK (`HMAC(DEK, "jesse-archive header mac v1")`). Riscritto a ogni salvataggio; i vault precedenti lo ricevono al primo salvataggio. Le versioni precedenti lo ignorano e lo conservano. `serde_json` usa `float_roundtrip`: senza, alcuni `hv` riletti dal file differivano di un bit e il `mac` falliva a caso (test `header_mac_survives_writing_and_reading_the_file`) |
| `data` | Payload JSON cifrato con la DEK |

I blob `wrap`, `rwrap`, `data` usano lo stesso encoding `Base64(nonce || ciphertext || tag)`. I timestamp applicativi sono normalmente secondi Unix `f64`; i timestamp delle News sono invece stringhe ISO 8601 e non appartengono al vault.

## Payload logico

`empty` inizializza `items`, `passwords`, `folders`, `deleted`, `settings_upd` e `settings`. `groups` viene aggiunto quando necessario. Le collezioni principali sono array, non mappe indicizzate dal tipo Rust.

| Collezione/campo | Campi rilevanti |
|---|---|
| `items[]` | `id`, `type`, `title`, `folder`, `fav`, `notes`, `f`, `trashed`, `created`, `updated`, `shared`, eventuali `gk`, `src` |
| `passwords[]` | `id`, `value`, `item_id`, `item_title`, `item_type`, `label`, `source`, `active`, `created`, `linked`, `retired`, `upd`, eventuale `orphan_of` |
| `folders[]` | `id`, `name`, `upd` |
| `groups` | Mappa per chiave di presentazione; valori `name`, `icon`, `src`, `upd`, eventuale `tried` per i download |
| `deleted` | Mappa ID → timestamp di eliminazione, condivisa tra collezioni |
| `settings` | `autolock`, `clip`, `old_days`, eventuali `logos`, `theme`, `dashboard`, `recent`, `never_save` |
| `settings_upd` | Timestamp per la scelta delle impostazioni durante il merge |

`id()` produce 6 byte casuali codificati esadecimali, non un UUID completo. Non risultano vincoli formali di unicità tra tutte le collezioni, integrità referenziale a livello storage o indici persistenti.

Il metodo `state` clona il payload e aggiunge `path`, `synced_at`, `prefs` per la UI: questi sono dati di risposta, non nuove tabelle del vault. I tipi di [types.ts](../src/types.ts) non elencano ogni campo legacy, ad esempio tutti gli `upd`/tombstone.

### Campi delle categorie

| `type` persistito | Chiavi di `f` | Collegamento allo storico |
|---|---|---|
| `login` | `url`, `username`, `password`, `totp` | `password` |
| `card` | `holder`, `number`, `expiry`, `cvv`, `pin` | `pin` |
| `note` | Nessun campo strutturato; testo in `notes` | Nessuno |
| `personal` | `fullname`, `email`, `phone`, `address`, `city`, `zip`, `country`, `birthday` | Nessuno |
| `passkey` | `url`, `username`, `credential`; per le passkey WebAuthn anche `webauthn` (nascosto) | Nessun campo `secret`. `webauthn` è JSON `{v:1, alg:-7, rp_id, cred_id, user_handle, key}`, con valori base64url e `key` = scalare privato P-256. Escluso dalla ricerca e dal CSV, incluso nell'export JSON in chiaro. |
| `crypto` | `platform`, `address`, `seed`, `password` | `password` |

`gk` e `src` raggruppano visivamente account web/app/altro. La ricerca rapida usa il sito in `f.url`, non l'etichetta del gruppo, e non deduce un dominio autorizzato dalla sola email dello username.

## CRUD e storico

- `item` clona un elemento esistente oppure ne crea uno; aggiorna campi noti, titolo, timestamp e gruppo. I campi sconosciuti dell'elemento esistente possono sopravvivere alla modifica.
- `link` mantiene una password attiva per elemento e conserva la precedente con `active=false` e `retired`. Se il valore non cambia, evita una nuova revisione. Può riutilizzare una password non collegata con lo stesso valore.
- `pw_save` salva valori indipendenti se non già presenti per valore. `pw_link` sostituisce il campo segreto dell'elemento e aggiorna lo storico; non modifica la password del servizio esterno. Il backend supporta i tipi con `secret`, mentre `PasswordPage` propone solo `login`.
- `trash` imposta o rimuove il timestamp di cestinamento. `delete_ids` toglie elementi e scrive tombstone; le loro password vengono scollegate e conservate come orfane.
- `pw_del`/`pw_bulk` impediscono di eliminare da quello storico una password ancora attiva e collegata. `folder` cancella la cartella ma lascia gli elementi senza cartella.
- `bulk` offre cestino, ripristino, spostamento e cancellazione dal cestino. La route singola `delete` non impone sempre lo stesso vincolo di cestinamento: il controllo UI non va scambiato per un vincolo generale del backend.

Non c'è una transazione con rollback generale: molte operazioni cambiano il JSON in memoria prima del salvataggio e un errore I/O può lasciare quello stato modificato. Fanno eccezione `import` e `unpack`, che passano da `Vault::transact`: se il merge o il salvataggio falliscono, dati, header e firma del file in memoria tornano allo stato precedente. Errori e validazione vanno verificati prima di presentare la persistenza come atomica a livello di intera operazione.

## Scrittura e backup

`save` effettua prima `pull`, cifra l'intero payload, poi usa `atomic_write`:

1. Crea la directory, un temporaneo con suffisso casuale e `create_new`.
2. Scrive e chiama `sync_all` sul file temporaneo.
3. Se esiste un file precedente, lo copia in quello con estensione `.bak`.
4. Tenta la sostituzione tramite rename; su Windows usa un precedente temporaneamente rinominato e un tentativo di ripristino in caso di errore.

Questo riduce il rischio di scritture parziali, ma non implementa transazioni concorrenti, lock file o una garanzia universale contro perdita di alimentazione. Possono restare temporanei in alcuni percorsi d'errore. La directory non viene esplicitamente sincronizzata dal codice.

Non esiste una UI dedicata che ripristini automaticamente la `.bak`. Un ripristino va progettato su copie indipendenti e autorizzato quando riguarda dati reali. I file storici possono contenere dati e wrapper precedenti: non sono cancellazione sicura né revoca delle vecchie credenziali.

## Fusione e cartelle cloud

`sig` usa dimensione e mtime in nanosecondi. `pull` legge una copia cambiata e le copie di conflitto `jesse_archive*.vault` nella directory, tentando la decifratura con la DEK già sbloccata. I fallimenti di lettura/decifratura durante questa ricerca sono ignorati; il Rust non rinomina automaticamente quei file in `.merged`.

`merge_data`:

- Unisce tombstone usando il timestamp maggiore.
- Unisce `items`, `passwords`, `folders` per ID; vince l'intero record con timestamp maggiore, non un merge campo per campo.
- La funzione `ts` privilegia `upd`, poi `updated`, poi `created`: non prende semplicemente il massimo di tutti i campi.
- Un tombstone rimuove il record quando il suo timestamp non è inferiore al timestamp scelto del record.
- Unisce gruppi e impostazioni usando i rispettivi timestamp; poi `normalize` riconcilia cartelle e collegamenti delle password.
- Può aggiornare `rev` e richiedere un nuovo salvataggio mediante `push`.

Le proprietà sconosciute di un record scelto possono essere conservate; ciò non significa che tutte le proprietà top-level sconosciute di una copia remota vengano fuse. Il test `merge_preserves_unknown` copre un caso specifico, non l'intero schema.

Limiti: orologi dei dispositivi non sincronizzati, collisioni di timestamp, copie simultanee, guasti I/O e conflitti di password/header non hanno una copertura esaustiva. Una semplice consultazione `ping/state` può provocare scritture di fusione quando `push` è attivo: non usare l'app come visualizzatore garantito in sola lettura del vault reale.

`discover_cloud_directories` suggerisce percorsi già locali, incluse variabili ambiente, configurazione Dropbox e registro OneDrive. Non carica file in rete. `loc_move`, nonostante il nome, **copia** il vault in una nuova cartella, confronta SHA-256, prova a copiare il backup e cambia il collegamento configurato, conservando l'originale. `loc_use` blocca/resetta la sessione e collega un file esistente. Il vecchio Python può invece spostare e rinominare: non intercambiare i due flussi su dati reali.

## Import/export e condivisione

| Operazione | Dati e comportamento |
|---|---|
| Export JSON | In chiaro: marker `kind`, cartelle, elementi e password, inclusi record non filtrati come nel CSV; non comprende impostazioni/gruppi/tombstone come backup completo |
| Export CSV | In chiaro: elementi non cestinati, campi strutturati, note e nome cartella; niente storico password indipendente. I valori non vengono modificati: quelli che iniziano con `=`, `+`, `-` o `@` diventano formule se il file è aperto con un foglio di calcolo, e la UI lo avverte (dalla Beta 1.4.0) |
| Import JSON | `merge_import`: mappa cartelle per nome, aggiorna elementi per ID/`updated`, aggiunge password per ID; non equivale al merge cloud |
| Import da altri programmi | Dalla Beta 1.5.0 (`importers.rs`). **CSV:** colonne riconosciute per nome (normalizzate: minuscole, solo lettere e cifre) per Bitwarden, LastPass, 1Password, Password di Apple / Safari, Firefox, Dashlane, NordPass, Proton Pass, KeePassXC, RoboForm, Chrome / Edge / Brave / Opera e il CSV di Jesse's Archive; il programma è riconosciuto dall'insieme delle colonne. Le colonne sconosciute sono ignorate salvo diversa scelta nell'anteprima (campo, «aggiungi alle note» o «ignora»); la mappatura viaggia con `import` come `{"Colonna": "campo"}` e campi non ammessi tornano alla scelta automatica. Login con sola email: l'email diventa lo username; senza nome il titolo è il dominio dell'indirizzo o lo username. **JSON di Bitwarden** non cifrato (riconosciuto da `type` numerico, oggetti `login` o flag `encrypted`; quello cifrato è rifiutato con un messaggio): login, note, carte, identità, cartelle, preferiti; campi personalizzati e indirizzi oltre il primo nelle note; passkey non importate. **XML di KeePass 2 / KeePassXC:** un gruppo sotto la radice diventa una cartella («Padre / Figlio» per quelli annidati); cestino e cronologia delle voci saltati; `otp` (KeePassXC) e `TimeOtp-Secret-Base32` (KeePass 2.47+) come TOTP; altri campi nelle note; DTD rifiutati. **Anteprima** (`import_preview`): programma riconosciuto, numero di elementi e, per i CSV, colonne con campo ed esempio (mai per password, CVV, PIN, seed, TOTP); non scrive nulla. Tutti gli import sono atomici (`transact`) |
| Import TXT di Kaspersky | Dalla Beta 1.4.0: file di «Esporta in file di testo» di Kaspersky Password Manager (UTF-8 o UTF-16 con BOM, come lo salva Windows), riconosciuto da righe `---` fra le voci ed etichette note (`Website name`, `Website URL`, `Login name`, `Login`, `Password`, `Comment`, `Text`, anche in italiano). Siti, applicazioni e altri account diventano login, la sezione Note diventa note; commenti su più righe conservati; `Login name` (nell'interfaccia di Kaspersky «Nome dell'account»: il nome dato a ogni account di un sito o di un'applicazione, per esempio «Sea of thieves» dentro «Microsoft Store», diverso da `Login`, che è lo username di accesso) diventa il titolo dell'account, mentre il sito o l'applicazione resta il gruppo; solo per gli «altri account» senza indirizzo, raggruppati per titolo, va nelle note come «Nome account: …»; le voci senza indirizzo ricevono un gruppo per nome (`app:<nome>` con `src: app` per la sezione Applicazioni, `other:<nome>` per le altre, con la stessa chiave di `deriveGroupKey`), perché altrimenti la lista le raggrupperebbe per dominio dell'email; etichette sconosciute ma ripetute (altra lingua) finiscono nelle note; senza nome riconosciuto il titolo è il primo campo della voce. Atomico come gli altri import; se nessuna voce è riconosciuta l'import fallisce |
| Import CSV | Alias per intestazioni comuni, creazione cartelle/ID e riconoscimento tipi; importa valori non vuoti e salta righe senza titolo/URL/username |
| `pack` | Envelope `.jshare` con marker `jessamine`, sale e blob; contiene cartelle, elementi scelti e storico collegato; selezione vuota include tutti gli elementi e password indipendenti |
| `unpack` | Decifra il pacchetto con passphrase e usa `merge_import`; restituisce conteggio e stato |

I nomi delle intestazioni CSV realmente supportate sono nel match di `import_csv`; la presenza di alcuni alias non certifica compatibilità completa con ogni prodotto esterno. Il salvataggio finale crea una `.bak` del file precedente se presente; non c'è un sistema distinto di snapshot prima di ogni possibile mutazione in memoria.

L'export JSON e `pack` non filtrano tutti i dati come il CSV: un pacchetto completo può comprendere cestino e storico. Il flag `shared` è metadato locale, non un'autorizzazione remota o la prova che il file sia stato consegnato. `pack` può modificare quel flag prima della successiva scelta di salvataggio.

La UI principale importa i file `.jshare` tramite `unpack`; altre estensioni sono trattate come import JSON/CSV. Il flusso `.jbackup` e il foglio stampabile appartengono alla UI Python storica, non a una schermata equivalente del client React corrente.

Prima del merge, `validate_import` controlla l'intero payload JSON/`.jshare` e lo **rifiuta tutto** al primo record non valido, indicandone il numero: radice oggetto; `folders`/`items`/`passwords` elenchi; cartelle con `name` stringa; elementi oggetto con `id` non vuoto, `type` tra le sei categorie, `title` stringa o assente, `f` oggetto o assente; password oggetto con `id` non vuoto e `value` stringa. Le proprietà sconosciute dei record validi sono conservate. Un testo che inizia con `{` o `[` è trattato come JSON, il resto come CSV. Non è uno schema completo dei campi di ogni categoria (per esempio formati di data o URL). Vedere SEC-05 in [SECURITY](SECURITY.md).

## Compatibilità e modifiche future

`settings.dashboard` (dalla Beta 1.1.17) contiene il layout della Dashboard: `{version: 1, active, layouts: {default|minimal|security|productivity|custom: {widgets: [{type, size, collapsed, config, x, y}]}}}`, con `x` colonna (0–3) e `y` riga della griglia. Contiene solo tipi di widget, dimensioni, posizioni e opzioni, compresi gli id delle note fissate, e mai segreti. Il backend accetta solo un oggetto di massimo 32 KB; la UI lo normalizza a ogni lettura, scartando widget, dimensioni e opzioni sconosciuti e mettendo nel primo spazio libero i widget senza posizione (configurazioni salvate prima delle posizioni), fuori dalla griglia o sovrapposti, così le versioni vecchie o danneggiate non bloccano la schermata. Viaggia con le altre impostazioni nella fusione delle copie (`settings_upd`).

`settings.never_save` (dalla Beta 1.3.0) è l'elenco dei siti (dominio registrabile, con la porta se presente) in cui l'estensione non propone di salvare gli account: al massimo 500 stringhe non vuote di massimo 260 caratteri, altrimenti il backend rifiuta. Si aggiunge con «Mai per questo sito» e si toglie dalle Impostazioni; è cifrato con il resto del vault.

`settings.recent` (dalla Beta 1.1.19) è l'elenco degli elementi usati di recente, condiviso dal widget «Usati di recente» della Dashboard e dalla ricerca rapida globale: al massimo 12 id di elementi, il più recente per primo, nient'altro. Il backend rifiuta valori che non sono un elenco di stringhe non vuote di massimo 128 caratteri. Gli id di elementi eliminati o nel cestino vengono ignorati in lettura e scartati alla scrittura successiva. Aprire un elemento nella finestra principale, oppure copiarlo, mostrarlo o aprirlo dalla ricerca rapida, salva il vault quando cambia il primo elemento dell'elenco.

Allo sblocco e su ogni copia letta da `pull`, `ensure_shape` aggiunge le collezioni mancanti (`items`, `passwords`, `folders`, `deleted`, `settings_upd`) e rifiuta tipi errati (collezioni che non sono elenchi di oggetti, `deleted`/`groups`/`settings` non oggetti) invece di lasciare che il core vada in panic più tardi; una copia di conflitto rifiutata viene ignorata come le altre copie illeggibili. Non esiste una pipeline generale di migrazione. La fixture certifica una corrispondenza tra scrypt/AES e un payload sintetico Python v1, non la portabilità completa di ogni vault storico.

Ogni modifica futura a schema, KDF, marker, identificatori o regole di merge deve prevedere test con dati sintetici, round trip, preservazione dei campi sconosciuti e casi d'errore. Non modificare automaticamente vault reali per “aggiornarli”. Aggiornare questa pagina, [SECURITY](SECURITY.md), [ARCHITECTURE](ARCHITECTURE.md) e gli altri documenti effettivamente coinvolti secondo [AGENTS.md](../AGENTS.md).
