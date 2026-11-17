# Branding MSI JesseArchive (v5.5 + artwork)

La grafica delle finestre guidate di installazione MSI (WiX) e stata personalizzata
con il logo originale JesseArchive, senza cambiare il codice dell'app o i vault.

- `src-tauri/installer-assets/dialog.bmp` (493x312): grafica benvenuto/conclusione.
- `src-tauri/installer-assets/banner.bmp` (493x58): grafica intestazioni.
- `src-tauri/tauri.conf.json`: `bundle.windows.wix.dialogImagePath` e `bannerPath`.
- `src-tauri/icon.ico`: icona originale del programma, invariata.

## Limite tecnico importante

L'icona esterna del file `.msi` in Esplora file (es. il disco rosso) e gestita
dall'associazione di file di Windows. Non e una proprieta che un MSI possa
personalizzare individualmente: questo intervento NON cambia quell'icona.
Se desideri un *file installer con icona JesseArchive*, serve un setup `.exe`
(NSIS o bootstrapper) correttamente configurato e collaudato.

## Build

```powershell
npm install
cargo test --manifest-path .\src-tauri\Cargo.toml
npm run tauri -- build --bundles msi
```

Poi apri il nuovo MSI e controlla le finestre iniziali e finali: le grafiche
personalizzate devono essere presenti. Compilazione e collaudo Windows non
eseguiti nell'ambiente di preparazione.
