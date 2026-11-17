# JesseArchive v5 — gruppi e fluidità Windows

## Modifiche
- Pulsante occhiolino per mostrare/nascondere password nelle schede dei gruppi, indipendente dal tasto Copia. La password torna nascosta al cambio di account.
- Eliminato PowerShell per copia password e pulizia automatica degli appunti. Adesso sono usate API native Windows tramite `clipboard-win` su thread di lavoro, senza nuove finestre console.
- I processi esterni residui per estrazione icona delle app e registro Windows sono avviati con `CREATE_NO_WINDOW`.
- Nessuna modifica al formato del vault, alla cifratura o ai dati salvati.

## Test Windows
1. Chiudi JesseArchive (anche dalla tray), poi `npm install`.
2. `cargo test --manifest-path .\src-tauri\Cargo.toml`.
3. `npm run tauri -- build --bundles msi`.
4. Su un vault di prova: copia una password, apri subito un account, attendi la scadenza del timer degli appunti. Verifica assenza di CMD e responsività.
5. Mostra/nascondi password di gruppo, cambia account e verifica che il segreto sia nuovamente nascosto.
6. Controlla che la pulizia automatica degli appunti non sovrascriva testo copiato successivamente da un'altra app.

La compilazione Windows e il collaudo grafico devono essere eseguiti sul PC Windows; non certificati qui.
