# JesseArchive 1.0.2 — Setup EXE offline senza NSIS

## Perché questo pacchetto

Il compilatore NSIS usato da Tauri sul PC Windows ha riportato ripetutamente
`NSISCOMCALL requires 4 parameter(s), passed 7` dentro `IsShortcutTarget`.
L'eseguibile JesseArchive era già compilato: falliva solo il confezionamento NSIS.

**Questa release evita completamente NSIS**: compila il pacchetto MSI di Tauri
(con `webviewInstallMode: offlineInstaller`) e lo incorpora in un singolo setup
`.exe` creato da **Inno Setup**. La procedura MSI rimane quella ufficiale di
Tauri e gestisce installazione, aggiornamenti, collegamenti e disinstallazione.
Il wrapper non aggiunge una seconda voce di disinstallazione.

## Prerequisiti solo sul PC che compila

- Rust/Cargo MSVC, Visual Studio C++ Build Tools, Node.js/npm, come già configurati.
- **Inno Setup 6 o 7** (gratis): https://jrsoftware.org/isinfo.php
- Connessione Internet solo per scaricare eventuali dipendenze di build.

Non sono richiesti Rust, Node.js, Inno Setup né Internet sul PC di destinazione.
Se WebView2 manca, il runtime offline contenuto nell'MSI lo installa.
È possibile che Windows richieda autorizzazione amministratore o riavvio.

## Compilazione

In PowerShell, nella cartella `JesseArchive-Tauri2`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Build-Setup-EXE.ps1"
```

Per saltare `npm install` se già eseguito:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Build-Setup-EXE.ps1" -SkipNpmInstall
```

Genera `src-tauri\target\release\bundle\distributable\JesseArchive-Setup-1.0.2-x64.exe`.
Lo script verifica che il pacchetto MSI sia recente e abbia dimensioni coerenti
con il runtime offline prima di incorporarlo.

**Nota:** il controllo dimensionale non prova da solo la presenza di WebView2;
la configurazione è in `src-tauri/tauri.conf.json`, e la verifica definitiva è
l'installazione offline su PC/VM privo del runtime.

## Installazione e upgrade

- Distribuisci **solo il file EXE generato**, non i sorgenti né il file MSI.
- Il wrapper visualizza le schermate personalizzate di Inno Setup e avvia
  `msiexec /i ... /passive /norestart`, attendendo l'esito dell'MSI.
- La voce di disinstallazione appartiene **solo all'MSI/Tauri**; non si crea
  un secondo disinstallatore. Gli aggiornamenti seguono le regole MSI.
- La gestione di eventuali codici errore MSI è mostrata dal wrapper.
- La configurazione dell'app, il formato `.vault` e le relative chiavi non cambiano.

## Test indispensabili prima della distribuzione

1. `cargo test` e `npm run build` superati; EXE creato da Inno Setup.
2. Installazione in VM Windows 10/11 x64 **offline**, senza WebView2.
3. Creazione, blocco, sblocco e salvataggio di un vault di prova.
4. Aggiornamento da v5.5/v1.0.1 e confronto hash/copie del vault di prova.
5. Disinstallazione da Impostazioni Windows: una sola voce JesseArchive.
6. Controllo firma digitale: senza certificato Authenticode SmartScreen può avvisare.

Non testare su vault reali prima di aver confermato la conservazione dei dati.
Non includere password, `.vault` o codici di recupero nel pacchetto distribuito.

## Limitazioni

Il progetto contiene gli script ma **non** l'EXE compilato: va generato su Windows.
Non posso garantire la compilazione Inno Setup né la compatibilità su ogni PC
finché il test reale non è eseguito. La necessità di autorizzazioni amministratore
non equivale a una dipendenza software da installare manualmente.
