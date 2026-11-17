# JesseArchive — patch v3 (conferma recupero)

## Correzione
- Il pulsante «Ho salvato il codice» ora chiude il dialogo di recupero.
- Il codice di recupero viene rimosso dallo stato React soltanto dopo la conferma.
- Per impedire chiusure accidentali prima della conferma, il dialogo di recupero non presenta pulsante X/Annulla e non si chiude cliccando fuori.
- Nessuna modifica al formato, alla derivazione delle chiavi, alla crittografia o ai file del vault.

## Su Windows
1. Chiudi completamente JesseArchive, anche dall'area di notifica, e verifica che `jesse_archive.exe` non sia in esecuzione.
2. Conserva una copia della cartella precedente e dei vault (non sovrascrivere file `.vault`).
3. Estrai la patch in una nuova cartella. In alternativa copia soltanto `src/App.tsx` nel progetto locale, preservando i tuoi eventuali cambiamenti.
4. Esegui `npm install`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, poi `npm run tauri -- build --bundles msi`.
5. Per provare il fix, usa un vault sintetico in una cartella di test; conferma il recupero e verifica la navigazione nel vault.

## Stato di verifica
Verificata la modifica al codice e l'integrità ZIP. Non sono stati eseguiti qui Cargo, build Windows o test GUI.
