# Catalogo delle funzionalità

Analisi statica del client Beta 1.1.4, baseline `1f09624`, 17 novembre 2026. **Presente** significa collegata nel codice attivo, non collaudata su ogni macchina. **Parziale** indica un limite concreto descritto nella riga. Il client Python è distinto in fondo. Architettura e protocolli: [ARCHITECTURE](ARCHITECTURE.md); protezioni e limiti: [SECURITY](SECURITY.md).

## Vault e credenziali

| Funzionalità | Stato e comportamento | File, moduli e dipendenze | Limiti |
|---|---|---|---|
| Creazione e sblocco | Presente: master password e codice di recupero proteggono due copie della medesima chiave dati | `src/App.tsx`, `src/api.ts`, `src-tauri/src/core.rs`; scrypt, aes-gcm | Nessuna autenticazione remota o biometrica; recupero non equivale a revoca delle copie precedenti |
| Blocco manuale e inattività | Presente: comando di blocco, chiusura finestra principale, scadenza su ogni comando e thread di controllo ogni 5 s; tastiera/clic/rotella contano come attività; la UI azzera lo stato su `vault-locked` | `src/App.tsx`, `src-tauri/src/lib.rs`, `core.rs` | Ritardo fino a circa 5 s; memoria JavaScript non cancellata in modo verificabile; vedere SEC-01 |
| Cambio master e recupero | Presente: ricifratura degli involucri della chiave dati | `core.rs`, impostazioni in `App.tsx` | Non ricifra tutto con una nuova chiave dati; backup precedenti restano autonomamente decifrabili |
| Schede archivio | Presente: login, carta, nota, dati personali, passkey, crypto; creazione, modifica, ricerca, preferiti | `src/types.ts`, `src/App.tsx`, `core.rs` | Passkey è un campo archiviato, senza WebAuthn; crypto non esegue operazioni blockchain |
| Cartelle e cestino | Presente: cartelle, spostamento, selezione multipla, cestinamento, ripristino e cancellazione. Nei riquadri dei gruppi di account: "Elimina account" (una conferma) sposta nel cestino solo l'account mostrato, il cestino nell'intestazione sposta l'intero gruppo con tutti i suoi account non cestinati, anche quelli esclusi dalla ricerca (due conferme che elencano gli account). Le righe delle altre categorie hanno un pulsante elimina con una conferma. Tutte le eliminazioni passano dal Cestino; l'eliminazione definitiva resta nella pagina Cestino | `App.tsx` (`deleteItem`, `deleteGroup`, `AccountGroups`), `core.rs` (`trash`, `bulk`) | Cancellare un elemento può lasciare password storiche non associate; cancellare una cartella non cancella gli elementi |
| Gruppi per servizio | Presente: aggregazione e configurazione visiva, categorie iniziali. Il gruppo (`gk`) viene ricalcolato a ogni salvataggio dal sito o dall'email attuali (account web) o dal titolo (altro), così modificare il sito sposta l'account nel gruppo giusto; resta fisso solo per un'applicazione installata associata esplicitamente. Nella raccolta gli account web sono raggruppati per il sito attuale anche se un vecchio salvataggio conserva un `gk` superato | `App.tsx` (`groupFor`, `deriveGroupKey`, `savedGroupKey`), `core.rs` | La funzione UI `domainOf` non applica la stessa PSL del riempimento browser; non è una barriera di sicurezza |
| Ricerca | Presente: filtri locali su titoli, note e valori dei campi | `App.tsx` | Dati già decifrati nella memoria del frontend; nessun indice cifrato separato |
| Cronologia password | Presente: password attive/ritirate, collegamento agli elementi, eliminazione protetta di quelle attive | `core.rs`, pagina password in `App.tsx` | Assegnazione dalla UI principalmente ai login; backend più generale; non è una cronologia completa delle schede |

Per campi reali, collegamenti e semantica di cancellazione vedere [DATABASE](DATABASE.md). Non chiamare le categorie “plugin”: sono tipi JSON gestiti dall'applicazione.

## Strumenti e personalizzazione

