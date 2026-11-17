# JesseArchive v5.5 — Ricerca cartelle cloud locali

- La ricerca mostra sempre un esito esplicito, anche quando non vengono trovate cartelle.
- Supporto alle cartelle OneDrive con suffissi personali o aziendali e alle variabili di ambiente OneDrive.
- Su Windows, lettura in sola lettura della configurazione OneDrive dal registro HKCU.
- Supporto ai percorsi Dropbox personalizzati dal file locale `info.json`.
- Riconoscimento di ulteriori cartelle comuni senza scandire ricorsivamente tutto il disco.
- Le cartelle trovate sono solo suggerimenti: cliccarle richiede conferma esplicita prima di copiare il vault.
- Rimane possibile selezionare manualmente qualsiasi cartella, compresi drive virtuali non rilevabili automaticamente.
- Nessuna modifica alla cifratura o al formato dei vault.

**Verifiche ancora necessarie:** `cargo test`, `npm run build`, e `npm run tauri -- build --bundles msi` su Windows; poi test di scansione con e senza OneDrive/Dropbox.
