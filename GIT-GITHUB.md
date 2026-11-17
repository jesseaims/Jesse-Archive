# JesseArchive — Git e GitHub

La configurazione e preparata ma **non vengono creati commit o caricati file automaticamente**.

## 1. Installare Git su Windows

Installa Git for Windows: https://git-scm.com/downloads/win
Verifica con `git --version`.

## 2. Inizializzare in locale

Apri PowerShell nella cartella del progetto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Git.ps1
```

Per collegare una repository GitHub vuota appena creata:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup-Git.ps1 -RemoteUrl "https://github.com/UTENTE/REPOSITORY.git"
```

Questo comando configura `origin` ma non autentica l'account e **non** effettua push. Per autenticarti usa Git Credential Manager (incluso normalmente in Git for Windows) oppure GitHub CLI (`gh auth login`). Non condividere token o password in chat.

## 3. Prima del primo commit

```powershell
git status --short
git status --ignored --short
```

Controlla attentamente l'elenco. Non caricare vault personali, file `.env`, certificati, chiavi private, file `.jshare` o database con password. I file `fixtures/legacy_v1_synthetic.json` sono sintetici e destinati ai test.

Per generare eventuali lockfile di dipendenza, da conservare nel repository:

```powershell
npm install
cargo generate-lockfile --manifest-path .\src-tauri\Cargo.toml
```

Quando avremo verificato i file e deciso di creare il commit iniziale:

```powershell
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "chore: initialize JesseArchive beta project"
git push -u origin main
```

**Non eseguire gli ultimi quattro comandi prima di aver verificato il contenuto.**

## 4. Note di sicurezza

- `.gitignore` evita l'aggiunta accidentale di molti file sensibili, ma non protegge file gia tracciati o segreti incollati nei sorgenti.
- Non pubblicare un repository finche non e stato effettuato un controllo dei dati e delle licenze.
- I file `*.ico`, immagini installer e asset grafici non sono segreti e restano versionati.
- Il setup `.exe` e l'MSI non vengono inclusi nel repository; si possono allegare successivamente a una GitHub Release verificata.
- La repository puo essere inizialmente **Private**.
