# JesseArchive — distribuzione Windows offline (v1.0.2)

Questa cartella contiene i **sorgenti**, non un installer già compilato. Serve un PC Windows con Node.js, Rust/Cargo MSVC e Visual Studio C++ Build Tools **solo per compilare**.

## Setup EXE consigliato (un solo file)

Chiudi completamente JesseArchive, apri PowerShell nella cartella principale e lancia:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Build-Distribuzione-Windows.ps1" -Formato exe
```

Il file finale, **solo se il comando termina senza errori**, sarà nella cartella `src-tauri\target\release\bundle\nsis\` e avrà il suffisso `-setup.exe`.

Il logo di JesseArchive è usato come icona del setup NSIS, e nelle immagini dell'installer. La configurazione Tauri incorpora l'**installer offline di WebView2**, perciò la macchina di destinazione non deve avere Internet per scaricare quel prerequisito. **Il PC che compila necessita di Internet la prima volta** per acquisire le dipendenze e il runtime offline (~127 MB).

## Fallback MSI offline

Se NSIS restituisce l'errore storico `NSISCOMCALL` / `IsShortcutTarget`, questa distribuzione NON dichiara l'EXE riuscito. Genera invece il MSI offline con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Build-Distribuzione-Windows.ps1" -Formato msi
```

Output `src-tauri\target\release\bundle\msi\`. Il file MSI resta autosufficiente in merito a WebView2 ma **Windows mantiene la propria icona di associazione per i file `.msi`**. Sono personalizzate le schermate interne dell'installer. NON modificare lo script `.nsi` generato direttamente dentro `target`: viene rigenerato da Tauri.

## Verifica prima di consegnarlo

1. Controlla che `cargo test` e `npm run build` superino i controlli, e che la generazione del bundle termini con successo.
2. Esegui l'installer offline su **Windows 10/11 x64 supportato** in una VM o PC di prova disconnesso da Internet, preferibilmente privo di WebView2. Se il runtime manca, l'installer deve installarlo senza download.
3. Crea un **vault sintetico**, aggiungi una voce, chiudi/riapri, copia password e verifica pulizia appunti, gruppo account e ricerca cartelle cloud.
4. Installa una versione successiva sopra la precedente; verifica che il file `.vault` e `%APPDATA%\JesseArchive` rimangano intatti. Prima, conserva copie di backup separate.
5. Verifica la disinstallazione e la presenza dei collegamenti Windows, senza usare dati reali per questo test.
6. Per distribuire pubblicamente, valuta la **firma Authenticode** del setup: senza firma Windows SmartScreen può mostrare un avviso. La firma richiede un certificato attendibile e non è fornita in questo pacchetto.

## Compatibilità e limiti

L'identificatore dell'app `app.jesse.archive`, la struttura della cifratura e le posizioni del vault **non sono state cambiate**. Il numero versione del bundle è stato incrementato a `1.0.2` per distinguere la distribuzione offline. Installazione predefinita NSIS per utente corrente (non richiede normalmente privilegi amministrativi per i file dell'app; l'installazione di WebView2 può richiedere autorizzazioni in alcuni sistemi).

È un'implementazione di distribuzione da **compilare e collaudare su Windows**: non è stato possibile testare qui i bundle NSIS/MSI o certificare la completa compatibilità offline. Le restrizioni di sicurezza aziendali, architetture diverse da x64 o Windows non supportati possono comunque impedirne l'installazione.

Non includere file `.vault`, password principali o codici di recupero nei file che distribuisci.
