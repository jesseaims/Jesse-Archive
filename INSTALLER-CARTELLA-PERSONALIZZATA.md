# Selezione cartella di installazione (EXE Inno + MSI Tauri)

L'EXE di Inno Setup non installa direttamente JesseArchive: incorpora ed esegue l'MSI WiX/Tauri. Per questo la pagina standard di Inno (`CreateAppDir`) non può governare la destinazione dell'applicazione.

Questa revisione aggiunge una pagina di selezione personalizzata (`CreateInputDirPage`) e inoltra la cartella scelta attraverso la proprietà pubblica `INSTALLDIR` a `msiexec`. Lo script `Build-Setup-EXE.ps1` interroga l'MSI compilato e **interrompe la build** se la tabella `Directory` non contiene `INSTALLDIR`, per evitare una falsa scelta.

## Prova Windows richiesta

1. Compila con `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Build-Setup-EXE.ps1`.
2. Installa su una VM di prova scegliendo, ad esempio, `D:\Applications\JesseArchive` e controlla che `jesse_archive.exe` sia **effettivamente** installato in quel percorso, non in Program Files.
3. Verifica avvio, menu Start, disinstallazione e che un vault sintetico rimanga integro.
4. Prova una reinstallazione/aggiornamento: Windows Installer può mantenere il percorso della precedente installazione e ignorare una nuova cartella. Non usare una modifica del percorso come procedura di migrazione di dati.
5. Verifica l'installazione offline su PC privo di WebView2.

**Non spostare né eliminare vault reali.** La cartella di installazione del programma e la cartella dati sono concetti diversi.

Il sorgente dell'applicazione, il formato cifrato e il backend non sono stati modificati. La compilazione Inno/MSI e il collaudo della destinazione restano da effettuare su Windows.
