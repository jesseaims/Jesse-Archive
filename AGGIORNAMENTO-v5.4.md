# JesseArchive v5.4 — Archivio password e firma autore

## Cosa cambia

- Sotto `SECURE VAULT`, nella barra laterale, compare `Made by` con icona Instagram e `samu.vaccc`.
- Il selettore globale `Seleziona account destinazione` è stato eliminato.
- Per ogni password non attiva, il pulsante `Usa per account` apre una finestra in stile applicazione per scegliere l'account da aggiornare.
- Prima dell'applicazione è richiesta un'ulteriore conferma, che chiarisce che la password salvata nel vault viene **sostituita**, mentre la precedente resta nello storico. **La password sul servizio esterno non viene modificata**.
- Nessuna modifica al backend, ai formati di persistenza o alla crittografia.

## Verifiche

- Sintassi TSX controllata con transpiler TypeScript: nessun errore di sintassi.
- Dipendenze non scaricabili nell'ambiente di preparazione: build React e compilazione Windows da eseguire sul PC Windows.

## Compilazione Windows

```powershell
npm install
cargo test --manifest-path .\src-tauri\Cargo.toml
npm run tauri -- build --bundles msi
```

Usare prima un vault sintetico per verificare che la sostituzione aggiorni il campo password dell'account e preservi la password precedente nello storico.
