# Jesse's Archive — Rust + Tauri 2 + React + TypeScript

**Stato:** codice sorgente di migrazione, **non ancora compilato/collaudato su Windows**. Non è una release verificata per custodire credenziali reali. Compilazione, test e correzioni eventuali vanno effettuati prima di usare un vault reale.

## Requisiti Windows 10/11
- Rust stabile MSVC, Cargo, Visual Studio 2022 Build Tools con workload C++ e Windows SDK.
- Node.js LTS e npm.
- Microsoft Edge WebView2 Runtime (normalmente già presente su Windows 11).
- Connessione Internet la prima volta per scaricare dipendenze Cargo/npm.

## Installazione, sviluppo e compilazione

In **PowerShell**, nella directory del progetto:

```powershell
npm install
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npm run tauri dev
npm run tauri -- build --bundles msi
```

I bundle MSI/NSIS verranno prodotti in `src-tauri/target/release/bundle/` dopo una compilazione completata.

La presenza del codice nel pacchetto **non** implica che sia stato compilato. L'ambiente in cui è stato generato non aveva Rust/Cargo e non poteva scaricare i pacchetti npm. I test Rust/React/Windows devono essere realmente eseguiti.

## Struttura

```
src-tauri/src/core.rs    Core Rust: formato legacy v1, CRUD, export/import, generatori, TOTP, sincronizzazione, controlli sicurezza
src-tauri/src/lib.rs     Comandi IPC Tauri, file picker/saver, tray/single instance, interfaccia OS
src-tauri/src/main.rs    Entry point
src/App.tsx              UI React
src/api.ts               Bridge TypeScript IPC
src/types.ts             Modello dati
src/style.css            UI responsive dark premium
fixtures/legacy_v1_synthetic.json   Vettore di test senza credenziali reali
```

## Uso dei vault storici: attenzione

Il formato legacy viene letto direttamente **senza** richiedere una conversione: JSON esterno `v,salt,wrap,rsalt,rwrap,hv,data`; AES-256-GCM con nonce di 12 byte anteposto, tag di 16 byte; scrypt N=32768, r=8, p=1, dklen=32. L'app può utilizzare un vault attraverso la variabile `JESSE_ARCHIVE_VAULT` o la funzione **Collega vault esistente**.

La posizione predefinita di un nuovo vault è `%LOCALAPPDATA%/JesseArchive/jesse_archive.vault`, oppure un vault nella cartella `dati` accanto all'eseguibile se già presente. La configurazione dispositivo si trova in `%APPDATA%/JesseArchive/config.json`.

**Non aprire inizialmente l'unica copia del vault originale.** Eseguire sempre la prima prova su una copia indipendente. Il programma può scrivere nel vault quando esegui salvataggi, importazioni o modifiche delle impostazioni.

Si genera un file `.bak` prima delle scritture. Per motivi di sicurezza la funzione di spostamento copia il vault e ne verifica SHA-256; non elimina quello sorgente. Il motore unisce modifiche usando `updated/upd` e tombstone, ma la sincronizzazione concorrente tra più PC e cloud necessita test dedicati e backup indipendenti.

## Compatibilità delle operazioni

Sono presenti implementazioni Rust per i nomi delle 36 route Python: `status`, `ping`, `create`, `unlock`, `touch`, `lock`, `state`, `item`, `trash`, `delete`, `bulk`, `folder`, `generate`, `pw_save`, `pw_link`, `prefs_set`, `show`, `pw_del`, `pw_bulk`, `health`, `breach`, `totp`, `settings`, `master`, `recovery_new`, `pack`, `unpack`, `export`, `import`, `group_logo`, `group_edit`, `apps`, `app_icon`, `suggest`, `loc_move`, `loc_use`.

Le funzionalità di crittografia, dati, gruppi, sicurezza, esportazione, tema e Windows sono state portate a livello sorgente. **Non tutte le interazioni avanzate della vecchia UI sono state ancora provate in regressione**, inclusi tutte le opzioni di esportazione/importazione, gestione sincronizzazione, tray, autostart, icone delle applicazioni e clipboard. L'archiviazione `passkey` conserva il campo `credential` ma non implementa un autenticatore WebAuthn.

## Test prioritari prima dell'uso reale

1. `cargo test` deve superare fixture AES/scrypt generata col Python originale e test CRUD, TOTP, merge.
2. Apri una **copia** di un vault v1 in una cartella temporanea; sblocca con master e recovery; confronta conteggi e campi con il client Python.
3. Salva una nuova password nella copia e verifica che il client Python possa aprirla, controllando il file `.bak`.
4. Testa tutti i sei tipi di elemento, gestione storico, import/export, condivisione e sync conflittuale tra copie.
5. Testa tray, singola istanza, avvio automatico, clipboard, ridimensionamento e installazione sul tuo Windows.
6. Solo dopo verifica backup **e** restore valuta di migrare i dati personali.

### Privacy e sicurezza

- Non include le credenziali né il vault reale contenuto nell'archivio sorgente.
- Password e segreti transitano momentaneamente in React/JS e IPC: non si può garantire azzeramento della RAM JavaScript.
- Le esportazioni CSV/JSON sono **in chiaro**. Le esportazioni `.jshare` sono cifrate con passphrase.
- Il controllo HIBP invia solo i primi 5 caratteri esadecimali dell'hash SHA-1 (k-anonymity).
- Il download delle favicon viene richiesto esplicitamente; la UI non scarica risorse di terze parti al caricamento.
- Può essere richiesto uno security audit prima dell'impiego in produzione.


## Distribuzione finale offline
Vedi `DISTRIBUZIONE-WINDOWS.md` e `Build-Distribuzione-Windows.ps1` per i bundle EXE/MSI con WebView2 offline.
