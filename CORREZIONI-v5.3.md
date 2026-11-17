# JesseArchive v5.3 – dialoghi integrati nel tema

## Modifiche
- Rimpiazzati tutti gli `window.confirm`, `window.alert` e `window.prompt` del frontend.
- Dialogo React personalizzato in stile JesseArchive, colori basati sulle variabili del tema, animazione e layout responsive.
- Conferme distruttive con pulsante rosso, annullamento esplicito e supporto al tasto Esc.
- Conferma di eliminazione password dello storico e di verifica account compromessi con testi contestuali.
- Coperti anche importazione, cestino, spostamento/collegamento dei vault, cambio password attiva e cartelle.
- Versione applicazione aumentata a 1.0.1 per distinguere l'installer MSI dalla versione precedente.

## Non modificato
Backend Rust, formato .vault, algoritmi di cifratura, chiavi, struttura dei dati.

## Verifiche
Controllata la sintassi TSX con il parser TypeScript e l'assenza di conferme native nel frontend.
Non compilato né collaudato su Windows in questo ambiente.

## Build
```powershell
npm install
cargo test --manifest-path .\src-tauri\Cargo.toml
npm run tauri -- build --bundles msi
```
Chiudere del tutto JesseArchive prima di ricompilare. Prima di usare dati reali, verificare le operazioni su un vault di prova.
