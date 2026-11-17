# Modifiche interfaccia e setup

- Nella schermata **Impostazioni**, in basso a destra, compare **Version 1.0.2**, letta a runtime tramite `@tauri-apps/api/app.getVersion()`. L’etichetta segue così la versione definita nella configurazione Tauri per le release future.
- Inno Setup genera il nome fisso **JesseArchive-Setup.exe** (`OutputBaseFilename=JesseArchive-Setup`).
- `Build-Setup-EXE.ps1` verifica e restituisce il nuovo nome.
- Nessuna modifica al backend, al vault o alla crittografia.

La versione della configurazione Tauri resta 1.0.2; non è stata inventata una dicitura Beta.