| Funzionalità | Stato e comportamento | File e dipendenze | Limiti |
|---|---|---|---|
| Generatore password | Presente: opzioni e generazione casuale tramite backend | `App.tsx`, `core.rs`; rand | Valutazione della forza euristica; non promettere entropia certificata o uniformità di ogni trasformazione |
| Controllo salute | Presente: deboli, riutilizzate e vecchie tra password attive degli elementi non cestinati | `core.rs`, `App.tsx` | Soglie e stima euristiche; anzianità della password collegata, non audit completo dell'account |
| Controllo compromissione | Presente, su conferma UI: range API Pwned Passwords con prefisso SHA-1 e padding | `core.rs`; reqwest, sha1 | Richiede rete; comunica prefisso hash e metadati di connessione; non invia password intera |
| TOTP | Presente: codice SHA-1 a sei cifre ogni 30 secondi, da Base32 o URI contenente secret | `core.rs`, `App.tsx`; hmac, sha1 | Parametri URI alternativi di algoritmo, cifre e periodo non implementati |
| Appunti | Presente: copia e cancellazione differita condizionata al contenuto ancora uguale | `src-tauri/src/lib.rs`, `App.tsx`; API Windows | Nessuna garanzia contro cronologia appunti, altri processi o copie pregresse |
| Icone dei siti | Presente: recupero DuckDuckGo e memorizzazione nel vault | `core.rs`, `App.tsx`; reqwest | Se abilitate, il salvataggio di un account può avviare la richiesta; dominio visibile al servizio; nessun funzionamento esclusivamente offline garantito |
| Applicazioni locali | Presente su Windows: ricerca collegamenti nel menu Start, icone e apertura | `core.rs`, `App.tsx`; Windows, PowerShell per estrazione icona | Non costituisce un sistema universale di riempimento nelle applicazioni desktop |
| Temi | Presente: otto temi e palette personalizzata | `src/theme.ts`, `src/style.css`, `App.tsx` | Validazione dei colori in UI; core memorizza impostazioni JSON senza schema rigido |
| Avvio e area di notifica | Presente: avvio automatico HKCU Run, `--background`, tray, singola istanza | `core.rs`, `src-tauri/src/lib.rs`; plugin Tauri | Integrazione completa verificabile principalmente su Windows; finestre secondarie possono lasciare il processo attivo |
| Novità e commit | Presente: schede separate con data/ora per voce, formato locale italiano | `src/NewsPanel.tsx`, `src/news-changelog.ts`, `src/commits.generated.json`, `scripts/generate-commits.mjs` | Snapshot commit generato in build, non consultazione live di GitHub; parte della cronologia è ricostruita e segnalata |

## Dati, copie e scambio

| Funzionalità | Stato e comportamento | File e dipendenze | Limiti |
|---|---|---|---|
| Persistenza cifrata | Presente: JSON cifrato, scrittura temporanea e backup precedente `.bak` | `core.rs`; serde_json, aes-gcm | Nessun database SQL, transazione multiprocesso o file lock; dettagli in DATABASE |
| Backup e ripristino completi | Parziale: copia dell'intero vault cifrato e scelta di un vault esistente | `core.rs`, dialoghi in `lib.rs`, `App.tsx` | `.bak` è una sola versione precedente; nessun catalogo automatico/versionamento; `.jbackup` del client storico non ha un dispatcher dedicato nella UI Rust |
| Posizione del vault | Presente: scelta percorso e copia verificata tramite hash nel cambio posizione | `core.rs`, `App.tsx` | `loc_move` Rust conserva l'originale; non chiamarlo cancellazione o spostamento distruttivo |
| Cartella sincronizzata | Parziale: lettura modifiche e fusione record di copie `jesse_archive*.vault` con la stessa chiave | `core.rs` | Il trasporto cloud è esterno; timestamp e record interi, non merge per campo; frontend non ricarica sempre dal solo cambio revisione |
| Esportazione CSV/JSON | Presente: file in chiaro con campi e, per JSON, cronologia | `core.rs`, `App.tsx`, dialoghi `lib.rs` | CSV esclude cestino; JSON non contiene tutte le impostazioni/gruppi/tombstone; non sono backup completi |
| Importazione CSV/JSON | Presente: mapping campi/cartelle e fusione | `core.rs`, `App.tsx` | JSON/`.jshare` validati e rifiutati per intero se un record non è valido; import atomico in memoria; nessuno schema completo dei campi né migrazioni; usare fixture sintetiche |
| Pacchetto protetto `.jshare` | Presente: payload cifrato con password separata, importabile | `core.rs`, `App.tsx`; scrypt, aes-gcm | Selezione supportata dal backend ma percorso UI prevalentemente esportazione completa; non è condivisione collaborativa o revocabile; marcatura shared può precedere un annullamento del dialogo |

