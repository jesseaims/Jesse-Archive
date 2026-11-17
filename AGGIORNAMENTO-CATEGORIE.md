# JesseArchive — creazione contestuale degli elementi

Modifica rispetto alla distribuzione offline v1.0.2:
- In **Account, Passkey, Note protette, Carte, Identità e Wallet crypto**, i pulsanti **Nuovo elemento** (sia nell'intestazione sia nella raccolta e nello stato vuoto) preselezionano la categoria corrente.
- In **Tutti gli elementi**, **Preferiti**, **Cartelle** e altre viste generali, la categoria iniziale rimane **Account**, con menu categoria modificabile.
- Aprire un elemento esistente continua a usare la sua categoria effettiva.
- Nessuna variazione a Rust, crittografia, database, formato `.vault` o installer offline.

## Compilazione Windows

Dalla cartella del progetto, chiudi completamente JesseArchive, poi esegui:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Build-Setup-EXE.ps1"
```

È richiesto Inno Setup sul PC che compila (come nella distribuzione precedente). Esegui i test su un vault sintetico prima di usare credenziali reali.

## Stato verifiche

Modificati e controllati staticamente i tre call site di creazione. Non è stato possibile eseguire la build TypeScript/Rust in questo ambiente: dipendenze npm non disponibili offline. È necessaria la compilazione sul tuo Windows.