## Integrazione browser

| Funzionalità | Stato e comportamento | File e dipendenze | Limiti |
|---|---|---|---|
| Shortcut globale | Presente: combinazione modificabile, predefinita Ctrl+Alt+J, apre pannello rapido | `src/BrowserSettings.tsx`, `src/QuickFill.tsx`, `src-tauri/src/browser.rs`, `lib.rs`; global-shortcut | Richiede applicazione attiva e host/estensione installati; non cattura universalmente i campi di tutte le app |
| Sblocco dal pannello | Presente: vault bloccato → sblocco → account compatibili | `QuickFill.tsx`, `browser.rs`, `core.rs` | Metadati account arrivano alla finestra; segreti inviati soltanto durante il riempimento |
| Riconoscimento sito | Presente: contesto HTTPS e matching del dominio registrabile con PSL, porte e casi IP | `browser.rs`; url, psl | Nessun HTTP; domini privati PSL separati; non equiparare automaticamente tutti i sottodomini a frame autorizzati |
| Selezione account | Presente: lista scorrevole, tastiera, selezione e riempimento username/password | `QuickFill.tsx`, `browser.rs`, `browser-extension/background.js` | Contesto con scadenza; rifiuti se scheda, URL, focus o frame cambiano |
| Riempimento DOM | Presente: setter nativo, eventi input/change, ricerca password e passaggio focus con Tab sintetico | `browser-extension/background.js`; scripting API | Nessun invio form automatico; login multistep richiede nuova invocazione; campi ambigui, iframe di origine diversa, Shadow DOM e widget speciali non garantiti |
| Collegamento nativo | Presente: Native Messaging → helper → TCP locale autenticato → Tauri | `browser_protocol.rs`, `bin/jesse_browser_host.rs`, `browser.rs` | L'host non avvia automaticamente un'app spenta; modello di fiducia dell'utente locale, non isolamento da malware stesso utente |
| Guida installazione | Parziale: rileva eseguibili, registra host HKCU, apre pagina estensioni del browser e cartella | `src/BrowserInstaller.tsx`, `browser_installer.rs`, `browser_navigation.rs` | Chrome, Edge, Brave, Opera, Vivaldi e Firefox previsti; non installa silenziosamente l'estensione; automazione pagina reale verificata precedentemente su Brave, altri browser **Da verificare** |
| Distribuzione estensione | Parziale: ZIP Chromium e Firefox generati dal setup | `scripts/package-browser-extension.mjs`, `browser-extension/*`, script PowerShell | Chromium usa caricamento locale in modalità sviluppatore; Firefox caricamento temporaneo non persistente; nessuna pubblicazione store o firma Mozilla dimostrata |

Entrambi i manifest derivano dal background canonico; modificare le copie generate senza il sorgente non è una manutenzione corretta. Guida utente esistente: [BROWSER-INTEGRATION](../BROWSER-INTEGRATION.md). I limiti di autorizzazione e protocollo sono descritti in [SECURITY](SECURITY.md).

## Distribuzione e codice storico

Il prodotto attivo usa MSI Tauri incorporato in un bootstrapper Inno `.exe`; la procedura completa include helper e pacchetti browser. Esistono controlli automatici Rust, Node/jsdom e una fixture Python, non una copertura end-to-end di ogni funzione. Vedere [DEVELOPMENT](DEVELOPMENT.md).

`legacy-python/` è un client separato: server HTTP locale, pywebview opzionale, UI HTML imperativa, stampa di emergenza, flusso `.jbackup` e comportamenti diversi di blocco/conflitti. Non è una libreria del client Rust e la sua esistenza non prova la disponibilità di tali schermate nella nuova UI.

Non risultano implementati nel client Rust: autenticazione biometrica, uso WebAuthn delle passkey, sincronizzazione cloud con account/API propri, aggiornamento automatico, distribuzione pubblicata e firmata delle estensioni, riempimento universale nelle applicazioni desktop. Non sono impegni di sviluppo: proposte e verifiche sono separate in [ROADMAP](ROADMAP.md).
